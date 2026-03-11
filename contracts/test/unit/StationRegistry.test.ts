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

  describe("station management", function () {
    it("emits StationRegistered on registerStation()", async function () {
      const tx = await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      const receipt = await tx.wait();
      const event = findEvent(receipt, registry, "StationRegistered");
      expect(event).to.not.be.null;
      expect(event.args.stationId).to.equal(STN_1);
      expect(event.args.regionId).to.equal(REGION_SEOUL);
    });

    it("returns the station after registration through getStation()", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      const s = await registry.getStation(STN_1);

      expect(s.stationId).to.equal(STN_1);
      expect(s.regionId).to.equal(REGION_SEOUL);
      expect(s.active).to.equal(true);
    });

    it("reverts registerStation() from an unauthorized address", async function () {
      await expectRevert(
        registry.connect(nonAdmin).registerStation(
          STN_1, REGION_SEOUL, "서울 강남"
        )
      );
    });

    it("reverts with RegionRequired when registering a station without regionId", async function () {
      await expectRevertCustomError(
        registry.registerStation(STN_3, REGION_EMPTY, "서울"),
        "RegionRequired"
      );
    });

    it("reverts deactivateStation() from an unauthorized address", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await expectRevert(registry.connect(nonAdmin).deactivateStation(STN_1));
    });

    it("reverts deactivateStation() with StationNotFound for an unknown stationId", async function () {
      await expectRevertCustomError(registry.deactivateStation(STN_1), "StationNotFound");
    });

    it("removes the station from getStationsByRegion() after deactivateStation()", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, REGION_SEOUL, "서울 종로");
      await registry.deactivateStation(STN_3);
      const stations = await registry.getStationsByRegion(REGION_SEOUL);
      expect(stations).to.include(STN_1);
      expect(stations).to.not.include(STN_3);
    });

    it("reverts deactivateStation() with HasActiveChargers when active chargers remain", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(Wallet.createRandom()), 0);
      await registry.registerCharger(CHG_1, STN_1, 1); // L2

      await expectRevertCustomError(registry.deactivateStation(STN_1), "HasActiveChargers");
    });

    it("allows deactivateStation() when no active chargers remain", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.deactivateStation(STN_1);
      const s = await registry.getStation(STN_1);
      expect(s.active).to.equal(false);
    });
  });

  // ── Charger Management ──────────────────────────────────────────────────────

  describe("charger management", function () {
    beforeEach(async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      // Enroll SE chips for chargers (required by registerCharger)
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(seWallet), 0);
      const se2 = Wallet.createRandom();
      await deviceRegistry.enrollChip(CHG_2, getPublicKey64(se2), 0);
    });

    it("returns chargers through getChargersByStation() after registration", async function () {
      await registry.registerCharger(CHG_1, STN_1, 1); // L2
      await registry.registerCharger(CHG_2, STN_1, 2); // DCFC

      const chargers = await registry.getChargersByStation(STN_1);
      expect(chargers).to.include(CHG_1);
      expect(chargers).to.include(CHG_2);
      expect(chargers.length).to.equal(2);
    });

    it("returns the expected fields from getCharger()", async function () {
      await registry.registerCharger(CHG_1, STN_1, 2); // DCFC
      const c = await registry.getCharger(CHG_1);

      expect(c.chargerId).to.equal(CHG_1);
      expect(c.stationId).to.equal(STN_1);
      expect(Number(c.chargerType)).to.equal(2);
      expect(c.active).to.equal(true);
    });

    it("reverts registerCharger() with StationNotActive for an inactive station", async function () {
      await registry.deactivateStation(STN_1);
      await expectRevertCustomError(registry.registerCharger(CHG_1, STN_1, 1), "StationNotActive");
    });

    it("reverts registerCharger() with StationNotFound for an unknown stationId", async function () {
      await expectRevertCustomError(
        registry.registerCharger(CHG_1, b32("STATION-999"), 1),
        "StationNotFound"
      );
    });

    it("chargerType > 2 → revert InvalidChargerType", async function () {
      await expectRevertCustomError(registry.registerCharger(CHG_1, STN_1, 3), "InvalidChargerType");
    });

    it("reverts registerCharger() with ChipNotActive for a charger without an enrolled chip", async function () {
      const CHG_NO_CHIP = b32("CHARGER-NOCHIP");
      await expectRevertCustomError(registry.registerCharger(CHG_NO_CHIP, STN_1, 1), "ChipNotActive");
    });

    it("sets getCharger().active to false after deactivateCharger()", async function () {
      await registry.registerCharger(CHG_1, STN_1, 1);
      await registry.deactivateCharger(CHG_1);
      const c = await registry.getCharger(CHG_1);
      expect(c.active).to.equal(false);
    });

    // T05: getChargersByStation — deactivate 후 배열 반영
    it("removes the charger from getChargersByStation() after deactivateCharger()", async function () {
      await registry.registerCharger(CHG_1, STN_1, 1);
      await registry.registerCharger(CHG_2, STN_1, 2);
      await registry.deactivateCharger(CHG_1);
      const chargers = await registry.getChargersByStation(STN_1);
      expect(chargers).to.not.include(CHG_1);
      expect(chargers).to.include(CHG_2);
      expect(chargers.length).to.equal(1);
    });

    it("reverts registerCharger() from an address without ADMIN_ROLE", async function () {
      await expectRevert(
        registry.connect(nonAdmin).registerCharger(CHG_1, STN_1, 1)
      );
    });

    it("reverts deactivateCharger() from an address without ADMIN_ROLE", async function () {
      await registry.registerCharger(CHG_1, STN_1, 1);
      await expectRevert(registry.connect(nonAdmin).deactivateCharger(CHG_1));
    });

    it("reverts deactivateCharger() with ChargerNotFound for an unknown chargerId", async function () {
      await expectRevertCustomError(registry.deactivateCharger(CHG_1), "ChargerNotFound");
    });

    it("reverts getCharger() with ChargerNotFound for an unknown chargerId", async function () {
      await expectRevertCustomError(registry.getCharger(CHG_1), "ChargerNotFound");
    });

    it("allows deactivateStation() after deactivating the charger", async function () {
      await registry.registerCharger(CHG_1, STN_1, 1);
      await registry.deactivateCharger(CHG_1);
      await registry.deactivateStation(STN_1);
      const s = await registry.getStation(STN_1);
      expect(s.active).to.equal(false);
    });
  });

  // ── Region Index Queries ───────────────────────────────────────────────────

  describe("region index lookups", function () {
    it("includes all stations from the same region in getStationsByRegion()", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, REGION_SEOUL, "서울 종로");

      const stations = await registry.getStationsByRegion(REGION_SEOUL);
      expect(stations.length).to.equal(2);
      expect(stations).to.include(STN_1);
      expect(stations).to.include(STN_3);
    });

    it("excludes stations from other regions in getStationsByRegion()", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, REGION_BUSAN, "부산 해운대");

      const seoulStations = await registry.getStationsByRegion(REGION_SEOUL);
      expect(seoulStations).to.include(STN_1);
      expect(seoulStations).to.not.include(STN_3);
    });
  });

  // ── isRegistered ───────────────────────────────────────────────────────────

  describe("isRegistered (T05)", function () {
    it("returns true for a registered station", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      expect(await registry.isRegistered(STN_1)).to.equal(true);
    });

    it("returns false for an unregistered station", async function () {
      expect(await registry.isRegistered(STN_1)).to.equal(false);
    });
  });

  // ── R04: Pausable ──────────────────────────────────────────────────────────

  describe("Pausable (R04)", function () {
    it("allows admin pause() and emits Paused", async function () {
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

    it("reverts registerStation() with EnforcedPause while paused", async function () {
      await registry.pause();
      await expectRevertCustomError(
        registry.registerStation(STN_1, REGION_SEOUL, "서울 강남"),
        "EnforcedPause"
      );
    });

    it("reverts registerCharger() with EnforcedPause while paused", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(seWallet), 0);
      await registry.pause();
      await expectRevertCustomError(
        registry.registerCharger(CHG_1, STN_1, 1),
        "EnforcedPause"
      );
    });

    it("reverts deactivateStation() with EnforcedPause while paused", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await registry.pause();
      await expectRevertCustomError(
        registry.deactivateStation(STN_1),
        "EnforcedPause"
      );
    });

    it("reverts deactivateCharger() with EnforcedPause while paused", async function () {
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(seWallet), 0);
      await registry.registerCharger(CHG_1, STN_1, 1);
      await registry.pause();
      await expectRevertCustomError(
        registry.deactivateCharger(CHG_1),
        "EnforcedPause"
      );
    });

    it("allows registerStation() again after unpause()", async function () {
      await registry.pause();
      await registry.unpause();
      await registry.registerStation(STN_1, REGION_SEOUL, "서울 강남");
      const s = await registry.getStation(STN_1);
      expect(s.active).to.equal(true);
    });

    it("keeps view functions working while paused", async function () {
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

  describe("UUPS upgrades (T04)", function () {
    it("allows admin upgrade", async function () {
      const SRv2 = await ethers.getContractFactory("StationRegistry");
      const v2Impl = await SRv2.deploy();
      await v2Impl.waitForDeployment();

      await registry.upgradeToAndCall(await v2Impl.getAddress(), "0x");
    });

    it("reverts upgrade from an unauthorized address", async function () {
      const SRv2 = await ethers.getContractFactory("StationRegistry");
      const v2Impl = await SRv2.deploy();
      await v2Impl.waitForDeployment();

      await expectRevert(
        registry.connect(nonAdmin).upgradeToAndCall(await v2Impl.getAddress(), "0x")
      );
    });

    it("preserves existing station and charger data after upgrade", async function () {
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

    it("still allows new registrations after upgrade", async function () {
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

  describe("initializer protection (R03)", function () {
    it("prevents reinitialize", async function () {
      await expectRevert(
        registry.initialize(admin.address, await deviceRegistry.getAddress())
      );
    });
  });
});
