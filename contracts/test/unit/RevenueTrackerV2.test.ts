/**
 * RevenueTracker V2 단위 테스트 — 31개
 *
 * UUPS 업그레이드: V1 → V2. 기존 storage 보존 + Phase 3 확장 기능 검증.
 *
 * claimRegion / getRegionAttestation / getRegionAttestationPeriods /
 * getCPORegionRevenue / 회귀 테스트 (기존 기능 보존).
 */

import hre from "hardhat";
import { expect } from "chai";
import { ZeroHash } from "ethers";
import {
  expectRevertCustomError,
  b32,
  regionBytes4,
  findEvent,
  findAllEvents,
  deployUUPSProxy,
} from "../helpers/helpers.js";
import type {
  DeviceRegistry,
  StationRegistry,
  RevenueTracker,
  RevenueTrackerV2,
} from "../../typechain-types/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const CPO_1 = b32("CPO-001");
const CPO_2 = b32("CPO-002");
const STN_1 = b32("STATION-001");  // CPO1-owned, Seoul
const STN_2 = b32("STATION-002");  // CPO1-owned, Seoul
const STN_3 = b32("STATION-003");  // EnergyFi-owned, Seoul
const STN_4 = b32("STATION-004");  // EnergyFi-owned, Busan
const STN_5 = b32("STATION-005");  // EnergyFi-owned, Seoul
const STN_6 = b32("STATION-006");  // CPO2-owned, Seoul
const STN_7 = b32("STATION-007");  // CPO2-owned, Busan
const REGION_SEOUL = regionBytes4("KR11");
const REGION_BUSAN = regionBytes4("KR26");
const REGION_DAEGU = regionBytes4("KR27");
const PERIOD = 202606n;
const PERIOD_2 = 202607n;
const OwnerType = { CPO: 0n, ENERGYFI: 1n };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RevenueTracker V2", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let cpoWallet: Awaited<ReturnType<typeof ethers.getSigner>>;

  let stationRegistry: StationRegistry;
  let rtV1: RevenueTracker;
  let rtV2: RevenueTrackerV2;
  let proxyAddress: string;

  /**
   * 공통 setup:
   *  1. DeviceRegistry + StationRegistry 배포
   *  2. RevenueTracker V1 (UUPS proxy) 배포 + initialize
   *  3. 인프라 등록: CPO, 충전소들
   *  4. V1으로 수익 기록 (upgrade 전 데이터 존재)
   *  5. V1에서 CPO 정산 수행 (settlement history 생성)
   *  6. V2 impl 배포 → upgradeToAndCall
   *  7. rtV2 = V2 인터페이스로 프록시 참조
   */
  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    nonAdmin = signers[1];
    cpoWallet = signers[2];

    // Deploy DeviceRegistry
    const { contract: dr } = await deployUUPSProxy<DeviceRegistry>(ethers, "DeviceRegistry");
    await dr.initialize(admin.address);

    // Deploy StationRegistry
    const { contract: sr } = await deployUUPSProxy<StationRegistry>(ethers, "StationRegistry");
    await sr.initialize(admin.address, await dr.getAddress());
    stationRegistry = sr;

    // Deploy RevenueTracker V1 (UUPS proxy)
    const { contract: rt, proxy } = await deployUUPSProxy<RevenueTracker>(ethers, "RevenueTracker");
    rtV1 = rt;
    proxyAddress = await proxy.getAddress();
    await rtV1.initialize(
      await stationRegistry.getAddress(),
      admin.address,  // bridge = admin for testing
      admin.address,
    );

    // Register infrastructure
    await stationRegistry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
    await stationRegistry.registerCPO(CPO_2, cpoWallet.address, "현대충전");
    await stationRegistry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
    await stationRegistry.registerStation(STN_2, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 서초");
    await stationRegistry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
    await stationRegistry.registerStation(STN_4, ZeroHash, OwnerType.ENERGYFI, REGION_BUSAN, "부산 해운대");
    await stationRegistry.registerStation(STN_5, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 마포");
    await stationRegistry.registerStation(STN_6, CPO_2, OwnerType.CPO, REGION_SEOUL, "서울 강서 CPO2");
    await stationRegistry.registerStation(STN_7, CPO_2, OwnerType.CPO, REGION_BUSAN, "부산 사하 CPO2");

    // Record some V1 revenue (pre-upgrade data)
    await rtV1.recordRevenue(STN_1, 5000n, PERIOD);  // CPO1 Seoul
    await rtV1.recordRevenue(STN_2, 3000n, PERIOD);  // CPO1 Seoul
    await rtV1.recordRevenue(STN_3, 8000n, PERIOD);  // EnergyFi Seoul
    await rtV1.recordRevenue(STN_4, 4000n, PERIOD);  // EnergyFi Busan
    await rtV1.recordRevenue(STN_5, 6000n, PERIOD);  // EnergyFi Seoul

    // V1에서 CPO 정산 수행 → settlement history 생성
    await rtV1.claim(CPO_1, PERIOD);

    // Upgrade V1 → V2
    const V2Factory = await ethers.getContractFactory("RevenueTrackerV2");
    const v2Impl = await V2Factory.deploy();
    await v2Impl.waitForDeployment();
    await rtV1.upgradeToAndCall(await v2Impl.getAddress(), "0x");

    // Get V2 interface on same proxy
    rtV2 = (await ethers.getContractAt("RevenueTrackerV2", proxyAddress)) as unknown as RevenueTrackerV2;
  });

  // ── UUPS 업그레이드: V1 → V2 ──────────────────────────────────────────────

  describe("UUPS 업그레이드: V1 → V2", function () {
    it("stationAccumulated와 stationSettled가 보존되어야 한다", async function () {
      // STN_1: V1 CPO claim으로 settled=5000, pending=0
      const [acc1, settled1, pending1] = await rtV2.getStationRevenue(STN_1);
      expect(acc1).to.equal(5000n);
      expect(settled1).to.equal(5000n);
      expect(pending1).to.equal(0n);

      // STN_3: EnergyFi 소유, claim 안 함
      const [acc3, settled3, pending3] = await rtV2.getStationRevenue(STN_3);
      expect(acc3).to.equal(8000n);
      expect(settled3).to.equal(0n);
      expect(pending3).to.equal(8000n);
    });

    it("monthly history가 보존되어야 한다", async function () {
      const amount = await rtV2.getStationRevenuePeriod(STN_1, PERIOD);
      expect(amount).to.equal(5000n);
    });

    it("V1에서 수행한 settlement history가 V2에서도 조회되어야 한다", async function () {
      const history1 = await rtV2.getSettlementHistory(STN_1);
      expect(history1.length).to.equal(1);
      expect(history1[0].amount).to.equal(5000n);

      const history2 = await rtV2.getSettlementHistory(STN_2);
      expect(history2.length).to.equal(1);
      expect(history2[0].amount).to.equal(3000n);
    });
  });

  // ── claimRegion 성공 ────────────────────────────────────────────────────────

  describe("claimRegion 성공", function () {
    it("지역 내 모든 EnergyFi 소유 충전소를 정산해야 한다", async function () {
      const [totalClaimed, stationCount] = await rtV2.claimRegion.staticCall(REGION_SEOUL, PERIOD);
      expect(totalClaimed).to.equal(14000n); // STN_3(8000) + STN_5(6000)
      expect(stationCount).to.equal(2n);
    });

    it("각 충전소의 pending이 0으로 리셋되어야 한다", async function () {
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const [, , pending3] = await rtV2.getStationRevenue(STN_3);
      const [, , pending5] = await rtV2.getStationRevenue(STN_5);
      expect(pending3).to.equal(0n);
      expect(pending5).to.equal(0n);
    });

    it("RegionAttestation이 온체인에 기록되어야 한다", async function () {
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const att = await rtV2.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.regionId).to.equal(REGION_SEOUL);
      expect(att.period_yyyyMM).to.equal(PERIOD);
      expect(att.distributableKrw).to.equal(14000n);
      expect(att.stationCount).to.equal(2n);
      expect(att.finalizedAt).to.be.greaterThan(0n);
    });

    it("RegionSettlementFinalized 이벤트가 emit 되어야 한다", async function () {
      const tx = await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, rtV2, "RegionSettlementFinalized");
      expect(event).to.not.be.null;
      expect(event.args.regionId).to.equal(REGION_SEOUL);
      expect(event.args.totalAmount).to.equal(14000n);
      expect(event.args.stationCount).to.equal(2n);
    });

    it("각 충전소마다 SettlementRecorded 이벤트가 emit 되어야 한다", async function () {
      const tx = await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const receipt = await tx.wait();
      const events = findAllEvents(receipt!, rtV2, "SettlementRecorded");
      // STN_3와 STN_5 두 개의 EnergyFi 소유 충전소
      expect(events.length).to.equal(2);
    });

    it("CPO 소유 충전소는 정산에 포함되지 않아야 한다", async function () {
      // CPO 충전소에 새 수익 추가 (V1 claim으로 기존 pending=0)
      await rtV2.recordRevenue(STN_1, 2000n, PERIOD_2);
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      // CPO 충전소의 새 pending은 claimRegion에 의해 건드려지지 않음
      const [, , pendingCpo1] = await rtV2.getStationRevenue(STN_1);
      expect(pendingCpo1).to.equal(2000n);
    });

    it("여러 EnergyFi 충전소가 있는 지역을 올바르게 처리해야 한다", async function () {
      // Seoul에 STN_3(8000) + STN_5(6000) = 14000
      const tx = await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, rtV2, "RegionSettlementFinalized");
      expect(event.args.totalAmount).to.equal(14000n);
    });
  });

  // ── claimRegion 실패 ────────────────────────────────────────────────────────

  describe("claimRegion 실패", function () {
    it("admin이 아닌 계정이 호출하면 revert", async function () {
      await expectRevertCustomError(
        rtV2.connect(nonAdmin).claimRegion(REGION_SEOUL, PERIOD),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("EnergyFi 충전소가 없거나 모든 pending이 0이면 revert", async function () {
      // Daegu에는 EnergyFi 충전소 없음
      await expectRevertCustomError(
        rtV2.claimRegion(REGION_DAEGU, PERIOD),
        "NothingToClaim",
      );
    });

    it("동일 기간 재호출 시 NothingToClaim revert", async function () {
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      // 두 번째 호출: pending이 모두 0
      await expectRevertCustomError(
        rtV2.claimRegion(REGION_SEOUL, PERIOD),
        "NothingToClaim",
      );
    });

    it("paused 상태에서 호출하면 revert", async function () {
      await rtV2.pause();
      await expectRevertCustomError(
        rtV2.claimRegion(REGION_SEOUL, PERIOD),
        "EnforcedPause",
      );
    });
  });

  // ── claimRegion: period는 라벨 (필터가 아님) ──────────────────────────────

  describe("claimRegion: period는 라벨 (필터가 아님)", function () {
    it("period_yyyyMM과 다른 기간에 기록된 수익도 pending이면 정산되어야 한다", async function () {
      // STN_3에 다른 기간의 수익 추가 기록
      await rtV2.recordRevenue(STN_3, 1000n, PERIOD_2);
      // claimRegion(PERIOD) 호출 — PERIOD는 attestation 라벨일 뿐,
      // 실제로는 해당 지역의 모든 EnergyFi pending을 정산
      const [totalClaimed] = await rtV2.claimRegion.staticCall(REGION_SEOUL, PERIOD);
      // STN_3: 8000(기존) + 1000(추가) = 9000 pending, STN_5: 6000 pending → 총 15000
      expect(totalClaimed).to.equal(15000n);
    });
  });

  // ── getRegionAttestation ────────────────────────────────────────────────────

  describe("getRegionAttestation", function () {
    it("claimRegion 후 올바른 attestation을 반환해야 한다", async function () {
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const att = await rtV2.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(14000n);
      expect(att.stationCount).to.equal(2n);
    });

    it("미확정 기간에 대해 빈 attestation을 반환해야 한다", async function () {
      const att = await rtV2.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(0n);
      expect(att.stationCount).to.equal(0n);
      expect(att.finalizedAt).to.equal(0n);
    });
  });

  // ── getRegionAttestationPeriods ─────────────────────────────────────────────

  describe("getRegionAttestationPeriods", function () {
    it("확정된 기간 목록을 반환해야 한다", async function () {
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      // 추가 수익 기록 후 다른 기간 정산
      await rtV2.recordRevenue(STN_3, 2000n, PERIOD_2);
      await rtV2.claimRegion(REGION_SEOUL, PERIOD_2);

      const periods = await rtV2.getRegionAttestationPeriods(REGION_SEOUL);
      expect(periods.length).to.equal(2);
      expect(periods[0]).to.equal(PERIOD);
      expect(periods[1]).to.equal(PERIOD_2);
    });

    it("attestation이 없으면 빈 배열을 반환해야 한다", async function () {
      const periods = await rtV2.getRegionAttestationPeriods(REGION_SEOUL);
      expect(periods.length).to.equal(0);
    });
  });

  // ── getCPORegionRevenue ─────────────────────────────────────────────────────

  describe("getCPORegionRevenue", function () {
    it("특정 지역의 CPO 충전소 수익만 반환해야 한다", async function () {
      // CPO_1 Seoul: STN_1(5000) + STN_2(3000) = 8000, V1 claim으로 settled=8000
      const [accumulated, settled, pending] = await rtV2.getCPORegionRevenue(CPO_1, REGION_SEOUL);
      expect(accumulated).to.equal(8000n);
      expect(settled).to.equal(8000n);
      expect(pending).to.equal(0n);
    });

    it("다른 지역의 CPO 충전소는 제외해야 한다", async function () {
      // CPO_2: STN_6(Seoul), STN_7(Busan) — 아직 수익 기록 없음
      await rtV2.recordRevenue(STN_6, 3000n, PERIOD);
      await rtV2.recordRevenue(STN_7, 7000n, PERIOD);

      const [accSeoul] = await rtV2.getCPORegionRevenue(CPO_2, REGION_SEOUL);
      expect(accSeoul).to.equal(3000n); // STN_6만

      const [accBusan] = await rtV2.getCPORegionRevenue(CPO_2, REGION_BUSAN);
      expect(accBusan).to.equal(7000n); // STN_7만
    });

    it("해당 지역에 CPO 충전소가 없으면 0을 반환해야 한다", async function () {
      const [accumulated, settled, pending] = await rtV2.getCPORegionRevenue(CPO_1, REGION_BUSAN);
      expect(accumulated).to.equal(0n);
      expect(settled).to.equal(0n);
      expect(pending).to.equal(0n);
    });
  });

  // ── 회귀 테스트: 기존 기능 보존 ─────────────────────────────────────────────

  describe("회귀 테스트: 기존 기능 보존", function () {
    it("recordRevenue가 업그레이드 후에도 동작해야 한다", async function () {
      await rtV2.recordRevenue(STN_1, 2000n, PERIOD);
      const [acc] = await rtV2.getStationRevenue(STN_1);
      expect(acc).to.equal(7000n); // 5000 + 2000
    });

    it("claim (CPO)이 업그레이드 후에도 동작해야 한다", async function () {
      // CPO_1은 V1에서 이미 정산됨. 새 수익 기록 후 재정산.
      await rtV2.recordRevenue(STN_1, 2000n, PERIOD_2);
      const totalClaimed = await rtV2.claim.staticCall(CPO_1, PERIOD_2);
      expect(totalClaimed).to.equal(2000n);
    });

    it("claimPaginated가 업그레이드 후에도 동작해야 한다", async function () {
      await rtV2.recordRevenue(STN_1, 4000n, PERIOD_2);
      await rtV2.recordRevenue(STN_2, 3000n, PERIOD_2);
      const [totalClaimed, processed, hasMore] = await rtV2.claimPaginated.staticCall(CPO_1, PERIOD_2, 0n, 1n);
      expect(totalClaimed).to.equal(4000n); // STN_1만 (limit=1)
      expect(processed).to.equal(1n);
      expect(hasMore).to.equal(true);
    });

    it("claimStation이 업그레이드 후에도 동작해야 한다", async function () {
      await rtV2.recordRevenue(STN_1, 3000n, PERIOD_2);
      const amount = await rtV2.claimStation.staticCall(STN_1, PERIOD_2);
      expect(amount).to.equal(3000n);
    });

    it("getStationRevenue가 올바른 데이터를 반환해야 한다", async function () {
      // STN_3: EnergyFi 소유, V1 claim 미대상
      const [acc, settled, pending] = await rtV2.getStationRevenue(STN_3);
      expect(acc).to.equal(8000n);
      expect(settled).to.equal(0n);
      expect(pending).to.equal(8000n);
    });

    it("getCPORevenue가 올바른 데이터를 반환해야 한다", async function () {
      // CPO_1: V1에서 claim → settled=8000, pending=0
      const [acc, settled, pending] = await rtV2.getCPORevenue(CPO_1);
      expect(acc).to.equal(8000n);
      expect(settled).to.equal(8000n);
      expect(pending).to.equal(0n);
    });

    it("getEnergyFiRegionRevenue가 올바른 데이터를 반환해야 한다", async function () {
      const pending = await rtV2.getEnergyFiRegionRevenue(REGION_SEOUL);
      expect(pending).to.equal(14000n); // STN_3(8000) + STN_5(6000)
    });

    it("getSettlementHistory가 올바른 데이터를 반환해야 한다", async function () {
      // V1 claim → STN_1에 이미 history 1건
      const history = await rtV2.getSettlementHistory(STN_1);
      expect(history.length).to.equal(1);
      expect(history[0].amount).to.equal(5000n);

      // 추가 정산
      await rtV2.recordRevenue(STN_1, 2000n, PERIOD_2);
      await rtV2.claimStation(STN_1, PERIOD_2);
      const history2 = await rtV2.getSettlementHistory(STN_1);
      expect(history2.length).to.equal(2);
      expect(history2[1].amount).to.equal(2000n);
    });

    it("getMonthlyHistory가 올바른 데이터를 반환해야 한다", async function () {
      const history = await rtV2.getMonthlyHistory(STN_1);
      expect(history.length).to.equal(1);
      expect(history[0].period_yyyyMM).to.equal(PERIOD);
      expect(history[0].amount).to.equal(5000n);
    });
  });
});
