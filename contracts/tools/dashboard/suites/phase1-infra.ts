/**
 * Suite 1: Phase 1 인프라 — DeviceRegistry + StationRegistry
 * 기존 verify.ts 로직 이관 + 신규 테스트 추가
 * ~20 cases
 */

import { ethers } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../server.js";
import {
  b32, regionBytes4, randomPubKey, newCounts,
  expectRevert, setup, expectSuccess, expectValue,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";

export const phase1InfraSuite: TestSuite = {
  id: "phase1-infra",
  label: "Phase 1 인프라",
  caseCount: 20,
  requires: "phase1",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    // 인터페이스 인스턴스 — IDeviceRegistry / IStationRegistry 함수만 사용
    const dr = ctx.deviceRegistry;
    const sr = ctx.stationRegistry;
    // Admin 인스턴스 — enrollChip/registerStation 등 인터페이스에 없는 write ops
    const drAdmin = ctx.deviceRegistryAdmin;
    const srAdmin = ctx.stationRegistryAdmin;
    // 에러 디코딩용 ifaces — admin ABI에 커스텀 에러 선언 포함
    const ifaces = [drAdmin.interface, srAdmin.interface];
    const counts = newCounts();

    const ts = Date.now();
    const exp = (label: string, txFn: () => Promise<unknown>, expected: string) =>
      expectRevert(label, txFn, expected, ifaces, emit, counts);

    // ── Test IDs ──────────────────────────────────────────────────────────
    const CHIP_ID_1    = b32(`C1-${ts}`);
    const PUB_KEY_64   = randomPubKey(64);
    const PUB_KEY_32   = randomPubKey(32);
    const STN_A        = b32(`SA-${ts}`);
    const STN_B        = b32(`SB-${ts}`);
    const STN_INACTIVE = b32(`SI-${ts}`);
    const CHG_ID_1     = b32(`G1-${ts}`);
    const CHG_ID_2     = b32(`G2-${ts}`);
    const CHG_NOGAP    = b32(`GG-${ts}`);
    const CHG_NO_STN   = b32(`GX-${ts}`);
    const CHG_INACT    = b32(`GY-${ts}`);

    const REGION_KR11  = regionBytes4("KR11");
    const REGION_EMPTY = "0x00000000";

    // ── 1. SE칩 등록 (1-1 ~ 1-6) ──────────────────────────────────────────

    // 1-1. SE칩 등록 성공
    await expectSuccess("1-1 SE칩 등록 성공",
      () => drAdmin.enrollChip(CHIP_ID_1, PUB_KEY_64, 1),
      emit, counts);

    // 1-2. isActiveChip → true 확인 (IDeviceRegistry 인터페이스 함수)
    await expectValue("1-2 isActiveChip → true 확인",
      () => dr.isActiveChip(CHIP_ID_1),
      (active) => active === true || `false 반환됨`,
      emit, counts);

    // 1-3. 중복 chargerId 차단
    await exp("1-3 중복 chargerId 차단",
      () => drAdmin.enrollChip(CHIP_ID_1, PUB_KEY_64, 1),
      "ChipAlreadyActive");

    // 1-4. 잘못된 publicKey 길이 차단
    await exp("1-4 잘못된 publicKey 길이(32) 차단",
      () => drAdmin.enrollChip(b32(`C2-${ts}`), PUB_KEY_32, 1),
      "InvalidPublicKeyLength");

    // 1-5. zero chargerId 차단
    await exp("1-5 zero chargerId 차단",
      () => drAdmin.enrollChip(ethers.ZeroHash, PUB_KEY_64, 1),
      "ZeroChargerId");

    // 1-6. 동일 publicKey 중복 등록 차단
    await exp("1-6 동일 publicKey 중복 등록 차단",
      () => drAdmin.enrollChip(b32(`C3-${ts}`), PUB_KEY_64, 1),
      "PublicKeyAlreadyRegistered");

    // ── 2. 충전소 등록 (2-1 ~ 2-4) ──────────────────────────────────────

    // 2-1. 충전소 등록 성공
    await expectSuccess("2-1 충전소 등록 성공",
      () => srAdmin.registerStation(STN_A, REGION_KR11, "서울 강남구 APT-A"),
      emit, counts);

    // 2-2. 두 번째 충전소 등록 성공
    await expectSuccess("2-2 두 번째 충전소 등록 성공",
      () => srAdmin.registerStation(STN_B, REGION_KR11, "서울 성동구 APT-B"),
      emit, counts);

    // 2-3. regionId 없음 차단
    await exp("2-3 regionId 없음 차단",
      () => srAdmin.registerStation(b32(`SZ-${ts}`), REGION_EMPTY, "리전 없음"),
      "RegionRequired");

    // 2-4. 중복 stationId 차단
    await exp("2-4 중복 stationId 차단",
      () => srAdmin.registerStation(STN_A, REGION_KR11, "중복 충전소"),
      "StationAlreadyExists");

    // ── SE칩 사전 등록 (registerCharger는 isActiveChip을 검증) ────────────
    await setup("SE칩 사전 등록 (충전기 테스트용)", async () => {
      for (const cid of [CHG_ID_1, CHG_ID_2, CHG_NO_STN, CHG_INACT]) {
        const tx = await drAdmin.enrollChip(cid, randomPubKey(64), 0);
        await tx.wait();
      }
    }, emit, counts);

    // ── 3. 충전기 등록 (3-1 ~ 3-6) ──────────────────────────────────────

    // 3-1. 충전기 등록 성공
    await expectSuccess("3-1 충전기 등록 성공",
      () => srAdmin.registerCharger(CHG_ID_1, STN_A, 0),
      emit, counts);

    // 3-2. 미등록 충전소 차단
    await exp("3-2 미등록 충전소 차단",
      () => srAdmin.registerCharger(CHG_NO_STN, b32(`NS-${ts}`), 1),
      "StationNotFound");

    // 3-3. 중복 충전기 차단
    await exp("3-3 중복 충전기 차단",
      () => srAdmin.registerCharger(CHG_ID_1, STN_A, 1),
      "ChargerAlreadyExists");

    // 3-4. 비활성 충전소 차단
    const stnReady = await setup("STN_INACTIVE 등록 후 비활성화", async () => {
      const tx1 = await srAdmin.registerStation(STN_INACTIVE, REGION_KR11, "비활성화될 충전소");
      await tx1.wait();
      const tx2 = await srAdmin.deactivateStation(STN_INACTIVE);
      await tx2.wait();
    }, emit, counts);
    if (stnReady) {
      await exp("3-4 비활성 충전소 차단",
        () => srAdmin.registerCharger(CHG_INACT, STN_INACTIVE, 1),
        "StationNotActive");
    }

    // 3-5. SE칩 미등록 충전기 등록 차단
    await exp("3-5 SE칩 미등록 충전기 등록 차단",
      () => srAdmin.registerCharger(CHG_NOGAP, STN_A, 1),
      "ChipNotActive");

    // 3-6. 유효하지 않은 chargerType 차단
    await exp("3-6 유효하지 않은 chargerType(99) 차단",
      () => srAdmin.registerCharger(b32(`GT-${ts}`), STN_A, 99),
      "InvalidChargerType");

    // ── 4. 계층 구조 조회 ─────────────────────────────────────────────────

    // 4-1. getStationsByRegion EFI 충전소 반환 (IStationRegistry 인터페이스)
    await expectValue("4-1 getStationsByRegion 충전소 반환",
      () => sr.getStationsByRegion(REGION_KR11),
      (stns: string[]) => {
        const hasA = stns.includes(STN_A);
        const hasB = stns.includes(STN_B);
        if (hasA && hasB) return true;
        return `A=${hasA}, B=${hasB}`;
      },
      emit, counts);

    // ── 5. deactivate 계층 보호 (5-1 ~ 5-2) ──────────────────────────────

    // 5-1. 충전기 있는 충전소 비활성화 차단
    await exp("5-1 충전기 있는 충전소 비활성화 차단",
      () => srAdmin.deactivateStation(STN_A),
      "HasActiveChargers");

    // 5-2. 충전기 비활성화 후 충전소 비활성화 성공
    const chg2Ready = await setup("STN_B에 충전기 등록", async () => {
      const tx = await srAdmin.registerCharger(CHG_ID_2, STN_B, 0);
      await tx.wait();
    }, emit, counts);
    if (chg2Ready) {
      await expectSuccess("5-2 충전기 비활성화 후 충전소 비활성화 성공",
        async () => {
          const tx1 = await srAdmin.deactivateCharger(CHG_ID_2);
          await tx1.wait();
          const tx2 = await srAdmin.deactivateStation(STN_B);
          return tx2;
        },
        emit, counts);
    }

    return counts;
  },
};
