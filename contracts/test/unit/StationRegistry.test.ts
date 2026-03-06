/**
 * StationRegistry 통합 테스트
 *
 * Hardhat 3 + hardhat-ethers v4 API:
 *   ethers = (await hre.network.connect()).ethers
 *
 * R03: UUPS 전환 — constructor → initialize(admin, deviceRegistry).
 * R04: Pausable — pause/unpause, whenNotPaused 적용 확인.
 * T04: UUPS 업그레이드 데이터 보존.
 * T05: View 함수 커버리지 강화.
 *
 * All stations are EnergyFi-owned. No CPO concept on-chain.
 */

import hre from "hardhat";
import { expect } from "chai";
import { ZeroHash, ZeroAddress, Wallet, HDNodeWallet } from "ethers";
import {
  expectRevert,
  expectRevertCustomError,
  b32,
  regionBytes4,
  findEvent,
  getPublicKey64,
  deployUUPSProxy,
} from "../helpers/helpers.js";
import type { DeviceRegistry, StationRegistry } from "../../typechain-types/index.js";

const REGION_SEOUL = regionBytes4("KR11");
const REGION_BUSAN = regionBytes4("KR26");
const REGION_EMPTY = "0x00000000";

// ── Constants ─────────────────────────────────────────────────────────────────

const STN_1 = b32("STATION-001");
const STN_2 = b32("STATION-002");
const STN_3 = b32("STATION-003");
const STN_4 = b32("STATION-004");
const CHG_1 = b32("CHARGER-001");
const CHG_2 = b32("CHARGER-002");

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StationRegistry", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let registry: StationRegistry;
  let deviceRegistry: DeviceRegistry;
  let seWallet: HDNodeWallet;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin     = signers[0];
    nonAdmin  = signers[1];

    seWallet = Wallet.createRandom();

    // R02: Deploy DeviceRegistry via UUPS proxy
    const { contract: dr } = await deployUUPSProxy<DeviceRegistry>(ethers, "DeviceRegistry");
    await dr.initialize(admin.address);
    deviceRegistry = dr;

    // R03: Deploy StationRegistry via UUPS proxy
    const { contract: sr } = await deployUUPSProxy<StationRegistry>(ethers, "StationRegistry");
    await sr.initialize(admin.address, await deviceRegistry.getAddress());
    registry = sr;
  });

  // ── Station Management ──────────────────────────────────────────────────────

  describe("Station 관리", function () {
    it("registerStation() → StationRegistered 이벤트 발행", async function () {
      const tx = await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      const receipt = await tx.wait();
      const event = findEvent(receipt, registry, "StationRegistered");
      expect(event).to.not.be.null;
      expect(event.args.stationId).to.equal(STN_1);
      expect(event.args.regionId).to.equal(REGION_SEOUL);
    });

    it("충전소 등록 후 getStation() 조회", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      const s = await registry.getStation(STN_1);

      expect(s.stationId).to.equal(STN_1);
      expect(s.regionId).to.equal(REGION_SEOUL);
      expect(s.active).to.equal(true);
    });

    it("권한 없는 주소의 registerStation() → revert", async function () {
      await expectRevert(
        registry.connect(nonAdmin).registerStation(
          STN_1, REGION_SEOUL, "서울 강남"
        )
      );
    });

    it("regionId 없는 충전소 등록 → revert RegionRequired", async function () {
      await expectRevertCustomError(
        registry.registerStation(STN_3, REGION_EMPTY, "서울"),
        "RegionRequired"
      );
    });

    it("권한 없는 주소의 deactivateStation() → revert", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await expectRevert(registry.connect(nonAdmin).deactivateStation(STN_1));
    });

    it("미등록 stationId deactivateStation() → revert StationNotFound", async function () {
      await expectRevertCustomError(registry.deactivateStation(STN_1), "StationNotFound");
    });

    it("deactivateStation() 후 getStationsByRegion()에서 제외됨", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, REGION_SEOUL, "서울 종로");
      await registry.deactivateStation(STN_3);
      const stations = await registry.getStationsByRegion(REGION_SEOUL);
      expect(stations).to.include(STN_1);
      expect(stations).to.not.include(STN_3);
    });

    it("active 충전기 있는 충전소 deactivateStation() → revert HasActiveChargers", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(Wallet.createRandom()), 0);
      await registry.registerCharger(CHG_1, STN_1, 1); // L2

      await expectRevertCustomError(registry.deactivateStation(STN_1), "HasActiveChargers");
    });

    it("active 충전기 없으면 deactivateStation() 성공", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.deactivateStation(STN_1);
      const s = await registry.getStation(STN_1);
      expect(s.active).to.equal(false);
    });
  });

  // ── Charger Management ──────────────────────────────────────────────────────

  describe("Charger 관리", function () {
    beforeEach(async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      // Enroll SE chips for chargers (required by registerCharger)
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(seWallet), 0);
      const se2 = Wallet.createRandom();
      await deviceRegistry.enrollChip(CHG_2, getPublicKey64(se2), 0);
    });

    it("충전기 등록 후 getChargersByStation() 조회", async function () {
      await registry.registerCharger(CHG_1, STN_1, 1); // L2
      await registry.registerCharger(CHG_2, STN_1, 2); // DCFC

      const chargers = await registry.getChargersByStation(STN_1);
      expect(chargers).to.include(CHG_1);
      expect(chargers).to.include(CHG_2);
      expect(chargers.length).to.equal(2);
    });

    it("getCharger() 필드 정확성 확인", async function () {
      await registry.registerCharger(CHG_1, STN_1, 2); // DCFC
      const c = await registry.getCharger(CHG_1);

      expect(c.chargerId).to.equal(CHG_1);
      expect(c.stationId).to.equal(STN_1);
      expect(Number(c.chargerType)).to.equal(2);
      expect(c.active).to.equal(true);
    });

    it("비활성화된 충전소에 registerCharger() → revert StationNotActive", async function () {
      await registry.deactivateStation(STN_1);
      await expectRevertCustomError(registry.registerCharger(CHG_1, STN_1, 1), "StationNotActive");
    });

    it("미등록 stationId에 registerCharger() → revert StationNotFound", async function () {
      await expectRevertCustomError(
        registry.registerCharger(CHG_1, b32("STATION-999"), 1),
        "StationNotFound"
      );
    });

    it("chargerType > 2 → revert InvalidChargerType", async function () {
      await expectRevertCustomError(registry.registerCharger(CHG_1, STN_1, 3), "InvalidChargerType");
    });

    it("SE칩 미등록 chargerId → revert ChipNotActive", async function () {
      const CHG_NO_CHIP = b32("CHARGER-NOCHIP");
      await expectRevertCustomError(registry.registerCharger(CHG_NO_CHIP, STN_1, 1), "ChipNotActive");
    });

    it("deactivateCharger() 후 getCharger().active === false", async function () {
      await registry.registerCharger(CHG_1, STN_1, 1);
      await registry.deactivateCharger(CHG_1);
      const c = await registry.getCharger(CHG_1);
      expect(c.active).to.equal(false);
    });

    // T05: getChargersByStation — deactivate 후 배열 반영
    it("deactivateCharger() 후 getChargersByStation()에서 제외됨", async function () {
      await registry.registerCharger(CHG_1, STN_1, 1);
      await registry.registerCharger(CHG_2, STN_1, 2);
      await registry.deactivateCharger(CHG_1);
      const chargers = await registry.getChargersByStation(STN_1);
      expect(chargers).to.not.include(CHG_1);
      expect(chargers).to.include(CHG_2);
      expect(chargers.length).to.equal(1);
    });

    it("ADMIN_ROLE 없는 주소의 registerCharger() → revert", async function () {
      await expectRevert(
        registry.connect(nonAdmin).registerCharger(CHG_1, STN_1, 1)
      );
    });

    it("ADMIN_ROLE 없는 주소의 deactivateCharger() → revert", async function () {
      await registry.registerCharger(CHG_1, STN_1, 1);
      await expectRevert(registry.connect(nonAdmin).deactivateCharger(CHG_1));
    });

    it("미등록 chargerId deactivateCharger() → revert ChargerNotFound", async function () {
      await expectRevertCustomError(registry.deactivateCharger(CHG_1), "ChargerNotFound");
    });

    it("미등록 chargerId getCharger() → revert ChargerNotFound", async function () {
      await expectRevertCustomError(registry.getCharger(CHG_1), "ChargerNotFound");
    });

    it("충전기 deactivate 후 deactivateStation() 성공", async function () {
      await registry.registerCharger(CHG_1, STN_1, 1);
      await registry.deactivateCharger(CHG_1);
      await registry.deactivateStation(STN_1);
      const s = await registry.getStation(STN_1);
      expect(s.active).to.equal(false);
    });
  });

  // ── Region Index Queries ───────────────────────────────────────────────────

  describe("지역 인덱스 조회", function () {
    it("getStationsByRegion() — 같은 지역 충전소 모두 포함", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, REGION_SEOUL, "서울 종로");

      const stations = await registry.getStationsByRegion(REGION_SEOUL);
      expect(stations.length).to.equal(2);
      expect(stations).to.include(STN_1);
      expect(stations).to.include(STN_3);
    });

    it("다른 지역 충전소는 getStationsByRegion()에 포함 안 됨", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, REGION_BUSAN, "부산 해운대");

      const seoulStations = await registry.getStationsByRegion(REGION_SEOUL);
      expect(seoulStations).to.include(STN_1);
      expect(seoulStations).to.not.include(STN_3);
    });
  });

  // ── isRegistered ───────────────────────────────────────────────────────────

  describe("isRegistered (T05)", function () {
    it("등록된 충전소 → true", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      expect(await registry.isRegistered(STN_1)).to.equal(true);
    });

    it("미등록 충전소 → false", async function () {
      expect(await registry.isRegistered(STN_1)).to.equal(false);
    });
  });

  // ── R04: Pausable ──────────────────────────────────────────────────────────

  describe("Pausable (R04)", function () {
    it("admin pause() → 성공, Paused 이벤트", async function () {
      const tx = await registry.pause();
      const receipt = await tx.wait();
      const event = findEvent(receipt, registry, "Paused");
      expect(event).to.not.be.null;
      expect(event.args.account).to.equal(admin.address);
    });

    it("non-admin pause() → revert", async function () {
      await expectRevert(registry.connect(nonAdmin).pause());
    });

    it("non-admin unpause() → revert", async function () {
      await registry.pause();
      await expectRevert(registry.connect(nonAdmin).unpause());
    });

    it("paused 상태에서 registerStation() → revert EnforcedPause", async function () {
      await registry.pause();
      await expectRevertCustomError(
        registry.registerStation(STN_1, REGION_SEOUL, "서울 강남"),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 registerCharger() → revert EnforcedPause", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(seWallet), 0);
      await registry.pause();
      await expectRevertCustomError(
        registry.registerCharger(CHG_1, STN_1, 1),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 deactivateStation() → revert EnforcedPause", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.pause();
      await expectRevertCustomError(
        registry.deactivateStation(STN_1),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 deactivateCharger() → revert EnforcedPause", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(seWallet), 0);
      await registry.registerCharger(CHG_1, STN_1, 1);
      await registry.pause();
      await expectRevertCustomError(
        registry.deactivateCharger(CHG_1),
        "EnforcedPause"
      );
    });

    it("unpause() 후 registerStation() 정상 동작", async function () {
      await registry.pause();
      await registry.unpause();
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      const s = await registry.getStation(STN_1);
      expect(s.active).to.equal(true);
    });

    it("paused 상태에서 view 함수 정상 동작", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.pause();

      // View functions should still work while paused
      expect(await registry.isRegistered(STN_1)).to.equal(true);
      const s = await registry.getStation(STN_1);
      expect(s.stationId).to.equal(STN_1);
      const stations = await registry.getStationsByRegion(REGION_SEOUL);
      expect(stations.length).to.equal(1);
    });
  });

  // ── T04: UUPS 업그레이드 데이터 보존 ──────────────────────────────────────

  describe("UUPS 업그레이드 (T04)", function () {
    it("admin 업그레이드 성공", async function () {
      const SRv2 = await ethers.getContractFactory("StationRegistry");
      const v2Impl = await SRv2.deploy();
      await v2Impl.waitForDeployment();

      await registry.upgradeToAndCall(await v2Impl.getAddress(), "0x");
    });

    it("비인가 주소 업그레이드 → revert", async function () {
      const SRv2 = await ethers.getContractFactory("StationRegistry");
      const v2Impl = await SRv2.deploy();
      await v2Impl.waitForDeployment();

      await expectRevert(
        registry.connect(nonAdmin).upgradeToAndCall(await v2Impl.getAddress(), "0x")
      );
    });

    it("업그레이드 후 기존 Station/Charger 데이터 보존", async function () {
      // Setup data before upgrade
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, REGION_SEOUL, "서울 종로");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(seWallet), 0);
      await registry.registerCharger(CHG_1, STN_1, 1);

      // Upgrade
      const SRv2 = await ethers.getContractFactory("StationRegistry");
      const v2Impl = await SRv2.deploy();
      await v2Impl.waitForDeployment();
      await registry.upgradeToAndCall(await v2Impl.getAddress(), "0x");

      // Verify Station preserved
      const s = await registry.getStation(STN_1);
      expect(s.regionId).to.equal(REGION_SEOUL);

      // Verify Charger preserved
      const c = await registry.getCharger(CHG_1);
      expect(c.stationId).to.equal(STN_1);
      expect(c.active).to.equal(true);

      // Verify index arrays preserved
      const stationsByRegion = await registry.getStationsByRegion(REGION_SEOUL);
      expect(stationsByRegion.length).to.equal(2);
    });

    it("업그레이드 후 새 registrations 정상 동작", async function () {
      // Upgrade
      const SRv2 = await ethers.getContractFactory("StationRegistry");
      const v2Impl = await SRv2.deploy();
      await v2Impl.waitForDeployment();
      await registry.upgradeToAndCall(await v2Impl.getAddress(), "0x");

      // New registrations after upgrade
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      expect(await registry.isRegistered(STN_1)).to.equal(true);
    });
  });

  // ── R03: 초기화 보호 ──────────────────────────────────────────────────────

  describe("초기화 보호 (R03)", function () {
    it("reinitialize 불가", async function () {
      await expectRevert(
        registry.initialize(admin.address, await deviceRegistry.getAddress())
      );
    });
  });
});
