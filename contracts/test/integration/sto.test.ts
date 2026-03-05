/**
 * STO Pipeline Integration Tests (Phase 1 → 2 → 3)
 *
 * Full pipeline: SE chip enrollment → charging session → revenue recording →
 * STO issuance → revenue finalization.
 *
 * Deploys 7 contracts (all UUPS proxy):
 *   DeviceRegistry + StationRegistry + ChargeTransaction + RevenueTracker(V2) +
 *   ChargeRouter + RegionSTOFactory + RegionSTO(s)
 */

import hre from "hardhat";
import { expect } from "chai";
import { Wallet, HDNodeWallet } from "ethers";
import {
  b32,
  regionBytes4,
  getPublicKey64,
  signRaw,
  buildMsgHash,
  deployUUPSProxy,
} from "../helpers/helpers.js";
import type {
  ChargeRouter,
  ChargeTransaction,
  DeviceRegistry,
  RevenueTracker,
  RevenueTrackerV2,
  StationRegistry,
  RegionSTO,
  RegionSTOFactory,
} from "../../typechain-types/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARGER_1 = b32("CHARGER-001");
const CHARGER_2 = b32("CHARGER-002");
const CHARGER_B1 = b32("CHARGER-B01");
const STN_SEOUL_1 = b32("STN-SEOUL-001");
const STN_SEOUL_2 = b32("STN-SEOUL-002");
const STN_BUSAN_1 = b32("STN-BUSAN-001");
const REGION_SEOUL = regionBytes4("KR11");
const REGION_BUSAN = regionBytes4("KR26");
const SECP256K1 = 0;
const PERIOD = 202606n;

const DEFAULT_START_TS = 1700000000n;
const DEFAULT_END_TS   = 1700003600n;
const DEFAULT_KRW      = 5000n;
const DEFAULT_ENERGY   = 1000n;

let sessionCounter = 0;
function nextSessionId(): string {
  sessionCounter++;
  return b32(`STO-SESS-${String(sessionCounter).padStart(4, "0")}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("STO Pipeline (Phase 1 → 2 → 3)", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let investor: Awaited<ReturnType<typeof ethers.getSigner>>;
  let seWallets: Map<string, HDNodeWallet>;

  let deviceRegistry: DeviceRegistry;
  let stationRegistry: StationRegistry;
  let revenueTracker: RevenueTrackerV2;
  let chargeRouter: ChargeRouter;
  let factory: RegionSTOFactory;

  beforeEach(async function () {
    sessionCounter = 0;
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    investor = signers[1];
    seWallets = new Map();
    for (const cid of [CHARGER_1, CHARGER_2, CHARGER_B1]) {
      seWallets.set(cid, Wallet.createRandom() as unknown as HDNodeWallet);
    }

    // ── Phase 1: DeviceRegistry + StationRegistry ──────────────────

    const { contract: dr } = await deployUUPSProxy<DeviceRegistry>(ethers, "DeviceRegistry");
    await dr.initialize(admin.address);
    deviceRegistry = dr;

    const { contract: sr } = await deployUUPSProxy<StationRegistry>(ethers, "StationRegistry");
    await sr.initialize(admin.address, await dr.getAddress());
    stationRegistry = sr;

    // ── Phase 2: ChargeTransaction + RevenueTracker + ChargeRouter ──

    const { contract: ct } = await deployUUPSProxy<ChargeTransaction>(ethers, "ChargeTransaction");

    const { contract: rt, proxy: rtProxy } = await deployUUPSProxy<RevenueTracker>(ethers, "RevenueTracker");

    const { contract: cr } = await deployUUPSProxy<ChargeRouter>(ethers, "ChargeRouter");
    chargeRouter = cr;

    const crAddr = await cr.getAddress();
    await ct.initialize(
      await dr.getAddress(),
      await sr.getAddress(),
      crAddr,   // bridge = ChargeRouter
      admin.address,
    );
    await rt.initialize(
      await sr.getAddress(),
      crAddr,   // bridge = ChargeRouter
      admin.address,
    );
    await cr.initialize(
      await ct.getAddress(),
      await rt.getAddress(),
      admin.address, // bridge = admin for testing
      admin.address,
    );

    // Upgrade RevenueTracker V1 → V2
    const V2Factory = await ethers.getContractFactory("RevenueTrackerV2");
    const v2Impl = await V2Factory.deploy();
    await v2Impl.waitForDeployment();
    await rt.upgradeToAndCall(await v2Impl.getAddress(), "0x");
    revenueTracker = (await ethers.getContractAt("RevenueTrackerV2", await rtProxy.getAddress())) as unknown as RevenueTrackerV2;

    // ── Phase 3: RegionSTOFactory ──────────────────────────────────

    const RegionSTOImplFactory = await ethers.getContractFactory("RegionSTO");
    const regionSTOImpl = await RegionSTOImplFactory.deploy();
    await regionSTOImpl.waitForDeployment();

    const { contract: f } = await deployUUPSProxy<RegionSTOFactory>(ethers, "RegionSTOFactory");
    await f.initialize(
      admin.address,
      await regionSTOImpl.getAddress(),
      await sr.getAddress(),
    );
    factory = f;

    // ── Register infrastructure ────────────────────────────────────

    // SE chips (each charger has unique key)
    for (const cid of [CHARGER_1, CHARGER_2, CHARGER_B1]) {
      await deviceRegistry.enrollChip(
        cid,
        getPublicKey64(seWallets.get(cid)!),
        SECP256K1,
      );
    }

    // Stations
    await stationRegistry.registerStation(STN_SEOUL_1, REGION_SEOUL, "Seoul Gangnam");
    await stationRegistry.registerStation(STN_SEOUL_2, REGION_SEOUL, "Seoul Seocho");
    await stationRegistry.registerStation(STN_BUSAN_1, REGION_BUSAN, "Busan Haeundae");

    // Chargers under stations
    await stationRegistry.registerCharger(CHARGER_1, STN_SEOUL_1, 0);
    await stationRegistry.registerCharger(CHARGER_2, STN_SEOUL_2, 1);
    await stationRegistry.registerCharger(CHARGER_B1, STN_BUSAN_1, 0);
  });

  // ── Helper: processCharge shortcut ─────────────────────────────

  async function doCharge(
    chargerId: string,
    stationId: string,
    kwh: bigint = DEFAULT_ENERGY,
    krw: bigint = DEFAULT_KRW,
  ) {
    const sessionId = nextSessionId();
    const wallet = seWallets.get(chargerId)!;
    const msgHash = buildMsgHash(chargerId, kwh, DEFAULT_START_TS, DEFAULT_END_TS);
    const seSig = signRaw(wallet, msgHash);

    await chargeRouter.processCharge(
      {
        sessionId,
        chargerId,
        chargerType: 0,
        energyKwh: kwh,
        startTimestamp: DEFAULT_START_TS,
        endTimestamp: DEFAULT_END_TS,
        vehicleCategory: 0,
        gridRegionCode: "0x00000000",
        stationId,
        distributableKrw: krw,
        seSignature: seSig,
      },
      PERIOD,
    );
  }

  // ── Full Pipeline ─────────────────────────────────────────────────────────

  describe("Full Pipeline", function () {
    it("Phase 1: SE chip enrollment + Seoul station registration", async function () {
      // Already completed in beforeEach — verify only
      expect(await stationRegistry.isRegistered(STN_SEOUL_1)).to.equal(true);
      const station = await stationRegistry.getStation(STN_SEOUL_1);
      expect(station.regionId).to.equal(REGION_SEOUL);
    });

    it("Phase 2: ChargeRouter.processCharge() records charging session + revenue", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      const [acc] = await revenueTracker.getStationRevenue(STN_SEOUL_1);
      expect(acc).to.equal(5000n);
    });

    it("Phase 3a: RegionSTOFactory.deployAllRegions() deploys all region tokens", async function () {
      await factory.deployAllRegions();
      expect(await factory.getRegionCount()).to.equal(17n);
      const seoulAddr = await factory.getRegionToken(REGION_SEOUL);
      expect(seoulAddr).to.not.equal("0x0000000000000000000000000000000000000000");
    });

    it("Phase 3b: issueTranche() mints Seoul STO tokens", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1);
      await factory.deployAllRegions();

      const seoulAddr = await factory.getRegionToken(REGION_SEOUL);
      const seoulSTO = (await ethers.getContractAt("RegionSTO", seoulAddr)) as unknown as RegionSTO;

      await seoulSTO.issueTranche(investor.address, 1000n, [STN_SEOUL_1, STN_SEOUL_2]);
      expect(await seoulSTO.totalSupply()).to.equal(1000n);
      expect(await seoulSTO.balanceOf(investor.address)).to.equal(1000n);
    });

    it("Phase 3c: claimRegion() finalizes Seoul region revenue", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await doCharge(CHARGER_2, STN_SEOUL_2, 2000n, 8000n);

      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const att = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(13000n); // 5000 + 8000
    });

    it("Verify: totalSupply matches issuance amount", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1);
      await factory.deployAllRegions();

      const seoulAddr = await factory.getRegionToken(REGION_SEOUL);
      const seoulSTO = (await ethers.getContractAt("RegionSTO", seoulAddr)) as unknown as RegionSTO;

      await seoulSTO.issueTranche(investor.address, 500n, [STN_SEOUL_1]);
      await seoulSTO.issueTranche(investor.address, 300n, [STN_SEOUL_2]);
      expect(await seoulSTO.totalSupply()).to.equal(800n);
    });

    it("Verify: RegionAttestation.distributableKrw matches recorded revenue", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 7000n);
      await doCharge(CHARGER_2, STN_SEOUL_2, 500n, 3000n);

      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const att = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(10000n);
    });

    it("Verify: RegionAttestation.stationCount matches registered station count", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await doCharge(CHARGER_2, STN_SEOUL_2, 1000n, 3000n);

      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const att = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      // Seoul has 2 stations
      expect(att.stationCount).to.equal(2n);
    });
  });

  // ── Multi-region scenarios ────────────────────────────────────────────────

  describe("Multi-region scenarios", function () {
    it("should process stations in different regions independently", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await doCharge(CHARGER_B1, STN_BUSAN_1, 500n, 2000n);

      // Settle Seoul only
      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const attSeoul = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(attSeoul.distributableKrw).to.equal(5000n);

      // Busan still unsettled
      const pendingBusan = await revenueTracker.getRegionRevenue(REGION_BUSAN);
      expect(pendingBusan).to.equal(2000n);
    });

    it("should allow simultaneous tranche issuance across regions", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1);
      await doCharge(CHARGER_B1, STN_BUSAN_1);
      await factory.deployAllRegions();

      const seoulAddr = await factory.getRegionToken(REGION_SEOUL);
      const busanAddr = await factory.getRegionToken(REGION_BUSAN);
      const seoulSTO = (await ethers.getContractAt("RegionSTO", seoulAddr)) as unknown as RegionSTO;
      const busanSTO = (await ethers.getContractAt("RegionSTO", busanAddr)) as unknown as RegionSTO;

      await seoulSTO.issueTranche(investor.address, 1000n, [STN_SEOUL_1]);
      await busanSTO.issueTranche(investor.address, 500n, [STN_BUSAN_1]);

      expect(await seoulSTO.totalSupply()).to.equal(1000n);
      expect(await busanSTO.totalSupply()).to.equal(500n);
    });
  });

  // ── Independence verification ─────────────────────────────────────────────

  describe("Independence verification", function () {
    it("claimRegion should work without STO issuance", async function () {
      // Revenue only — no RegionSTO deployed
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const att = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(5000n);
      expect(att.stationCount).to.equal(1n);
    });

    it("issueTranche should work without revenue recording", async function () {
      // Token issuance only — no charging sessions
      await factory.deployAllRegions();
      const seoulAddr = await factory.getRegionToken(REGION_SEOUL);
      const seoulSTO = (await ethers.getContractAt("RegionSTO", seoulAddr)) as unknown as RegionSTO;
      await seoulSTO.issueTranche(investor.address, 1000n, [STN_SEOUL_1]);
      expect(await seoulSTO.totalSupply()).to.equal(1000n);
    });
  });

  // ── Complex settlement scenarios ──────────────────────────────────────────

  describe("Complex settlement scenarios", function () {
    it("should finalize all revenue after multiple charging sessions", async function () {
      // Multiple sessions on Seoul stations
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await doCharge(CHARGER_1, STN_SEOUL_1, 2000n, 8000n);
      await doCharge(CHARGER_2, STN_SEOUL_2, 500n, 3000n);

      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const att = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(16000n); // 5000+8000+3000
      expect(att.stationCount).to.equal(2n);
    });

    it("should only settle new revenue in subsequent claimRegion", async function () {
      // First revenue + settlement
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);

      const att1 = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att1.distributableKrw).to.equal(5000n);

      // Second revenue (new charging session → added to pending)
      await doCharge(CHARGER_2, STN_SEOUL_2, 500n, 3000n);

      // Second settlement: only includes pending since first settlement
      const PERIOD_NEXT = 202607n;
      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD_NEXT);
      const att2 = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD_NEXT);
      expect(att2.distributableKrw).to.equal(3000n);
    });
  });
});
