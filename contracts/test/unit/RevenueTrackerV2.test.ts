/**
 * RevenueTracker V2 Unit Tests
 *
 * UUPS upgrade: V1 → V2. Existing storage preservation + Phase 3 extension validation.
 *
 * claimRegion / claimRegionPaginated / getRegionAttestation /
 * getRegionAttestationPeriods / regression tests.
 */

import hre from "hardhat";
import { expect } from "chai";
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

const STN_1 = b32("STATION-001");  // Seoul
const STN_2 = b32("STATION-002");  // Seoul
const STN_3 = b32("STATION-003");  // Seoul
const STN_4 = b32("STATION-004");  // Busan
const STN_5 = b32("STATION-005");  // Seoul
const REGION_SEOUL = regionBytes4("KR11");
const REGION_BUSAN = regionBytes4("KR26");
const REGION_DAEGU = regionBytes4("KR27");
const PERIOD = 202606n;
const PERIOD_2 = 202607n;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RevenueTracker V2", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;

  let stationRegistry: StationRegistry;
  let rtV1: RevenueTracker;
  let rtV2: RevenueTrackerV2;
  let proxyAddress: string;

  /**
   * Common setup:
   *  1. Deploy DeviceRegistry + StationRegistry
   *  2. Deploy RevenueTracker V1 (UUPS proxy) + initialize
   *  3. Register stations (all EnergyFi-owned)
   *  4. Record V1 revenue (pre-upgrade data)
   *  5. Perform station settlement on V1 (creates settlement history)
   *  6. Deploy V2 impl → upgradeToAndCall
   *  7. rtV2 = V2 interface on the same proxy
   */
  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    nonAdmin = signers[1];

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

    // Register stations (all EnergyFi-owned)
    await stationRegistry.registerStation(STN_1, REGION_SEOUL, "Seoul Gangnam");
    await stationRegistry.registerStation(STN_2, REGION_SEOUL, "Seoul Seocho");
    await stationRegistry.registerStation(STN_3, REGION_SEOUL, "Seoul Jongno");
    await stationRegistry.registerStation(STN_4, REGION_BUSAN, "Busan Haeundae");
    await stationRegistry.registerStation(STN_5, REGION_SEOUL, "Seoul Mapo");

    // Record V1 revenue (pre-upgrade data)
    await rtV1.recordRevenue(STN_1, 5000n, PERIOD);
    await rtV1.recordRevenue(STN_2, 3000n, PERIOD);
    await rtV1.recordRevenue(STN_3, 8000n, PERIOD);
    await rtV1.recordRevenue(STN_4, 4000n, PERIOD);
    await rtV1.recordRevenue(STN_5, 6000n, PERIOD);

    // Station settlement on V1 → creates settlement history
    await rtV1.claimStation(STN_1, PERIOD);

    // Upgrade V1 → V2
    const V2Factory = await ethers.getContractFactory("RevenueTrackerV2");
    const v2Impl = await V2Factory.deploy();
    await v2Impl.waitForDeployment();
    await rtV1.upgradeToAndCall(await v2Impl.getAddress(), "0x");

    // Get V2 interface on same proxy
    rtV2 = (await ethers.getContractAt("RevenueTrackerV2", proxyAddress)) as unknown as RevenueTrackerV2;
  });

  // ── UUPS Upgrade: V1 → V2 ────────────────────────────────────────────────

  describe("UUPS Upgrade: V1 → V2", function () {
    it("should preserve stationAccumulated and stationSettled", async function () {
      // STN_1: V1 claimStation settled=5000, pending=0
      const [acc1, settled1, pending1] = await rtV2.getStationRevenue(STN_1);
      expect(acc1).to.equal(5000n);
      expect(settled1).to.equal(5000n);
      expect(pending1).to.equal(0n);

      // STN_3: not claimed in V1
      const [acc3, settled3, pending3] = await rtV2.getStationRevenue(STN_3);
      expect(acc3).to.equal(8000n);
      expect(settled3).to.equal(0n);
      expect(pending3).to.equal(8000n);
    });

    it("should preserve monthly history", async function () {
      const amount = await rtV2.getStationRevenuePeriod(STN_1, PERIOD);
      expect(amount).to.equal(5000n);
    });

    it("should preserve V1 settlement history in V2", async function () {
      const history1 = await rtV2.getSettlementHistory(STN_1);
      expect(history1.length).to.equal(1);
      expect(history1[0].amount).to.equal(5000n);

      // STN_2: not claimed in V1
      const history2 = await rtV2.getSettlementHistory(STN_2);
      expect(history2.length).to.equal(0);
    });
  });

  // ── claimRegion success ───────────────────────────────────────────────────

  describe("claimRegion success", function () {
    it("should settle all stations in the region", async function () {
      // Seoul: STN_2(3000) + STN_3(8000) + STN_5(6000) = 17000
      // STN_1 was already settled in V1 (pending=0), so skipped
      const [totalClaimed, stationCount] = await rtV2.claimRegion.staticCall(REGION_SEOUL, PERIOD);
      expect(totalClaimed).to.equal(17000n);
      expect(stationCount).to.equal(3n);
    });

    it("should reset pending to 0 for each station", async function () {
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const [, , pending2] = await rtV2.getStationRevenue(STN_2);
      const [, , pending3] = await rtV2.getStationRevenue(STN_3);
      const [, , pending5] = await rtV2.getStationRevenue(STN_5);
      expect(pending2).to.equal(0n);
      expect(pending3).to.equal(0n);
      expect(pending5).to.equal(0n);
    });

    it("should record RegionAttestation on-chain", async function () {
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const att = await rtV2.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.regionId).to.equal(REGION_SEOUL);
      expect(att.period_yyyyMM).to.equal(PERIOD);
      expect(att.distributableKrw).to.equal(17000n);
      expect(att.stationCount).to.equal(3n);
      expect(att.finalizedAt).to.be.greaterThan(0n);
    });

    it("should emit RegionSettlementFinalized event", async function () {
      const tx = await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, rtV2, "RegionSettlementFinalized");
      expect(event).to.not.be.null;
      expect(event.args.regionId).to.equal(REGION_SEOUL);
      expect(event.args.totalAmount).to.equal(17000n);
      expect(event.args.stationCount).to.equal(3n);
    });

    it("should emit SettlementRecorded for each station", async function () {
      const tx = await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const receipt = await tx.wait();
      const events = findAllEvents(receipt!, rtV2, "SettlementRecorded");
      // STN_2, STN_3, STN_5 — three stations with pending revenue
      expect(events.length).to.equal(3);
    });

    it("should correctly process regions with multiple stations", async function () {
      // Seoul: STN_2(3000) + STN_3(8000) + STN_5(6000) = 17000
      const tx = await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, rtV2, "RegionSettlementFinalized");
      expect(event.args.totalAmount).to.equal(17000n);
    });
  });

  // ── claimRegion failure ───────────────────────────────────────────────────

  describe("claimRegion failure", function () {
    it("should revert when called by non-admin", async function () {
      await expectRevertCustomError(
        rtV2.connect(nonAdmin).claimRegion(REGION_SEOUL, PERIOD),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("should revert when no stations or all pending is 0", async function () {
      // Daegu has no stations
      await expectRevertCustomError(
        rtV2.claimRegion(REGION_DAEGU, PERIOD),
        "NothingToClaim",
      );
    });

    it("should revert PeriodAlreadyFinalized on duplicate period", async function () {
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      await expectRevertCustomError(
        rtV2.claimRegion(REGION_SEOUL, PERIOD),
        "PeriodAlreadyFinalized",
      );
    });

    it("should revert when paused", async function () {
      await rtV2.pause();
      await expectRevertCustomError(
        rtV2.claimRegion(REGION_SEOUL, PERIOD),
        "EnforcedPause",
      );
    });
  });

  // ── claimRegion: period is a label, not a filter ──────────────────────────

  describe("claimRegion: period is a label, not a filter", function () {
    it("should settle all pending revenue regardless of recording period", async function () {
      // Add revenue in a different period
      await rtV2.recordRevenue(STN_3, 1000n, PERIOD_2);
      // claimRegion(PERIOD) — PERIOD is just a label for the attestation,
      // it settles ALL pending for stations in the region
      const [totalClaimed] = await rtV2.claimRegion.staticCall(REGION_SEOUL, PERIOD);
      // STN_2: 3000, STN_3: 8000+1000=9000, STN_5: 6000 → total 18000
      // (STN_1 settled in V1, pending=0)
      expect(totalClaimed).to.equal(18000n);
    });
  });

  // ── getRegionAttestation ──────────────────────────────────────────────────

  describe("getRegionAttestation", function () {
    it("should return correct attestation after claimRegion", async function () {
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      const att = await rtV2.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(17000n);
      expect(att.stationCount).to.equal(3n);
    });

    it("should return empty attestation for unfinalized period", async function () {
      const att = await rtV2.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(0n);
      expect(att.stationCount).to.equal(0n);
      expect(att.finalizedAt).to.equal(0n);
    });
  });

  // ── getRegionAttestationPeriods ───────────────────────────────────────────

  describe("getRegionAttestationPeriods", function () {
    it("should return list of finalized periods", async function () {
      await rtV2.claimRegion(REGION_SEOUL, PERIOD);
      // Add more revenue and finalize another period
      await rtV2.recordRevenue(STN_3, 2000n, PERIOD_2);
      await rtV2.claimRegion(REGION_SEOUL, PERIOD_2);

      const periods = await rtV2.getRegionAttestationPeriods(REGION_SEOUL);
      expect(periods.length).to.equal(2);
      expect(periods[0]).to.equal(PERIOD);
      expect(periods[1]).to.equal(PERIOD_2);
    });

    it("should return empty array when no attestations exist", async function () {
      const periods = await rtV2.getRegionAttestationPeriods(REGION_SEOUL);
      expect(periods.length).to.equal(0);
    });
  });

  // ── claimRegionPaginated ──────────────────────────────────────────────────

  describe("claimRegionPaginated", function () {
    it("should settle in pages using offset and limit", async function () {
      // Seoul stations with pending: STN_2(3000), STN_3(8000), STN_5(6000)
      // STN_1 settled in V1 (pending=0)
      const [claimed1, count1, processed1, hasMore1] = await rtV2.claimRegionPaginated.staticCall(
        REGION_SEOUL, PERIOD, 0n, 1n,
      );
      expect(processed1).to.equal(1n);
      expect(hasMore1).to.equal(true);
      // Execute first page
      await rtV2.claimRegionPaginated(REGION_SEOUL, PERIOD, 0n, 1n);

      // Second page
      const [claimed2, count2, processed2, hasMore2] = await rtV2.claimRegionPaginated.staticCall(
        REGION_SEOUL, PERIOD, 1n, 1n,
      );
      expect(processed2).to.equal(1n);
      expect(hasMore2).to.equal(true);
    });

    it("should revert when limit is 0", async function () {
      await expectRevertCustomError(
        rtV2.claimRegionPaginated(REGION_SEOUL, PERIOD, 0n, 0n),
        "LimitZero",
      );
    });

    it("should revert when offset is out of bounds", async function () {
      await expectRevertCustomError(
        rtV2.claimRegionPaginated(REGION_SEOUL, PERIOD, 100n, 10n),
        "OffsetOutOfBounds",
      );
    });

    it("should revert when called by non-admin", async function () {
      await expectRevertCustomError(
        rtV2.connect(nonAdmin).claimRegionPaginated(REGION_SEOUL, PERIOD, 0n, 10n),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("should produce same result as claimRegion when processing all at once", async function () {
      const [totalPag] = await rtV2.claimRegionPaginated.staticCall(
        REGION_SEOUL, PERIOD, 0n, 100n,
      );
      const [totalFull] = await rtV2.claimRegion.staticCall(REGION_SEOUL, PERIOD);
      expect(totalPag).to.equal(totalFull);
    });
  });

  // ── Regression: existing V1 functionality preserved ───────────────────────

  describe("Regression: existing V1 functionality preserved", function () {
    it("should allow recordRevenue after upgrade", async function () {
      await rtV2.recordRevenue(STN_1, 2000n, PERIOD);
      const [acc] = await rtV2.getStationRevenue(STN_1);
      expect(acc).to.equal(7000n); // 5000 + 2000
    });

    it("should allow claimStation after upgrade", async function () {
      await rtV2.recordRevenue(STN_1, 3000n, PERIOD_2);
      const amount = await rtV2.claimStation.staticCall(STN_1, PERIOD_2);
      expect(amount).to.equal(3000n);
    });

    it("should return correct data from getStationRevenue", async function () {
      // STN_3: not claimed in V1
      const [acc, settled, pending] = await rtV2.getStationRevenue(STN_3);
      expect(acc).to.equal(8000n);
      expect(settled).to.equal(0n);
      expect(pending).to.equal(8000n);
    });

    it("should return correct data from getRegionRevenue", async function () {
      // Seoul: STN_1(pending=0, settled in V1) + STN_2(3000) + STN_3(8000) + STN_5(6000) = 17000
      const pending = await rtV2.getRegionRevenue(REGION_SEOUL);
      expect(pending).to.equal(17000n);
    });

    it("should return correct data from getSettlementHistory", async function () {
      // V1 claimStation → STN_1 has 1 history entry
      const history = await rtV2.getSettlementHistory(STN_1);
      expect(history.length).to.equal(1);
      expect(history[0].amount).to.equal(5000n);

      // Additional settlement
      await rtV2.recordRevenue(STN_1, 2000n, PERIOD_2);
      await rtV2.claimStation(STN_1, PERIOD_2);
      const history2 = await rtV2.getSettlementHistory(STN_1);
      expect(history2.length).to.equal(2);
      expect(history2[1].amount).to.equal(2000n);
    });

    it("should return correct data from getMonthlyHistory", async function () {
      const history = await rtV2.getMonthlyHistory(STN_1);
      expect(history.length).to.equal(1);
      expect(history[0].period_yyyyMM).to.equal(PERIOD);
      expect(history[0].amount).to.equal(5000n);
    });
  });
});
