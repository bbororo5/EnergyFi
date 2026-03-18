/**
 * RevenueTracker test suite
 *
 * UUPS proxy. Tracks station-level revenue together with StationRegistry.
 * All stations are EnergyFi-owned — no CPO on-chain.
 *
 * R04: Pausable coverage — pause/unpause and whenNotPaused on recordRevenue/claimStation.
 * R05: Bridge rotation — updateBridgeAddress().
 * T01: cross-checking data consistency (region revenue = sum of member-station revenue).
 * T02: month-boundary settlement independence.
 * T05: expanded view-function coverage.
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
const REGION_DAEGU = regionBytes4("KR27");
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
    await stationRegistry.registerStation(STN_1, REGION_SEOUL, "Seoul Gangnam");
    await stationRegistry.registerStation(STN_2, REGION_SEOUL, "Seoul Seocho");
    await stationRegistry.registerStation(STN_3, REGION_SEOUL, "Seoul Jongno");
    await stationRegistry.registerStation(STN_4, REGION_BUSAN, "Busan Haeundae");
  });

  // ── recordRevenue success ──────────────────────────────────────────────────

  describe("recordRevenue success", function () {
    it("accumulates revenue correctly", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_1, 3000n, PERIOD);

      const [accumulated, settled, pending] = await rt.getStationRevenue(STN_1);
      expect(accumulated).to.equal(8000n);
      expect(settled).to.equal(0n);
      expect(pending).to.equal(8000n);
    });

    it("aggregates monthly history within the same month", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_1, 3000n, PERIOD);

      const amount = await rt.getStationRevenuePeriod(STN_1, PERIOD);
      expect(amount).to.equal(8000n);
    });

    it("stores separate monthly history entries for different months", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_1, 7000n, PERIOD_2);

      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD)).to.equal(5000n);
      expect(await rt.getStationRevenuePeriod(STN_1, PERIOD_2)).to.equal(7000n);
    });

    // B-1: event parameter validation
    it("emits RevenueRecorded with the expected parameters", async function () {
      const tx = await rt.recordRevenue(STN_1, 5000n, PERIOD);
      const receipt = await tx.wait();

      const event = findEvent(receipt!, rt, "RevenueRecorded");
      expect(event, "RevenueRecorded event should be emitted").to.not.be.null;
      expect(event!.args.stationId).to.equal(STN_1);
      expect(event!.args.distributableKrw).to.equal(5000n);
      expect(event!.args.accumulated).to.equal(5000n);
      expect(event!.args.period_yyyyMM).to.equal(PERIOD);
    });

    it("emits accumulated values correctly across consecutive records", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);

      const tx2 = await rt.recordRevenue(STN_1, 3000n, PERIOD);
      const receipt2 = await tx2.wait();

      const event2 = findEvent(receipt2!, rt, "RevenueRecorded");
      expect(event2).to.not.be.null;
      expect(event2!.args.distributableKrw).to.equal(3000n);
      expect(event2!.args.accumulated).to.equal(8000n); // 5000 + 3000
    });

    // B-3: non-sequential month writes (validates the _monthlyIndex fix)
    it("handles non-sequential month writes such as month 7 -> month 6 -> month 7", async function () {
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

    it("keeps consistency across three or more non-sequential month writes", async function () {
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

    it("returns an empty array from getMonthlyHistory for a station with no records", async function () {
      const history = await rt.getMonthlyHistory(STN_1);
      expect(history.length).to.equal(0);
    });
  });

  // ── recordRevenue failures ─────────────────────────────────────────────────

  describe("recordRevenue failures", function () {
    it("reverts with StationNotRegistered for an unknown stationId", async function () {
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

    it("reverts with CallerNotBridge for an unauthorized caller", async function () {
      await expectRevertCustomError(
        rt.connect(nonAdmin).recordRevenue(STN_1, 5000n, PERIOD),
        "CallerNotBridge"
      );
    });
  });

  // ── claimStation success ───────────────────────────────────────────────────

  describe("claimStation success", function () {
    beforeEach(async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
    });

    it("settles a single station", async function () {
      const amount = await rt.claimStation.staticCall(STN_1, PERIOD);
      expect(amount).to.equal(5000n);

      await rt.claimStation(STN_1, PERIOD);

      const [, , pend1] = await rt.getStationRevenue(STN_1);
      expect(pend1).to.equal(0n);

      // STN_2 remains unaffected
      const [, , pend2] = await rt.getStationRevenue(STN_2);
      expect(pend2).to.equal(3000n);
    });

    it("emits StationClaimed", async function () {
      const tx = await rt.claimStation(STN_1, PERIOD);
      const receipt = await tx.wait();

      const event = findEvent(receipt!, rt, "StationClaimed");
      expect(event).to.not.be.null;
      expect(event!.args.stationId).to.equal(STN_1);
      expect(event!.args.amount).to.equal(5000n);
      expect(event!.args.period_yyyyMM).to.equal(PERIOD);
    });

    it("emits SettlementRecorded", async function () {
      const tx = await rt.claimStation(STN_1, PERIOD);
      const receipt = await tx.wait();

      const event = findEvent(receipt!, rt, "SettlementRecorded");
      expect(event).to.not.be.null;
      expect(event!.args.stationId).to.equal(STN_1);
      expect(event!.args.amount).to.equal(5000n);
      expect(event!.args.period_yyyyMM).to.equal(PERIOD);
      expect(event!.args.settledAt > 0n).to.be.true;
    });

    it("stores settlement history", async function () {
      await rt.claimStation(STN_1, PERIOD);

      const history = await rt.getSettlementHistory(STN_1);
      expect(history.length).to.equal(1);
      expect(history[0].amount).to.equal(5000n);
    });
  });

  // ── claimStation failures ──────────────────────────────────────────────────

  describe("claimStation failures", function () {
    it("reverts with StationNotRegistered for an unknown stationId", async function () {
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

    it("reverts for an unauthorized caller", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await expectRevert(
        rt.connect(nonAdmin).claimStation(STN_1, PERIOD)
      );
    });
  });

  // ── Pausable: claimStation ──────────────────────────────────────────────────

  describe("Pausable: claimStation", function () {
    it("reverts claimStation() with EnforcedPause while paused", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.pause();
      await expectRevertCustomError(
        rt.claimStation(STN_1, PERIOD),
        "EnforcedPause"
      );
    });
  });

  // ── view functions ─────────────────────────────────────────────────────────

  describe("view functions", function () {
    beforeEach(async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.recordRevenue(STN_3, 10000n, PERIOD);
      await rt.recordRevenue(STN_4, 7000n, PERIOD);
    });

    it("returns pending revenue for the Seoul region from getRegionRevenue", async function () {
      const pending = await rt.getRegionRevenue(REGION_SEOUL);
      expect(pending).to.equal(18000n); // STN_1 + STN_2 + STN_3
    });

    it("returns pending revenue for the Busan region from getRegionRevenue", async function () {
      const pending = await rt.getRegionRevenue(REGION_BUSAN);
      expect(pending).to.equal(7000n); // STN_4 only
    });

    it("returns 0 from getStationRevenuePeriod for an unrecorded period", async function () {
      const amount = await rt.getStationRevenuePeriod(STN_1, PERIOD_2);
      expect(amount).to.equal(0n);
    });

    // T05: verify getMonthlyHistory length and entries after multi-month writes
    it("verifies getMonthlyHistory item count and entries after multi-month writes (T05)", async function () {
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

    // T05: verify getSettlementHistory length and entries after multiple settlements
    it("verifies getSettlementHistory item count and entries after multiple settlements (T05)", async function () {
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

    // B-6: missing-data lookups
    it("returns 0,0,0 from getStationRevenue() for a station with no recorded revenue", async function () {
      const STN_5 = b32("STATION-005");
      await stationRegistry.registerStation(STN_5, REGION_BUSAN, "Busan Gijang");

      const [acc, set, pend] = await rt.getStationRevenue(STN_5);
      expect(acc).to.equal(0n);
      expect(set).to.equal(0n);
      expect(pend).to.equal(0n);
    });

    it("returns 0 from getRegionRevenue() for a region with no records", async function () {
      const REGION_JEJU = regionBytes4("KR49");
      const pending = await rt.getRegionRevenue(REGION_JEJU);
      expect(pending).to.equal(0n);
    });

    it("returns an empty array from getSettlementHistory() for a station with no settlements", async function () {
      const history = await rt.getSettlementHistory(STN_1);
      expect(history.length).to.equal(0);
    });
  });

  // ── paginated view functions ───────────────────────────────────────────────

  describe("paginated view functions", function () {
    beforeEach(async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.recordRevenue(STN_3, 10000n, PERIOD);
      await rt.recordRevenue(STN_4, 7000n, PERIOD);
    });

    it("returns the full Seoul range from getRegionRevenuePaginated()", async function () {
      const [pend, processed, hasMore] = await rt.getRegionRevenuePaginated(REGION_SEOUL, 0n, 10n);
      expect(pend).to.equal(18000n); // STN_1 + STN_2 + STN_3
      expect(processed).to.equal(3n);
      expect(hasMore).to.equal(false);
    });

    it("returns a partial range from getRegionRevenuePaginated()", async function () {
      const [pend1, processed1, hasMore1] = await rt.getRegionRevenuePaginated(REGION_SEOUL, 0n, 2n);
      expect(processed1).to.equal(2n);
      expect(hasMore1).to.equal(true);

      const [pend2, processed2, hasMore2] = await rt.getRegionRevenuePaginated(REGION_SEOUL, 2n, 2n);
      expect(processed2).to.equal(1n);
      expect(hasMore2).to.equal(false);

      // Sum must match the full-range value
      expect(pend1 + pend2).to.equal(18000n);
    });

    it("returns 0 for an empty region from getRegionRevenuePaginated()", async function () {
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

  // ── T01: cross-checking data consistency ───────────────────────────────────

  describe("cross-checking data consistency (T01)", function () {
    it("matches region revenue to the sum of pending revenue for member stations", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.recordRevenue(STN_3, 10000n, PERIOD);

      const regionPending = await rt.getRegionRevenue(REGION_SEOUL);

      const [, , pend1] = await rt.getStationRevenue(STN_1);
      const [, , pend2] = await rt.getStationRevenue(STN_2);
      const [, , pend3] = await rt.getStationRevenue(STN_3);
      expect(regionPending).to.equal(pend1 + pend2 + pend3);
    });

    it("reflects settlement in settled totals and reduces pending values", async function () {
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

  // ── T02: month-boundary settlement independence ────────────────────────────

  describe("month-boundary settlement independence (T02)", function () {
    it("keeps prior settlement unchanged when new-month revenue is added after claimStation", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claimStation(STN_1, PERIOD);

      // Add new revenue in new period
      await rt.recordRevenue(STN_1, 3000n, PERIOD_2);

      const [acc, set, pend] = await rt.getStationRevenue(STN_1);
      expect(acc).to.equal(8000n);  // 5000 + 3000
      expect(set).to.equal(5000n);  // Only first claim settled
      expect(pend).to.equal(3000n); // New revenue
    });

    it("keeps station settlement independent across multiple stations", async function () {
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
    it("allows admin pause() and emits Paused", async function () {
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

    it("reverts recordRevenue() with EnforcedPause while paused", async function () {
      await rt.pause();
      await expectRevertCustomError(
        rt.recordRevenue(STN_1, 5000n, PERIOD),
        "EnforcedPause"
      );
    });

    it("allows recordRevenue() again after unpause()", async function () {
      await rt.pause();
      await rt.unpause();
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      const [accumulated] = await rt.getStationRevenue(STN_1);
      expect(accumulated).to.equal(5000n);
    });

    it("keeps view functions working while paused", async function () {
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
    it("allows admin updateBridgeAddress(newAddr) and emits the event", async function () {
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

    it("rejects calls from the previous bridge address after update", async function () {
      await rt.updateBridgeAddress(newBridge.address);

      // Old bridge (admin) can no longer call recordRevenue
      await expectRevertCustomError(
        rt.recordRevenue(STN_1, 5000n, PERIOD),
        "CallerNotBridge"
      );
    });

    it("accepts calls from the new bridge address after update", async function () {
      await rt.updateBridgeAddress(newBridge.address);

      // New bridge can call recordRevenue
      await rt.connect(newBridge).recordRevenue(STN_1, 5000n, PERIOD);
      const [accumulated] = await rt.getStationRevenue(STN_1);
      expect(accumulated).to.equal(5000n);
    });
  });

  // ── B-5: post-settlement view consistency ─────────────────────────────────

  describe("view consistency after settlement", function () {
    it("returns settled = accumulated and pending = 0 after claimStation", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claimStation(STN_1, PERIOD);

      const [acc, set, pend] = await rt.getStationRevenue(STN_1);
      expect(acc).to.equal(5000n);
      expect(set).to.equal(5000n);
      expect(pend).to.equal(0n);
    });

    it("keeps pending values correct after partial settlement and new revenue", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claimStation(STN_1, PERIOD);

      // Add more revenue after settlement
      await rt.recordRevenue(STN_1, 3000n, PERIOD_2);

      const [acc, set, pend] = await rt.getStationRevenue(STN_1);
      expect(acc).to.equal(8000n);  // 5000 + 3000
      expect(set).to.equal(5000n);  // Only first claim
      expect(pend).to.equal(3000n); // New revenue
    });

    it("keeps claimStation from affecting region revenue for other stations", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_3, 10000n, PERIOD);

      // Claim STN_1 only
      await rt.claimStation(STN_1, PERIOD);

      // Region revenue should decrease by STN_1's amount
      const pending = await rt.getRegionRevenue(REGION_SEOUL);
      expect(pending).to.equal(10000n); // Only STN_3 pending remains
    });

    it("accumulates settlementHistory after multiple settlements", async function () {
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

  // ── claimRegion success ────────────────────────────────────────────────────

  describe("claimRegion success", function () {
    beforeEach(async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.recordRevenue(STN_3, 8000n, PERIOD);
      await rt.recordRevenue(STN_4, 4000n, PERIOD);
    });

    it("settles all stations in the region at once", async function () {
      // Seoul: STN_1(5000) + STN_2(3000) + STN_3(8000) = 16000
      const [totalClaimed, stationCount] = await rt.claimRegion.staticCall(REGION_SEOUL, PERIOD);
      expect(totalClaimed).to.equal(16000n);
      expect(stationCount).to.equal(3n);
    });

    it("sets each station pending value to 0 after settlement", async function () {
      await rt.claimRegion(REGION_SEOUL, PERIOD);
      const [, , pend1] = await rt.getStationRevenue(STN_1);
      const [, , pend2] = await rt.getStationRevenue(STN_2);
      const [, , pend3] = await rt.getStationRevenue(STN_3);
      expect(pend1).to.equal(0n);
      expect(pend2).to.equal(0n);
      expect(pend3).to.equal(0n);
    });

    it("records RegionAttestation on-chain", async function () {
      await rt.claimRegion(REGION_SEOUL, PERIOD);
      const att = await rt.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.regionId).to.equal(REGION_SEOUL);
      expect(att.period_yyyyMM).to.equal(PERIOD);
      expect(att.distributableKrw).to.equal(16000n);
      expect(att.stationCount).to.equal(3n);
      expect(att.finalizedAt).to.be.greaterThan(0n);
    });

    it("emits RegionSettlementFinalized", async function () {
      const tx = await rt.claimRegion(REGION_SEOUL, PERIOD);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, rt, "RegionSettlementFinalized");
      expect(event).to.not.be.null;
      expect(event.args.regionId).to.equal(REGION_SEOUL);
      expect(event.args.totalAmount).to.equal(16000n);
      expect(event.args.stationCount).to.equal(3n);
    });

    it("emits SettlementRecorded for each station", async function () {
      const tx = await rt.claimRegion(REGION_SEOUL, PERIOD);
      const receipt = await tx.wait();
      const events = findAllEvents(receipt!, rt, "SettlementRecorded");
      expect(events.length).to.equal(3);
    });

    it("skips stations that have already been settled", async function () {
      // Settle STN_1 individually first
      await rt.claimStation(STN_1, PERIOD);
      // Then claimRegion — STN_1 pending=0 should be skipped
      const [totalClaimed, stationCount] = await rt.claimRegion.staticCall(REGION_SEOUL, PERIOD);
      expect(totalClaimed).to.equal(11000n); // STN_2(3000) + STN_3(8000)
      expect(stationCount).to.equal(2n);
    });
  });

  // ── claimRegion failures ───────────────────────────────────────────────────

  describe("claimRegion failures", function () {
    it("reverts for an unauthorized caller", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await expectRevertCustomError(
        rt.connect(nonAdmin).claimRegion(REGION_SEOUL, PERIOD),
        "AccessControlUnauthorizedAccount"
      );
    });

    it("reverts with NothingToClaim when no stations or no pending revenue exist", async function () {
      await expectRevertCustomError(
        rt.claimRegion(REGION_DAEGU, PERIOD),
        "NothingToClaim"
      );
    });

    it("reverts with PeriodAlreadyFinalized for a duplicate finalized period", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claimRegion(REGION_SEOUL, PERIOD);
      await expectRevertCustomError(
        rt.claimRegion(REGION_SEOUL, PERIOD),
        "PeriodAlreadyFinalized"
      );
    });

    it("reverts with EnforcedPause while paused", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.pause();
      await expectRevertCustomError(
        rt.claimRegion(REGION_SEOUL, PERIOD),
        "EnforcedPause"
      );
    });
  });

  // ── claimRegion: period acts as a label, not a filter ─────────────────────

  describe("claimRegion period as a label", function () {
    it("settles all pending revenue regardless of the recorded source period", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_1, 1000n, PERIOD_2);
      // claimRegion(PERIOD) — PERIOD is just a label, settles ALL pending
      const [totalClaimed] = await rt.claimRegion.staticCall(REGION_SEOUL, PERIOD);
      expect(totalClaimed).to.equal(6000n); // 5000 + 1000
    });
  });

  // ── getRegionAttestation ──────────────────────────────────────────────────

  describe("getRegionAttestation", function () {
    it("returns the expected attestation after settlement", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.claimRegion(REGION_SEOUL, PERIOD);
      const att = await rt.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(8000n);
      expect(att.stationCount).to.equal(2n);
    });

    it("returns an empty attestation for an unfinalized period", async function () {
      const att = await rt.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(0n);
      expect(att.stationCount).to.equal(0n);
      expect(att.finalizedAt).to.equal(0n);
    });
  });

  // ── getRegionAttestationPeriods ───────────────────────────────────────────

  describe("getRegionAttestationPeriods", function () {
    it("returns the list of finalized periods", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.claimRegion(REGION_SEOUL, PERIOD);
      // Add more revenue and finalize another period
      await rt.recordRevenue(STN_2, 2000n, PERIOD_2);
      await rt.claimRegion(REGION_SEOUL, PERIOD_2);

      const periods = await rt.getRegionAttestationPeriods(REGION_SEOUL);
      expect(periods.length).to.equal(2);
      expect(periods[0]).to.equal(PERIOD);
      expect(periods[1]).to.equal(PERIOD_2);
    });

    it("returns finalized periods in ascending order even after non-sequential claimRegion calls", async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD_2);
      await rt.claimRegion(REGION_SEOUL, PERIOD_2);

      await rt.recordRevenue(STN_2, 2000n, PERIOD);
      await rt.claimRegion(REGION_SEOUL, PERIOD);

      const periods = await rt.getRegionAttestationPeriods(REGION_SEOUL);
      expect(periods.length).to.equal(2);
      expect(periods[0]).to.equal(PERIOD);
      expect(periods[1]).to.equal(PERIOD_2);
    });

    it("keeps the largest YYYYMM as the final item", async function () {
      await rt.recordRevenue(STN_1, 4000n, PERIOD_2);
      await rt.claimRegion(REGION_SEOUL, PERIOD_2);

      await rt.recordRevenue(STN_2, 1500n, PERIOD_3);
      await rt.claimRegion(REGION_SEOUL, PERIOD_3);

      await rt.recordRevenue(STN_3, 2500n, PERIOD);
      await rt.claimRegion(REGION_SEOUL, PERIOD);

      const periods = await rt.getRegionAttestationPeriods(REGION_SEOUL);
      expect(periods.length).to.equal(3);
      expect(periods[periods.length - 1]).to.equal(PERIOD_2);
    });

    it("returns an empty array when attestation does not exist", async function () {
      const periods = await rt.getRegionAttestationPeriods(REGION_SEOUL);
      expect(periods.length).to.equal(0);
    });
  });

  // ── claimRegionPaginated ──────────────────────────────────────────────────

  describe("claimRegionPaginated", function () {
    beforeEach(async function () {
      await rt.recordRevenue(STN_1, 5000n, PERIOD);
      await rt.recordRevenue(STN_2, 3000n, PERIOD);
      await rt.recordRevenue(STN_3, 8000n, PERIOD);
    });

    it("settles by page using offset + limit", async function () {
      const [, , processed1, hasMore1] = await rt.claimRegionPaginated.staticCall(
        REGION_SEOUL, PERIOD, 0n, 1n
      );
      expect(processed1).to.equal(1n);
      expect(hasMore1).to.equal(true);
      // Execute first page
      await rt.claimRegionPaginated(REGION_SEOUL, PERIOD, 0n, 1n);

      // Second page
      const [, , processed2, hasMore2] = await rt.claimRegionPaginated.staticCall(
        REGION_SEOUL, PERIOD, 1n, 1n
      );
      expect(processed2).to.equal(1n);
      expect(hasMore2).to.equal(true);
    });

    it("LimitZero → revert", async function () {
      await expectRevertCustomError(
        rt.claimRegionPaginated(REGION_SEOUL, PERIOD, 0n, 0n),
        "LimitZero"
      );
    });

    it("OffsetOutOfBounds → revert", async function () {
      await expectRevertCustomError(
        rt.claimRegionPaginated(REGION_SEOUL, PERIOD, 100n, 10n),
        "OffsetOutOfBounds"
      );
    });

    it("reverts for an unauthorized caller", async function () {
      await expectRevertCustomError(
        rt.connect(nonAdmin).claimRegionPaginated(REGION_SEOUL, PERIOD, 0n, 10n),
        "AccessControlUnauthorizedAccount"
      );
    });

    it("matches claimRegion when processed all at once", async function () {
      const [totalPag] = await rt.claimRegionPaginated.staticCall(
        REGION_SEOUL, PERIOD, 0n, 100n
      );
      const [totalFull] = await rt.claimRegion.staticCall(REGION_SEOUL, PERIOD);
      expect(totalPag).to.equal(totalFull);
    });
  });

  // ── UUPS Upgrade ───────────────────────────────────────────────────────────

  describe("UUPS upgrades", function () {
    it("allows admin upgrade", async function () {
      const RTv2 = await ethers.getContractFactory("RevenueTracker");
      const v2Impl = await RTv2.deploy();
      await v2Impl.waitForDeployment();

      await rt.upgradeToAndCall(await v2Impl.getAddress(), "0x");
    });

    it("reverts upgrade from an unauthorized address", async function () {
      const RTv2 = await ethers.getContractFactory("RevenueTracker");
      const v2Impl = await RTv2.deploy();
      await v2Impl.waitForDeployment();

      await expectRevert(
        rt.connect(nonAdmin).upgradeToAndCall(await v2Impl.getAddress(), "0x")
      );
    });

    // B-2: preserve existing data after upgrade
    it("preserves existing revenue data after upgrade", async function () {
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
