/**
 * Phase 1 + Phase 2 자동 셋업 — 테스트 스위트 자립 실행용
 * oracle.ts POST /all + phase2-oracle.ts POST /setup 로직을 공유 함수로 추출
 *
 * Nonce 관리: LiveTestSigner가 로컬 nonce 추적을 담당.
 * 이 모듈에서는 별도의 nonce 관리가 불필요하다.
 */

import {
  encodeBytes32String,
  Wallet,
  getBytes,
  Interface,
} from "ethers";
import type { ContractCtx } from "../context.js";
import { regionBytes4 } from "./utils.js";
import { chipKeyPairs, setupP256Chips } from "./p256-keys.js";
import { extractRevertData, decodeCustomError, type EmitFn } from "./test-helpers.js";

const ChargerType: Record<string, number> = { "완속7kW": 0, "완속11kW": 1, "완속22kW": 2 };

/**
 * idempotent 등록에서 "이미 존재" 에러인지 확인
 * 배포된 컨트랙트 버전에 따라 require 문자열 또는 custom error 사용 가능
 */
function isExpectedRevert(err: unknown, keywords: string[], iface: Interface): boolean {
  const msg = String(err);
  // 1) 키워드 중 하나라도 에러 메시지에 포함
  if (keywords.some(kw => msg.includes(kw))) return true;
  // 2) custom error data 디코딩
  const data = extractRevertData(err);
  const decoded = decodeCustomError([iface], data);
  return decoded !== null && keywords.some(kw => decoded.includes(kw));
}

const STATION_DATA = [
  { id: "STATION-001", regionId: "KR11", location: "서울특별시 강남구 테헤란로 123" },
  { id: "STATION-002", regionId: "KR26", location: "부산광역시 해운대구 해운대해변로 456" },
  { id: "STATION-003", regionId: "KR11", location: "서울특별시 종로구 종로1가 789" },
  { id: "STATION-004", regionId: "KR11", location: "서울특별시 마포구 홍대입구역 101" },
  { id: "STATION-005", regionId: "KR41", location: "경기도 성남시 분당구 판교역로 202" },
];

const CHARGER_DATA = [
  { id: "CHARGER-001", stationId: "STATION-001", type: "완속7kW"  },
  { id: "CHARGER-002", stationId: "STATION-001", type: "완속11kW" },
  { id: "CHARGER-003", stationId: "STATION-001", type: "완속22kW" },
  { id: "CHARGER-004", stationId: "STATION-002", type: "완속7kW"  },
  { id: "CHARGER-005", stationId: "STATION-002", type: "완속22kW" },
  { id: "CHARGER-006", stationId: "STATION-003", type: "완속7kW"  },
  { id: "CHARGER-007", stationId: "STATION-003", type: "완속11kW" },
  { id: "CHARGER-008", stationId: "STATION-003", type: "완속22kW" },
  { id: "CHARGER-009", stationId: "STATION-003", type: "완속22kW" },
  { id: "CHARGER-010", stationId: "STATION-004", type: "완속7kW"  },
  { id: "CHARGER-011", stationId: "STATION-005", type: "완속22kW" },
  { id: "CHARGER-012", stationId: "STATION-005", type: "완속11kW" },
  { id: "CHARGER-013", stationId: "STATION-005", type: "완속7kW"  },
  { id: "CHARGER-014", stationId: "STATION-005", type: "완속22kW" },
  { id: "CHARGER-015", stationId: "STATION-005", type: "완속11kW" },
];

/**
 * Phase 1 bulk 데이터 등록 (idempotent — 이미 등록된 항목은 스킵)
 * 충전소 5개 + 충전기 15개 + SE칩 15개(secp256k1)
 */
export async function ensureBulkData(ctx: ContractCtx, emit?: EmitFn): Promise<void> {
  const log = (msg: string) => {
    if (emit) emit({ type: "setup-ok", label: msg });
  };

  // admin 인스턴스 사용 — enrollChip/registerStation 등은 IDeviceRegistry/IStationRegistry에 없음
  const sr = ctx.stationRegistryAdmin;
  const dr = ctx.deviceRegistryAdmin;
  const srIface = sr.interface as Interface;
  const drIface = dr.interface as Interface;

  /** "already known" = same TX already in mempool (idempotent skip) */
  const isSkippable = (err: unknown, keywords: string[], iface: Interface): boolean => {
    const msg = String(err);
    if (msg.includes("already known")) return true;
    return isExpectedRevert(err, keywords, iface);
  };

  // Stations
  for (const s of STATION_DATA) {
    const sid = encodeBytes32String(s.id);
    const rid = regionBytes4(s.regionId);
    try {
      const tx = await sr.registerStation(sid, rid, s.location);
      await tx.wait();
      log(`충전소 ${s.id} 등록`);
    } catch (err) {
      if (!isSkippable(err, ["StationAlreadyExists", "Station already", "station already"], srIface)) throw err;
    }
  }

  // SE chips (secp256k1, 001~015 — must be enrolled BEFORE registerCharger)
  for (let i = 1; i <= 15; i++) {
    const chargerLabel = `CHARGER-${String(i).padStart(3, "0")}`;
    const cid = encodeBytes32String(chargerLabel);
    try {
      const wallet = Wallet.createRandom();
      const pubBytes = getBytes(wallet.signingKey.publicKey);
      const pub64 = pubBytes.slice(1);
      const tx = await dr.enrollChip(cid, pub64, 0);
      await tx.wait();
      log(`SE칩 ${chargerLabel} 등록`);
    } catch (err) {
      if (!isSkippable(err, ["ChipAlreadyActive", "chip already active"], drIface)) throw err;
    }
  }

  // Chargers (SE chips must be enrolled first — StationRegistry.registerCharger checks isActiveChip)
  for (const c of CHARGER_DATA) {
    const cid = encodeBytes32String(c.id);
    const sid = encodeBytes32String(c.stationId);
    const ct = ChargerType[c.type] ?? 0;
    try {
      const tx = await sr.registerCharger(cid, sid, ct);
      await tx.wait();
      log(`충전기 ${c.id} 등록`);
    } catch (err) {
      if (!isSkippable(err, ["ChargerAlreadyExists", "Charger already", "charger already"], srIface)) throw err;
    }
  }
}

/**
 * Phase 2 P-256 키 셋업 (idempotent — chipKeyPairs가 이미 채워져있으면 스킵)
 */
export async function ensureP256Setup(ctx: ContractCtx, emit?: EmitFn): Promise<void> {
  if (chipKeyPairs.size >= 12) return;
  const logs = await setupP256Chips(ctx);
  if (emit) {
    emit({ type: "setup-ok", label: `P-256 ${chipKeyPairs.size}개 등록 완료` });
  }
}
