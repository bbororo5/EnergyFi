/**
 * ChargeRouter 통합 테스트
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
} from "./helpers.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARGER_1 = b32("CHARGER-001");
const STATION_1 = b32("STATION-001");
const CPO_1 = b32("CPO-001");
const REGION_SEOUL = regionBytes4("KR11");
const SECP256K1 = 0;
const PERIOD = 202606n;
const OwnerType = { CPO: 0n, ENERGYFI: 1n };

let sessionCounter = 0;
function nextSessionId(): string {
  sessionCounter++;
  return b32(`SESS-${String(sessionCounter).padStart(4, "0")}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChargeRouter", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let cpoWallet: Awaited<ReturnType<typeof ethers.getSigner>>;
  let newBridge: Awaited<ReturnType<typeof ethers.getSigner>>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deviceRegistry: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stationRegistry: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ct: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rt: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cr: any;

  let seWallet: HDNodeWallet;

  function makeSession(overrides: Record<string, unknown> = {}) {
    const energyKwh = (overrides.energyKwh as bigint) ?? 1000n;
    const startTs = (overrides.startTimestamp as bigint) ?? 1700000000n;
    const endTs = (overrides.endTimestamp as bigint) ?? 1700003600n;
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
      distributableKrw: (overrides.distributableKrw as bigint) ?? 5000n,
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
    const { contract: dr } = await deployUUPSProxy(ethers, "DeviceRegistry");
    await dr.initialize(admin.address);
    deviceRegistry = dr;

    // 2. StationRegistry (UUPS proxy)
    const { contract: sr } = await deployUUPSProxy(ethers, "StationRegistry");
    await sr.initialize(admin.address, await deviceRegistry.getAddress());
    stationRegistry = sr;

    // 3. ChargeTransaction (UUPS proxy)
    const { contract: ctContract, proxy: ctProxy } = await deployUUPSProxy(ethers, "ChargeTransaction");
    ct = ctContract;

    // 4. RevenueTracker (UUPS proxy)
    const { contract: rtContract, proxy: rtProxy } = await deployUUPSProxy(ethers, "RevenueTracker");
    rt = rtContract;

    // 5. ChargeRouter (UUPS proxy)
    const { contract: crContract } = await deployUUPSProxy(ethers, "ChargeRouter");
    cr = crContract;

    // 6. Initialize — CT/RT bridge = ChargeRouter, CR bridge = admin (test)
    const crAddr = await cr.getAddress();
    await ct.initialize(
      await deviceRegistry.getAddress(),
      await stationRegistry.getAddress(),
      crAddr,
      admin.address
    );
    await rt.initialize(
      await stationRegistry.getAddress(),
      crAddr,
      admin.address
    );
    await cr.initialize(
      await ctProxy.getAddress(),
      await rtProxy.getAddress(),
      admin.address,  // bridge = admin for testing
      admin.address
    );

    // 7. Setup infrastructure (chip must be enrolled before registerCharger)
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

      const crEvent = findEvent(receipt!, cr, "ChargeProcessed");
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

      // ChargeRouter event
      const crEvent = findEvent(receipt!, cr, "ChargeProcessed");
      expect(crEvent, "ChargeRouter: ChargeProcessed").to.not.be.null;

      // ChargeTransaction event
      const ctEvent = findEvent(receipt!, ct, "ChargeSessionRecorded");
      expect(ctEvent, "ChargeTransaction: ChargeSessionRecorded").to.not.be.null;
      expect(ctEvent!.args.tokenId).to.equal(1n);
      expect(ctEvent!.args.sessionId).to.equal(session.sessionId);

      // RevenueTracker event
      const rtEvent = findEvent(receipt!, rt, "RevenueRecorded");
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
    });
  });

  // ── 원자성 검증 ────────────────────────────────────────────────────────────

  describe("원자성", function () {
    // B-7: 성공 후 실패 시 성공 상태 유지 (부분 롤백 검증)
    it("성공 → 실패 시 성공 TX 상태 보존 + 실패 TX 완전 롤백", async function () {
      // First: successful charge
      await cr.processCharge(makeSession({ distributableKrw: 5000n }), PERIOD);

      // Second: failed charge (distributableKrw = 0 → RT revert)
      await expectRevert(
        cr.processCharge(makeSession({ distributableKrw: 0n }), PERIOD)
      );

      // Successful TX state preserved
      expect(await ct.totalSessions()).to.equal(1n);
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(5000n);
    });

    it("distributableKrw=0 → RT revert → CT mint도 롤백", async function () {
      await expectRevert(
        cr.processCharge(
          makeSession({ distributableKrw: 0n }),
          PERIOD
        )
      );

      // Nothing minted
      expect(await ct.totalSessions()).to.equal(0n);
      // No revenue recorded
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(0n);
    });

    it("미등록 stationId → CT revert → 전체 롤백", async function () {
      const unknownStation = b32("STATION-999");
      await expectRevert(
        cr.processCharge(
          makeSession({ stationId: unknownStation }),
          PERIOD
        )
      );

      expect(await ct.totalSessions()).to.equal(0n);
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(0n);
    });

    // B-7: CT 실패가 RT에 영향 없음 증거
    it("비활성 칩 → CT revert → RT 수익 기록 없음", async function () {
      await deviceRegistry.revokeChip(CHARGER_1);

      await expectRevert(
        cr.processCharge(makeSession(), PERIOD)
      );

      expect(await ct.totalSessions()).to.equal(0n);
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(0n);
    });

    it("잘못된 SE 서명 → CT revert → 전체 롤백", async function () {
      const wrongWallet: HDNodeWallet = Wallet.createRandom();
      const msgHash = buildMsgHash(CHARGER_1, 1000n, 1700000000n, 1700003600n);
      const wrongSig = signRaw(wrongWallet, msgHash);

      await expectRevert(
        cr.processCharge(
          makeSession({ seSignature: wrongSig }),
          PERIOD
        )
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
      const tx = await cr.pause();
      const receipt = await tx.wait();
      const event = findEvent(receipt, cr, "Paused");
      expect(event).to.not.be.null;
      expect(event.args.account).to.equal(admin.address);
    });

    it("non-admin pause() → revert", async function () {
      await expectRevert(cr.connect(nonAdmin).pause());
    });

    it("non-admin unpause() → revert", async function () {
      await cr.pause();
      await expectRevert(cr.connect(nonAdmin).unpause());
    });

    it("paused 상태에서 processCharge() → revert EnforcedPause", async function () {
      await cr.pause();
      await expectRevertCustomError(
        cr.processCharge(makeSession(), PERIOD),
        "EnforcedPause"
      );
    });

    it("unpause() 후 processCharge() 정상 동작", async function () {
      await cr.pause();
      await cr.unpause();
      await cr.processCharge(makeSession(), PERIOD);
      expect(await ct.totalSessions()).to.equal(1n);
    });
  });

  // ── R05: Bridge Rotation ──────────────────────────────────────────────────

  describe("Bridge Rotation (R05)", function () {
    it("admin updateBridgeAddress(newAddr) → 성공, 이벤트 emit", async function () {
      const tx = await cr.updateBridgeAddress(newBridge.address);
      const receipt = await tx.wait();

      const event = findEvent(receipt, cr, "BridgeAddressUpdated");
      expect(event).to.not.be.null;
      expect(event.args.oldAddress).to.equal(admin.address);
      expect(event.args.newAddress).to.equal(newBridge.address);
    });

    it("non-admin updateBridgeAddress → revert", async function () {
      await expectRevert(
        cr.connect(nonAdmin).updateBridgeAddress(newBridge.address)
      );
    });

    it("updateBridgeAddress(address(0)) → revert ZeroAddress", async function () {
      await expectRevertCustomError(
        cr.updateBridgeAddress("0x0000000000000000000000000000000000000000"),
        "ZeroAddress"
      );
    });

    it("변경 후 이전 bridge 주소 호출 불가", async function () {
      await cr.updateBridgeAddress(newBridge.address);

      // Old bridge (admin) can no longer call processCharge
      await expectRevertCustomError(
        cr.processCharge(makeSession(), PERIOD),
        "CallerNotBridge"
      );
    });

    it("변경 후 새 bridge 주소 호출 성공", async function () {
      await cr.updateBridgeAddress(newBridge.address);

      // New bridge can call processCharge
      await cr.connect(newBridge).processCharge(makeSession(), PERIOD);
      expect(await ct.totalSessions()).to.equal(1n);
    });
  });

  // ── UUPS Upgrade ───────────────────────────────────────────────────────────

  describe("UUPS 업그레이드", function () {
    it("admin 업그레이드 성공", async function () {
      const CRv2 = await ethers.getContractFactory("ChargeRouter");
      const v2Impl = await CRv2.deploy();
      await v2Impl.waitForDeployment();

      await cr.upgradeToAndCall(await v2Impl.getAddress(), "0x");
    });

    it("비인가 주소 업그레이드 → revert", async function () {
      const CRv2 = await ethers.getContractFactory("ChargeRouter");
      const v2Impl = await CRv2.deploy();
      await v2Impl.waitForDeployment();

      await expectRevert(
        cr.connect(nonAdmin).upgradeToAndCall(await v2Impl.getAddress(), "0x")
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
      await cr.upgradeToAndCall(await v2Impl.getAddress(), "0x");

      // Charge after upgrade — CT/RT references preserved
      await cr.processCharge(makeSession(), PERIOD);

      expect(await ct.totalSessions()).to.equal(2n);
      const [accumulated] = await rt.getStationRevenue(STATION_1);
      expect(accumulated).to.equal(10000n); // 5000 + 5000
    });
  });
});
