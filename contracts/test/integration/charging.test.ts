/**
 * Charging Pipeline (Phase 1 → 2) 통합 테스트
 *
 * 5개 컨트랙트 전체 배포 (모두 UUPS proxy):
 *   DeviceRegistry + StationRegistry + ChargeTransaction + RevenueTracker + ChargeRouter
 *
 * processCharge() 원자성 검증: mint + recordRevenue 동시 성공/실패.
 *
 * R04: Pausable — pause/unpause, whenNotPaused on processCharge().
 * R05: Bridge rotation — updateBridgeAddress() on CR.
 * T03: 접근 제어 전면 검증.
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
const CPO_1 = b32("CPO-001");
const REGION_SEOUL = regionBytes4("KR11");
const SECP256K1 = 0;
const PERIOD = 202606n;
const OwnerType = { CPO: 0n, ENERGYFI: 1n };

const DEFAULT_START_TS = 1700000000n;
const DEFAULT_END_TS   = 1700003600n;  // +3600s = 1시간
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
  let cpoWallet: Awaited<ReturnType<typeof ethers.getSigner>>;
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
      cpoId: (overrides.cpoId as string) ?? CPO_1,
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
    cpoWallet = signers[2];
    newBridge = signers[3];

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
    await stationRegistry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
    await stationRegistry.registerStation(STATION_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
    await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(seWallet), SECP256K1);
    await stationRegistry.registerCharger(CHARGER_1, STATION_1, 1);
  });

  // ── processCharge 성공 ─────────────────────────────────────────────────────

  describe("processCharge 성공", function () {
    it("CT 토큰 생성 + RT 수익 누적 동시 확인", async function () {
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

    // B-1: 이벤트 파라미터 검증 (3개 컨트랙트 모두)
    it("ChargeProcessed 이벤트 파라미터 검증", async function () {
      const session = makeSession();
      const tx = await cr.processCharge(session, PERIOD);
      const receipt = await tx.wait();

      const crEvent = findEvent(receipt!, crContract, "ChargeProcessed");
      expect(crEvent, "ChargeProcessed 이벤트가 emit되어야 한다").to.not.be.null;
      expect(crEvent!.args.tokenId).to.equal(1n);
      expect(crEvent!.args.sessionId).to.equal(session.sessionId);
      expect(crEvent!.args.stationId).to.equal(session.stationId);
      expect(crEvent!.args.period_yyyyMM).to.equal(PERIOD);
    });

    // B-7: 단일 TX에서 CT + RT + CR 이벤트 모두 emit 증거
    it("단일 TX에서 CT·RT·CR 이벤트 동시 emit (원자적 실행 증거)", async function () {
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

    it("대량 처리 후 데이터 정합성", async function () {
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

    it("동일 sessionId 중복 처리 → revert DuplicateSession", async function () {
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

  // ── 원자성 검증 ────────────────────────────────────────────────────────────

  describe("원자성", function () {
    // B-7: 성공 후 실패 시 성공 상태 유지 (부분 롤백 검증)
    it("성공 → 실패 시 성공 TX 상태 보존 + 실패 TX 완전 롤백", async function () {
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

    it("distributableKrw=0 → RT revert → CT mint도 롤백", async function () {
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

    it("미등록 stationId → CT revert → 전체 롤백", async function () {
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

    // B-7: CT 실패가 RT에 영향 없음 증거
    it("비활성 칩 → CT revert → RT 수익 기록 없음", async function () {
      await deviceRegistry.revokeChip(CHARGER_1);

      await expectRevertCustomError(
        cr.processCharge(makeSession(), PERIOD),
        "ChipNotActive"
      );

      expect(await ct.totalSessions()).to.equal(0n);
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(0n);
    });

    it("잘못된 SE 서명 → CT revert → 전체 롤백", async function () {
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

  // ── 접근 제어 ──────────────────────────────────────────────────────────────

  describe("접근 제어", function () {
    it("onlyBridge — 비인가 주소 → CallerNotBridge", async function () {
      await expectRevertCustomError(
        cr.connect(nonAdmin).processCharge(makeSession(), PERIOD),
        "CallerNotBridge"
      );
    });

    it("CT/RT는 ChargeRouter만 호출 가능", async function () {
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
    it("admin pause() → 성공, Paused 이벤트", async function () {
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

    it("paused 상태에서 processCharge() → revert EnforcedPause", async function () {
      await crContract.pause();
      await expectRevertCustomError(
        cr.processCharge(makeSession(), PERIOD),
        "EnforcedPause"
      );
    });

    it("unpause() 후 processCharge() 정상 동작", async function () {
      await crContract.pause();
      await crContract.unpause();
      await cr.processCharge(makeSession(), PERIOD);
      expect(await ct.totalSessions()).to.equal(1n);
    });
  });

  // ── R05: Bridge Rotation ──────────────────────────────────────────────────

  describe("Bridge Rotation (R05)", function () {
    it("admin updateBridgeAddress(newAddr) → 성공, 이벤트 emit", async function () {
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

    it("변경 후 이전 bridge 주소 호출 불가", async function () {
      await crContract.updateBridgeAddress(newBridge.address);

      // Old bridge (admin) can no longer call processCharge
      await expectRevertCustomError(
        cr.processCharge(makeSession(), PERIOD),
        "CallerNotBridge"
      );
    });

    it("변경 후 새 bridge 주소 호출 성공", async function () {
      await crContract.updateBridgeAddress(newBridge.address);

      // New bridge can call processCharge
      await cr.connect(newBridge).processCharge(makeSession(), PERIOD);
      expect(await ct.totalSessions()).to.equal(1n);
    });

    it("현재 bridge 주소와 동일한 주소로 변경 시에도 이벤트 emit", async function () {
      const tx = await crContract.updateBridgeAddress(admin.address);
      const receipt = await tx.wait();

      const event = findEvent(receipt, crContract, "BridgeAddressUpdated");
      expect(event).to.not.be.null;
      expect(event.args.oldAddress).to.equal(admin.address);
      expect(event.args.newAddress).to.equal(admin.address);
    });
  });

  // ── UUPS Upgrade ───────────────────────────────────────────────────────────

  describe("UUPS 업그레이드", function () {
    it("admin 업그레이드 성공", async function () {
      const CRv2 = await ethers.getContractFactory("ChargeRouter");
      const v2Impl = await CRv2.deploy();
      await v2Impl.waitForDeployment();

      await crContract.upgradeToAndCall(await v2Impl.getAddress(), "0x");
    });

    it("비인가 주소 업그레이드 → revert AccessControlUnauthorizedAccount", async function () {
      const CRv2 = await ethers.getContractFactory("ChargeRouter");
      const v2Impl = await CRv2.deploy();
      await v2Impl.waitForDeployment();

      await expectRevertCustomError(
        crContract.connect(nonAdmin).upgradeToAndCall(await v2Impl.getAddress(), "0x"),
        "AccessControlUnauthorizedAccount"
      );
    });

    // B-2: 업그레이드 후 기존 데이터 보존 + 연동 유지
    it("업그레이드 후 processCharge 계속 동작", async function () {
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

  // ── Double-initialize 방지 ─────────────────────────────────────────────────

  describe("Double-initialize 방지", function () {
    it("ChargeRouter 재초기화 → revert InvalidInitialization", async function () {
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

    it("ChargeTransaction 재초기화 → revert InvalidInitialization", async function () {
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

    it("RevenueTracker 재초기화 → revert InvalidInitialization", async function () {
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
