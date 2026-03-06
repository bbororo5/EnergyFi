/**
 * RegionSTO 단위 테스트 — 37개
 *
 * 지역별 토큰증권 (ERC-20 기반) 인터페이스 + 구현 검증.
 * UUPS proxy 배포, StationRegistry 연동.
 *
 * 초기화 / issueTranche 성공·실패 / transfer 제한 / burn / View / Pausable / UUPS.
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
const STN_1 = b32("STATION-001");   // EnergyFi, Seoul
const STN_2 = b32("STATION-002");   // EnergyFi, Seoul
const STN_3 = b32("STATION-003");   // EnergyFi, Seoul
const STN_4 = b32("STATION-004");   // EnergyFi, Busan (다른 지역)
const STN_5 = b32("STATION-005");   // CPO 소유, Seoul
const STN_99 = b32("STATION-999");  // 미등록
const CPO_1 = b32("CPO-001");
const OwnerType = { CPO: 0n, ENERGYFI: 1n };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RegionSTO", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let investor: Awaited<ReturnType<typeof ethers.getSigner>>;
  let cpoWallet: Awaited<ReturnType<typeof ethers.getSigner>>;

  let stationRegistry: StationRegistry;
  let regionSTO: RegionSTO;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    nonAdmin = signers[1];
    investor = signers[2];
    cpoWallet = signers[3];

    // Deploy DeviceRegistry (needed for StationRegistry)
    const { contract: dr } = await deployUUPSProxy<DeviceRegistry>(ethers, "DeviceRegistry");
    await dr.initialize(admin.address);

    // Deploy StationRegistry
    const { contract: sr } = await deployUUPSProxy<StationRegistry>(ethers, "StationRegistry");
    await sr.initialize(admin.address, await dr.getAddress());
    stationRegistry = sr;

    // Register CPO + stations
    await stationRegistry.registerCPO(CPO_1, cpoWallet.address, "TestCPO");
    await stationRegistry.registerStation(STN_1, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 강남");
    await stationRegistry.registerStation(STN_2, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 서초");
    await stationRegistry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
    await stationRegistry.registerStation(STN_4, ZeroHash, OwnerType.ENERGYFI, REGION_BUSAN, "부산 해운대");
    await stationRegistry.registerStation(STN_5, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 역삼 CPO");

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

  // ── 초기화 ──────────────────────────────────────────────────────────────────

  describe("초기화", function () {
    it("regionId, name, symbol이 올바르게 설정되어야 한다", async function () {
      expect(await regionSTO.regionId()).to.equal(REGION_SEOUL);
      expect(await regionSTO.name()).to.equal("EnergyFi Seoul STO");
      expect(await regionSTO.symbol()).to.equal("EFI-KR11");
    });

    it("deployer에게 DEFAULT_ADMIN_ROLE이 부여되어야 한다", async function () {
      const DEFAULT_ADMIN_ROLE = ZeroHash;
      expect(await regionSTO.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
    });

    it("double initialize 시 revert 되어야 한다", async function () {
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

  // ── issueTranche 성공 ───────────────────────────────────────────────────────

  describe("issueTranche 성공", function () {
    it("토큰이 mint되고 tranche가 기록되어야 한다", async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1]);
      expect(await regionSTO.balanceOf(investor.address)).to.equal(1000n);
      expect(await regionSTO.getTrancheCount()).to.equal(1n);
    });

    it("trancheCount가 증가해야 한다", async function () {
      expect(await regionSTO.getTrancheCount()).to.equal(0n);
      await regionSTO.issueTranche(investor.address, 500n, [STN_1]);
      expect(await regionSTO.getTrancheCount()).to.equal(1n);
      await regionSTO.issueTranche(investor.address, 300n, [STN_2]);
      expect(await regionSTO.getTrancheCount()).to.equal(2n);
    });

    it("TrancheIssued 이벤트가 올바른 파라미터로 emit 되어야 한다", async function () {
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

    it("totalSupply가 tokenAmount만큼 증가해야 한다", async function () {
      expect(await regionSTO.totalSupply()).to.equal(0n);
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1]);
      expect(await regionSTO.totalSupply()).to.equal(1000n);
      await regionSTO.issueTranche(investor.address, 500n, [STN_2]);
      expect(await regionSTO.totalSupply()).to.equal(1500n);
    });

    it("tranche에 stationIds가 기록되어야 한다", async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1, STN_2]);
      const tranche = await regionSTO.getTranche(1);
      expect(tranche.stationIds.length).to.equal(2);
      expect(tranche.stationIds[0]).to.equal(STN_1);
      expect(tranche.stationIds[1]).to.equal(STN_2);
    });

    it("getStationTranche로 stationId → trancheId 매핑을 확인할 수 있어야 한다", async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1, STN_2]);
      expect(await regionSTO.getStationTranche(STN_1)).to.equal(1n);
      expect(await regionSTO.getStationTranche(STN_2)).to.equal(1n);
    });

    it("여러 차수를 연속 발행할 수 있어야 한다", async function () {
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

  // ── issueTranche 실패 ───────────────────────────────────────────────────────

  describe("issueTranche 실패", function () {
    it("admin이 아닌 계정이 호출하면 revert", async function () {
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).issueTranche(investor.address, 1000n, [STN_1]),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("미등록 충전소가 포함되면 revert", async function () {
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, [STN_99]),
        "StationNotRegistered",
      );
    });

    it("CPO 소유 충전소가 포함되면 revert", async function () {
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, [STN_5]),
        "StationNotEnergyFiOwned",
      );
    });

    it("다른 지역 충전소가 포함되면 revert", async function () {
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, [STN_4]),
        "RegionMismatch",
      );
    });

    it("이미 다른 tranche에 포함된 충전소가 있으면 revert", async function () {
      await regionSTO.issueTranche(investor.address, 500n, [STN_1]);
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 300n, [STN_1]),
        "StationAlreadyInTranche",
      );
    });

    it("tokenAmount가 0이면 revert", async function () {
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 0n, [STN_1]),
        "ZeroAmount",
      );
    });

    it("stationIds가 비어있으면 revert", async function () {
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, []),
        "EmptyStations",
      );
    });

    it("paused 상태에서 호출하면 revert", async function () {
      await regionSTO.pause();
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, [STN_1]),
        "EnforcedPause",
      );
    });

    it("비활성화된 충전소가 포함되면 revert", async function () {
      // STN_1 비활성화
      await stationRegistry.deactivateStation(STN_1);
      await expectRevertCustomError(
        regionSTO.issueTranche(investor.address, 1000n, [STN_1]),
        "StationNotActive",
      );
    });
  });

  // ── transfer 제한 (Admin-only) ─────────────────────────────────────────────

  describe("transfer 제한 (Admin-only)", function () {
    beforeEach(async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1]);
    });

    it("admin이 adminTransfer로 이체하면 성공", async function () {
      await regionSTO.adminTransfer(investor.address, nonAdmin.address, 100n);
      expect(await regionSTO.balanceOf(nonAdmin.address)).to.equal(100n);
      expect(await regionSTO.balanceOf(investor.address)).to.equal(900n);
    });

    it("admin이 아닌 계정이 adminTransfer 호출하면 revert", async function () {
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).adminTransfer(investor.address, admin.address, 100n),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("일반 사용자의 transfer는 revert (Admin-only 정책)", async function () {
      await expectRevertCustomError(
        regionSTO.connect(investor).transfer(nonAdmin.address, 100n),
        "TransferNotAllowed",
      );
    });

    it("일반 사용자의 transferFrom은 revert", async function () {
      // investor가 nonAdmin에게 allowance 부여해도 transfer 불가
      await regionSTO.connect(investor).approve(nonAdmin.address, 500n);
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).transferFrom(investor.address, admin.address, 100n),
        "TransferNotAllowed",
      );
    });
  });

  // ── burn ─────────────────────────────────────────────────────────────────────

  describe("burn", function () {
    beforeEach(async function () {
      await regionSTO.issueTranche(investor.address, 1000n, [STN_1]);
    });

    it("admin이 burn하면 totalSupply가 감소해야 한다", async function () {
      await regionSTO.burn(investor.address, 300n);
      expect(await regionSTO.totalSupply()).to.equal(700n);
      expect(await regionSTO.balanceOf(investor.address)).to.equal(700n);
    });

    it("Transfer(from, address(0), amount) 이벤트가 emit 되어야 한다", async function () {
      const tx = await regionSTO.burn(investor.address, 200n);
      const receipt = await tx.wait();
      const event = findEvent(receipt!, regionSTO, "Transfer");
      expect(event).to.not.be.null;
      expect(event.args.from).to.equal(investor.address);
      expect(event.args.to).to.equal(ZeroAddress);
      expect(event.args.value).to.equal(200n);
    });

    it("admin이 아닌 계정이 호출하면 revert", async function () {
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).burn(investor.address, 100n),
        "AccessControlUnauthorizedAccount",
      );
    });

    it("balance 초과 금액을 burn하면 revert", async function () {
      await expectRevertCustomError(
        regionSTO.burn(investor.address, 2000n),
        "ERC20InsufficientBalance",
      );
    });

    it("burn 후에도 tranche 기록은 보존되어야 한다 (KSD 감사 추적)", async function () {
      await regionSTO.burn(investor.address, 1000n);
      expect(await regionSTO.totalSupply()).to.equal(0n);
      // tranche 기록은 불변 — 소각 이력 추적을 위해 보존
      const tranche = await regionSTO.getTranche(1);
      expect(tranche.tokenAmount).to.equal(1000n);
      expect(tranche.stationIds[0]).to.equal(STN_1);
    });
  });

  // ── View 함수 ──────────────────────────────────────────────────────────────

  describe("View 함수", function () {
    it("regionId()가 initialize에서 설정한 값을 반환해야 한다", async function () {
      expect(await regionSTO.regionId()).to.equal(REGION_SEOUL);
    });

    it("getTranche(0) 존재하지 않는 trancheId 조회 시 빈 값 또는 revert", async function () {
      // trancheId는 1-based. 0 또는 범위 밖 조회 시 동작 확인
      const tranche = await regionSTO.getTranche(0);
      expect(tranche.trancheId).to.equal(0n);
      expect(tranche.tokenAmount).to.equal(0n);
    });

    it("getTranche()이 올바른 데이터를 반환해야 한다", async function () {
      await regionSTO.issueTranche(investor.address, 500n, [STN_1, STN_2]);
      const tranche = await regionSTO.getTranche(1);
      expect(tranche.trancheId).to.equal(1n);
      expect(tranche.tokenAmount).to.equal(500n);
      expect(tranche.stationIds.length).to.equal(2);
      expect(tranche.issuedAt).to.be.greaterThan(0n);
    });

    it("getStationTranche()이 미포함 충전소에 대해 0을 반환해야 한다", async function () {
      expect(await regionSTO.getStationTranche(STN_1)).to.equal(0n);
    });
  });

  // ── Pausable ────────────────────────────────────────────────────────────────

  describe("Pausable", function () {
    it("admin이 pause할 수 있어야 한다", async function () {
      await regionSTO.pause();
      expect(await regionSTO.paused()).to.equal(true);
    });

    it("admin이 unpause할 수 있어야 한다", async function () {
      await regionSTO.pause();
      await regionSTO.unpause();
      expect(await regionSTO.paused()).to.equal(false);
    });

    it("admin이 아닌 계정이 pause하면 revert", async function () {
      await expectRevertCustomError(
        regionSTO.connect(nonAdmin).pause(),
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  // ── UUPS 업그레이드 ────────────────────────────────────────────────────────

  describe("UUPS 업그레이드", function () {
    it("admin이 업그레이드를 승인할 수 있어야 한다", async function () {
      const Factory = await ethers.getContractFactory("RegionSTO");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();
      await regionSTO.upgradeToAndCall(await newImpl.getAddress(), "0x");
    });

    it("admin이 아닌 계정이 업그레이드하면 revert", async function () {
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
