/**
 * Suite 1: Phase 1 인프라 — DeviceRegistry + StationRegistry
 * 기존 verify.ts 로직 이관 + 신규 테스트 추가
 * ~28 cases
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
  caseCount: 28, // 31 - 3 (2-2 getCPO, 5-2 getChargersByStation, 5-5 getStationsByRegion 제거 — 비인터페이스)
  requires: "phase1",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    // 인터페이스 인스턴스 — IDeviceRegistry / IStationRegistry 함수만 사용
    const dr = ctx.deviceRegistry;
    const sr = ctx.stationRegistry;
    // Admin 인스턴스 — enrollChip/registerCPO 등 인터페이스에 없는 write ops
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
    const CPO_ID_1     = b32(`P1-${ts}`);
    const CPO_ID_2     = b32(`P2-${ts}`);
    const CPO_ID_GHOST = b32(`PG-${ts}`);
    const STN_CPO      = b32(`SC-${ts}`);
    const STN_EFI      = b32(`SE-${ts}`);
    const STN_INACTIVE = b32(`SI-${ts}`);
    const CHG_ID_1     = b32(`G1-${ts}`);
    const CHG_ID_2     = b32(`G2-${ts}`);
    const CHG_NOGAP    = b32(`GG-${ts}`);
    const CHG_NO_STN   = b32(`GX-${ts}`);
    const CHG_INACT    = b32(`GY-${ts}`);

    const CPO_WALLET   = await ctx.signer.getAddress();
    const REGION_KR11  = regionBytes4("KR11");
    const REGION_EMPTY = "0x00000000";
    const OWNER_CPO    = 0;
    const OWNER_EFI    = 1;

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

    // ── 2. CPO 등록 (2-1, 2-3, 2-4 — 2-2 getCPO 제거: 비인터페이스) ─────

    // 2-1. CPO 등록 성공
    await expectSuccess("2-1 CPO 등록 성공",
      () => srAdmin.registerCPO(CPO_ID_1, CPO_WALLET, "통합테스트 CPO-1"),
      emit, counts);

    // 2-3. 중복 CPO 차단
    await exp("2-3 중복 CPO 차단",
      () => srAdmin.registerCPO(CPO_ID_1, CPO_WALLET, "중복 CPO"),
      "CPOAlreadyExists");

    // 2-4. zero wallet address 차단
    await exp("2-4 zero wallet address 차단",
      () => srAdmin.registerCPO(b32(`PZ-${ts}`), ethers.ZeroAddress, "제로 지갑 CPO"),
      "ZeroWalletAddress");

    // ── 3. 충전소 등록 (3-1 ~ 3-7) ────────────────────────────────────────

    // 3-1. CPO-owned 충전소 등록
    await expectSuccess("3-1 CPO-owned 충전소 등록",
      () => srAdmin.registerStation(STN_CPO, CPO_ID_1, OWNER_CPO, REGION_KR11, "서울 강남구 APT-A"),
      emit, counts);

    // 3-2. ENERGYFI-owned 충전소 등록
    await expectSuccess("3-2 ENERGYFI-owned 충전소 등록",
      () => srAdmin.registerStation(STN_EFI, ethers.ZeroHash, OWNER_EFI, REGION_KR11, "서울 성동구 APT-B"),
      emit, counts);

    // 3-3. 미등록 CPO 차단
    await exp("3-3 미등록 CPO 차단",
      () => srAdmin.registerStation(b32(`SX-${ts}`), CPO_ID_GHOST, OWNER_CPO, REGION_KR11, "없는 CPO"),
      "CPONotFound");

    // 3-4. ENERGYFI + regionId 없음 차단
    await exp("3-4 ENERGYFI + regionId 없음 차단",
      () => srAdmin.registerStation(b32(`SZ-${ts}`), ethers.ZeroHash, OWNER_EFI, REGION_EMPTY, "리전 없음"),
      "RegionRequired");

    // 3-5. CPO + cpoId 없음 차단
    await exp("3-5 CPO + cpoId 없음 차단",
      () => srAdmin.registerStation(b32(`SW-${ts}`), ethers.ZeroHash, OWNER_CPO, REGION_KR11, "CPO ID 없음"),
      "CpoRequired");

    // 3-6. 비활성 CPO 차단
    const cpo2Ready = await setup("CPO-2 등록 후 비활성화", async () => {
      const tx1 = await srAdmin.registerCPO(CPO_ID_2, CPO_WALLET, "통합테스트 CPO-2");
      await tx1.wait();
      const tx2 = await srAdmin.deactivateCPO(CPO_ID_2);
      await tx2.wait();
    }, emit, counts);
    if (cpo2Ready) {
      await exp("3-6 비활성 CPO 차단",
        () => srAdmin.registerStation(b32(`SY-${ts}`), CPO_ID_2, OWNER_CPO, REGION_KR11, "비활성 CPO"),
        "CPONotActive");
    }

    // 3-7. 중복 stationId 차단
    await exp("3-7 중복 stationId 차단",
      () => srAdmin.registerStation(STN_CPO, CPO_ID_1, OWNER_CPO, REGION_KR11, "중복 충전소"),
      "StationAlreadyExists");

    // ── SE칩 사전 등록 (registerCharger는 isActiveChip을 검증) ────────────
    await setup("SE칩 사전 등록 (충전기 테스트용)", async () => {
      for (const cid of [CHG_ID_1, CHG_ID_2, CHG_NO_STN, CHG_INACT]) {
        const tx = await drAdmin.enrollChip(cid, randomPubKey(64), 0);
        await tx.wait();
      }
    }, emit, counts);

    // ── 4. 충전기 등록 (4-1 ~ 4-6) ────────────────────────────────────────

    // 4-1. 충전기 등록 성공
    await expectSuccess("4-1 충전기 등록 성공",
      () => srAdmin.registerCharger(CHG_ID_1, STN_CPO, 0),
      emit, counts);

    // 4-2. 미등록 충전소 차단
    await exp("4-2 미등록 충전소 차단",
      () => srAdmin.registerCharger(CHG_NO_STN, b32(`NS-${ts}`), 1),
      "StationNotFound");

    // 4-3. 중복 충전기 차단
    await exp("4-3 중복 충전기 차단",
      () => srAdmin.registerCharger(CHG_ID_1, STN_CPO, 1),
      "ChargerAlreadyExists");

    // 4-4. 비활성 충전소 차단
    const stnReady = await setup("STN_INACTIVE 등록 후 비활성화", async () => {
      const tx1 = await srAdmin.registerStation(STN_INACTIVE, CPO_ID_1, OWNER_CPO, REGION_KR11, "비활성화될 충전소");
      await tx1.wait();
      const tx2 = await srAdmin.deactivateStation(STN_INACTIVE);
      await tx2.wait();
    }, emit, counts);
    if (stnReady) {
      await exp("4-4 비활성 충전소 차단",
        () => srAdmin.registerCharger(CHG_INACT, STN_INACTIVE, 1),
        "StationNotActive");
    }

    // 4-5. SE칩 미등록 충전기 등록 차단
    await exp("4-5 SE칩 미등록 충전기 등록 차단",
      () => srAdmin.registerCharger(CHG_NOGAP, STN_CPO, 1),
      "ChipNotActive");

    // 4-6. 유효하지 않은 chargerType 차단
    await exp("4-6 유효하지 않은 chargerType(99) 차단",
      () => srAdmin.registerCharger(b32(`GT-${ts}`), STN_CPO, 99),
      "InvalidChargerType");

    // ── 5. 계층 구조 조회 ─────────────────────────────────────────────────
    // 5-1/5-3/5-4 만 남김: IStationRegistry 인터페이스 함수
    // 5-2 getChargersByStation → 비인터페이스, 제거
    // 5-5 getStationsByRegion → 비인터페이스, 제거

    // 5-1. getStationsByCPO 확인 (IStationRegistry 인터페이스)
    await expectValue("5-1 getStationsByCPO 확인",
      () => sr.getStationsByCPO(CPO_ID_1),
      (stns: string[]) => stns.includes(STN_CPO) || `목록에 없음 (${stns.length}개)`,
      emit, counts);

    // 5-3. isEnergyFiOwned CPO=false, EFI=true (IStationRegistry 인터페이스)
    await expectValue("5-3 isEnergyFiOwned CPO=false, EFI=true",
      async () => ({
        cpo: await sr.isEnergyFiOwned(STN_CPO),
        efi: await sr.isEnergyFiOwned(STN_EFI),
      }),
      (r: any) => (r.cpo === false && r.efi === true) || `CPO=${r.cpo}, EFI=${r.efi}`,
      emit, counts);

    // 5-4. getEnergyFiStationsByRegion EFI만 반환 (IStationRegistry 인터페이스)
    await expectValue("5-4 getEnergyFiStationsByRegion EFI만 반환",
      () => sr.getEnergyFiStationsByRegion(REGION_KR11),
      (efiStns: string[]) => {
        const hasEfi = efiStns.includes(STN_EFI);
        const hasCpo = efiStns.includes(STN_CPO);
        if (hasEfi && !hasCpo) return true;
        return `EFI=${hasEfi}, CPO포함=${hasCpo}`;
      },
      emit, counts);

    // ── 6. deactivate 계층 보호 (6-1 ~ 6-3) ──────────────────────────────

    // 6-1. 충전기 있는 충전소 비활성화 차단
    await exp("6-1 충전기 있는 충전소 비활성화 차단",
      () => srAdmin.deactivateStation(STN_CPO),
      "HasActiveChargers");

    // 6-2. 충전소 있는 CPO 비활성화 차단
    await exp("6-2 충전소 있는 CPO 비활성화 차단",
      () => srAdmin.deactivateCPO(CPO_ID_1),
      "HasActiveStations");

    // 6-3. 충전기 비활성화 후 충전소 비활성화 성공
    const chg2Ready = await setup("EFI 충전소에 충전기 등록", async () => {
      const tx = await srAdmin.registerCharger(CHG_ID_2, STN_EFI, 0);
      await tx.wait();
    }, emit, counts);
    if (chg2Ready) {
      await expectSuccess("6-3 충전기 비활성화 후 충전소 비활성화 성공",
        async () => {
          const tx1 = await srAdmin.deactivateCharger(CHG_ID_2);
          await tx1.wait();
          const tx2 = await srAdmin.deactivateStation(STN_EFI);
          return tx2;
        },
        emit, counts);
    }

    return counts;
  },
};
