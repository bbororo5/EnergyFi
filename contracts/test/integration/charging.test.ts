/**
 * Charging Pipeline (Phase 1 -> 2) integration test suite
 *
 * Deploys the full 5-contract surface (all UUPS proxies):
 *   DeviceRegistry + StationRegistry + ChargeTransaction + RevenueTracker + ChargeRouter
 *
 * Verifies processCharge() atomicity: mint + recordRevenue succeed or fail together.
 *
 * R04: Pausable coverage — pause/unpause and whenNotPaused on processCharge().
 * R05: Bridge rotation — updateBridgeAddress() on CR.
 * T03: end-to-end access-control validation.
 */

import hre from "hardhat";
import { expect } from "chai";
import { Wallet, ZeroHash, HDNodeWallet } from "ethers";
import {
  expectRevert,
  expectRevertCustomError,
  b32,
  regionBytes4,
  getPublicKey64,
  signRaw,
  buildMsgHash,
  findEvent,
  deployUUPSProxy,
} from "../helpers/helpers.js";
import type {
  ChargeRouter, ChargeTransaction, DeviceRegistry, RevenueTracker, StationRegistry,
  IChargeRouter, IChargeTransaction, IRevenueTracker,
} from "../../typechain-types/index.js";
import {
  IChargeRouter__factory,
  IChargeTransaction__factory,
  IRevenueTracker__factory,
} from "../../typechain-types/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARGER_1 = b32("CHARGER-001");
const STATION_1 = b32("STATION-001");
const REGION_SEOUL = regionBytes4("KR11");
const SECP256K1 = 0;
const PERIOD = 202606n;

const DEFAULT_START_TS = 1700000000n;
const DEFAULT_END_TS   = 1700003600n;  // +3600s = 1 hour
const DEFAULT_KRW      = 5000n;
const DEFAULT_ENERGY    = 1000n;

let sessionCounter = 0;
function nextSessionId(): string {
  sessionCounter++;
  return b32(`SESS-${String(sessionCounter).padStart(4, "0")}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Charging Pipeline (Phase 1 → 2)", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let newBridge: Awaited<ReturnType<typeof ethers.getSigner>>;

  // Admin instances (concrete) — deployment, admin ops, event parsing
  let deviceRegistry: DeviceRegistry;
  let stationRegistry: StationRegistry;
  let ctContract: ChargeTransaction;
  let rtContract: RevenueTracker;
  let crContract: ChargeRouter;

  // Consumer instances (interface) — pipeline business logic
  let cr: IChargeRouter;
  let ct: IChargeTransaction;
  let rt: IRevenueTracker;

  let seWallet: HDNodeWallet;

  function makeSession(overrides: Record<string, unknown> = {}) {
    const energyKwh = (overrides.energyKwh as bigint) ?? DEFAULT_ENERGY;
    const startTs = (overrides.startTimestamp as bigint) ?? DEFAULT_START_TS;
    const endTs = (overrides.endTimestamp as bigint) ?? DEFAULT_END_TS;
    const chargerId = (overrides.chargerId as string) ?? CHARGER_1;

    const msgHash = buildMsgHash(chargerId, energyKwh, startTs, endTs);
    const sig = overrides.seSignature ?? signRaw(seWallet, msgHash);

    return {
      sessionId: (overrides.sessionId as string) ?? nextSessionId(),
      chargerId,
      chargerType: (overrides.chargerType as number) ?? 1,
      energyKwh,
      startTimestamp: startTs,
      endTimestamp: endTs,
      vehicleCategory: (overrides.vehicleCategory as number) ?? 0,
      gridRegionCode: (overrides.gridRegionCode as string) ?? REGION_SEOUL,
      stationId: (overrides.stationId as string) ?? STATION_1,
      distributableKrw: (overrides.distributableKrw as bigint) ?? DEFAULT_KRW,
      seSignature: sig,
    };
  }

  beforeEach(async function () {
    sessionCounter = 0;
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    nonAdmin = signers[1];
    newBridge = signers[2];

    seWallet = Wallet.createRandom();

    // 1. DeviceRegistry (UUPS proxy)
    const { contract: dr } = await deployUUPSProxy<DeviceRegistry>(ethers, "DeviceRegistry");
    await dr.initialize(admin.address);
    deviceRegistry = dr;

    // 2. StationRegistry (UUPS proxy)
    const { contract: sr } = await deployUUPSProxy<StationRegistry>(ethers, "StationRegistry");
    await sr.initialize(admin.address, await deviceRegistry.getAddress());
    stationRegistry = sr;

    // 3. ChargeTransaction (UUPS proxy)
    ({ contract: ctContract } = await deployUUPSProxy<ChargeTransaction>(ethers, "ChargeTransaction"));

    // 4. RevenueTracker (UUPS proxy)
    ({ contract: rtContract } = await deployUUPSProxy<RevenueTracker>(ethers, "RevenueTracker"));

    // 5. ChargeRouter (UUPS proxy)
    ({ contract: crContract } = await deployUUPSProxy<ChargeRouter>(ethers, "ChargeRouter"));

    // 6. Initialize — CT/RT bridge = ChargeRouter, CR bridge = admin (test)
    const crAddr = await crContract.getAddress();
    await ctContract.initialize(
      await deviceRegistry.getAddress(),
      await stationRegistry.getAddress(),
      crAddr,
      admin.address
    );
    await rtContract.initialize(
      await stationRegistry.getAddress(),
      crAddr,
      admin.address
    );
    await crContract.initialize(
      await ctContract.getAddress(),
      await rtContract.getAddress(),
      admin.address,  // bridge = admin for testing
      admin.address
    );

    // 7. Interface-scoped instances (consumer/STRIKON perspective)
    cr = IChargeRouter__factory.connect(await crContract.getAddress(), admin);
    ct = IChargeTransaction__factory.connect(await ctContract.getAddress(), admin);
    rt = IRevenueTracker__factory.connect(await rtContract.getAddress(), admin);

    // 8. Setup infrastructure (chip must be enrolled before registerCharger)
    await stationRegistry.registerStation(STATION_1, REGION_SEOUL, "Seoul Gangnam");
    await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(seWallet), SECP256K1);
    await stationRegistry.registerCharger(CHARGER_1, STATION_1, 1);
  });

  // ── processCharge success ──────────────────────────────────────────────────

  describe("processCharge success", function () {
    it("creates the CT token and accumulates RT revenue in the same call", async function () {
      const session = makeSession();
      await cr.processCharge(session, PERIOD);

      // ChargeTransaction: token minted
      expect(await ct.totalSessions()).to.equal(1n);
      const stored = await ct.getSession(1n);
      expect(stored.sessionId).to.equal(session.sessionId);
      expect(stored.energyKwh).to.equal(session.energyKwh);
      expect(stored.distributableKrw).to.equal(session.distributableKrw);

      // RevenueTracker: revenue accumulated
      const [accumulated, , pending] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(5000n);
      expect(pending).to.equal(5000n);
    });

    // B-1: event parameter validation across all three contracts
    it("emits ChargeProcessed with the expected parameters", async function () {
      const session = makeSession();
      const tx = await cr.processCharge(session, PERIOD);
      const receipt = await tx.wait();

      const crEvent = findEvent(receipt!, crContract, "ChargeProcessed");
      expect(crEvent, "ChargeProcessed event should be emitted").to.not.be.null;
      expect(crEvent!.args.tokenId).to.equal(1n);
      expect(crEvent!.args.sessionId).to.equal(session.sessionId);
      expect(crEvent!.args.stationId).to.equal(session.stationId);
      expect(crEvent!.args.period_yyyyMM).to.equal(PERIOD);
    });

    // B-7: prove that CT + RT + CR all emit from a single transaction
    it("emits CT, RT, and CR events from a single transaction", async function () {
      const session = makeSession();
      const tx = await cr.processCharge(session, PERIOD);
      const receipt = await tx.wait();

      // ChargeRouter event (concrete type needed for event ABI)
      const crEvent = findEvent(receipt!, crContract, "ChargeProcessed");
      expect(crEvent, "ChargeRouter: ChargeProcessed").to.not.be.null;

      // ChargeTransaction event
      const ctEvent = findEvent(receipt!, ctContract, "ChargeSessionRecorded");
      expect(ctEvent, "ChargeTransaction: ChargeSessionRecorded").to.not.be.null;
      expect(ctEvent!.args.tokenId).to.equal(1n);
      expect(ctEvent!.args.sessionId).to.equal(session.sessionId);

      // RevenueTracker event
      const rtEvent = findEvent(receipt!, rtContract, "RevenueRecorded");
      expect(rtEvent, "RevenueTracker: RevenueRecorded").to.not.be.null;
      expect(rtEvent!.args.stationId).to.equal(session.stationId);
      expect(rtEvent!.args.distributableKrw).to.equal(session.distributableKrw);
    });

    it("keeps data consistency after batch processing", async function () {
      const count = 10;
      let expectedRevenue = 0n;

      for (let i = 0; i < count; i++) {
        const krw = BigInt(1000 + i * 500);
        expectedRevenue += krw;
        await cr.processCharge(
          makeSession({ distributableKrw: krw }),
          PERIOD
        );
      }

      expect(await ct.totalSessions()).to.equal(BigInt(count));

      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(expectedRevenue);

      // Verify monthly period also correct
      expect(await rt.getStationRevenuePeriod(STATION_1, PERIOD)).to.equal(expectedRevenue);

      // Verify last individual record integrity
      const lastKrw = BigInt(1000 + (count - 1) * 500);
      const lastSession = await ct.getSession(BigInt(count));
      expect(lastSession.distributableKrw).to.equal(lastKrw);
      expect(lastSession.stationId).to.equal(STATION_1);
    });

    it("reverts with DuplicateSession for a repeated sessionId", async function () {
      const fixedSessionId = b32("SESS-DUP");
      await cr.processCharge(makeSession({ sessionId: fixedSessionId }), PERIOD);

      await expectRevertCustomError(
        cr.processCharge(makeSession({ sessionId: fixedSessionId }), PERIOD),
        "DuplicateSession"
      );

      // Only one token minted
      expect(await ct.totalSessions()).to.equal(1n);
    });
  });

  // ── atomicity validation ───────────────────────────────────────────────────

  describe("atomicity", function () {
    // B-7: keep the successful state after a later failure (partial rollback check)
    it("preserves prior successful state and fully rolls back the failing transaction", async function () {
      // First: successful charge
      await cr.processCharge(makeSession({ distributableKrw: DEFAULT_KRW }), PERIOD);

      // Second: failed charge (distributableKrw = 0 → RT revert)
      await expectRevertCustomError(
        cr.processCharge(makeSession({ distributableKrw: 0n }), PERIOD),
        "ZeroAmount"
      );

      // Successful TX state preserved
      expect(await ct.totalSessions()).to.equal(1n);
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(DEFAULT_KRW);
    });

    it("rolls back CT mint when RT reverts on distributableKrw=0", async function () {
      await expectRevertCustomError(
        cr.processCharge(
          makeSession({ distributableKrw: 0n }),
          PERIOD
        ),
        "ZeroAmount"
      );

      // Nothing minted
      expect(await ct.totalSessions()).to.equal(0n);
      // No revenue recorded
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(0n);
    });

    it("fully reverts when CT rejects an unregistered stationId", async function () {
      const unknownStation = b32("STATION-999");
      await expectRevertCustomError(
        cr.processCharge(
          makeSession({ stationId: unknownStation }),
          PERIOD
        ),
        "StationNotRegistered"
      );

      expect(await ct.totalSessions()).to.equal(0n);
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(0n);
    });

    // B-7: prove that CT failure leaves RT unchanged
    it("records no RT revenue when CT reverts for an inactive chip", async function () {
      await deviceRegistry.revokeChip(CHARGER_1);

      await expectRevertCustomError(
        cr.processCharge(makeSession(), PERIOD),
        "ChipNotActive"
      );

      expect(await ct.totalSessions()).to.equal(0n);
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(0n);
    });

    it("fully reverts when CT rejects an invalid SE signature", async function () {
      const wrongWallet: HDNodeWallet = Wallet.createRandom();
      const msgHash = buildMsgHash(CHARGER_1, DEFAULT_ENERGY, DEFAULT_START_TS, DEFAULT_END_TS);
      const wrongSig = signRaw(wrongWallet, msgHash);

      await expectRevertCustomError(
        cr.processCharge(
          makeSession({ seSignature: wrongSig }),
          PERIOD
        ),
        "InvalidSESignature"
      );

      expect(await ct.totalSessions()).to.equal(0n);
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(0n);
    });
  });

  // ── access control ─────────────────────────────────────────────────────────

  describe("access control", function () {
    it("reverts with CallerNotBridge for an unauthorized caller", async function () {
      await expectRevertCustomError(
        cr.connect(nonAdmin).processCharge(makeSession(), PERIOD),
        "CallerNotBridge"
      );
    });

    it("allows only ChargeRouter to call CT and RT write paths", async function () {
      // Direct mint on CT should fail (bridge = ChargeRouter, not admin)
      await expectRevertCustomError(
        ct.mint(makeSession()),
        "CallerNotBridge"
      );

      // Direct recordRevenue on RT should fail
      await expectRevertCustomError(
        rt.recordRevenue(STATION_1, 5000n, PERIOD),
        "CallerNotBridge"
      );
    });
  });

  // ── R04: Pausable ──────────────────────────────────────────────────────────

  describe("Pausable (R04)", function () {
    it("allows admin pause() and emits Paused", async function () {
      const tx = await crContract.pause();
      const receipt = await tx.wait();
      const event = findEvent(receipt, crContract, "Paused");
      expect(event).to.not.be.null;
      expect(event.args.account).to.equal(admin.address);
    });

    it("non-admin pause() → revert AccessControlUnauthorizedAccount", async function () {
      await expectRevertCustomError(
        crContract.connect(nonAdmin).pause(),
        "AccessControlUnauthorizedAccount"
      );
    });

    it("non-admin unpause() → revert AccessControlUnauthorizedAccount", async function () {
      await crContract.pause();
      await expectRevertCustomError(
        crContract.connect(nonAdmin).unpause(),
        "AccessControlUnauthorizedAccount"
      );
    });

    it("reverts processCharge() with EnforcedPause while paused", async function () {
      await crContract.pause();
      await expectRevertCustomError(
        cr.processCharge(makeSession(), PERIOD),
        "EnforcedPause"
      );
    });

    it("allows processCharge() again after unpause()", async function () {
      await crContract.pause();
      await crContract.unpause();
      await cr.processCharge(makeSession(), PERIOD);
      expect(await ct.totalSessions()).to.equal(1n);
    });
  });

  // ── R05: Bridge Rotation ──────────────────────────────────────────────────

  describe("Bridge Rotation (R05)", function () {
    it("allows admin updateBridgeAddress(newAddr) and emits the event", async function () {
      const tx = await crContract.updateBridgeAddress(newBridge.address);
      const receipt = await tx.wait();

      const event = findEvent(receipt, crContract, "BridgeAddressUpdated");
      expect(event).to.not.be.null;
      expect(event.args.oldAddress).to.equal(admin.address);
      expect(event.args.newAddress).to.equal(newBridge.address);
    });

    it("non-admin updateBridgeAddress → revert AccessControlUnauthorizedAccount", async function () {
      await expectRevertCustomError(
        crContract.connect(nonAdmin).updateBridgeAddress(newBridge.address),
        "AccessControlUnauthorizedAccount"
      );
    });

    it("updateBridgeAddress(address(0)) → revert ZeroAddress", async function () {
      await expectRevertCustomError(
        crContract.updateBridgeAddress("0x0000000000000000000000000000000000000000"),
        "ZeroAddress"
      );
    });

    it("rejects calls from the previous bridge address after update", async function () {
      await crContract.updateBridgeAddress(newBridge.address);

      // Old bridge (admin) can no longer call processCharge
      await expectRevertCustomError(
        cr.processCharge(makeSession(), PERIOD),
        "CallerNotBridge"
      );
    });

    it("accepts calls from the new bridge address after update", async function () {
      await crContract.updateBridgeAddress(newBridge.address);

      // New bridge can call processCharge
      await cr.connect(newBridge).processCharge(makeSession(), PERIOD);
      expect(await ct.totalSessions()).to.equal(1n);
    });

    it("still emits the event when updating to the same bridge address", async function () {
      const tx = await crContract.updateBridgeAddress(admin.address);
      const receipt = await tx.wait();

      const event = findEvent(receipt, crContract, "BridgeAddressUpdated");
      expect(event).to.not.be.null;
      expect(event.args.oldAddress).to.equal(admin.address);
      expect(event.args.newAddress).to.equal(admin.address);
    });
  });

  // ── UUPS upgrades ──────────────────────────────────────────────────────────

  describe("UUPS upgrades", function () {
    it("allows admin upgrade", async function () {
      const CRv2 = await ethers.getContractFactory("ChargeRouter");
      const v2Impl = await CRv2.deploy();
      await v2Impl.waitForDeployment();

      await crContract.upgradeToAndCall(await v2Impl.getAddress(), "0x");
    });

    it("reverts unauthorized upgrade with AccessControlUnauthorizedAccount", async function () {
      const CRv2 = await ethers.getContractFactory("ChargeRouter");
      const v2Impl = await CRv2.deploy();
      await v2Impl.waitForDeployment();

      await expectRevertCustomError(
        crContract.connect(nonAdmin).upgradeToAndCall(await v2Impl.getAddress(), "0x"),
        "AccessControlUnauthorizedAccount"
      );
    });

    // B-2: preserve existing data and integration behavior after upgrade
    it("keeps processCharge working after upgrade", async function () {
      // Charge before upgrade
      await cr.processCharge(makeSession(), PERIOD);

      // Upgrade ChargeRouter
      const CRv2 = await ethers.getContractFactory("ChargeRouter");
      const v2Impl = await CRv2.deploy();
      await v2Impl.waitForDeployment();
      await crContract.upgradeToAndCall(await v2Impl.getAddress(), "0x");

      // Charge after upgrade — CT/RT references preserved
      await cr.processCharge(makeSession(), PERIOD);

      expect(await ct.totalSessions()).to.equal(2n);
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(10000n); // 5000 + 5000
    });
  });

  // ── double-initialize protection ───────────────────────────────────────────

  describe("double-initialize protection", function () {
    it("reverts ChargeRouter reinitialization with InvalidInitialization", async function () {
      await expectRevertCustomError(
        crContract.initialize(
          await ctContract.getAddress(),
          await rtContract.getAddress(),
          admin.address,
          admin.address
        ),
        "InvalidInitialization"
      );
    });

    it("reverts ChargeTransaction reinitialization with InvalidInitialization", async function () {
      await expectRevertCustomError(
        ctContract.initialize(
          await deviceRegistry.getAddress(),
          await stationRegistry.getAddress(),
          await crContract.getAddress(),
          admin.address
        ),
        "InvalidInitialization"
      );
    });

    it("reverts RevenueTracker reinitialization with InvalidInitialization", async function () {
      await expectRevertCustomError(
        rtContract.initialize(
          await stationRegistry.getAddress(),
          await crContract.getAddress(),
          admin.address
        ),
        "InvalidInitialization"
      );
    });
  });
});
