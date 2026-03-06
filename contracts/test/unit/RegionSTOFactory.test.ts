/**
 * RegionSTOFactory Unit Tests
 *
 * Deploys and manages 17 regional RegionSTO proxies.
 * UUPS proxy. References StationRegistry + RegionSTO impl.
 *
 * Initialization / deployRegion success & failure / deployAllRegions /
 * config setters / integration / UUPS.
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
  RegionSTOFactory,
} from "../../typechain-types/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const REGION_SEOUL = regionBytes4("KR11");
const STN_1 = b32("STATION-001");

// All 17 Korean region codes
const ALL_REGIONS = [
  "KR11", "KR26", "KR27", "KR28", "KR29", "KR30", "KR31", "KR36",
  "KR41", "KR42", "KR43", "KR44", "KR45", "KR46", "KR47", "KR48", "KR49",
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RegionSTOFactory", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;

  let stationRegistry: StationRegistry;
  let factory: RegionSTOFactory;
  let regionSTOImplAddr: string;

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

    // Deploy RegionSTO implementation (not behind proxy — used as impl for factory)
    const RegionSTOFactory_ = await ethers.getContractFactory("RegionSTO");
    const regionSTOImpl = await RegionSTOFactory_.deploy();
    await regionSTOImpl.waitForDeployment();
    regionSTOImplAddr = await regionSTOImpl.getAddress();

    // Deploy RegionSTOFactory (UUPS proxy)
    const { contract: f } = await deployUUPSProxy<RegionSTOFactory>(ethers, "RegionSTOFactory");
    await f.initialize(
      admin.address,
      regionSTOImplAddr,
      await stationRegistry.getAddress(),
    );
    factory = f;
  });

  // ── Initialization ────────────────────────────────────────────────────────

  describe("Initialization", function () {
    it("should store stationRegistry and regionSTOImpl addresses correctly", async function () {
      expect(await factory.stationRegistry()).to.equal(await stationRegistry.getAddress());
      expect(await factory.regionSTOImpl()).to.equal(regionSTOImplAddr);
    });

    it("should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = ZeroHash;
      expect(await factory.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
    });

    it("should revert on double initialize", async function () {
      await expectRevertCustomError(
        factory.initialize(
          admin.address,
          regionSTOImplAddr,
          await stationRegistry.getAddress(),
        ),
        "InvalidInitialization",
      );
    });

    it("should revert initialize with zero address", async function () {
      const { contract: f2 } = await deployUUPSProxy<RegionSTOFactory>(ethers, "RegionSTOFactory");
      await expectRevertCustomError(
        f2.initialize(ZeroAddress, regionSTOImplAddr, await stationRegistry.getAddress()),
        "ZeroAddress",
      );
      await expectRevertCustomError(
        f2.initialize(admin.address, ZeroAddress, await stationRegistry.getAddress()),
        "ZeroAddress",
      );
      await expectRevertCustomError(
        f2.initialize(admin.address, regionSTOImplAddr, ZeroAddress),
        "ZeroAddress",
      );
    });
  });

  // ── deployRegion success ──────────────────────────────────────────────────

  describe("deployRegion success", function () {
    it("should deploy a RegionSTO proxy and return its address", async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      const tokenAddr = await factory.getRegionToken(REGION_SEOUL);
      expect(tokenAddr).to.not.equal(ZeroAddress);
    });

    it("should emit RegionDeployed event", async function () {
      const tx = await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      const receipt = await tx.wait();
      const event = findEvent(receipt!, factory, "RegionDeployed");
      expect(event).to.not.be.null;
      expect(event.args.regionId).to.equal(REGION_SEOUL);
      expect(event.args.name).to.equal("EnergyFi Seoul STO");
      expect(event.args.symbol).to.equal("EFI-KR11");
      expect(event.args.tokenAddress).to.not.equal(ZeroAddress);
    });

    it("should register in getRegionToken mapping", async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      const addr = await factory.getRegionToken(REGION_SEOUL);
      expect(addr).to.not.equal(ZeroAddress);
    });

    it("should increment getRegionCount", async function () {
      expect(await factory.getRegionCount()).to.equal(0n);
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      expect(await factory.getRegionCount()).to.equal(1n);
    });

    it("should set regionId, name, symbol on the deployed token", async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      const tokenAddr = await factory.getRegionToken(REGION_SEOUL);
      const sto = (await ethers.getContractAt("RegionSTO", tokenAddr)) as unknown as RegionSTO;
      expect(await sto.regionId()).to.equal(REGION_SEOUL);
      expect(await sto.name()).to.equal("EnergyFi Seoul STO");
      expect(await sto.symbol()).to.equal("EFI-KR11");
    });

    it("should set factory caller (admin) as the deployed token's admin", async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      const tokenAddr = await factory.getRegionToken(REGION_SEOUL);
      const sto = (await ethers.getContractAt("RegionSTO", tokenAddr)) as unknown as RegionSTO;
      const DEFAULT_ADMIN_ROLE = ZeroHash;
      expect(await sto.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
    });
  });

  // ── deployRegion failure ──────────────────────────────────────────────────

  describe("deployRegion failure", function () {
    it("should revert when deploying already deployed region", async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      await expectRevertCustomError(
        factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11"),
        "RegionAlreadyDeployed",
      );
    });

    it("should revert when called by non-admin", async function () {
      await expectRevertCustomError(
        factory.connect(nonAdmin).deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11"),
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  // ── deployAllRegions ──────────────────────────────────────────────────────

  describe("deployAllRegions", function () {
    it("should deploy all 17 regions", async function () {
      await factory.deployAllRegions();
      for (const code of ALL_REGIONS) {
        const rid = regionBytes4(code);
        const addr = await factory.getRegionToken(rid);
        expect(addr).to.not.equal(ZeroAddress);
      }
    });

    it("should return 17 from getRegionCount", async function () {
      await factory.deployAllRegions();
      expect(await factory.getRegionCount()).to.equal(17n);
    });

    it("should return 17 region codes from getAllRegionIds", async function () {
      await factory.deployAllRegions();
      const ids = await factory.getAllRegionIds();
      expect(ids.length).to.equal(17);
    });

    it("should set EFI-KRxx symbol format on each token", async function () {
      await factory.deployAllRegions();
      for (const code of ALL_REGIONS) {
        const rid = regionBytes4(code);
        const addr = await factory.getRegionToken(rid);
        const sto = (await ethers.getContractAt("RegionSTO", addr)) as unknown as RegionSTO;
        const symbol = await sto.symbol();
        expect(symbol).to.match(/^EFI-KR\d{2}$/);
      }
    });

    it("should revert when called again after deployment", async function () {
      await factory.deployAllRegions();
      await expectRevertCustomError(
        factory.deployAllRegions(),
        "RegionAlreadyDeployed",
      );
    });

    it("should revert when called by non-admin", async function () {
      await expectRevertCustomError(
        factory.connect(nonAdmin).deployAllRegions(),
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  // ── Config setters ────────────────────────────────────────────────────────

  describe("Config setters", function () {
    it("should update regionSTOImpl and emit event", async function () {
      const NewImpl = await ethers.getContractFactory("RegionSTO");
      const newImpl = await NewImpl.deploy();
      await newImpl.waitForDeployment();
      const newAddr = await newImpl.getAddress();

      const tx = await factory.updateRegionSTOImpl(newAddr);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, factory, "RegionSTOImplUpdated");
      expect(event).to.not.be.null;
      expect(event.args.oldImpl).to.equal(regionSTOImplAddr);
      expect(event.args.newImpl).to.equal(newAddr);
      expect(await factory.regionSTOImpl()).to.equal(newAddr);
    });

    it("should update stationRegistry and emit event", async function () {
      // Deploy a second StationRegistry as the new address
      const { contract: dr2 } = await deployUUPSProxy<DeviceRegistry>(ethers, "DeviceRegistry");
      await dr2.initialize(admin.address);
      const { contract: sr2 } = await deployUUPSProxy<StationRegistry>(ethers, "StationRegistry");
      await sr2.initialize(admin.address, await dr2.getAddress());
      const newAddr = await sr2.getAddress();

      const oldAddr = await factory.stationRegistry();
      const tx = await factory.updateStationRegistry(newAddr);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, factory, "StationRegistryUpdated");
      expect(event).to.not.be.null;
      expect(event.args.oldRegistry).to.equal(oldAddr);
      expect(event.args.newRegistry).to.equal(newAddr);
      expect(await factory.stationRegistry()).to.equal(newAddr);
    });

    it("should revert updateRegionSTOImpl with zero address", async function () {
      await expectRevertCustomError(
        factory.updateRegionSTOImpl(ZeroAddress),
        "ZeroAddress",
      );
    });

    it("should revert updateStationRegistry with zero address", async function () {
      await expectRevertCustomError(
        factory.updateStationRegistry(ZeroAddress),
        "ZeroAddress",
      );
    });

    it("should revert config setters when called by non-admin", async function () {
      await expectRevertCustomError(
        factory.connect(nonAdmin).updateRegionSTOImpl(admin.address),
        "AccessControlUnauthorizedAccount",
      );
      await expectRevertCustomError(
        factory.connect(nonAdmin).updateStationRegistry(admin.address),
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  // ── Integration: Factory → RegionSTO ──────────────────────────────────────

  describe("Integration: Factory → RegionSTO", function () {
    beforeEach(async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      await stationRegistry.registerStation(STN_1, REGION_SEOUL, "Seoul Gangnam");
    });

    it("should allow issueTranche on deployed token", async function () {
      const tokenAddr = await factory.getRegionToken(REGION_SEOUL);
      const sto = (await ethers.getContractAt("RegionSTO", tokenAddr)) as unknown as RegionSTO;
      await sto.issueTranche(admin.address, 1000n, [STN_1]);
      expect(await sto.totalSupply()).to.equal(1000n);
    });

    it("should enforce admin-only transfer policy on deployed token", async function () {
      const tokenAddr = await factory.getRegionToken(REGION_SEOUL);
      const sto = (await ethers.getContractAt("RegionSTO", tokenAddr)) as unknown as RegionSTO;
      await sto.issueTranche(admin.address, 1000n, [STN_1]);
      await expectRevertCustomError(
        sto.connect(nonAdmin).transfer(admin.address, 100n),
        "TransferNotAllowed",
      );
    });
  });

  // ── UUPS Upgrade ──────────────────────────────────────────────────────────

  describe("UUPS Upgrade", function () {
    it("should allow admin to authorize upgrade", async function () {
      const Factory = await ethers.getContractFactory("RegionSTOFactory");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();
      await factory.upgradeToAndCall(await newImpl.getAddress(), "0x");
    });

    it("should revert when non-admin tries to upgrade", async function () {
      const Factory = await ethers.getContractFactory("RegionSTOFactory");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();
      await expectRevertCustomError(
        factory.connect(nonAdmin).upgradeToAndCall(await newImpl.getAddress(), "0x"),
        "AccessControlUnauthorizedAccount",
      );
    });
  });
});
