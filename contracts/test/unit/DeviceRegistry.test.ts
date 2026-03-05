/**
 * DeviceRegistry 통합 테스트
 *
 * Hardhat 3 + hardhat-ethers v4 API:
 *   ethers = (await hre.network.connect()).ethers
 *
 * R02: UUPS 전환 — constructor → initialize(admin), deployUUPSProxy 헬퍼 사용.
 * R04: Pausable — pause/unpause, whenNotPaused 적용 확인.
 * T04: UUPS 업그레이드 데이터 보존.
 * T05: View 함수 커버리지 강화.
 *
 * P-256 (secp256r1) 테스트는 RIP-7212 precompile이 필요하므로 Hardhat in-memory에서는 skip.
 * energyfi-l1-local 네트워크에서는 통과: npx hardhat test --network energyfi-l1-local
 */

import hre from "hardhat";
import { expect } from "chai";
import { Wallet, encodeBytes32String, ZeroHash, hexlify, keccak256, solidityPacked, HDNodeWallet, getBytes } from "ethers";
import { p256 } from "@noble/curves/nist.js";
import {
  expectRevert,
  expectRevertCustomError,
  getPublicKey64,
  signRaw,
  findEvent,
  deployUUPSProxy,
} from "../helpers/helpers.js";
import type { DeviceRegistry } from "../../typechain-types/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARGER_1 = encodeBytes32String("CHARGER-001");
const CHARGER_2 = encodeBytes32String("CHARGER-002");
const SECP256K1 = 0;
const P256_SECP256R1 = 1;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DeviceRegistry", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let nonAdmin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let deviceRegistry: DeviceRegistry;

  let wallet1: HDNodeWallet;
  let wallet2: HDNodeWallet;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin    = signers[0];
    nonAdmin = signers[1];

    wallet1 = Wallet.createRandom();
    wallet2 = Wallet.createRandom();

    // R02: Deploy via UUPS proxy + initialize
    const { contract: dr } = await deployUUPSProxy<DeviceRegistry>(ethers, "DeviceRegistry");
    await dr.initialize(admin.address);
    deviceRegistry = dr;
  });

  // ── enrollChip ──────────────────────────────────────────────────────────────

  describe("enrollChip", function () {
    it("ADMIN_ROLE 없는 주소의 enrollChip() → revert", async function () {
      await expectRevert(
        deviceRegistry.connect(nonAdmin).enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1)
      );
    });

    it("SE 칩 등록 후 isActiveChip() true 반환", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(true);
    });

    it("미등록 chargerId의 isActiveChip() false 반환", async function () {
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(false);
    });

    it("동일 chargerId 중복 등록 → revert ChipAlreadyActive", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await expectRevertCustomError(
        deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet2), SECP256K1),
        "ChipAlreadyActive"
      );
    });

    it("동일 publicKey 다른 chargerId → revert PublicKeyAlreadyRegistered", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await expectRevertCustomError(
        deviceRegistry.enrollChip(CHARGER_2, getPublicKey64(wallet1), SECP256K1),
        "PublicKeyAlreadyRegistered"
      );
    });

    it("64바이트 아닌 publicKey → revert InvalidPublicKeyLength", async function () {
      await expectRevertCustomError(
        deviceRegistry.enrollChip(CHARGER_1, new Uint8Array(32), SECP256K1),
        "InvalidPublicKeyLength"
      );
    });

    it("zero chargerId → revert ZeroChargerId", async function () {
      await expectRevertCustomError(
        deviceRegistry.enrollChip(ZeroHash, getPublicKey64(wallet1), SECP256K1),
        "ZeroChargerId"
      );
    });

    it("enrollChip() → ChipEnrolled 이벤트 발행", async function () {
      const pub64 = getPublicKey64(wallet1);
      const pubkeyHash = keccak256(pub64);
      const tx = await deviceRegistry.enrollChip(CHARGER_1, pub64, SECP256K1);
      const receipt = await tx.wait();
      const event = findEvent(receipt, deviceRegistry, "ChipEnrolled");
      expect(event).to.not.be.null;
      expect(event.args.chargerId).to.equal(CHARGER_1);
      expect(event.args.pubkeyHash).to.equal(pubkeyHash);
      expect(Number(event.args.algorithm)).to.equal(SECP256K1);
    });
  });

  // ── revokeChip ──────────────────────────────────────────────────────────────

  describe("revokeChip", function () {
    it("revokeChip() 후 isActiveChip() false 반환", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await deviceRegistry.revokeChip(CHARGER_1);
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(false);
    });

    it("ADMIN_ROLE 없는 주소의 revokeChip() → revert", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await expectRevert(deviceRegistry.connect(nonAdmin).revokeChip(CHARGER_1));
    });

    it("활성 칩 없는 chargerId revokeChip() → revert NoActiveChip", async function () {
      await expectRevertCustomError(deviceRegistry.revokeChip(CHARGER_1), "NoActiveChip");
    });

    it("revokeChip() → ChipRevoked 이벤트 발행", async function () {
      const pub64 = getPublicKey64(wallet1);
      const pubkeyHash = keccak256(pub64);
      await deviceRegistry.enrollChip(CHARGER_1, pub64, SECP256K1);
      const tx = await deviceRegistry.revokeChip(CHARGER_1);
      const receipt = await tx.wait();
      const event = findEvent(receipt, deviceRegistry, "ChipRevoked");
      expect(event).to.not.be.null;
      expect(event.args.chargerId).to.equal(CHARGER_1);
      expect(event.args.pubkeyHash).to.equal(pubkeyHash);
    });

    it("revoke 후 동일 chargerId 재등록 가능 (다른 키)", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await deviceRegistry.revokeChip(CHARGER_1);
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet2), SECP256K1);
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(true);
    });
  });

  // ── verifySignature ─────────────────────────────────────────────────────────

  describe("verifySignature (secp256k1)", function () {
    it("등록된 공개키 서명의 verifySignature() → true", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);

      const msgHash = keccak256(
        solidityPacked(
          ["bytes32", "uint256", "uint256", "uint256"],
          [CHARGER_1, 1000n, 1700000000n, 1700003600n]
        )
      );
      const sig = signRaw(wallet1, msgHash);

      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, sig)).to.equal(true);
    });

    it("다른 키로 서명한 경우 → false", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);

      const msgHash = keccak256(solidityPacked(["bytes32"], [CHARGER_1]));
      const wrongSig = signRaw(wallet2, msgHash);

      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, wrongSig)).to.equal(false);
    });

    it("미등록 chargerId의 verifySignature() → false", async function () {
      const msgHash = keccak256(solidityPacked(["bytes32"], [CHARGER_1]));
      const fakeSig = new Uint8Array(65);
      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, fakeSig)).to.equal(false);
    });

    it("revokeChip() 후 verifySignature() → false", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);

      const msgHash = keccak256(solidityPacked(["bytes32"], [CHARGER_1]));
      const sig = signRaw(wallet1, msgHash);

      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, sig)).to.equal(true);
      await deviceRegistry.revokeChip(CHARGER_1);
      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, sig)).to.equal(false);
    });

    it("P-256 verifySignature() — RIP-7212 precompile 통합 테스트", async function () {
      // RIP-7212 precompile (address 0x100) is only available on EnergyFi L1 local.
      // Run with: npx hardhat test --network energyfi-l1-local
      if (hre.network.name !== "energyfi-l1-local") {
        this.skip();
      }

      // Generate a P-256 (secp256r1) key pair
      const privKey = p256.utils.randomPrivateKey();
      // toRawBytes(false) → 65 bytes: 0x04 prefix || x (32) || y (32)
      const pubKeyFull = p256.ProjectivePoint.fromPrivateKey(privKey).toRawBytes(false);
      const pubKey64 = pubKeyFull.slice(1); // 64 bytes: x || y

      // Enroll as P256_SECP256R1
      await deviceRegistry.enrollChip(CHARGER_1, pubKey64, P256_SECP256R1);
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(true);

      // Build message hash (same format as ChargeTransaction.mint())
      const msgHash = keccak256(
        solidityPacked(
          ["bytes32", "uint256", "uint256", "uint256"],
          [CHARGER_1, 2000n, 1700000000n, 1700003600n]
        )
      );

      // Sign — contract expects 64-byte signature (r || s), no recovery byte
      const sig = p256.sign(getBytes(msgHash), privKey, { lowS: true });
      const sigBytes = sig.toCompactRawBytes(); // 64 bytes: r || s

      // Correct signature → true
      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, sigBytes)).to.equal(true);

      // Zeroed signature → false
      expect(
        await deviceRegistry.verifySignature(CHARGER_1, msgHash, new Uint8Array(64))
      ).to.equal(false);
    });
  });

  // ── getChargerByPubkey ──────────────────────────────────────────────────────

  describe("getChargerByPubkey", function () {
    it("reverse lookup 정확성 확인", async function () {
      const pub64 = getPublicKey64(wallet1);
      await deviceRegistry.enrollChip(CHARGER_1, pub64, SECP256K1);

      const pubkeyHash = keccak256(pub64);
      expect(await deviceRegistry.getChargerByPubkey(pubkeyHash)).to.equal(CHARGER_1);
    });

    it("미등록 pubkeyHash → bytes32(0)", async function () {
      const fakeHash = keccak256(getPublicKey64(wallet2));
      expect(await deviceRegistry.getChargerByPubkey(fakeHash)).to.equal(ZeroHash);
    });

    // T05: revokeChip 후 reverse lookup → bytes32(0)
    it("revokeChip() 후 reverse lookup → bytes32(0)", async function () {
      const pub64 = getPublicKey64(wallet1);
      await deviceRegistry.enrollChip(CHARGER_1, pub64, SECP256K1);
      await deviceRegistry.revokeChip(CHARGER_1);

      const pubkeyHash = keccak256(pub64);
      expect(await deviceRegistry.getChargerByPubkey(pubkeyHash)).to.equal(ZeroHash);
    });
  });

  // ── getChipRecord ───────────────────────────────────────────────────────────

  describe("getChipRecord", function () {
    // T05: 모든 필드 검증 (publicKey, publicKeyHash, algorithm, enrolledAt, active)
    it("등록 후 getChipRecord() 모든 필드 정확성 확인 (enrolledAt 포함)", async function () {
      const pub64 = getPublicKey64(wallet1);
      await deviceRegistry.enrollChip(CHARGER_1, pub64, SECP256K1);

      const [publicKey, publicKeyHash, algorithm, enrolledAt, active] =
        await deviceRegistry.getChipRecord(CHARGER_1);

      expect(publicKey).to.equal(hexlify(pub64));
      expect(publicKeyHash).to.equal(keccak256(pub64));
      expect(Number(algorithm)).to.equal(SECP256K1);
      expect(enrolledAt > 0n).to.be.true;
      expect(active).to.equal(true);
    });

    // T05: revoke 후 active = false
    it("revokeChip 후 getChipRecord().active === false", async function () {
      const pub64 = getPublicKey64(wallet1);
      await deviceRegistry.enrollChip(CHARGER_1, pub64, SECP256K1);
      await deviceRegistry.revokeChip(CHARGER_1);

      const [, , , , active] = await deviceRegistry.getChipRecord(CHARGER_1);
      expect(active).to.equal(false);
    });
  });

  // ── R04: Pausable ──────────────────────────────────────────────────────────

  describe("Pausable (R04)", function () {
    it("admin pause() → 성공, Paused 이벤트", async function () {
      const tx = await deviceRegistry.pause();
      const receipt = await tx.wait();
      const event = findEvent(receipt, deviceRegistry, "Paused");
      expect(event).to.not.be.null;
      expect(event.args.account).to.equal(admin.address);
    });

    it("non-admin pause() → revert", async function () {
      await expectRevert(deviceRegistry.connect(nonAdmin).pause());
    });

    it("non-admin unpause() → revert", async function () {
      await deviceRegistry.pause();
      await expectRevert(deviceRegistry.connect(nonAdmin).unpause());
    });

    it("paused 상태에서 enrollChip() → revert EnforcedPause", async function () {
      await deviceRegistry.pause();
      await expectRevertCustomError(
        deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1),
        "EnforcedPause"
      );
    });

    it("paused 상태에서 revokeChip() → revert EnforcedPause", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await deviceRegistry.pause();
      await expectRevertCustomError(
        deviceRegistry.revokeChip(CHARGER_1),
        "EnforcedPause"
      );
    });

    it("unpause() 후 enrollChip() 정상 동작", async function () {
      await deviceRegistry.pause();
      await deviceRegistry.unpause();
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(true);
    });

    it("paused 상태에서 view 함수 정상 동작", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await deviceRegistry.pause();

      // View functions should still work while paused
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(true);

      const msgHash = keccak256(
        solidityPacked(
          ["bytes32", "uint256", "uint256", "uint256"],
          [CHARGER_1, 1000n, 1700000000n, 1700003600n]
        )
      );
      const sig = signRaw(wallet1, msgHash);
      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, sig)).to.equal(true);

      const pub64 = getPublicKey64(wallet1);
      const pubkeyHash = keccak256(pub64);
      expect(await deviceRegistry.getChargerByPubkey(pubkeyHash)).to.equal(CHARGER_1);

      const [, , , , active] = await deviceRegistry.getChipRecord(CHARGER_1);
      expect(active).to.equal(true);
    });
  });

  // ── T04: UUPS 업그레이드 데이터 보존 ──────────────────────────────────────

  describe("UUPS 업그레이드 (T04)", function () {
    it("admin 업그레이드 성공", async function () {
      const DRv2 = await ethers.getContractFactory("DeviceRegistry");
      const v2Impl = await DRv2.deploy();
      await v2Impl.waitForDeployment();

      await deviceRegistry.upgradeToAndCall(await v2Impl.getAddress(), "0x");
      // Still functional after upgrade
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(false);
    });

    it("비인가 주소 업그레이드 → revert", async function () {
      const DRv2 = await ethers.getContractFactory("DeviceRegistry");
      const v2Impl = await DRv2.deploy();
      await v2Impl.waitForDeployment();

      await expectRevert(
        deviceRegistry.connect(nonAdmin).upgradeToAndCall(await v2Impl.getAddress(), "0x")
      );
    });

    it("업그레이드 후 기존 enrolled chip data 보존", async function () {
      const pub64 = getPublicKey64(wallet1);
      await deviceRegistry.enrollChip(CHARGER_1, pub64, SECP256K1);

      // Upgrade
      const DRv2 = await ethers.getContractFactory("DeviceRegistry");
      const v2Impl = await DRv2.deploy();
      await v2Impl.waitForDeployment();
      await deviceRegistry.upgradeToAndCall(await v2Impl.getAddress(), "0x");

      // Verify isActiveChip preserved
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(true);

      // Verify verifySignature still works
      const msgHash = keccak256(
        solidityPacked(
          ["bytes32", "uint256", "uint256", "uint256"],
          [CHARGER_1, 1000n, 1700000000n, 1700003600n]
        )
      );
      const sig = signRaw(wallet1, msgHash);
      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, sig)).to.equal(true);

      // Verify getChipRecord returns same data
      const [publicKey, publicKeyHash, algorithm, , active] =
        await deviceRegistry.getChipRecord(CHARGER_1);
      expect(publicKey).to.equal(hexlify(pub64));
      expect(publicKeyHash).to.equal(keccak256(pub64));
      expect(Number(algorithm)).to.equal(SECP256K1);
      expect(active).to.equal(true);

      // Verify reverse lookup preserved
      const pubkeyHash = keccak256(pub64);
      expect(await deviceRegistry.getChargerByPubkey(pubkeyHash)).to.equal(CHARGER_1);
    });

    it("업그레이드 후 새 enrollChip 정상 동작", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);

      // Upgrade
      const DRv2 = await ethers.getContractFactory("DeviceRegistry");
      const v2Impl = await DRv2.deploy();
      await v2Impl.waitForDeployment();
      await deviceRegistry.upgradeToAndCall(await v2Impl.getAddress(), "0x");

      // New enroll after upgrade
      await deviceRegistry.enrollChip(CHARGER_2, getPublicKey64(wallet2), SECP256K1);
      expect(await deviceRegistry.isActiveChip(CHARGER_2)).to.equal(true);
    });
  });

  // ── R02: 초기화 보호 ──────────────────────────────────────────────────────

  describe("초기화 보호 (R02)", function () {
    it("reinitialize 불가", async function () {
      await expectRevert(deviceRegistry.initialize(admin.address));
    });
  });
});
