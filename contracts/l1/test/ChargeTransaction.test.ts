/**
 * ChargeTransaction 통합 테스트
 *
 * ERC-721 Soulbound + UUPS Proxy.
 * SE 칩 서명은 secp256k1로 테스트 (로컬 네트워크에서 P-256 RIP-7212 불가).
 *
 * R04: Pausable — pause/unpause, whenNotPaused on mint().
 * R05: Bridge rotation — updateBridgeAddress().
 * R08: getSession 존재 검증 — SessionNotFound.
 * T01: 데이터 정합성 교차 검증 (totalSessions == mint 횟수 + reverse lookup).
 * T05: View 함수 커버리지 강화.
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
const CHARGER_2 = b32("CHARGER-002");
const STATION_1 = b32("STATION-001");
const STATION_99 = b32("STATION-999");
const CPO_1 = b32("CPO-001");
const SESSION_1 = b32("SESSION-001");
const SESSION_2 = b32("SESSION-002");
const SESSION_3 = b32("SESSION-003");
const REGION_SEOUL = regionBytes4("KR11");
const SECP256K1 = 0;
const OwnerType = { CPO: 0n, ENERGYFI: 1n };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChargeTransaction", function () {
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
  let ctProxyAddr: string;

  let seWallet: HDNodeWallet;

  // Helper to build a valid ChargeSession struct
  function makeSession(overrides: Record<string, unknown> = {}) {
    const energyKwh = (overrides.energyKwh as bigint) ?? 1000n;
    const startTs = (overrides.startTimestamp as bigint) ?? 1700000000n;
    const endTs = (overrides.endTimestamp as bigint) ?? 1700003600n;
    const chargerId = (overrides.chargerId as string) ?? CHARGER_1;

    const msgHash = buildMsgHash(chargerId, energyKwh, startTs, endTs);
    const sig = overrides.seSignature ?? signRaw(seWallet, msgHash);

    return {
      sessionId: (overrides.sessionId as string) ?? SESSION_1,
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
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    nonAdmin = signers[1];
    cpoWallet = signers[2];
    newBridge = signers[3];

    seWallet = Wallet.createRandom();

    // R02: Deploy DeviceRegistry via UUPS proxy
    const { contract: dr } = await deployUUPSProxy(ethers, "DeviceRegistry");
    await dr.initialize(admin.address);
    deviceRegistry = dr;

    // R03: Deploy StationRegistry via UUPS proxy
    const { contract: sr } = await deployUUPSProxy(ethers, "StationRegistry");
    await sr.initialize(admin.address, await deviceRegistry.getAddress());
    stationRegistry = sr;

    // Deploy ChargeTransaction (UUPS proxy)
    const { contract: ctContract, proxy } = await deployUUPSProxy(ethers, "ChargeTransaction");
    ctProxyAddr = await proxy.getAddress();
    ct = ctContract;
    await ct.initialize(
      await deviceRegistry.getAddress(),
      await stationRegistry.getAddress(),
      admin.address, // bridge = admin for testing
      admin.address  // admin
    );

    // Setup infrastructure: CPO, Station, SE chip, Charger (chip must be enrolled before registerCharger)
    await stationRegistry.registerCPO(CPO_1, cpoWallet.address, "삼성EV");
    await stationRegistry.registerStation(STATION_1, CPO_1, OwnerType.CPO, REGION_SEOUL, "서울 강남");
    await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(seWallet), SECP256K1);
    await stationRegistry.registerCharger(CHARGER_1, STATION_1, 1);
  });

  // ── 초기화 ──────────────────────────────────────────────────────────────────

  describe("초기화", function () {
    it("reinitialize 불가", async function () {
      await expectRevert(
        ct.initialize(
          await deviceRegistry.getAddress(),
          await stationRegistry.getAddress(),
          admin.address,
          admin.address
        )
      );
    });

    it("DEFAULT_ADMIN_ROLE 설정 확인", async function () {
      const DEFAULT_ADMIN = ZeroHash;
      expect(await ct.hasRole(DEFAULT_ADMIN, admin.address)).to.equal(true);
    });

    it("ERC-721 name/symbol 확인", async function () {
      expect(await ct.name()).to.equal("EnergyFi Charge Session");
      expect(await ct.symbol()).to.equal("EFCS");
    });

    it("zero address 초기화 → revert", async function () {
      const { contract: ct2 } = await deployUUPSProxy(ethers, "ChargeTransaction");

      await expectRevertCustomError(
        ct2.initialize(
          "0x0000000000000000000000000000000000000000",
          await stationRegistry.getAddress(),
          admin.address,
          admin.address
        ),
        "ZeroAddress"
      );
    });
  });

  // ── mint() 성공 ────────────────────────────────────────────────────────────

  describe("mint() 성공", function () {
    it("유효 SE 서명으로 mint 성공, tokenId = 1", async function () {
      const session = makeSession();
      const tx = await ct.mint(session);
      await tx.wait();

      expect(await ct.totalSessions()).to.equal(1n);
    });

    it("토큰 소유자 = 컨트랙트 자체 (Soulbound)", async function () {
      await ct.mint(makeSession());
      expect(await ct.ownerOf(1n)).to.equal(ctProxyAddr);
    });

    it("getSession() 저장된 값 정확성", async function () {
      const session = makeSession();
      await ct.mint(session);

      const stored = await ct.getSession(1n);
      expect(stored.sessionId).to.equal(session.sessionId);
      expect(stored.chargerId).to.equal(session.chargerId);
      expect(stored.energyKwh).to.equal(session.energyKwh);
      expect(stored.stationId).to.equal(session.stationId);
      expect(stored.distributableKrw).to.equal(session.distributableKrw);
      expect(stored.startTimestamp).to.equal(session.startTimestamp);
      expect(stored.endTimestamp).to.equal(session.endTimestamp);
      expect(stored.gridRegionCode).to.equal(session.gridRegionCode);
      expect(stored.cpoId).to.equal(session.cpoId);
    });

    // T05: getTokenIdBySessionId 정확성
    it("getTokenIdBySessionId() 정확성", async function () {
      await ct.mint(makeSession());
      expect(await ct.getTokenIdBySessionId(SESSION_1)).to.equal(1n);
    });

    it("tokenId 연속 증가", async function () {
      await ct.mint(makeSession({ sessionId: SESSION_1 }));
      await ct.mint(makeSession({ sessionId: SESSION_2 }));
      expect(await ct.totalSessions()).to.equal(2n);
      expect(await ct.getTokenIdBySessionId(SESSION_2)).to.equal(2n);
    });

    it("balanceOf(contract) 증가", async function () {
      await ct.mint(makeSession());
      expect(await ct.balanceOf(ctProxyAddr)).to.equal(1n);
    });

    // B-1: 이벤트 파라미터 검증
    it("ChargeSessionRecorded 이벤트 파라미터 검증", async function () {
      const session = makeSession();
      const tx = await ct.mint(session);
      const receipt = await tx.wait();

      const event = findEvent(receipt!, ct, "ChargeSessionRecorded");
      expect(event, "ChargeSessionRecorded 이벤트가 emit되어야 한다").to.not.be.null;
      expect(event!.args.tokenId).to.equal(1n);
      expect(event!.args.sessionId).to.equal(session.sessionId);
      expect(event!.args.chargerId).to.equal(session.chargerId);
      expect(event!.args.stationId).to.equal(session.stationId);
      expect(event!.args.gridRegionCode).to.equal(session.gridRegionCode);
      expect(event!.args.energyKwh).to.equal(session.energyKwh);
      expect(event!.args.distributableKrw).to.equal(session.distributableKrw);
      expect(event!.args.startTimestamp).to.equal(session.startTimestamp);
      expect(event!.args.endTimestamp).to.equal(session.endTimestamp);
    });
  });

  // ── mint() 실패 ────────────────────────────────────────────────────────────

  describe("mint() 실패", function () {
    it("DuplicateSession — 동일 sessionId 중복", async function () {
      await ct.mint(makeSession());
      await expectRevertCustomError(
        ct.mint(makeSession()),
        "DuplicateSession"
      );
    });

    it("StationNotRegistered — 미등록 stationId", async function () {
      await expectRevertCustomError(
        ct.mint(makeSession({ stationId: STATION_99 })),
        "StationNotRegistered"
      );
    });

    it("ChipNotActive — 비활성 칩", async function () {
      await deviceRegistry.revokeChip(CHARGER_1);
      await expectRevertCustomError(
        ct.mint(makeSession()),
        "ChipNotActive"
      );
    });

    it("InvalidSESignature — 잘못된 서명", async function () {
      const wrongWallet: HDNodeWallet = Wallet.createRandom();
      const msgHash = buildMsgHash(CHARGER_1, 1000n, 1700000000n, 1700003600n);
      const wrongSig = signRaw(wrongWallet, msgHash);

      await expectRevertCustomError(
        ct.mint(makeSession({ seSignature: wrongSig })),
        "InvalidSESignature"
      );
    });

    it("CallerNotBridge — 비인가 주소", async function () {
      await expectRevertCustomError(
        ct.connect(nonAdmin).mint(makeSession()),
        "CallerNotBridge"
      );
    });

    it("미등록 칩 (enrollChip 미호출)", async function () {
      // CHARGER_2 needs a chip to pass StationRegistry.registerCharger check
      const se2 = Wallet.createRandom();
      await deviceRegistry.enrollChip(CHARGER_2, getPublicKey64(se2), 0);
      await stationRegistry.registerCharger(CHARGER_2, STATION_1, 1);

      // Revoke chip AFTER charger registration to test CT chip check
      await deviceRegistry.revokeChip(CHARGER_2);

      const msgHash = buildMsgHash(CHARGER_2, 1000n, 1700000000n, 1700003600n);
      const sig = signRaw(se2, msgHash);

      await expectRevertCustomError(
        ct.mint(makeSession({ chargerId: CHARGER_2, seSignature: sig })),
        "ChipNotActive"
      );
    });
  });

  // ── Soulbound ──────────────────────────────────────────────────────────────

  describe("Soulbound", function () {
    beforeEach(async function () {
      await ct.mint(makeSession());
    });

    it("transferFrom 차단 → SoulboundToken", async function () {
      await expectRevertCustomError(
        ct.transferFrom(ctProxyAddr, admin.address, 1n),
        "SoulboundToken"
      );
    });

    it("safeTransferFrom 차단 → SoulboundToken", async function () {
      await expectRevertCustomError(
        ct["safeTransferFrom(address,address,uint256)"](ctProxyAddr, admin.address, 1n),
        "SoulboundToken"
      );
    });
  });

  // ── tokenURI ───────────────────────────────────────────────────────────────

  describe("tokenURI", function () {
    it("존재하는 토큰 → 빈 문자열", async function () {
      await ct.mint(makeSession());
      expect(await ct.tokenURI(1n)).to.equal("");
    });

    it("존재하지 않는 토큰 → revert", async function () {
      await expectRevert(ct.tokenURI(999n));
    });
  });

  // ── R08: 미존재 데이터 조회 (BREAKING CHANGE) ──────────────────────────────

  describe("미존재 데이터 조회 (R08)", function () {
    // R08: getSession(999) → revert SessionNotFound (was empty struct)
    it("getSession(미존재 tokenId) → revert SessionNotFound", async function () {
      await expectRevertCustomError(ct.getSession(999n), "SessionNotFound");
    });

    // T05: getTokenIdBySessionId for unknown → 0
    it("getTokenIdBySessionId(미존재 sessionId) → 0", async function () {
      expect(await ct.getTokenIdBySessionId(b32("UNKNOWN-SESSION"))).to.equal(0n);
    });

    // T05: totalSessions 초기값
    it("totalSessions() 초기값 = 0", async function () {
      // Before any mint — should be 0 (not undefined/revert)
      expect(await ct.totalSessions()).to.equal(0n);
    });
  });

  // ── R04: Pausable ──────────────────────────────────────────────────────────

  describe("Pausable (R04)", function () {
    it("admin pause() → 성공, Paused 이벤트", async function () {
      const tx = await ct.pause();
      const receipt = await tx.wait();
      const event = findEvent(receipt, ct, "Paused");
      expect(event).to.not.be.null;
      expect(event.args.account).to.equal(admin.address);
    });

    it("non-admin pause() → revert", async function () {
      await expectRevert(ct.connect(nonAdmin).pause());
    });

    it("non-admin unpause() → revert", async function () {
      await ct.pause();
      await expectRevert(ct.connect(nonAdmin).unpause());
    });

    it("paused 상태에서 mint() → revert EnforcedPause", async function () {
      await ct.pause();
      await expectRevertCustomError(
        ct.mint(makeSession()),
        "EnforcedPause"
      );
    });

    it("unpause() 후 mint() 정상 동작", async function () {
      await ct.pause();
      await ct.unpause();
      await ct.mint(makeSession());
      expect(await ct.totalSessions()).to.equal(1n);
    });

    it("paused 상태에서 view 함수 정상 동작", async function () {
      await ct.mint(makeSession());
      await ct.pause();

      // View functions should still work while paused
      expect(await ct.totalSessions()).to.equal(1n);
      const stored = await ct.getSession(1n);
      expect(stored.sessionId).to.equal(SESSION_1);
      expect(await ct.getTokenIdBySessionId(SESSION_1)).to.equal(1n);
      expect(await ct.ownerOf(1n)).to.equal(ctProxyAddr);
    });
  });

  // ── R05: Bridge Rotation ──────────────────────────────────────────────────

  describe("Bridge Rotation (R05)", function () {
    it("admin updateBridgeAddress(newAddr) → 성공, 이벤트 emit", async function () {
      const tx = await ct.updateBridgeAddress(newBridge.address);
      const receipt = await tx.wait();

      const event = findEvent(receipt, ct, "BridgeAddressUpdated");
      expect(event).to.not.be.null;
      expect(event.args.oldAddress).to.equal(admin.address);
      expect(event.args.newAddress).to.equal(newBridge.address);
    });

    it("non-admin updateBridgeAddress → revert", async function () {
      await expectRevert(
        ct.connect(nonAdmin).updateBridgeAddress(newBridge.address)
      );
    });

    it("updateBridgeAddress(address(0)) → revert ZeroAddress", async function () {
      await expectRevertCustomError(
        ct.updateBridgeAddress("0x0000000000000000000000000000000000000000"),
        "ZeroAddress"
      );
    });

    it("변경 후 이전 bridge 주소 호출 불가", async function () {
      await ct.updateBridgeAddress(newBridge.address);

      // Old bridge (admin) can no longer call mint
      await expectRevertCustomError(
        ct.mint(makeSession()),
        "CallerNotBridge"
      );
    });

    it("변경 후 새 bridge 주소 호출 성공", async function () {
      await ct.updateBridgeAddress(newBridge.address);

      // New bridge can call mint
      await ct.connect(newBridge).mint(makeSession());
      expect(await ct.totalSessions()).to.equal(1n);
    });
  });

  // ── T01: 데이터 정합성 교차 검증 ──────────────────────────────────────────

  describe("데이터 정합성 교차 검증 (T01)", function () {
    it("totalSessions == 실제 mint 횟수 + reverse lookup 검증", async function () {
      const sessions = [SESSION_1, SESSION_2, SESSION_3];
      for (const sid of sessions) {
        await ct.mint(makeSession({ sessionId: sid }));
      }

      // totalSessions matches
      expect(await ct.totalSessions()).to.equal(BigInt(sessions.length));

      // Each session has valid reverse lookup and correct data
      for (let i = 0; i < sessions.length; i++) {
        const tokenId = await ct.getTokenIdBySessionId(sessions[i]);
        expect(tokenId).to.equal(BigInt(i + 1));

        const stored = await ct.getSession(tokenId);
        expect(stored.sessionId).to.equal(sessions[i]);
      }
    });
  });

  // ── UUPS Upgrade ───────────────────────────────────────────────────────────

  describe("UUPS 업그레이드", function () {
    it("admin 업그레이드 성공", async function () {
      const CTv2 = await ethers.getContractFactory("ChargeTransaction");
      const v2Impl = await CTv2.deploy();
      await v2Impl.waitForDeployment();

      await ct.upgradeToAndCall(await v2Impl.getAddress(), "0x");
      // Still functional after upgrade
      expect(await ct.totalSessions()).to.equal(0n);
    });

    it("비인가 주소 업그레이드 → revert", async function () {
      const CTv2 = await ethers.getContractFactory("ChargeTransaction");
      const v2Impl = await CTv2.deploy();
      await v2Impl.waitForDeployment();

      await expectRevert(
        ct.connect(nonAdmin).upgradeToAndCall(await v2Impl.getAddress(), "0x")
      );
    });

    // B-2: 업그레이드 후 기존 데이터 보존
    it("업그레이드 후 기존 mint 데이터 보존", async function () {
      // Mint 2 sessions before upgrade
      const session1 = makeSession({ sessionId: SESSION_1 });
      const session2 = makeSession({ sessionId: SESSION_2 });
      await ct.mint(session1);
      await ct.mint(session2);

      expect(await ct.totalSessions()).to.equal(2n);

      // Upgrade
      const CTv2 = await ethers.getContractFactory("ChargeTransaction");
      const v2Impl = await CTv2.deploy();
      await v2Impl.waitForDeployment();
      await ct.upgradeToAndCall(await v2Impl.getAddress(), "0x");

      // Verify ALL state preserved after upgrade
      expect(await ct.totalSessions()).to.equal(2n);

      const stored1 = await ct.getSession(1n);
      expect(stored1.sessionId).to.equal(SESSION_1);
      expect(stored1.energyKwh).to.equal(session1.energyKwh);
      expect(stored1.distributableKrw).to.equal(session1.distributableKrw);

      const stored2 = await ct.getSession(2n);
      expect(stored2.sessionId).to.equal(SESSION_2);

      expect(await ct.getTokenIdBySessionId(SESSION_1)).to.equal(1n);
      expect(await ct.getTokenIdBySessionId(SESSION_2)).to.equal(2n);

      expect(await ct.ownerOf(1n)).to.equal(ctProxyAddr);
      expect(await ct.ownerOf(2n)).to.equal(ctProxyAddr);

      // Verify new mint still works after upgrade
      const session3 = makeSession({ sessionId: SESSION_3 });
      await ct.mint(session3);
      expect(await ct.totalSessions()).to.equal(3n);
    });
  });
});
