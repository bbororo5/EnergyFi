/**
 * RegionSTOFactory 단위 테스트 — 21개
 *
 * 17개 지역 RegionSTO 프록시 배포 및 관리.
 * UUPS proxy. StationRegistry + RegionSTO impl 참조.
 *
 * 초기화 / deployRegion 성공·실패 / deployAllRegions / 통합 / UUPS.
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
const OwnerType = { CPO: 0n, ENERGYFI: 1n };

// 17개 지역 코드
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

  // ── 초기화 ──────────────────────────────────────────────────────────────────

  describe("초기화", function () {
    it("stationRegistry, regionSTOImpl 주소가 올바르게 설정되어야 한다", async function () {
      // IRegionSTOFactory에 정의된 view 함수
      expect(await factory.stationRegistry()).to.equal(await stationRegistry.getAddress());
      expect(await factory.regionSTOImpl()).to.equal(regionSTOImplAddr);
    });

    it("deployer에게 DEFAULT_ADMIN_ROLE이 부여되어야 한다", async function () {
      const DEFAULT_ADMIN_ROLE = ZeroHash;
      expect(await factory.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
    });

    it("double initialize 시 revert 되어야 한다", async function () {
      await expectRevertCustomError(
        factory.initialize(
          admin.address,
          regionSTOImplAddr,
          await stationRegistry.getAddress(),
        ),
        "InvalidInitialization",
      );
    });
  });

  // ── deployRegion 성공 ───────────────────────────────────────────────────────

  describe("deployRegion 성공", function () {
    it("RegionSTO 프록시를 배포하고 주소를 반환해야 한다", async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      const tokenAddr = await factory.getRegionToken(REGION_SEOUL);
      expect(tokenAddr).to.not.equal(ZeroAddress);
    });

    it("RegionDeployed 이벤트가 emit 되어야 한다", async function () {
      const tx = await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      const receipt = await tx.wait();
      const event = findEvent(receipt!, factory, "RegionDeployed");
      expect(event).to.not.be.null;
      expect(event.args.regionId).to.equal(REGION_SEOUL);
      expect(event.args.name).to.equal("EnergyFi Seoul STO");
      expect(event.args.symbol).to.equal("EFI-KR11");
      expect(event.args.tokenAddress).to.not.equal(ZeroAddress);
    });

    it("getRegionToken 매핑에 등록되어야 한다", async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      const addr = await factory.getRegionToken(REGION_SEOUL);
      expect(addr).to.not.equal(ZeroAddress);
    });

    it("getRegionCount가 증가해야 한다", async function () {
      expect(await factory.getRegionCount()).to.equal(0n);
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      expect(await factory.getRegionCount()).to.equal(1n);
    });

    it("배포된 토큰의 regionId, name, symbol이 올바라야 한다", async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      const tokenAddr = await factory.getRegionToken(REGION_SEOUL);
      const sto = (await ethers.getContractAt("RegionSTO", tokenAddr)) as unknown as RegionSTO;
      expect(await sto.regionId()).to.equal(REGION_SEOUL);
      expect(await sto.name()).to.equal("EnergyFi Seoul STO");
      expect(await sto.symbol()).to.equal("EFI-KR11");
    });

    it("배포된 토큰의 admin이 factory 호출자(admin)와 동일해야 한다", async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      const tokenAddr = await factory.getRegionToken(REGION_SEOUL);
      const sto = (await ethers.getContractAt("RegionSTO", tokenAddr)) as unknown as RegionSTO;
      const DEFAULT_ADMIN_ROLE = ZeroHash;
      expect(await sto.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
    });
  });

  // ── deployRegion 실패 ───────────────────────────────────────────────────────

  describe("deployRegion 실패", function () {
    it("이미 배포된 지역을 다시 배포하면 revert", async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      await expectRevertCustomError(
        factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11"),
        "RegionAlreadyDeployed",
      );
    });

    it("admin이 아닌 계정이 호출하면 revert", async function () {
      await expectRevertCustomError(
        factory.connect(nonAdmin).deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11"),
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  // ── deployAllRegions ────────────────────────────────────────────────────────

  describe("deployAllRegions", function () {
    it("17개 지역 전부 배포해야 한다", async function () {
      await factory.deployAllRegions();
      for (const code of ALL_REGIONS) {
        const rid = regionBytes4(code);
        const addr = await factory.getRegionToken(rid);
        expect(addr).to.not.equal(ZeroAddress);
      }
    });

    it("getRegionCount가 17을 반환해야 한다", async function () {
      await factory.deployAllRegions();
      expect(await factory.getRegionCount()).to.equal(17n);
    });

    it("getAllRegionIds가 17개 지역 코드를 반환해야 한다", async function () {
      await factory.deployAllRegions();
      const ids = await factory.getAllRegionIds();
      expect(ids.length).to.equal(17);
    });

    it("각 지역 토큰의 심볼이 EFI-KRxx 형태여야 한다", async function () {
      await factory.deployAllRegions();
      for (const code of ALL_REGIONS) {
        const rid = regionBytes4(code);
        const addr = await factory.getRegionToken(rid);
        const sto = (await ethers.getContractAt("RegionSTO", addr)) as unknown as RegionSTO;
        const symbol = await sto.symbol();
        expect(symbol).to.match(/^EFI-KR\d{2}$/);
      }
    });

    it("이미 배포된 상태에서 다시 호출하면 revert", async function () {
      await factory.deployAllRegions();
      await expectRevertCustomError(
        factory.deployAllRegions(),
        "RegionAlreadyDeployed",
      );
    });

    it("admin이 아닌 계정이 deployAllRegions 호출하면 revert", async function () {
      await expectRevertCustomError(
        factory.connect(nonAdmin).deployAllRegions(),
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  // ── 통합: Factory → RegionSTO ──────────────────────────────────────────────

  describe("통합: Factory → RegionSTO", function () {
    beforeEach(async function () {
      await factory.deployRegion(REGION_SEOUL, "EnergyFi Seoul STO", "EFI-KR11");
      await stationRegistry.registerStation(STN_1, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 강남");
    });

    it("배포된 토큰에서 issueTranche를 호출할 수 있어야 한다", async function () {
      const tokenAddr = await factory.getRegionToken(REGION_SEOUL);
      const sto = (await ethers.getContractAt("RegionSTO", tokenAddr)) as unknown as RegionSTO;
      await sto.issueTranche(admin.address, 1000n, [STN_1]);
      expect(await sto.totalSupply()).to.equal(1000n);
    });

    it("배포된 토큰에서 admin-only transfer 정책이 적용되어야 한다", async function () {
      const tokenAddr = await factory.getRegionToken(REGION_SEOUL);
      const sto = (await ethers.getContractAt("RegionSTO", tokenAddr)) as unknown as RegionSTO;
      await sto.issueTranche(admin.address, 1000n, [STN_1]);
      // non-admin transfer → revert
      await expectRevertCustomError(
        sto.connect(nonAdmin).transfer(admin.address, 100n),
        "TransferNotAllowed",
      );
    });
  });

  // ── UUPS 업그레이드 ────────────────────────────────────────────────────────

  describe("UUPS 업그레이드", function () {
    it("admin이 업그레이드를 승인할 수 있어야 한다", async function () {
      const Factory = await ethers.getContractFactory("RegionSTOFactory");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();
      await factory.upgradeToAndCall(await newImpl.getAddress(), "0x");
    });

    it("admin이 아닌 계정이 업그레이드하면 revert", async function () {
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
