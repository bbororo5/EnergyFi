/**
 * StationRegistry 통합 테스트
 *
 * Hardhat 3 + hardhat-ethers v4 API:
 *   ethers = (await hre.network.connect()).ethers
 *
 * R03: UUPS 전환 — constructor → initialize(admin, deviceRegistry).
 * R04: Pausable — pause/unpause, whenNotPaused 적용 확인.
 * R07: 입력 검증 보강 — ZeroWalletAddress, EmptyName.
 * T01: 데이터 정합성 교차 검증 (getStationsByCPO, getStationsByRegion vs getEnergyFiStationsByRegion).
 * T04: UUPS 업그레이드 데이터 보존.
 * T05: View 함수 커버리지 강화.
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

const OwnerType = { CPO: 0n, ENERGYFI: 1n };

// ── Constants ─────────────────────────────────────────────────────────────────

const CPO_1 = b32("CPO-001");
const CPO_2 = b32("CPO-002");
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
  let cpoWallet: Awaited<ReturnType<typeof ethers.getSigner>>;
  let registry: StationRegistry;
  let deviceRegistry: DeviceRegistry;
  let seWallet: HDNodeWallet;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin     = signers[0];
    nonAdmin  = signers[1];
    cpoWallet = signers[2];

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

  // ── CPO Management ──────────────────────────────────────────────────────────

  describe("CPO 관리", function () {
    it("registerCPO() → CPORegistered 이벤트 발행", async function () {
      const tx = await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      const receipt = await tx.wait();
      const event = findEvent(receipt, registry, "CPORegistered");
      expect(event).to.not.be.null;
      expect(event.args.cpoId).to.equal(CPO_1);
      expect(event.args.walletAddress).to.equal(cpoWallet.address);
      expect(event.args.name).to.equal("삼성EV");
    });

    it("CPO 등록 후 getCPO() 조회 성공", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      const cpo = await registry.getCPO(CPO_1);

      expect(cpo.cpoId).to.equal(CPO_1);
      expect(cpo.walletAddress).to.equal(cpoWallet.address);
      expect(cpo.name).to.equal("삼성EV");
      expect(cpo.active).to.equal(true);
    });

    it("동일 cpoId 중복 등록 → revert CPOAlreadyExists", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await expectRevertCustomError(
        registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV2"),
        "CPOAlreadyExists"
      );
    });

    it("미등록 CPO getCPO() → revert CPONotFound", async function () {
      await expectRevertCustomError(registry.getCPO(CPO_1), "CPONotFound");
    });

    it("active 충전소 있는 CPO deactivateCPO() → revert HasActiveStations", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await expectRevertCustomError(registry.deactivateCPO(CPO_1), "HasActiveStations");
    });

    it("active 충전소 없으면 deactivateCPO() 성공", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.deactivateCPO(CPO_1);
      const cpo = await registry.getCPO(CPO_1);
      expect(cpo.active).to.equal(false);
    });

    it("ADMIN_ROLE 없는 주소의 registerCPO() → revert", async function () {
      await expectRevert(
        registry.connect(nonAdmin).registerCPO(CPO_1, cpoWallet.address, "삼성EV")
      );
    });

    it("ADMIN_ROLE 없는 주소의 deactivateCPO() → revert", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await expectRevert(registry.connect(nonAdmin).deactivateCPO(CPO_1));
    });

    it("미등록 cpoId deactivateCPO() → revert CPONotFound", async function () {
      await expectRevertCustomError(registry.deactivateCPO(CPO_1), "CPONotFound");
    });

    // R07: 입력 검증 보강
    it("registerCPO with address(0) → revert ZeroWalletAddress (R07)", async function () {
      await expectRevertCustomError(
        registry.registerCPO(CPO_1, ZeroAddress, "삼성EV"),
        "ZeroWalletAddress"
      );
    });

    it("registerCPO with empty name → revert EmptyName (R07)", async function () {
      await expectRevertCustomError(
        registry.registerCPO(CPO_1, cpoWallet.address, ""),
        "EmptyName"
      );
    });
  });

  // ── Station Management ──────────────────────────────────────────────────────

  describe("Station 관리", function () {
    beforeEach(async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
    });

    it("registerStation() → StationRegistered 이벤트 발행", async function () {
      const tx = await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      const receipt = await tx.wait();
      const event = findEvent(receipt, registry, "StationRegistered");
      expect(event).to.not.be.null;
      expect(event.args.stationId).to.equal(STN_1);
      expect(event.args.cpoId).to.equal(CPO_1);
      expect(event.args.ownerType).to.equal(OwnerType.CPO);
      expect(event.args.regionId).to.equal(REGION_SEOUL);
    });

    it("CPO 충전소 등록 후 getStation() 조회", async function () {
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      const s = await registry.getStation(STN_1);

      expect(s.stationId).to.equal(STN_1);
      expect(s.cpoId).to.equal(CPO_1);
      expect(s.ownerType).to.equal(OwnerType.CPO);
      expect(s.regionId).to.equal(REGION_SEOUL);
      expect(s.active).to.equal(true);
    });

    it("ENERGYFI 충전소 등록 후 getStation() 조회", async function () {
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
      const s = await registry.getStation(STN_3);

      expect(s.ownerType).to.equal(OwnerType.ENERGYFI);
      expect(s.cpoId).to.equal(ZeroHash);
      expect(s.regionId).to.equal(REGION_SEOUL);
    });

    it("ENERGYFI 충전소 getEnergyFiStationsByRegion() 포함 확인", async function () {
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
      await registry.registerStation(STN_4, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 마포");

      const efStations = await registry.getEnergyFiStationsByRegion(REGION_SEOUL);
      expect(efStations).to.include(STN_3);
      expect(efStations).to.include(STN_4);
      expect(efStations.length).to.equal(2);
    });

    it("CPO 충전소가 getEnergyFiStationsByRegion() 결과에 포함 안 됨", async function () {
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");

      const efStations = await registry.getEnergyFiStationsByRegion(REGION_SEOUL);
      expect(efStations).to.not.include(STN_1);
      expect(efStations).to.include(STN_3);
    });

    it("isEnergyFiOwned() CPO → false", async function () {
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      expect(await registry.isEnergyFiOwned(STN_1)).to.equal(false);
    });

    it("isEnergyFiOwned() ENERGYFI → true", async function () {
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
      expect(await registry.isEnergyFiOwned(STN_3)).to.equal(true);
    });

    // T05: getStationOwner 검증
    it("getStationOwner() CPO → (CPO, cpoWalletAddress)", async function () {
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      const [ownerType, ownerAddress] = await registry.getStationOwner(STN_1);

      expect(ownerType).to.equal(OwnerType.CPO);
      expect(ownerAddress).to.equal(cpoWallet.address);
    });

    it("getStationOwner() ENERGYFI → (ENERGYFI, address(0))", async function () {
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
      const [ownerType, ownerAddress] = await registry.getStationOwner(STN_3);

      expect(ownerType).to.equal(OwnerType.ENERGYFI);
      expect(ownerAddress).to.equal(ZeroAddress);
    });

    it("권한 없는 주소의 registerStation() → revert", async function () {
      await expectRevert(
        registry.connect(nonAdmin).registerStation(
          STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남"
        )
      );
    });

    it("regionId 없는 ENERGYFI 충전소 등록 → revert RegionRequired", async function () {
      await expectRevertCustomError(
        registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_EMPTY, "서울"),
        "RegionRequired"
      );
    });

    it("cpoId 없는 CPO 충전소 등록 → revert CpoRequired", async function () {
      await expectRevertCustomError(
        registry.registerStation(STN_1, ZeroHash, OwnerType.CPO, REGION_SEOUL, "서울 강남"),
        "CpoRequired"
      );
    });

    it("미등록 cpoId로 CPO 충전소 등록 → revert CPONotFound", async function () {
      await expectRevertCustomError(
        registry.registerStation(STN_1, CPO_2, OwnerType.CPO, REGION_SEOUL, "서울 강남"),
        "CPONotFound"
      );
    });

    it("비활성 CPO로 CPO 충전소 등록 → revert CPONotActive", async function () {
      await registry.deactivateCPO(CPO_1); // CPO_1은 beforeEach에서 등록, 소속 스테이션 없음
      await expectRevertCustomError(
        registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남"),
        "CPONotActive"
      );
    });

    it("권한 없는 주소의 deactivateStation() → revert", async function () {
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await expectRevert(registry.connect(nonAdmin).deactivateStation(STN_1));
    });

    it("미등록 stationId deactivateStation() → revert StationNotFound", async function () {
      await expectRevertCustomError(registry.deactivateStation(STN_1), "StationNotFound");
    });

    it("deactivateStation() 후 getStationsByRegion()에서 제외됨", async function () {
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
      await registry.deactivateStation(STN_3);
      const stations = await registry.getStationsByRegion(REGION_SEOUL);
      expect(stations).to.include(STN_1);
      expect(stations).to.not.include(STN_3);
    });

    it("deactivateStation() 후 getEnergyFiStationsByRegion()에서 제외됨", async function () {
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
      await registry.registerStation(STN_4, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 마포");
      await registry.deactivateStation(STN_3);
      const efStations = await registry.getEnergyFiStationsByRegion(REGION_SEOUL);
      expect(efStations).to.not.include(STN_3);
      expect(efStations).to.include(STN_4);
      expect(efStations.length).to.equal(1);
    });

    it("deactivateStation() 후 getStationsByCPO()에서 제외됨", async function () {
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.deactivateStation(STN_1);
      const stations = await registry.getStationsByCPO(CPO_1);
      expect(stations).to.not.include(STN_1);
      expect(stations.length).to.equal(0);
    });

    it("active 충전기 있는 충전소 deactivateStation() → revert HasActiveChargers", async function () {
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(Wallet.createRandom()), 0);
      await registry.registerCharger(CHG_1, STN_1, 1); // L2

      await expectRevertCustomError(registry.deactivateStation(STN_1), "HasActiveChargers");
    });

    it("active 충전기 없으면 deactivateStation() 성공", async function () {
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.deactivateStation(STN_1);
      const s = await registry.getStation(STN_1);
      expect(s.active).to.equal(false);
    });
  });

  // ── Charger Management ──────────────────────────────────────────────────────

  describe("Charger 관리", function () {
    beforeEach(async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
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

  // ── Region / CPO Index Queries ───────────────────────────────────────────────

  describe("지역/CPO 인덱스 조회", function () {
    it("getStationsByRegion() — CPO + ENERGYFI 모두 포함", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");

      const stations = await registry.getStationsByRegion(REGION_SEOUL);
      expect(stations.length).to.equal(2);
      expect(stations).to.include(STN_1);
      expect(stations).to.include(STN_3);
    });

    it("다른 지역 충전소는 getStationsByRegion()에 포함 안 됨", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_BUSAN, "부산 해운대");

      const seoulStations = await registry.getStationsByRegion(REGION_SEOUL);
      expect(seoulStations).to.include(STN_1);
      expect(seoulStations).to.not.include(STN_3);
    });

    it("getStationsByCPO() — CPO 소속 충전소 목록 정확성", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");

      const stations = await registry.getStationsByCPO(CPO_1);
      expect(stations.length).to.equal(1);
      expect(stations[0]).to.equal(STN_1);
    });

    // T01: getStationsByCPO 정합성 — N개 등록 후 length == N, 각 station.cpoId == cpo
    it("getStationsByCPO 정합성 — N개 등록 후 일치 확인 (T01)", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_2, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 서초");

      const stations = await registry.getStationsByCPO(CPO_1);
      expect(stations.length).to.equal(2);

      for (const sid of stations) {
        const s = await registry.getStation(sid);
        expect(s.cpoId).to.equal(CPO_1);
      }
    });

    // T01: getStationsByRegion vs getEnergyFiStationsByRegion — EF stations are subset
    it("EnergyFi 충전소는 지역 충전소의 부분집합 (T01)", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
      await registry.registerStation(STN_4, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 마포");

      const allStations = await registry.getStationsByRegion(REGION_SEOUL);
      const efStations = await registry.getEnergyFiStationsByRegion(REGION_SEOUL);

      // EF stations must be a subset of all stations
      for (const efSid of efStations) {
        expect(allStations).to.include(efSid);
      }
      // All stations includes CPO + EF
      expect(allStations.length).to.equal(3);
      expect(efStations.length).to.equal(2);
    });
  });

  // ── isEnergyFiOwned 미등록 보호 ────────────────────────────────────────────

  describe("isEnergyFiOwned 미등록 보호", function () {
    it("미등록 stationId isEnergyFiOwned() → revert StationNotFound (silent false 방지)", async function () {
      await expectRevertCustomError(registry.isEnergyFiOwned(STN_1), "StationNotFound");
    });
  });

  // ── isRegistered ───────────────────────────────────────────────────────────

  describe("isRegistered (T05)", function () {
    it("등록된 충전소 → true", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");

      expect(await registry.isRegistered(STN_1)).to.equal(true);
    });

    it("미등록 충전소 → false", async function () {
      expect(await registry.isRegistered(STN_1)).to.equal(false);
    });

    it("ENERGYFI 충전소도 true", async function () {
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
      expect(await registry.isRegistered(STN_3)).to.equal(true);
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

    it("paused 상태에서 registerCPO() → revert EnforcedPause", async function () {
      await registry.pause();
      await expectRevertCustomError(
        registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV"),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 registerStation() → revert EnforcedPause", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.pause();
      await expectRevertCustomError(
        registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남"),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 deactivateCPO() → revert EnforcedPause", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.pause();
      await expectRevertCustomError(
        registry.deactivateCPO(CPO_1),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 registerCharger() → revert EnforcedPause", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(seWallet), 0);
      await registry.pause();
      await expectRevertCustomError(
        registry.registerCharger(CHG_1, STN_1, 1),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 deactivateStation() → revert EnforcedPause", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.pause();
      await expectRevertCustomError(
        registry.deactivateStation(STN_1),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 deactivateCharger() → revert EnforcedPause", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(seWallet), 0);
      await registry.registerCharger(CHG_1, STN_1, 1);
      await registry.pause();
      await expectRevertCustomError(
        registry.deactivateCharger(CHG_1),
        "EnforcedPause"
      );
    });

    it("unpause() 후 registerCPO() 정상 동작", async function () {
      await registry.pause();
      await registry.unpause();
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      const cpo = await registry.getCPO(CPO_1);
      expect(cpo.active).to.equal(true);
    });

    it("paused 상태에서 view 함수 정상 동작", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.pause();

      // View functions should still work while paused
      expect(await registry.isRegistered(STN_1)).to.equal(true);
      const s = await registry.getStation(STN_1);
      expect(s.stationId).to.equal(STN_1);
      const cpo = await registry.getCPO(CPO_1);
      expect(cpo.cpoId).to.equal(CPO_1);
      const stations = await registry.getStationsByCPO(CPO_1);
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

    it("업그레이드 후 기존 CPO/Station/Charger 데이터 보존", async function () {
      // Setup data before upgrade
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      await registry.registerStation(STN_3, ZeroHash, OwnerType.ENERGYFI, REGION_SEOUL, "서울 종로");
      await deviceRegistry.enrollChip(CHG_1, getPublicKey64(seWallet), 0);
      await registry.registerCharger(CHG_1, STN_1, 1);

      // Upgrade
      const SRv2 = await ethers.getContractFactory("StationRegistry");
      const v2Impl = await SRv2.deploy();
      await v2Impl.waitForDeployment();
      await registry.upgradeToAndCall(await v2Impl.getAddress(), "0x");

      // Verify CPO preserved
      const cpo = await registry.getCPO(CPO_1);
      expect(cpo.name).to.equal("삼성EV");
      expect(cpo.active).to.equal(true);

      // Verify Station preserved
      const s = await registry.getStation(STN_1);
      expect(s.cpoId).to.equal(CPO_1);
      expect(s.regionId).to.equal(REGION_SEOUL);

      // Verify Charger preserved
      const c = await registry.getCharger(CHG_1);
      expect(c.stationId).to.equal(STN_1);
      expect(c.active).to.equal(true);

      // Verify index arrays preserved
      const stationsByCPO = await registry.getStationsByCPO(CPO_1);
      expect(stationsByCPO.length).to.equal(1);
      const stationsByRegion = await registry.getStationsByRegion(REGION_SEOUL);
      expect(stationsByRegion.length).to.equal(2);
      const efStations = await registry.getEnergyFiStationsByRegion(REGION_SEOUL);
      expect(efStations.length).to.equal(1);
    });

    it("업그레이드 후 새 registrations 정상 동작", async function () {
      await registry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");

      // Upgrade
      const SRv2 = await ethers.getContractFactory("StationRegistry");
      const v2Impl = await SRv2.deploy();
      await v2Impl.waitForDeployment();
      await registry.upgradeToAndCall(await v2Impl.getAddress(), "0x");

      // New registrations after upgrade
      await registry.registerStation(STN_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
      expect(await registry.isRegistered(STN_1)).to.equal(true);

      await registry.registerCPO(CPO_2, cpoWallet.address, "현대충전");
      const cpo2 = await registry.getCPO(CPO_2);
      expect(cpo2.active).to.equal(true);
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
