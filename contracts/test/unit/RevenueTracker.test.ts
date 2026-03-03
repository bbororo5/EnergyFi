/**
 * RevenueTracker 통합 테스트
 *
 * UUPS Proxy. StationRegistry와 연동하여 충전소별 수익 추적.
 *
 * R04: Pausable — pause/unpause, whenNotPaused on recordRevenue/claim.
 * R05: Bridge rotation — updateBridgeAddress().
 * T01: 데이터 정합성 교차 검증 (CPO 총수익 = 소속 충전소 수익 합).
 * T02: 월경계 정산 독립성.
 * T05: View 함수 커버리지 강화.
 */

import hre from "hardhat";
import { expect } from "chai";
import { ZeroHash } from "ethers";
import {
  expectRevert,
  expectRevertCustomError,
  b32,
  regionBytes4,
  findEvent,
  findAllEvents,
  deployUUPSProxy,
} from "../helpers/helpers.js";
import type { DeviceRegistry, RevenueTracker, StationRegistry } from "../../typechain-types/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const CPO_1 = b32("CPO-001");
const CPO_2 = b32("CPO-002");
const CPO_99 = b32("CPO-999");
const STN_1 = b32("STATION-001");
const STN_2 = b32("STATION-002");
const STN_3 = b32("STATION-003");
const STN_4 = b32("STATION-004");
const STN_99 = b32("STATION-999");
const REGION_SEOUL = regionBytes4("KR11");
const REGION_BUSAN = regionBytes4("KR26");
const PERIOD = 202606n;
const PERIOD_2 = 202607n;
const PERIOD_3 = 202605n;
const OwnerType = { CPO: 0n, ENERGYFI: 1n };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RevenueTracker", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let cpoWallet: Awaited<ReturnType<typeof ethers.getSigner>>;
  let newBridge: Awaited<ReturnType<typeof ethers.getSigner>>;

  let stationRegistry: StationRegistry;
  let rt: RevenueTracker;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    nonAdmin = signers[1];
    cpoWallet = signers[2];
    newBridge = signers[3];

    // Deploy DeviceRegistry (UUPS proxy, needed for StationRegistry)
    const { contract: dr } = await deployUUPSProxy<DeviceRegistry>(ethers, "DeviceRegistry");
    await dr.initialize(admin.address);

    // Deploy StationRegistry (UUPS proxy)
    const { contract: sr } = await deployUUPSProxy<StationRegistry>(ethers, "StationRegistry");
    await sr.initialize(admin.address, await dr.getAddress());
    stationRegistry = sr;

    // Deploy RevenueTracker (UUPS proxy)
    const { contract: rtContract } = await deployUUPSProxy<RevenueTracker>(ethers, "RevenueTracker");
    rt = rtContract;
    await rt.initialize(
      await stationRegistry.getAddress(),
      admin.address, // bridge = admin for testing
      admin.address
    );

    // Setup infrastructure
    await stationRegistry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
    await stationRegistry.registerCPO(CPO_2, cpoWallet.address, "현대충전");
    await stationRegistry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
    await stationRegistry.registerStation(STN_2, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 서초");
    await stationRegistry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
    await stationRegistry.registerStation(STN_4, ZeroHash, OwnerType.ENERGYFI, REGION_BUSAN, "부산 해운대");
  });

  // ── recordRevenue 성공 ─────────────────────────────────────────────────────

  describe("recordRevenue 성공", function () {
    it("수익 누적 정확성", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_1, 3000n, PERIOD);

      const [accumulated, settled, pending] = await rt.getStationRevenue(STN_1);
      expect(accumulated).to.equal(8000n);
      expect(settled).to.equal(0n);
      expect(pending).to.equal(8000n);
    });

    it("월별 이력 정확성 — 동일 월 합산", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_1, 3000n, PERIOD);

      const amount = await rt.getStationRevenuePeriod(STN_1, PERIOD);
      expect(amount).to.equal(8000n);
    });

    it("월별 이력 — 다른 월 별도 기록", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_1, 7000n, PERIOD_2);

      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD)).to.equal(5000n);
      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD_2)).to.equal(7000n);
    });

    // B-1: 이벤트 파라미터 검증
    it("RevenueRecorded 이벤트 파라미터 검증", async function () {
      const tx = await rt.recordRevenue(STN_1, 5000n, PERIOD);
      const receipt = await tx.wait();

      const event = findEvent(receipt!, rt, "RevenueRecorded");
      expect(event, "RevenueRecorded 이벤트가 emit되어야 한다").to.not.be.null;
      expect(event!.args.stationId).to.equal(STN_1);
      expect(event!.args.distributableKrw).to.equal(5000n);
      expect(event!.args.accumulated).to.equal(5000n);
      expect(event!.args.period_yyyyMM).to.equal(PERIOD);
    });

    it("연속 기록 시 accumulated 누적 반영된 이벤트", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);

      const tx2 = await rt.recordRevenue(STN_1, 3000n, PERIOD);
      const receipt2 = await tx2.wait();

      const event2 = findEvent(receipt2!, rt, "RevenueRecorded");
      expect(event2).to.not.be.null;
      expect(event2!.args.distributableKrw).to.equal(3000n);
      expect(event2!.args.accumulated).to.equal(8000n); // 5000 + 3000
    });

    // B-3: 비순차 월 기록 (A-1 _monthlyIndex 수정 검증)
    it("비순차 월 기록 — 월 7 → 월 6 → 월 7 추가", async function () {
      // Record July first
      await rt.recordRevenue(STN_1, 3000n, PERIOD_2);
      // Record June (out of order)
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      // Add more to July (requires correct index lookup)
      await rt.recordRevenue(STN_1, 2000n, PERIOD_2);

      // Verify mapping values
      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD)).to.equal(5000n);
      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD_2)).to.equal(5000n); // 3000 + 2000

      // Verify array history (order = insertion order)
      const history = await rt.getMonthlyHistory(STN_1);
      expect(history.length).to.equal(2);
      // First entry: July (first recorded)
      expect(history[0].period_yyyyMM).to.equal(PERIOD_2);
      expect(history[0].amount).to.equal(5000n); // 3000 + 2000
      // Second entry: June
      expect(history[1].period_yyyyMM).to.equal(PERIOD);
      expect(history[1].amount).to.equal(5000n);

      // Accumulated total should be correct
      const [accumulated] = await rt.getStationRevenue(STN_1);
      expect(accumulated).to.equal(10000n); // 3000 + 5000 + 2000
    });

    it("3개 이상 비순차 월 기록 정합성", async function () {
      // Record months out of order: Jul → May → Jun → May → Jul
      await rt.recordRevenue(STN_1, 1000n, PERIOD_2);  // Jul
      await rt.recordRevenue(STN_1, 2000n, PERIOD_3);  // May
      await rt.recordRevenue(STN_1, 3000n, PERIOD);    // Jun
      await rt.recordRevenue(STN_1, 500n, PERIOD_3);   // May again
      await rt.recordRevenue(STN_1, 1500n, PERIOD_2);  // Jul again

      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD_2)).to.equal(2500n);
      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD_3)).to.equal(2500n);
      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD)).to.equal(3000n);

      const history = await rt.getMonthlyHistory(STN_1);
      expect(history.length).to.equal(3);

      const [accumulated] = await rt.getStationRevenue(STN_1);
      expect(accumulated).to.equal(8000n);
    });

    it("getMonthlyHistory — 기록 없는 충전소는 빈 배열", async function () {
      const history = await rt.getMonthlyHistory(STN_1);
      expect(history.length).to.equal(0);
    });
  });

  // ── recordRevenue 실패 ─────────────────────────────────────────────────────

  describe("recordRevenue 실패", function () {
    it("StationNotRegistered — 미등록 stationId", async function () {
      await expectRevertCustomError(
        rt.recordRevenue(STN_99, 5000n, PERIOD),
        "StationNotRegistered"
      );
    });

    it("ZeroAmount — distributableKrw = 0", async function () {
      await expectRevertCustomError(
        rt.recordRevenue(STN_1, 0n, PERIOD),
        "ZeroAmount"
      );
    });

    it("CallerNotBridge — 비인가 호출자", async function () {
      await expectRevertCustomError(
        rt.connect(nonAdmin).recordRevenue(STN_1, 5000n, PERIOD),
        "CallerNotBridge"
      );
    });
  });

  // ── claim 성공 ─────────────────────────────────────────────────────────────

  describe("claim 성공", function () {
    beforeEach(async function () {
      // CPO-001 소유 충전소 2개에 수익 기록
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
    });

    it("claim 후 pending = 0", async function () {
      await rt.claim(CPO_1, PERIOD);

      const [acc1, set1, pend1] = await rt.getStationRevenue(STN_1);
      expect(pend1).to.equal(0n);
      expect(set1).to.equal(5000n);

      const [acc2, set2, pend2] = await rt.getStationRevenue(STN_2);
      expect(pend2).to.equal(0n);
      expect(set2).to.equal(3000n);
    });

    it("claim 반환값 = totalClaimed", async function () {
      // Use staticCall to get the return value
      const totalClaimed = await rt.claim.staticCall(CPO_1, PERIOD);
      expect(totalClaimed).to.equal(8000n);
    });

    it("settlementHistory 기록", async function () {
      await rt.claim(CPO_1, PERIOD);

      const history1 = await rt.getSettlementHistory(STN_1);
      expect(history1.length).to.equal(1);
      expect(history1[0].amount).to.equal(5000n);
      expect(history1[0].period_yyyyMM).to.equal(PERIOD);
      expect(history1[0].settledAt > 0n).to.be.true;

      const history2 = await rt.getSettlementHistory(STN_2);
      expect(history2.length).to.equal(1);
      expect(history2[0].amount).to.equal(3000n);
    });

    // B-1: claim 이벤트 파라미터 검증
    it("SettlementRecorded + CPOClaimed 이벤트 파라미터 검증", async function () {
      const tx = await rt.claim(CPO_1, PERIOD);
      const receipt = await tx.wait();

      // Should have SettlementRecorded for each station
      const settleEvents = findAllEvents(receipt!, rt, "SettlementRecorded");
      expect(settleEvents.length).to.equal(2);

      // Find events by station
      const stn1Event = settleEvents.find(
        (e: { args: { stationId: string } }) => e.args.stationId === STN_1
      );
      const stn2Event = settleEvents.find(
        (e: { args: { stationId: string } }) => e.args.stationId === STN_2
      );
      expect(stn1Event, "STN_1 SettlementRecorded").to.not.be.undefined;
      expect(stn1Event!.args.cpoId).to.equal(CPO_1);
      expect(stn1Event!.args.amount).to.equal(5000n);
      expect(stn1Event!.args.period_yyyyMM).to.equal(PERIOD);

      expect(stn2Event, "STN_2 SettlementRecorded").to.not.be.undefined;
      expect(stn2Event!.args.amount).to.equal(3000n);

      // CPOClaimed event
      const cpoEvent = findEvent(receipt!, rt, "CPOClaimed");
      expect(cpoEvent, "CPOClaimed 이벤트가 emit되어야 한다").to.not.be.null;
      expect(cpoEvent!.args.cpoId).to.equal(CPO_1);
      expect(cpoEvent!.args.totalAmount).to.equal(8000n);
      expect(cpoEvent!.args.period_yyyyMM).to.equal(PERIOD);
    });
  });

  // ── claim 실패 ─────────────────────────────────────────────────────────────

  describe("claim 실패", function () {
    it("NothingToClaim — pending = 0", async function () {
      // Register a station for CPO_2 with no revenue
      const STN_5 = b32("STATION-005");
      await stationRegistry.registerStation(STN_5, CPO_2, OwnerType.CPO, REGION_SEOUL, "서울 마포");

      await expectRevertCustomError(
        rt.claim(CPO_2, PERIOD),
        "NothingToClaim"
      );
    });

    it("CPOHasNoStations — 미등록 CPO", async function () {
      await expectRevertCustomError(
        rt.claim(CPO_99, PERIOD),
        "CPOHasNoStations"
      );
    });

    it("claim 재호출 → NothingToClaim", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claim(CPO_1, PERIOD);

      await expectRevertCustomError(
        rt.claim(CPO_1, PERIOD),
        "NothingToClaim"
      );
    });

    it("비인가 호출자 claim → revert", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);

      await expectRevert(
        rt.connect(nonAdmin).claim(CPO_1, PERIOD)
      );
    });
  });

  // ── claimPaginated 성공 ─────────────────────────────────────────────────────

  describe("claimPaginated 성공", function () {
    beforeEach(async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
    });

    it("전체 범위 페이지네이션 — offset=0, limit=10", async function () {
      const [totalClaimed, processed, hasMore] = await rt.claimPaginated.staticCall(CPO_1, PERIOD, 0n, 10n);
      expect(totalClaimed).to.equal(8000n);
      expect(processed).to.equal(2n);
      expect(hasMore).to.equal(false);
    });

    it("부분 페이지네이션 — offset=0, limit=1 → hasMore=true", async function () {
      const [totalClaimed, processed, hasMore] = await rt.claimPaginated.staticCall(CPO_1, PERIOD, 0n, 1n);
      expect(processed).to.equal(1n);
      expect(hasMore).to.equal(true);
      expect(totalClaimed > 0n).to.be.true;
    });

    it("2단계 페이지네이션 — 두 번 호출로 전체 정산", async function () {
      await rt.claimPaginated(CPO_1, PERIOD, 0n, 1n);
      await rt.claimPaginated(CPO_1, PERIOD, 1n, 1n);

      const [, , pend1] = await rt.getStationRevenue(STN_1);
      const [, , pend2] = await rt.getStationRevenue(STN_2);
      expect(pend1).to.equal(0n);
      expect(pend2).to.equal(0n);
    });

    it("CPOClaimed 이벤트 emit (totalClaimed > 0 일 때만)", async function () {
      const tx = await rt.claimPaginated(CPO_1, PERIOD, 0n, 10n);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, rt, "CPOClaimed");
      expect(event).to.not.be.null;
      expect(event!.args.totalAmount).to.equal(8000n);
    });

    it("pending=0인 배치 — CPOClaimed 이벤트 미emit", async function () {
      await rt.claim(CPO_1, PERIOD); // 전체 정산
      const tx = await rt.claimPaginated(CPO_1, PERIOD, 0n, 10n);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, rt, "CPOClaimed");
      expect(event).to.be.null;
    });
  });

  // ── claimPaginated 실패 ─────────────────────────────────────────────────────

  describe("claimPaginated 실패", function () {
    it("LimitZero — limit=0", async function () {
      await expectRevertCustomError(
        rt.claimPaginated(CPO_1, PERIOD, 0n, 0n),
        "LimitZero"
      );
    });

    it("CPOHasNoStations — 미등록 CPO", async function () {
      await expectRevertCustomError(
        rt.claimPaginated(CPO_99, PERIOD, 0n, 10n),
        "CPOHasNoStations"
      );
    });

    it("OffsetOutOfBounds — offset >= 스테이션 수", async function () {
      await expectRevertCustomError(
        rt.claimPaginated(CPO_1, PERIOD, 100n, 10n),
        "OffsetOutOfBounds"
      );
    });

    it("비인가 호출자 → revert", async function () {
      await expectRevert(
        rt.connect(nonAdmin).claimPaginated(CPO_1, PERIOD, 0n, 10n)
      );
    });
  });

  // ── claimStation 성공 ─────────────────────────────────────────────────────

  describe("claimStation 성공", function () {
    beforeEach(async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
    });

    it("개별 스테이션 정산", async function () {
      const amount = await rt.claimStation.staticCall(STN_1, PERIOD);
      expect(amount).to.equal(5000n);

      await rt.claimStation(STN_1, PERIOD);

      const [, , pend1] = await rt.getStationRevenue(STN_1);
      expect(pend1).to.equal(0n);

      // STN_2는 영향 없음
      const [, , pend2] = await rt.getStationRevenue(STN_2);
      expect(pend2).to.equal(3000n);
    });

    it("StationClaimed 이벤트 emit", async function () {
      const tx = await rt.claimStation(STN_1, PERIOD);
      const receipt = await tx.wait();

      const event = findEvent(receipt!, rt, "StationClaimed");
      expect(event).to.not.be.null;
      expect(event!.args.stationId).to.equal(STN_1);
      expect(event!.args.amount).to.equal(5000n);
      expect(event!.args.period_yyyyMM).to.equal(PERIOD);
    });

    it("정산 이력 기록", async function () {
      await rt.claimStation(STN_1, PERIOD);

      const history = await rt.getSettlementHistory(STN_1);
      expect(history.length).to.equal(1);
      expect(history[0].amount).to.equal(5000n);
    });
  });

  // ── claimStation 실패 ─────────────────────────────────────────────────────

  describe("claimStation 실패", function () {
    it("StationNotRegistered — 미등록 stationId", async function () {
      await expectRevertCustomError(
        rt.claimStation(STN_99, PERIOD),
        "StationNotRegistered"
      );
    });

    it("NothingToClaim — pending=0", async function () {
      await expectRevertCustomError(
        rt.claimStation(STN_1, PERIOD),
        "NothingToClaim"
      );
    });

    it("비인가 호출자 → revert", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await expectRevert(
        rt.connect(nonAdmin).claimStation(STN_1, PERIOD)
      );
    });
  });

  // ── Pausable: 새 함수 ──────────────────────────────────────────────────────

  describe("Pausable: 새 함수", function () {
    it("paused 상태에서 claimPaginated() → revert EnforcedPause", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.pause();
      await expectRevertCustomError(
        rt.claimPaginated(CPO_1, PERIOD, 0n, 10n),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 claimStation() → revert EnforcedPause", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.pause();
      await expectRevertCustomError(
        rt.claimStation(STN_1, PERIOD),
        "EnforcedPause"
      );
    });
  });

  // ── View 함수 ──────────────────────────────────────────────────────────────

  describe("View 함수", function () {
    beforeEach(async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.recordRevenue(STN_3, 10000n, PERIOD);  // EnergyFi Seoul
      await rt.recordRevenue(STN_4, 7000n, PERIOD);   // EnergyFi Busan
    });

    it("getCPORevenue — CPO 소속 충전소 합산", async function () {
      const [accumulated, settled, pending] = await rt.getCPORevenue(CPO_1);
      expect(accumulated).to.equal(8000n);
      expect(pending).to.equal(8000n);
    });

    it("getEnergyFiRegionRevenue — 서울 지역 pending", async function () {
      const pending = await rt.getEnergyFiRegionRevenue(REGION_SEOUL);
      expect(pending).to.equal(10000n); // STN_3 only
    });

    it("getEnergyFiRegionRevenue — 부산 지역 pending", async function () {
      const pending = await rt.getEnergyFiRegionRevenue(REGION_BUSAN);
      expect(pending).to.equal(7000n); // STN_4 only
    });

    it("getStationRevenuePeriod — 미기록 기간 = 0", async function () {
      const amount = await rt.getStationRevenuePeriod(STN_1, PERIOD_2);
      expect(amount).to.equal(0n);
    });

    // T05: getMonthlyHistory — 다중 월 기록 후 배열 길이, 항목 검증
    it("getMonthlyHistory — 다중 월 기록 후 배열 길이 및 항목 검증 (T05)", async function () {
      await rt.recordRevenue(STN_1, 2000n, PERIOD_2);

      const history = await rt.getMonthlyHistory(STN_1);
      expect(history.length).to.equal(2);

      // Find by period
      const periodEntry = history.find(
        (h: { period_yyyyMM: bigint }) => h.period_yyyyMM === PERIOD
      );
      const period2Entry = history.find(
        (h: { period_yyyyMM: bigint }) => h.period_yyyyMM === PERIOD_2
      );
      expect(periodEntry).to.not.be.undefined;
      expect(periodEntry!.amount).to.equal(5000n);
      expect(period2Entry).to.not.be.undefined;
      expect(period2Entry!.amount).to.equal(2000n);
    });

    // T05: getSettlementHistory — 다중 정산 후 배열 길이, 항목 검증
    it("getSettlementHistory — 다중 정산 후 배열 길이 및 항목 검증 (T05)", async function () {
      await rt.claim(CPO_1, PERIOD);
      await rt.recordRevenue(STN_1, 2000n, PERIOD_2);
      await rt.claim(CPO_1, PERIOD_2);

      const history = await rt.getSettlementHistory(STN_1);
      expect(history.length).to.equal(2);
      expect(history[0].period_yyyyMM).to.equal(PERIOD);
      expect(history[0].amount).to.equal(5000n);
      expect(history[0].settledAt > 0n).to.be.true;
      expect(history[1].period_yyyyMM).to.equal(PERIOD_2);
      expect(history[1].amount).to.equal(2000n);
      expect(history[1].settledAt > 0n).to.be.true;
    });

    // B-6: 미존재 데이터 조회
    it("getStationRevenue(수익 미기록 충전소) → 0,0,0", async function () {
      const STN_5 = b32("STATION-005");
      await stationRegistry.registerStation(STN_5, CPO_2, OwnerType.CPO, REGION_BUSAN, "부산 기장");

      const [acc, set, pend] = await rt.getStationRevenue(STN_5);
      expect(acc).to.equal(0n);
      expect(set).to.equal(0n);
      expect(pend).to.equal(0n);
    });

    it("getCPORevenue(충전소 없는 CPO) → 0,0,0", async function () {
      const [acc, set, pend] = await rt.getCPORevenue(CPO_99);
      expect(acc).to.equal(0n);
      expect(set).to.equal(0n);
      expect(pend).to.equal(0n);
    });

    it("getEnergyFiRegionRevenue(미기록 지역) → 0", async function () {
      const REGION_JEJU = regionBytes4("KR49");
      const pending = await rt.getEnergyFiRegionRevenue(REGION_JEJU);
      expect(pending).to.equal(0n);
    });

    it("getSettlementHistory(정산 미진행 충전소) → 빈 배열", async function () {
      const history = await rt.getSettlementHistory(STN_1);
      expect(history.length).to.equal(0);
    });
  });

  // ── 페이지네이션 View 함수 ──────────────────────────────────────────────────

  describe("페이지네이션 View 함수", function () {
    beforeEach(async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.recordRevenue(STN_3, 10000n, PERIOD);  // EnergyFi Seoul
      await rt.recordRevenue(STN_4, 7000n, PERIOD);   // EnergyFi Busan
    });

    it("getCPORevenuePaginated — 전체 범위", async function () {
      const [acc, set, pend, processed, hasMore] = await rt.getCPORevenuePaginated(CPO_1, 0n, 10n);
      expect(acc).to.equal(8000n);
      expect(pend).to.equal(8000n);
      expect(processed).to.equal(2n);
      expect(hasMore).to.equal(false);
    });

    it("getCPORevenuePaginated — 부분 범위", async function () {
      const [acc1, , , processed1, hasMore1] = await rt.getCPORevenuePaginated(CPO_1, 0n, 1n);
      expect(processed1).to.equal(1n);
      expect(hasMore1).to.equal(true);

      const [acc2, , , processed2, hasMore2] = await rt.getCPORevenuePaginated(CPO_1, 1n, 1n);
      expect(processed2).to.equal(1n);
      expect(hasMore2).to.equal(false);

      // 합계 = 전체와 동일
      expect(acc1 + acc2).to.equal(8000n);
    });

    it("getCPORevenuePaginated — 빈 CPO는 0 반환", async function () {
      const [acc, set, pend, processed, hasMore] = await rt.getCPORevenuePaginated(CPO_99, 0n, 10n);
      expect(acc).to.equal(0n);
      expect(processed).to.equal(0n);
      expect(hasMore).to.equal(false);
    });

    it("getCPORevenuePaginated — LimitZero", async function () {
      await expectRevertCustomError(
        rt.getCPORevenuePaginated(CPO_1, 0n, 0n),
        "LimitZero"
      );
    });

    it("getCPORevenuePaginated — OffsetOutOfBounds", async function () {
      await expectRevertCustomError(
        rt.getCPORevenuePaginated(CPO_1, 100n, 10n),
        "OffsetOutOfBounds"
      );
    });

    it("getEnergyFiRegionRevenuePaginated — 전체 범위", async function () {
      const [pend, processed, hasMore] = await rt.getEnergyFiRegionRevenuePaginated(REGION_SEOUL, 0n, 10n);
      expect(pend).to.equal(10000n);
      expect(processed).to.equal(1n); // STN_3 only
      expect(hasMore).to.equal(false);
    });

    it("getEnergyFiRegionRevenuePaginated — 빈 지역은 0 반환", async function () {
      const REGION_JEJU = regionBytes4("KR49");
      const [pend, processed, hasMore] = await rt.getEnergyFiRegionRevenuePaginated(REGION_JEJU, 0n, 10n);
      expect(pend).to.equal(0n);
      expect(processed).to.equal(0n);
      expect(hasMore).to.equal(false);
    });

    it("getEnergyFiRegionRevenuePaginated — LimitZero", async function () {
      await expectRevertCustomError(
        rt.getEnergyFiRegionRevenuePaginated(REGION_SEOUL, 0n, 0n),
        "LimitZero"
      );
    });
  });

  // ── T01: 데이터 정합성 교차 검증 ──────────────────────────────────────────

  describe("데이터 정합성 교차 검증 (T01)", function () {
    it("CPO 총수익 = 소속 충전소 수익 합", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.recordRevenue(STN_1, 2000n, PERIOD_2);

      const [cpoAcc, , cpoP] = await rt.getCPORevenue(CPO_1);

      // Sum of station revenues
      const [stn1Acc] = await rt.getStationRevenue(STN_1);
      const [stn2Acc] = await rt.getStationRevenue(STN_2);
      expect(cpoAcc).to.equal(stn1Acc + stn2Acc);
    });

    it("EnergyFi 지역 수익 = 소속 EF 충전소 pending 합", async function () {
      await rt.recordRevenue(STN_3, 10000n, PERIOD);  // EF Seoul

      const efPending = await rt.getEnergyFiRegionRevenue(REGION_SEOUL);
      const [, , stn3Pending] = await rt.getStationRevenue(STN_3);
      expect(efPending).to.equal(stn3Pending);
    });

    it("정산 후 교차 검증 — CPO settled = 충전소 settled 합, pending = 0", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.claim(CPO_1, PERIOD);

      const [cpoAcc, cpoSet, cpoPend] = await rt.getCPORevenue(CPO_1);
      expect(cpoSet).to.equal(cpoAcc);
      expect(cpoPend).to.equal(0n);

      // Each station pending = 0
      const [, , pend1] = await rt.getStationRevenue(STN_1);
      const [, , pend2] = await rt.getStationRevenue(STN_2);
      expect(pend1).to.equal(0n);
      expect(pend2).to.equal(0n);

      // Sum of station settled = CPO settled
      const [, set1] = await rt.getStationRevenue(STN_1);
      const [, set2] = await rt.getStationRevenue(STN_2);
      expect(set1 + set2).to.equal(cpoSet);
    });
  });

  // ── T02: 월경계 정산 독립성 ──────────────────────────────────────────────

  describe("월경계 정산 독립성 (T02)", function () {
    it("월 A 세션 + 월 B 세션 → claim → 양쪽 다 정산됨", async function () {
      // Revenue in two different months
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_1, 3000n, PERIOD_2);

      // claim() settles ALL pending regardless of period
      await rt.claim(CPO_1, PERIOD);

      const [acc, set, pend] = await rt.getStationRevenue(STN_1);
      expect(acc).to.equal(8000n);
      expect(set).to.equal(8000n);
      expect(pend).to.equal(0n);
    });

    it("claim 후 새 월 수익 추가 → 기존 정산 불변", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claim(CPO_1, PERIOD);

      // Add new revenue in new period
      await rt.recordRevenue(STN_1, 3000n, PERIOD_2);

      const [acc, set, pend] = await rt.getStationRevenue(STN_1);
      expect(acc).to.equal(8000n);  // 5000 + 3000
      expect(set).to.equal(5000n);  // Only first claim settled
      expect(pend).to.equal(3000n); // New revenue
    });

    it("다중 CPO 독립 정산 — CPO_1 claim이 CPO_2에 영향 없음", async function () {
      const STN_5 = b32("STATION-005");
      await stationRegistry.registerStation(STN_5, CPO_2, OwnerType.CPO, REGION_SEOUL, "서울 마포");

      await rt.recordRevenue(STN_1, 5000n, PERIOD);  // CPO_1
      await rt.recordRevenue(STN_5, 3000n, PERIOD);  // CPO_2

      // Only claim CPO_1
      await rt.claim(CPO_1, PERIOD);

      // CPO_2 should be unaffected
      const [acc2, set2, pend2] = await rt.getCPORevenue(CPO_2);
      expect(acc2).to.equal(3000n);
      expect(set2).to.equal(0n);
      expect(pend2).to.equal(3000n);
    });

    it("EnergyFi 충전소는 CPO claim 대상 아님", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);  // CPO-owned
      await rt.recordRevenue(STN_3, 10000n, PERIOD);  // EnergyFi Seoul

      // CPO claim only settles CPO stations
      await rt.claim(CPO_1, PERIOD);

      // EnergyFi station pending should be unchanged
      const [efAcc, efSet, efPend] = await rt.getStationRevenue(STN_3);
      expect(efAcc).to.equal(10000n);
      expect(efSet).to.equal(0n);
      expect(efPend).to.equal(10000n);

      // EnergyFi region revenue unaffected
      const regionPending = await rt.getEnergyFiRegionRevenue(REGION_SEOUL);
      expect(regionPending).to.equal(10000n);
    });
  });

  // ── R04: Pausable ──────────────────────────────────────────────────────────

  describe("Pausable (R04)", function () {
    it("admin pause() → 성공, Paused 이벤트", async function () {
      const tx = await rt.pause();
      const receipt = await tx.wait();
      const event = findEvent(receipt, rt, "Paused");
      expect(event).to.not.be.null;
      expect(event.args.account).to.equal(admin.address);
    });

    it("non-admin pause() → revert", async function () {
      await expectRevert(rt.connect(nonAdmin).pause());
    });

    it("non-admin unpause() → revert", async function () {
      await rt.pause();
      await expectRevert(rt.connect(nonAdmin).unpause());
    });

    it("paused 상태에서 recordRevenue() → revert EnforcedPause", async function () {
      await rt.pause();
      await expectRevertCustomError(
        rt.recordRevenue(STN_1, 5000n, PERIOD),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 claim() → revert EnforcedPause", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.pause();
      await expectRevertCustomError(
        rt.claim(CPO_1, PERIOD),
        "EnforcedPause"
      );
    });

    it("unpause() 후 recordRevenue() 정상 동작", async function () {
      await rt.pause();
      await rt.unpause();
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      const [accumulated] = await rt.getStationRevenue(STN_1);
      expect(accumulated).to.equal(5000n);
    });

    it("paused 상태에서 view 함수 정상 동작", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.pause();

      // View functions should still work while paused
      const [accumulated, , pending] = await rt.getStationRevenue(STN_1);
      expect(accumulated).to.equal(5000n);
      expect(pending).to.equal(5000n);

      const amount = await rt.getStationRevenuePeriod(STN_1, PERIOD);
      expect(amount).to.equal(5000n);

      const history = await rt.getMonthlyHistory(STN_1);
      expect(history.length).to.equal(1);
    });
  });

  // ── R05: Bridge Rotation ──────────────────────────────────────────────────

  describe("Bridge Rotation (R05)", function () {
    it("admin updateBridgeAddress(newAddr) → 성공, 이벤트 emit", async function () {
      const tx = await rt.updateBridgeAddress(newBridge.address);
      const receipt = await tx.wait();

      const event = findEvent(receipt, rt, "BridgeAddressUpdated");
      expect(event).to.not.be.null;
      expect(event.args.oldAddress).to.equal(admin.address);
      expect(event.args.newAddress).to.equal(newBridge.address);
    });

    it("non-admin updateBridgeAddress → revert", async function () {
      await expectRevert(
        rt.connect(nonAdmin).updateBridgeAddress(newBridge.address)
      );
    });

    it("updateBridgeAddress(address(0)) → revert ZeroAddress", async function () {
      await expectRevertCustomError(
        rt.updateBridgeAddress("0x0000000000000000000000000000000000000000"),
        "ZeroAddress"
      );
    });

    it("변경 후 이전 bridge 주소 호출 불가", async function () {
      await rt.updateBridgeAddress(newBridge.address);

      // Old bridge (admin) can no longer call recordRevenue
      await expectRevertCustomError(
        rt.recordRevenue(STN_1, 5000n, PERIOD),
        "CallerNotBridge"
      );
    });

    it("변경 후 새 bridge 주소 호출 성공", async function () {
      await rt.updateBridgeAddress(newBridge.address);

      // New bridge can call recordRevenue
      await rt.connect(newBridge).recordRevenue(STN_1, 5000n, PERIOD);
      const [accumulated] = await rt.getStationRevenue(STN_1);
      expect(accumulated).to.equal(5000n);
    });
  });

  // ── B-5: 정산 후 View 정합성 ──────────────────────────────────────────────

  describe("정산 후 View 정합성", function () {
    it("claim 후 getCPORevenue — settled = accumulated, pending = 0", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.claim(CPO_1, PERIOD);

      const [acc, set, pend] = await rt.getCPORevenue(CPO_1);
      expect(acc).to.equal(8000n);
      expect(set).to.equal(8000n);
      expect(pend).to.equal(0n);
    });

    it("부분 정산 후 추가 수익 → pending 정확성", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claim(CPO_1, PERIOD);

      // Add more revenue after settlement
      await rt.recordRevenue(STN_1, 3000n, PERIOD_2);

      const [acc, set, pend] = await rt.getStationRevenue(STN_1);
      expect(acc).to.equal(8000n);  // 5000 + 3000
      expect(set).to.equal(5000n);  // Only first claim
      expect(pend).to.equal(3000n); // New revenue
    });

    it("CPO claim은 EnergyFi region revenue에 영향 없음", async function () {
      // Both CPO and EnergyFi stations have revenue
      await rt.recordRevenue(STN_1, 5000n, PERIOD);  // CPO-owned
      await rt.recordRevenue(STN_3, 10000n, PERIOD);  // EnergyFi Seoul

      // Claim CPO revenue only
      await rt.claim(CPO_1, PERIOD);

      // EnergyFi region revenue should be unchanged
      const pending = await rt.getEnergyFiRegionRevenue(REGION_SEOUL);
      expect(pending).to.equal(10000n);
    });

    it("다중 정산 후 settlementHistory 누적", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claim(CPO_1, PERIOD);

      await rt.recordRevenue(STN_1, 3000n, PERIOD_2);
      await rt.claim(CPO_1, PERIOD_2);

      const history = await rt.getSettlementHistory(STN_1);
      expect(history.length).to.equal(2);
      expect(history[0].amount).to.equal(5000n);
      expect(history[0].period_yyyyMM).to.equal(PERIOD);
      expect(history[1].amount).to.equal(3000n);
      expect(history[1].period_yyyyMM).to.equal(PERIOD_2);
    });
  });

  // ── UUPS Upgrade ───────────────────────────────────────────────────────────

  describe("UUPS 업그레이드", function () {
    it("admin 업그레이드 성공", async function () {
      const RTv2 = await ethers.getContractFactory("RevenueTracker");
      const v2Impl = await RTv2.deploy();
      await v2Impl.waitForDeployment();

      await rt.upgradeToAndCall(await v2Impl.getAddress(), "0x");
    });

    it("비인가 주소 업그레이드 → revert", async function () {
      const RTv2 = await ethers.getContractFactory("RevenueTracker");
      const v2Impl = await RTv2.deploy();
      await v2Impl.waitForDeployment();

      await expectRevert(
        rt.connect(nonAdmin).upgradeToAndCall(await v2Impl.getAddress(), "0x")
      );
    });

    // B-2: 업그레이드 후 기존 데이터 보존
    it("업그레이드 후 기존 수익 데이터 보존", async function () {
      // Record revenue and claim before upgrade
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.claim(CPO_1, PERIOD);

      // Record more after claim
      await rt.recordRevenue(STN_1, 2000n, PERIOD_2);

      // Upgrade
      const RTv2 = await ethers.getContractFactory("RevenueTracker");
      const v2Impl = await RTv2.deploy();
      await v2Impl.waitForDeployment();
      await rt.upgradeToAndCall(await v2Impl.getAddress(), "0x");

      // Verify ALL state preserved
      const [acc1, set1, pend1] = await rt.getStationRevenue(STN_1);
      expect(acc1).to.equal(7000n);  // 5000 + 2000
      expect(set1).to.equal(5000n);  // claimed
      expect(pend1).to.equal(2000n); // new

      const [acc2, set2, pend2] = await rt.getStationRevenue(STN_2);
      expect(acc2).to.equal(3000n);
      expect(set2).to.equal(3000n);
      expect(pend2).to.equal(0n);

      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD)).to.equal(5000n);
      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD_2)).to.equal(2000n);

      const history = await rt.getSettlementHistory(STN_1);
      expect(history.length).to.equal(1);
      expect(history[0].amount).to.equal(5000n);

      // Verify new operations still work
      await rt.recordRevenue(STN_1, 1000n, PERIOD_2);
      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD_2)).to.equal(3000n);
    });
  });
});
