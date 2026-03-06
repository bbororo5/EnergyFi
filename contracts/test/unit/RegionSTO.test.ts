/**
 * RegionSTO Unit Tests
 *
 * Per-region security token (ERC-20 based) interface + implementation validation.
 * UUPS proxy deployment, StationRegistry integration.
 *
 * Initialization / issueTranche success & failure / transfer restriction /
 * burn / decimals / View / getTrancheActiveStations / Pausable / UUPS.
 */

import hre from "hardhat";
import { expect } from "chai";
import { ZeroAddress, ZeroHash } from "ethers";
import {
  expectRevertCustomError,
  b32,
  regionBytes4,
  findEvent,
  deployUUPSProxy,
} from "../helpers/helpers.js";
import type {
  DeviceRegistry,
  StationRegistry,
  RegionSTO,
} from "../../typechain-types/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const REGION_SEOUL = regionBytes4("KR11");
const REGION_BUSAN = regionBytes4("KR26");
const STN_1 = b32("STATION-001");   // Seoul
const STN_2 = b32("STATION-002");   // Seoul
const STN_3 = b32("STATION-003");   // Seoul
const STN_4 = b32("STATION-004");   // Busan (different region)
const STN_99 = b32("STATION-999");  // unregistered

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RegionSTO", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let investor: Awaited<ReturnType<typeof ethers.getSigner>>;

  let stationRegistry: StationRegistry;
  let regionSTO: RegionSTO;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    nonAdmin = signers[1];
    investor = signers[2];

    // Deploy DeviceRegistry (needed for StationRegistry)
    const { contract: dr } = await deployUUPSProxy<DeviceRegistry>(ethers, "DeviceRegistry");
    await dr.initialize(admin.address);

    // Deploy StationRegistry
    const { contract: sr } = await deployUUPSProxy<StationRegistry>(ethers, "StationRegistry");
    await sr.initialize(admin.address, await dr.getAddress());
    stationRegistry = sr;

    // Register stations (all EnergyFi-owned)
    await stationRegistry.registerStation(STN_1, REGION_SEOUL, "Seoul Gangnam");
    await stationRegistry.registerStation(STN_2, REGION_SEOUL, "Seoul Seocho");
    await stationRegistry.registerStation(STN_3, REGION_SEOUL, "Seoul Jongno");
    await stationRegistry.registerStation(STN_4, REGION_BUSAN, "Busan Haeundae");

    // Deploy RegionSTO (UUPS proxy)
    const { contract: sto } = await deployUUPSProxy<RegionSTO>(ethers, "RegionSTO");
    await sto.initialize(
      REGION_SEOUL,
      "EnergyFi Seoul STO",
      "EFI-KR11",
      admin.address,
      await stationRegistry.getAddress(),
    );
    regionSTO = sto;
  });

  // ── Initialization ────────────────────────────────────────────────────────

  describe("Initialization", function () {
    it("should set regionId, name, symbol correctly", async function () {
      expect(await regionSTO.regionId()).to.equal(REGION_SEOUL);
      expect(await regionSTO.name()).to.equal("EnergyFi Seoul STO");
      expect(await regionSTO.symbol()).to.equal("EFI-KR11");
    });

    it("should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = ZeroHash;
      expect(await regionSTO.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
    });

    it("should revert on double initialize", async function () {
      await expectRevertCustomError(
        regionSTO.initialize(
          REGION_SEOUL,
          "EnergyFi Seoul STO",
          "EFI-KR11",
          admin.address,
          await stationRegistry.getAddress(),
        ),
        "InvalidInitialization",
      );
    });
  });

  // ── decimals ──────────────────────────────────────────────────────────────

  describe("decimals", function () {
    it("should return 0 (whole securities, no fractional units)", async function () {
      expect(await regionSTO.decimals()).to.equal(0n);
    });
  });

  // ── issueTranche success ──────────────────────────────────────────────────

  describe("issueTranche success", function () {
    it("should mint tokens and record the tranche", async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1]);
      expect(await regionSTO.balanceOf(investor.address)).to.equal(1000n);
      expect(await regionSTO.getTrancheCount()).to.equal(1n);
    });

    it("should increment trancheCount", async function () {
      expect(await regionSTO.getTrancheCount()).to.equal(0n);
      await regionSTO.issueTranche(investor.address, 500n, [STN_1]);
      expect(await regionSTO.getTrancheCount()).to.equal(1n);
      await regionSTO.issueTranche(investor.address, 300n, [STN_2]);
      expect(await regionSTO.getTrancheCount()).to.equal(2n);
    });

    it("should emit TrancheIssued with correct parameters", async function () {
      const tx = await regionSTO.issueTranche(investor.address, 1000n, [STN_1, STN_2]);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, regionSTO, "TrancheIssued");
      expect(event).to.not.be.null;
      expect(event.args.trancheId).to.equal(1n);
      expect(event.args.to).to.equal(investor.address);
      expect(event.args.tokenAmount).to.equal(1000n);
      expect(event.args.stationCount).to.equal(2n);
      expect(event.args.issuedAt).to.be.greaterThan(0n);
    });

    it("should increase totalSupply by tokenAmount", async function () {
      expect(await regionSTO.totalSupply()).to.equal(0n);
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1]);
      expect(await regionSTO.totalSupply()).to.equal(1000n);
      await regionSTO.issueTranche(investor.address, 500n, [STN_2]);
      expect(await regionSTO.totalSupply()).to.equal(1500n);
    });

    it("should record stationIds in the tranche", async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1, STN_2]);
      const tranche = await regionSTO.getTranche(1);
      expect(tranche.stationIds.length).to.equal(2);
      expect(tranche.stationIds[0]).to.equal(STN_1);
      expect(tranche.stationIds[1]).to.equal(STN_2);
    });

    it("should map stationId to trancheId via getStationTranche", async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1, STN_2]);
      expect(await regionSTO.getStationTranche(STN_1)).to.equal(1n);
      expect(await regionSTO.getStationTranche(STN_2)).to.equal(1n);
    });

    it("should allow consecutive tranche issuances", async function () {
      await regionSTO.issueTranche(investor.address, 500n, [STN_1]);
      await regionSTO.issueTranche(investor.address, 300n, [STN_2]);
      await regionSTO.issueTranche(investor.address, 200n, [STN_3]);

      expect(await regionSTO.getTrancheCount()).to.equal(3n);
      expect(await regionSTO.totalSupply()).to.equal(1000n);
      expect(await regionSTO.getStationTranche(STN_1)).to.equal(1n);
      expect(await regionSTO.getStationTranche(STN_2)).to.equal(2n);
      expect(await regionSTO.getStationTranche(STN_3)).to.equal(3n);
    });
  });

  // ── issueTranche failure ──────────────────────────────────────────────────

  describe("issueTranche failure", function () {
    it("should revert when called by non-admin", async function () {
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).issueTranche(investor.address, 1000n, [STN_1]),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("should revert when including unregistered station", async function () {
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, [STN_99]),
        "StationNotRegistered",
      );
    });

    it("should revert when including station from different region", async function () {
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, [STN_4]),
        "RegionMismatch",
      );
    });

    it("should revert when station is already in another tranche", async function () {
      await regionSTO.issueTranche(investor.address, 500n, [STN_1]);
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 300n, [STN_1]),
        "StationAlreadyInTranche",
      );
    });

    it("should revert when duplicate stationIds in same call", async function () {
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, [STN_1, STN_1]),
        "StationAlreadyInTranche",
      );
    });

    it("should revert when tokenAmount is 0", async function () {
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 0n, [STN_1]),
        "ZeroAmount",
      );
    });

    it("should revert when stationIds is empty", async function () {
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, []),
        "EmptyStations",
      );
    });

    it("should revert when paused", async function () {
      await regionSTO.pause();
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, [STN_1]),
        "EnforcedPause",
      );
    });

    it("should revert when including deactivated station", async function () {
      await stationRegistry.deactivateStation(STN_1);
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, [STN_1]),
        "StationNotActive",
      );
    });
  });

  // ── Transfer restriction (Admin-only) ─────────────────────────────────────

  describe("Transfer restriction (Admin-only)", function () {
    beforeEach(async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1]);
    });

    it("should succeed when admin calls adminTransfer", async function () {
      await regionSTO.adminTransfer(investor.address, nonAdmin.address, 100n);
      expect(await regionSTO.balanceOf(nonAdmin.address)).to.equal(100n);
      expect(await regionSTO.balanceOf(investor.address)).to.equal(900n);
    });

    it("should revert when non-admin calls adminTransfer", async function () {
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).adminTransfer(investor.address, admin.address, 100n),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("should revert when non-admin calls transfer (admin-only policy)", async function () {
      await expectRevertCustomError(
        regionSTO.connect(investor).transfer(nonAdmin.address, 100n),
        "TransferNotAllowed",
      );
    });

    it("should revert transferFrom (approve is blocked, so allowance is 0)", async function () {
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).transferFrom(investor.address, admin.address, 100n),
        "ERC20InsufficientAllowance",
      );
    });

    it("should revert approve (STO admin-only transfer policy)", async function () {
      await expectRevertCustomError(
        regionSTO.connect(investor).approve(nonAdmin.address, 500n),
        "TransferNotAllowed",
      );
    });
  });

  // ── burn ───────────────────────────────────────────────────────────────────

  describe("burn", function () {
    beforeEach(async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1]);
    });

    it("should decrease totalSupply when admin burns", async function () {
      await regionSTO.burn(investor.address, 300n);
      expect(await regionSTO.totalSupply()).to.equal(700n);
      expect(await regionSTO.balanceOf(investor.address)).to.equal(700n);
    });

    it("should emit Transfer(from, address(0), amount)", async function () {
      const tx = await regionSTO.burn(investor.address, 200n);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, regionSTO, "Transfer");
      expect(event).to.not.be.null;
      expect(event.args.from).to.equal(investor.address);
      expect(event.args.to).to.equal(ZeroAddress);
      expect(event.args.value).to.equal(200n);
    });

    it("should revert when called by non-admin", async function () {
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).burn(investor.address, 100n),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("should revert when burning more than balance", async function () {
      await expectRevertCustomError(
        regionSTO.burn(investor.address, 2000n),
        "ERC20InsufficientBalance",
      );
    });

    it("should preserve tranche records after burn (KSD audit trail)", async function () {
      await regionSTO.burn(investor.address, 1000n);
      expect(await regionSTO.totalSupply()).to.equal(0n);
      // Tranche records are immutable — preserved for audit trail
      const tranche = await regionSTO.getTranche(1);
      expect(tranche.tokenAmount).to.equal(1000n);
      expect(tranche.stationIds[0]).to.equal(STN_1);
    });
  });

  // ── View functions ────────────────────────────────────────────────────────

  describe("View functions", function () {
    it("should return regionId set during initialization", async function () {
      expect(await regionSTO.regionId()).to.equal(REGION_SEOUL);
    });

    it("should return empty tranche for non-existent trancheId(0)", async function () {
      // trancheId is 1-based. Query 0 or out-of-range
      const tranche = await regionSTO.getTranche(0);
      expect(tranche.trancheId).to.equal(0n);
      expect(tranche.tokenAmount).to.equal(0n);
    });

    it("should return correct tranche data", async function () {
      await regionSTO.issueTranche(investor.address, 500n, [STN_1, STN_2]);
      const tranche = await regionSTO.getTranche(1);
      expect(tranche.trancheId).to.equal(1n);
      expect(tranche.tokenAmount).to.equal(500n);
      expect(tranche.stationIds.length).to.equal(2);
      expect(tranche.issuedAt).to.be.greaterThan(0n);
    });

    it("should return 0 for unassigned station via getStationTranche", async function () {
      expect(await regionSTO.getStationTranche(STN_1)).to.equal(0n);
    });
  });

  // ── getTrancheActiveStations ──────────────────────────────────────────────

  describe("getTrancheActiveStations", function () {
    it("should return activeCount == totalCount when all stations are active", async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1, STN_2]);
      const [activeCount, totalCount] = await regionSTO.getTrancheActiveStations(1);
      expect(activeCount).to.equal(2n);
      expect(totalCount).to.equal(2n);
    });

    it("should decrease activeCount after station deactivation", async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1, STN_2]);
      await stationRegistry.deactivateStation(STN_1);
      const [activeCount, totalCount] = await regionSTO.getTrancheActiveStations(1);
      expect(activeCount).to.equal(1n);
      expect(totalCount).to.equal(2n);
    });

    it("should return (0, 0) for non-existent trancheId", async function () {
      const [activeCount, totalCount] = await regionSTO.getTrancheActiveStations(999);
      expect(activeCount).to.equal(0n);
      expect(totalCount).to.equal(0n);
    });
  });

  // ── Pausable ──────────────────────────────────────────────────────────────

  describe("Pausable", function () {
    it("should allow admin to pause", async function () {
      await regionSTO.pause();
      expect(await regionSTO.paused()).to.equal(true);
    });

    it("should allow admin to unpause", async function () {
      await regionSTO.pause();
      await regionSTO.unpause();
      expect(await regionSTO.paused()).to.equal(false);
    });

    it("should revert when non-admin tries to pause", async function () {
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).pause(),
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  // ── UUPS Upgrade ──────────────────────────────────────────────────────────

  describe("UUPS Upgrade", function () {
    it("should allow admin to authorize upgrade", async function () {
      const Factory = await ethers.getContractFactory("RegionSTO");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();
      await regionSTO.upgradeToAndCall(await newImpl.getAddress(), "0x");
    });

    it("should revert when non-admin tries to upgrade", async function () {
      const Factory = await ethers.getContractFactory("RegionSTO");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).upgradeToAndCall(await newImpl.getAddress(), "0x"),
        "AccessControlUnauthorizedAccount",
      );
    });
  });
});
