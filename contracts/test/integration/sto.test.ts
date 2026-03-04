/**
 * STO Pipeline (Phase 1 → 2 → 3) 통합 테스트 — 14개
 *
 * 전체 파이프라인: SE chip 등록 → 충전 세션 → 수익 기록 → STO 발행 → 수익 확정.
 *
 * 7개 컨트랙트 배포 (모두 UUPS proxy):
 *   DeviceRegistry + StationRegistry + ChargeTransaction + RevenueTracker(V2) +
 *   ChargeRouter + RegionSTOFactory + RegionSTO(들)
 */

import hre from "hardhat";
import { expect } from "chai";
import { Wallet, ZeroHash, HDNodeWallet } from "ethers";
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
const OwnerType = { CPO: 0n, ENERGYFI: 1n };

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
  let seWallet: HDNodeWallet;

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
    seWallet = Wallet.createRandom() as unknown as HDNodeWallet;

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

    // SE chip
    await deviceRegistry.registerChip(
      CHARGER_1,
      getPublicKey64(seWallet),
      SECP256K1,
    );
    await deviceRegistry.registerChip(
      CHARGER_2,
      getPublicKey64(seWallet),
      SECP256K1,
    );
    await deviceRegistry.registerChip(
      CHARGER_B1,
      getPublicKey64(seWallet),
      SECP256K1,
    );

    // Stations (all EnergyFi-owned)
    await stationRegistry.registerStation(STN_SEOUL_1, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 강남");
    await stationRegistry.registerStation(STN_SEOUL_2, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 서초");
    await stationRegistry.registerStation(STN_BUSAN_1, ZeroHash, OwnerType.ENERGYFI, REGION_BUSAN, "부산 해운대");

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
    const msgHash = buildMsgHash(chargerId, kwh, DEFAULT_START_TS, DEFAULT_END_TS);
    const seSig = signRaw(seWallet, msgHash);

    await chargeRouter.processCharge(
      sessionId,
      chargerId,
      stationId,
      kwh,
      krw,
      PERIOD,
      DEFAULT_START_TS,
      DEFAULT_END_TS,
      seSig,
    );
  }

  // ── 전체 파이프라인 ─────────────────────────────────────────────────────────

  describe("전체 파이프라인", function () {
    it("Phase 1: SE chip 등록 + EnergyFi 소유 서울 충전소 등록", async function () {
      // 이미 beforeEach에서 완료 — 검증만
      expect(await stationRegistry.isRegistered(STN_SEOUL_1)).to.equal(true);
      expect(await stationRegistry.isEnergyFiOwned(STN_SEOUL_1)).to.equal(true);
      const station = await stationRegistry.getStation(STN_SEOUL_1);
      expect(station.regionId).to.equal(REGION_SEOUL);
    });

    it("Phase 2: ChargeRouter.processCharge()로 충전 세션 + 수익 기록", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      const [acc] = await revenueTracker.getStationRevenue(STN_SEOUL_1);
      expect(acc).to.equal(5000n);
    });

    it("Phase 3a: RegionSTOFactory.deployAllRegions()로 전체 지역 토큰 배포", async function () {
      await factory.deployAllRegions();
      expect(await factory.getRegionCount()).to.equal(17n);
      const seoulAddr = await factory.getRegionToken(REGION_SEOUL);
      expect(seoulAddr).to.not.equal("0x0000000000000000000000000000000000000000");
    });

    it("Phase 3b: issueTranche()로 서울 토큰 발행", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1);
      await factory.deployAllRegions();

      const seoulAddr = await factory.getRegionToken(REGION_SEOUL);
      const seoulSTO = (await ethers.getContractAt("RegionSTO", seoulAddr)) as unknown as RegionSTO;

      await seoulSTO.issueTranche(investor.address, 1000n, [STN_SEOUL_1, STN_SEOUL_2]);
      expect(await seoulSTO.totalSupply()).to.equal(1000n);
      expect(await seoulSTO.balanceOf(investor.address)).to.equal(1000n);
    });

    it("Phase 3c: claimRegion()으로 서울 지역 수익 확정", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await doCharge(CHARGER_2, STN_SEOUL_2, 2000n, 8000n);

      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const att = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(13000n); // 5000 + 8000
    });

    it("검증: totalSupply가 발행량과 일치", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1);
      await factory.deployAllRegions();

      const seoulAddr = await factory.getRegionToken(REGION_SEOUL);
      const seoulSTO = (await ethers.getContractAt("RegionSTO", seoulAddr)) as unknown as RegionSTO;

      await seoulSTO.issueTranche(investor.address, 500n, [STN_SEOUL_1]);
      await seoulSTO.issueTranche(investor.address, 300n, [STN_SEOUL_2]);
      expect(await seoulSTO.totalSupply()).to.equal(800n);
    });

    it("검증: RegionAttestation.distributableKrw가 기록된 수익과 일치", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 7000n);
      await doCharge(CHARGER_2, STN_SEOUL_2, 500n, 3000n);

      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const att = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(10000n);
    });

    it("검증: RegionAttestation.stationCount가 등록된 충전소 수와 일치", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await doCharge(CHARGER_2, STN_SEOUL_2, 1000n, 3000n);

      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const att = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      // 서울에 EnergyFi 소유 2개 충전소
      expect(att.stationCount).to.equal(2n);
    });
  });

  // ── 다중 지역 시나리오 ──────────────────────────────────────────────────────

  describe("다중 지역 시나리오", function () {
    it("서로 다른 지역의 충전소가 독립적으로 처리되어야 한다", async function () {
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await doCharge(CHARGER_B1, STN_BUSAN_1, 500n, 2000n);

      // 서울만 정산
      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const attSeoul = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(attSeoul.distributableKrw).to.equal(5000n);

      // 부산 아직 미정산
      const pendingBusan = await revenueTracker.getEnergyFiRegionRevenue(REGION_BUSAN);
      expect(pendingBusan).to.equal(2000n);
    });

    it("서로 다른 지역에서 동시에 tranche 발행이 가능해야 한다", async function () {
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

  // ── 독립성 검증 ─────────────────────────────────────────────────────────────

  describe("독립성 검증", function () {
    it("claimRegion은 STO 발행 없이도 동작해야 한다", async function () {
      // RegionSTO 배포/발행 없이 수익만 기록 후 claimRegion
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const att = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(5000n);
      expect(att.stationCount).to.equal(1n);
    });

    it("issueTranche는 수익 기록 없이도 동작해야 한다", async function () {
      // 수익 기록 없이 토큰 발행만 수행
      await factory.deployAllRegions();
      const seoulAddr = await factory.getRegionToken(REGION_SEOUL);
      const seoulSTO = (await ethers.getContractAt("RegionSTO", seoulAddr)) as unknown as RegionSTO;
      await seoulSTO.issueTranche(investor.address, 1000n, [STN_SEOUL_1]);
      expect(await seoulSTO.totalSupply()).to.equal(1000n);
    });
  });

  // ── 복합 정산 시나리오 ──────────────────────────────────────────────────────

  describe("복합 정산 시나리오", function () {
    it("여러 충전 세션 후 claimRegion이 전체 수익을 확정해야 한다", async function () {
      // 서울 충전소들에 여러 세션
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await doCharge(CHARGER_1, STN_SEOUL_1, 2000n, 8000n);
      await doCharge(CHARGER_2, STN_SEOUL_2, 500n, 3000n);

      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);
      const att = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att.distributableKrw).to.equal(16000n); // 5000+8000+3000
      expect(att.stationCount).to.equal(2n);
    });

    it("claimRegion 후 새 수익이 쌓이면 다음 claimRegion에서만 정산되어야 한다", async function () {
      // 1차 수익 + 정산
      await doCharge(CHARGER_1, STN_SEOUL_1, 1000n, 5000n);
      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD);

      const att1 = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD);
      expect(att1.distributableKrw).to.equal(5000n);

      // 2차 수익 (새 충전 세션 → pending에 추가됨)
      await doCharge(CHARGER_2, STN_SEOUL_2, 500n, 3000n);

      // 2차 정산: 1차 이후 쌓인 pending만 포함
      const PERIOD_NEXT = 202607n;
      await revenueTracker.claimRegion(REGION_SEOUL, PERIOD_NEXT);
      const att2 = await revenueTracker.getRegionAttestation(REGION_SEOUL, PERIOD_NEXT);
      expect(att2.distributableKrw).to.equal(3000n);
    });
  });
});
