/**
 * RevenueTracker 단위 테스트
 *
 * UUPS Proxy. StationRegistry와 연동하여 충전소별 수익 추적.
 * All stations are EnergyFi-owned — no CPO on-chain.
 *
 * R04: Pausable — pause/unpause, whenNotPaused on recordRevenue/claimStation.
 * R05: Bridge rotation — updateBridgeAddress().
 * T01: 데이터 정합성 교차 검증 (지역 수익 = 소속 충전소 수익 합).
 * T02: 월경계 정산 독립성.
 * T05: View 함수 커버리지 강화.
 */

import hre from "hardhat";
import { expect } from "chai";
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RevenueTracker", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let newBridge: Awaited<ReturnType<typeof ethers.getSigner>>;

  let stationRegistry: StationRegistry;
  let rt: RevenueTracker;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    nonAdmin = signers[1];
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

    // Setup infrastructure — all stations are EnergyFi-owned
    await stationRegistry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
    await stationRegistry.registerStation(STN_2, REGION_SEOUL, "서울 서초");
    await stationRegistry.registerStation(STN_3, REGION_SEOUL, "서울 종로");
    await stationRegistry.registerStation(STN_4, REGION_BUSAN, "부산 해운대");
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

    it("SettlementRecorded 이벤트 emit", async function () {
      const tx = await rt.claimStation(STN_1, PERIOD);
      const receipt = await tx.wait();

      const event = findEvent(receipt!, rt, "SettlementRecorded");
      expect(event).to.not.be.null;
      expect(event!.args.stationId).to.equal(STN_1);
      expect(event!.args.amount).to.equal(5000n);
      expect(event!.args.period_yyyyMM).to.equal(PERIOD);
      expect(event!.args.settledAt > 0n).to.be.true;
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

  // ── Pausable: claimStation ──────────────────────────────────────────────────

  describe("Pausable: claimStation", function () {
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
      await rt.recordRevenue(STN_3, 10000n, PERIOD);
      await rt.recordRevenue(STN_4, 7000n, PERIOD);
    });

    it("getRegionRevenue — 서울 지역 pending", async function () {
      const pending = await rt.getRegionRevenue(REGION_SEOUL);
      expect(pending).to.equal(18000n); // STN_1 + STN_2 + STN_3
    });

    it("getRegionRevenue — 부산 지역 pending", async function () {
      const pending = await rt.getRegionRevenue(REGION_BUSAN);
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
      await rt.claimStation(STN_1, PERIOD);
      await rt.recordRevenue(STN_1, 2000n, PERIOD_2);
      await rt.claimStation(STN_1, PERIOD_2);

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
      await stationRegistry.registerStation(STN_5, REGION_BUSAN, "부산 기장");

      const [acc, set, pend] = await rt.getStationRevenue(STN_5);
      expect(acc).to.equal(0n);
      expect(set).to.equal(0n);
      expect(pend).to.equal(0n);
    });

    it("getRegionRevenue(미기록 지역) → 0", async function () {
      const REGION_JEJU = regionBytes4("KR49");
      const pending = await rt.getRegionRevenue(REGION_JEJU);
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
      await rt.recordRevenue(STN_3, 10000n, PERIOD);
      await rt.recordRevenue(STN_4, 7000n, PERIOD);
    });

    it("getRegionRevenuePaginated — 전체 범위 (서울)", async function () {
      const [pend, processed, hasMore] = await rt.getRegionRevenuePaginated(REGION_SEOUL, 0n, 10n);
      expect(pend).to.equal(18000n); // STN_1 + STN_2 + STN_3
      expect(processed).to.equal(3n);
      expect(hasMore).to.equal(false);
    });

    it("getRegionRevenuePaginated — 부분 범위", async function () {
      const [pend1, processed1, hasMore1] = await rt.getRegionRevenuePaginated(REGION_SEOUL, 0n, 2n);
      expect(processed1).to.equal(2n);
      expect(hasMore1).to.equal(true);

      const [pend2, processed2, hasMore2] = await rt.getRegionRevenuePaginated(REGION_SEOUL, 2n, 2n);
      expect(processed2).to.equal(1n);
      expect(hasMore2).to.equal(false);

      // 합계 = 전체와 동일
      expect(pend1 + pend2).to.equal(18000n);
    });

    it("getRegionRevenuePaginated — 빈 지역은 0 반환", async function () {
      const REGION_JEJU = regionBytes4("KR49");
      const [pend, processed, hasMore] = await rt.getRegionRevenuePaginated(REGION_JEJU, 0n, 10n);
      expect(pend).to.equal(0n);
      expect(processed).to.equal(0n);
      expect(hasMore).to.equal(false);
    });

    it("getRegionRevenuePaginated — LimitZero", async function () {
      await expectRevertCustomError(
        rt.getRegionRevenuePaginated(REGION_SEOUL, 0n, 0n),
        "LimitZero"
      );
    });
  });

  // ── T01: 데이터 정합성 교차 검증 ──────────────────────────────────────────

  describe("데이터 정합성 교차 검증 (T01)", function () {
    it("지역 수익 = 소속 충전소 pending 합", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.recordRevenue(STN_3, 10000n, PERIOD);

      const regionPending = await rt.getRegionRevenue(REGION_SEOUL);

      const [, , pend1] = await rt.getStationRevenue(STN_1);
      const [, , pend2] = await rt.getStationRevenue(STN_2);
      const [, , pend3] = await rt.getStationRevenue(STN_3);
      expect(regionPending).to.equal(pend1 + pend2 + pend3);
    });

    it("정산 후 교차 검증 — settled 반영, pending 감소", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.claimStation(STN_1, PERIOD);

      // STN_1 settled, STN_2 still pending
      const [acc1, set1, pend1] = await rt.getStationRevenue(STN_1);
      expect(set1).to.equal(acc1);
      expect(pend1).to.equal(0n);

      const [, , pend2] = await rt.getStationRevenue(STN_2);
      expect(pend2).to.equal(3000n);

      // Region pending = only STN_2 + STN_3 (STN_3 has no revenue yet)
      const regionPending = await rt.getRegionRevenue(REGION_SEOUL);
      expect(regionPending).to.equal(pend2);
    });
  });

  // ── T02: 월경계 정산 독립성 ──────────────────────────────────────────────

  describe("월경계 정산 독립성 (T02)", function () {
    it("claimStation 후 새 월 수익 추가 → 기존 정산 불변", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claimStation(STN_1, PERIOD);

      // Add new revenue in new period
      await rt.recordRevenue(STN_1, 3000n, PERIOD_2);

      const [acc, set, pend] = await rt.getStationRevenue(STN_1);
      expect(acc).to.equal(8000n);  // 5000 + 3000
      expect(set).to.equal(5000n);  // Only first claim settled
      expect(pend).to.equal(3000n); // New revenue
    });

    it("다중 충전소 독립 정산 — STN_1 claimStation이 STN_2에 영향 없음", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);

      // Only claim STN_1
      await rt.claimStation(STN_1, PERIOD);

      // STN_2 should be unaffected
      const [acc2, set2, pend2] = await rt.getStationRevenue(STN_2);
      expect(acc2).to.equal(3000n);
      expect(set2).to.equal(0n);
      expect(pend2).to.equal(3000n);
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
    it("claimStation 후 getStationRevenue — settled = accumulated, pending = 0", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claimStation(STN_1, PERIOD);

      const [acc, set, pend] = await rt.getStationRevenue(STN_1);
      expect(acc).to.equal(5000n);
      expect(set).to.equal(5000n);
      expect(pend).to.equal(0n);
    });

    it("부분 정산 후 추가 수익 → pending 정확성", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claimStation(STN_1, PERIOD);

      // Add more revenue after settlement
      await rt.recordRevenue(STN_1, 3000n, PERIOD_2);

      const [acc, set, pend] = await rt.getStationRevenue(STN_1);
      expect(acc).to.equal(8000n);  // 5000 + 3000
      expect(set).to.equal(5000n);  // Only first claim
      expect(pend).to.equal(3000n); // New revenue
    });

    it("claimStation은 다른 충전소 region revenue에 영향 없음", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_3, 10000n, PERIOD);

      // Claim STN_1 only
      await rt.claimStation(STN_1, PERIOD);

      // Region revenue should decrease by STN_1's amount
      const pending = await rt.getRegionRevenue(REGION_SEOUL);
      expect(pending).to.equal(10000n); // Only STN_3 pending remains
    });

    it("다중 정산 후 settlementHistory 누적", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claimStation(STN_1, PERIOD);

      await rt.recordRevenue(STN_1, 3000n, PERIOD_2);
      await rt.claimStation(STN_1, PERIOD_2);

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
      await rt.claimStation(STN_1, PERIOD);

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
      expect(set2).to.equal(0n);
      expect(pend2).to.equal(3000n);

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
