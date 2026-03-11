/**
 * SE칩 키 관리 + Mock 서명 + 세션 빌더
 *
 * NOTE: RIP-7212 P-256 프리컴파일이 로컬 서브넷에서 미지원. 대상 체인 genesis 설정에서 활성화된 뒤 사용 가능.
 * 현재는 secp256k1 서명(chipType=0)을 사용하여 전체 파이프라인을 검증합니다.
 *
 * 인터페이스 준수 규칙:
 * - buildRandomSession: IStationRegistry 함수만 사용. getChargersByStation/queryFilter 금지.
 *   충전소→충전기 매핑은 bulk-setup에서 등록한 정적 데이터(STATION_CHARGER_MAP)로 해결.
 * - setupP256Chips: enrollChip/revokeChip은 ctx.deviceRegistryAdmin 사용.
 *   ctx.deviceRegistry(IDeviceRegistryABI)에는 isActiveChip만 있음.
 * - generateAndProcessSession: tokenId 추출을 이벤트 파싱 대신
 *   IChargeTransaction.getTokenIdBySessionId() 로 처리.
 */

import {
  encodeBytes32String,
  ethers,
  hexlify,
  getBytes,
  randomBytes,
  Wallet,
  type HDNodeWallet,
} from "ethers";
import type { ContractCtx } from "../context.js";
import { regionBytes4, calculatePeriod, safeDecodeB32 } from "./utils.js";

// ── 정적 매핑 (bulk-setup에서 등록한 데이터와 동일) ───────────────────────────
// IStationRegistry에 getChargersByStation/getCharger가 없으므로 정적 데이터 사용.

/** stationLabel → chargerLabel[] 매핑 */
export const STATION_CHARGER_MAP: Record<string, string[]> = {
  "STATION-001": ["CHARGER-001", "CHARGER-002", "CHARGER-003"],
  "STATION-002": ["CHARGER-004", "CHARGER-005"],
  "STATION-003": ["CHARGER-006", "CHARGER-007", "CHARGER-008", "CHARGER-009"],
  "STATION-004": ["CHARGER-010"],
  "STATION-005": ["CHARGER-011", "CHARGER-012", "CHARGER-013", "CHARGER-014", "CHARGER-015"],
};

/** chargerLabel → chargerType (0=완속7kW, 1=완속11kW, 2=완속22kW) */
const CHARGER_TYPE_MAP: Record<string, number> = {
  "CHARGER-001": 0, "CHARGER-002": 1, "CHARGER-003": 2,
  "CHARGER-004": 0, "CHARGER-005": 2,
  "CHARGER-006": 0, "CHARGER-007": 1, "CHARGER-008": 2, "CHARGER-009": 2,
  "CHARGER-010": 0,
  "CHARGER-011": 2, "CHARGER-012": 1, "CHARGER-013": 0, "CHARGER-014": 2, "CHARGER-015": 1,
};

/** 전체 충전소 레이블 목록 (모두 EnergyFi 소유) */
const ALL_STATION_LABELS = ["STATION-001", "STATION-002", "STATION-003", "STATION-004", "STATION-005"];

// ── 키페어 메모리 맵 ──────────────────────────────────────────────────────────

/** 서버 메모리 키페어 맵: chargerId(bytes32) → { publicKey, wallet } */
export const chipKeyPairs: Map<string, { publicKey: Uint8Array; wallet: HDNodeWallet }> = new Map();

// ── 서명 유틸 ─────────────────────────────────────────────────────────────────

/** secp256k1 Mock 서명 생성 (r||s||v 65바이트 — DeviceRegistry._verifySecp256k1 호환) */
export function generateMockSignature(
  chargerId: string,
  energyKwh: bigint,
  startTimestamp: bigint,
  endTimestamp: bigint,
): Uint8Array {
  const keyPair = chipKeyPairs.get(chargerId);
  if (!keyPair) throw new Error(`No key pair for charger: ${safeDecodeB32(chargerId)}`);

  const msgHash = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "uint256", "uint256", "uint256"],
      [chargerId, energyKwh, startTimestamp, endTimestamp],
    ),
  );

  return getBytes(keyPair.wallet.signingKey.sign(msgHash).serialized);
}

/** secp256k1 키페어 생성 */
export function generateP256KeyPair(): { publicKey: Uint8Array; wallet: HDNodeWallet } {
  const wallet = Wallet.createRandom();
  const pubBytes = getBytes(wallet.signingKey.publicKey);
  const publicKey = pubBytes.slice(1); // 64 bytes (uncompressed, sans 0x04 prefix)
  return { publicKey, wallet };
}

/** 랜덤 UUID → bytes32 */
export function randomSessionId(): string {
  const hex = hexlify(randomBytes(16)).slice(2);
  return "0x" + hex.padEnd(64, "0");
}

/** 랜덤 정수 [min, max] */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── 칩 셋업 ───────────────────────────────────────────────────────────────────

/**
 * SE칩 재등록 (secp256k1).
 * enrollChip/revokeChip은 IDeviceRegistry 인터페이스에 없으므로
 * ctx.deviceRegistryAdmin (full ABI 인스턴스) 을 사용한다.
 */
export async function setupP256Chips(ctx: ContractCtx): Promise<string[]> {
  const logs: string[] = [];
  const dr = ctx.deviceRegistryAdmin; // admin 인스턴스 사용

  for (let i = 1; i <= 12; i++) {
    const chargerLabel = `CHARGER-${String(i).padStart(3, "0")}`;
    const cid = encodeBytes32String(chargerLabel);
    try {
      // isActiveChip은 인터페이스에 있으므로 interface 인스턴스 사용 가능
      const isActive = await ctx.deviceRegistry.isActiveChip(cid);
      if (isActive) {
        const tx = await dr.revokeChip(cid);
        await tx.wait();
      }

      const { publicKey, wallet } = generateP256KeyPair();
      const tx = await dr.enrollChip(cid, publicKey, 0);
      await tx.wait();

      chipKeyPairs.set(cid, { publicKey, wallet });
      logs.push(`${chargerLabel} secp256k1 재등록 완료`);
    } catch (err) {
      const msg = String(err);
      // ChipAlreadyActive: revokeChip 후 재시도
      if (msg.includes("ChipAlreadyActive") || msg.includes("chip already active")) {
        try {
          const tx1 = await dr.revokeChip(cid);
          await tx1.wait();
          const { publicKey, wallet } = generateP256KeyPair();
          const tx2 = await dr.enrollChip(cid, publicKey, 0);
          await tx2.wait();
          chipKeyPairs.set(cid, { publicKey, wallet });
          logs.push(`${chargerLabel} 재등록 완료 (기존 비활성화 후)`);
        } catch (err2) {
          logs.push(`${chargerLabel} 실패: ${String(err2).slice(0, 100)}`);
        }
      } else {
        logs.push(`${chargerLabel} 실패: ${msg.slice(0, 100)}`);
      }
    }
  }

  logs.push(`secp256k1 키페어 ${chipKeyPairs.size}개 서버 메모리에 보관`);
  return logs;
}

// ── 세션 빌더 ─────────────────────────────────────────────────────────────────

/**
 * 랜덤 세션 데이터 빌드.
 *
 * 인터페이스 준수:
 * - 충전소 목록: 정적 ALL_STATION_LABELS + IStationRegistry.getStation() 으로 검증
 * - 충전기 목록: IStationRegistry.getChargersByStation() 없으므로 STATION_CHARGER_MAP 사용
 * - 충전기 타입: IStationRegistry.getCharger() 없으므로 CHARGER_TYPE_MAP 사용
 */
export async function buildRandomSession(
  ctx: ContractCtx,
  stationIdStr?: string,
  regionIdFilter?: string,
): Promise<any> {
  const sr = ctx.stationRegistry; // IStationRegistryABI 인스턴스

  let stationLabel: string;

  if (stationIdStr) {
    stationLabel = stationIdStr;
  } else if (regionIdFilter) {
    // IStationRegistry.getStation() 으로 regionId 검증
    const rid = regionBytes4(regionIdFilter);
    const filtered: string[] = [];
    for (const s of ALL_STATION_LABELS) {
      try {
        const station = await sr.getStation(encodeBytes32String(s));
        if (station.regionId === rid) filtered.push(s);
      } catch { /* skip */ }
    }
    const candidates = filtered.length > 0 ? filtered : ALL_STATION_LABELS;
    const withKeys = candidates.filter(s =>
      (STATION_CHARGER_MAP[s] ?? []).some(c => chipKeyPairs.has(encodeBytes32String(c))),
    );
    const pool = withKeys.length > 0 ? withKeys : candidates;
    if (pool.length === 0) throw new Error("충전소 없음");
    stationLabel = pool[randInt(0, pool.length - 1)];
  } else {
    // 필터 없음 — 모든 충전소
    const withKeys = ALL_STATION_LABELS.filter(s =>
      (STATION_CHARGER_MAP[s] ?? []).some(c => chipKeyPairs.has(encodeBytes32String(c))),
    );
    const pool = withKeys.length > 0 ? withKeys : ALL_STATION_LABELS;
    stationLabel = pool[randInt(0, pool.length - 1)];
  }

  const sid = encodeBytes32String(stationLabel);

  // 충전기 선택 — STATION_CHARGER_MAP 사용 (IStationRegistry.getChargersByStation 없음)
  const chargerLabels = STATION_CHARGER_MAP[stationLabel] ?? [];
  const chargerIds = chargerLabels.map(c => encodeBytes32String(c));
  const validChargers = chargerIds.filter(c => chipKeyPairs.has(c));
  if (validChargers.length === 0) {
    throw new Error(`충전소 ${stationLabel}에 서명 키 등록된 충전기가 없습니다`);
  }
  const chargerId = validChargers[randInt(0, validChargers.length - 1)];
  const chargerLabel = safeDecodeB32(chargerId);
  // 충전기 타입 — CHARGER_TYPE_MAP 사용 (IStationRegistry.getCharger 없음)
  const chargerType = CHARGER_TYPE_MAP[chargerLabel] ?? 0;

  // 충전소 메타 — IStationRegistry.getStation 사용 (인터페이스에 있음)
  const station = await sr.getStation(sid);
  const regionId = station.regionId;

  const energyKwh = BigInt(randInt(500, 8000));
  const rate = BigInt(randInt(200, 400));
  const distributableKrw = (energyKwh * rate) / 100n;
  const now = Math.floor(Date.now() / 1000);
  const duration = randInt(1800, 10800);
  const endTimestamp = BigInt(now);
  const startTimestamp = BigInt(now - duration);

  const seSignature = generateMockSignature(chargerId, energyKwh, startTimestamp, endTimestamp);

  return {
    sessionId: randomSessionId(),
    chargerId,
    chargerType,
    energyKwh,
    startTimestamp,
    endTimestamp,
    vehicleCategory: 0,
    gridRegionCode: regionId,
    stationId: sid,
    distributableKrw,
    seSignature: hexlify(seSignature),
  };
}

/** 정상 세션 생성 + processCharge 호출 */
export async function generateAndProcessSession(
  ctx: ContractCtx,
  stationIdStr?: string,
  regionIdFilter?: string,
) {
  const session = await buildRandomSession(ctx, stationIdStr, regionIdFilter);
  const period = calculatePeriod(Number(session.endTimestamp));

  const cr = ctx.chargeRouter!;
  const ct = ctx.chargeTransaction!;
  const tx = await cr.processCharge(session, period);
  await tx.wait();

  // tokenId 추출: IChargeTransaction.getTokenIdBySessionId 사용 (인터페이스에 있음)
  // ChargeProcessed 이벤트 파싱 불가 — IChargeRouterABI에 이벤트 선언 없음
  let tokenId = "?";
  try {
    const tid = await ct.getTokenIdBySessionId(session.sessionId);
    tokenId = tid.toString();
  } catch { /* non-critical */ }

  const stationName = safeDecodeB32(session.stationId as string);

  return {
    ok: true,
    message: `Token #${tokenId}: ${stationName} | ${Number(session.energyKwh) / 100} kWh | ${session.distributableKrw}원`,
    tokenId,
    sessionId: session.sessionId,
  };
}

/** revert 메시지 추출 */
export function extractRevertReason(msg: string): string {
  const customMatch = msg.match(/reverted with custom error '([^']+)'/);
  if (customMatch) return customMatch[1];
  const reasonMatch = msg.match(/reason="([^"]+)"/);
  if (reasonMatch) return reasonMatch[1];
  if (msg.includes("reverted")) return msg.slice(0, 120);
  return msg.slice(0, 120);
}
