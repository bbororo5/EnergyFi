/**
 * ReputationRegistry admin-policy tests.
 *
 * Concrete-only suite for implementation policy that lives outside the
 * consumer-facing interface: initialize, pause, bridge rotation, UUPS.
 */

import hre from "hardhat";
import { expect } from "chai";
import { ZeroAddress, ZeroHash } from "ethers";
import {
  expectRevertCustomError,
  findEvent,
  deployUUPSProxy,
} from "../helpers/helpers.js";
import { makeSnapshot } from "../helpers/reputation.js";
import type {
  ReputationRegistry,
} from "../../typechain-types/index.js";

describe("ReputationRegistry admin surface", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let bridge: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let newBridge: Awaited<ReturnType<typeof ethers.getSigner>>;

  let registry: ReputationRegistry;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    bridge = signers[1];
    nonAdmin = signers[2];
    newBridge = signers[3];

    const { contract } = await deployUUPSProxy<ReputationRegistry>(
      ethers,
      "ReputationRegistry",
    );
    registry = contract;
    await registry.initialize(admin.address, bridge.address);
  });

  describe("initialize", function () {
    it("stores admin role and bridge address", async function () {
      expect(await registry.bridgeAddress()).to.equal(bridge.address);
      expect(await registry.hasRole(ZeroHash, admin.address)).to.equal(true);
    });

    it("rejects double initialize", async function () {
      await expectRevertCustomError(
        registry.initialize(admin.address, bridge.address),
        "InvalidInitialization",
      );
    });

    it("rejects zero admin and zero bridge", async function () {
      const { contract } = await deployUUPSProxy<ReputationRegistry>(
        ethers,
        "ReputationRegistry",
      );

      await expectRevertCustomError(
        contract.initialize(ZeroAddress, bridge.address),
        "ZeroAddress",
      );
      await expectRevertCustomError(
        contract.initialize(admin.address, ZeroAddress),
        "ZeroAddress",
      );
    });
  });

  describe("pausable", function () {
    it("allows admin to pause and emits Paused", async function () {
      const tx = await registry.pause();
      const receipt = await tx.wait();

      const event = findEvent(receipt!, registry, "Paused");
      expect(event).to.not.be.null;
      expect(event!.args.account).to.equal(admin.address);
    });

    it("rejects non-admin pause/unpause", async function () {
      await expectRevertCustomError(
        registry.connect(nonAdmin).pause(),
        "AccessControlUnauthorizedAccount",
      );

      await registry.pause();
      await expectRevertCustomError(
        registry.connect(nonAdmin).unpause(),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("blocks bridge writes while paused and resumes after unpause", async function () {
      const snapshot = makeSnapshot();

      await registry.pause();
      await expectRevertCustomError(
        registry.connect(bridge).upsertRegionSnapshot(snapshot),
        "EnforcedPause",
      );

      await registry.unpause();
      await registry.connect(bridge).upsertRegionSnapshot(snapshot);
      expect(await registry.hasRegionSnapshot(snapshot.regionId, snapshot.granularity, snapshot.periodId)).to.equal(true);
    });
  });

  describe("bridge rotation", function () {
    it("allows admin to rotate bridge and emits BridgeAddressUpdated", async function () {
      const tx = await registry.updateBridgeAddress(newBridge.address);
      const receipt = await tx.wait();

      const event = findEvent(receipt!, registry, "BridgeAddressUpdated");
      expect(event).to.not.be.null;
      expect(event!.args.oldAddress).to.equal(bridge.address);
      expect(event!.args.newAddress).to.equal(newBridge.address);
      expect(await registry.bridgeAddress()).to.equal(newBridge.address);
    });

    it("rejects non-admin rotation and zero address", async function () {
      await expectRevertCustomError(
        registry.connect(nonAdmin).updateBridgeAddress(newBridge.address),
        "AccessControlUnauthorizedAccount",
      );
      await expectRevertCustomError(
        registry.updateBridgeAddress(ZeroAddress),
        "ZeroAddress",
      );
    });

    it("moves write authority from old bridge to new bridge", async function () {
      const snapshot = makeSnapshot();
      await registry.updateBridgeAddress(newBridge.address);

      await expectRevertCustomError(
        registry.connect(bridge).upsertRegionSnapshot(snapshot),
        "CallerNotBridge",
      );

      await registry.connect(newBridge).upsertRegionSnapshot(snapshot);
      expect(await registry.hasRegionSnapshot(snapshot.regionId, snapshot.granularity, snapshot.periodId)).to.equal(true);
    });
  });

  describe("UUPS upgrade", function () {
    it("allows admin to authorize upgrade", async function () {
      const Factory = await ethers.getContractFactory("ReputationRegistry");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();

      await registry.upgradeToAndCall(await newImpl.getAddress(), "0x");
    });

    it("rejects non-admin upgrade", async function () {
      const Factory = await ethers.getContractFactory("ReputationRegistry");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();

      await expectRevertCustomError(
        registry.connect(nonAdmin).upgradeToAndCall(await newImpl.getAddress(), "0x"),
        "AccessControlUnauthorizedAccount",
      );
    });
  });
});
