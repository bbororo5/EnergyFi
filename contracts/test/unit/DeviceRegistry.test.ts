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
 * energyfi-l1-testnet 네트워크에서는 통과: npx hardhat test --network energyfi-l1-testnet
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
    it("reverts when enrollChip() is called without ADMIN_ROLE", async function () {
      await expectRevert(
        deviceRegistry.connect(nonAdmin).enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1)
      );
    });

    it("returns true from isActiveChip() after chip enrollment", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(true);
    });

    it("returns false from isActiveChip() for an unknown chargerId", async function () {
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(false);
    });

    it("reverts with ChipAlreadyActive for duplicate chargerId enrollment", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await expectRevertCustomError(
        deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet2), SECP256K1),
        "ChipAlreadyActive"
      );
    });

    it("reverts with PublicKeyAlreadyRegistered when reusing a publicKey", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await expectRevertCustomError(
        deviceRegistry.enrollChip(CHARGER_2, getPublicKey64(wallet1), SECP256K1),
        "PublicKeyAlreadyRegistered"
      );
    });

    it("reverts with InvalidPublicKeyLength for a non-64-byte publicKey", async function () {
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

    it("emits ChipEnrolled on enrollChip()", async function () {
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
    it("returns false from isActiveChip() after revokeChip()", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await deviceRegistry.revokeChip(CHARGER_1);
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(false);
    });

    it("reverts when revokeChip() is called without ADMIN_ROLE", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await expectRevert(deviceRegistry.connect(nonAdmin).revokeChip(CHARGER_1));
    });

    it("reverts with NoActiveChip when revokeChip() targets an inactive charger", async function () {
      await expectRevertCustomError(deviceRegistry.revokeChip(CHARGER_1), "NoActiveChip");
    });

    it("emits ChipRevoked on revokeChip()", async function () {
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

    it("allows re-enrollment of the same chargerId after revoke with a different key", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await deviceRegistry.revokeChip(CHARGER_1);
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet2), SECP256K1);
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(true);
    });
  });

  // ── verifySignature ─────────────────────────────────────────────────────────

  describe("verifySignature (secp256k1)", function () {
    it("returns true from verifySignature() for a signature made with the enrolled key", async function () {
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

    it("returns false from verifySignature() for a signature made with a different key", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);

      const msgHash = keccak256(solidityPacked(["bytes32"], [CHARGER_1]));
      const wrongSig = signRaw(wallet2, msgHash);

      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, wrongSig)).to.equal(false);
    });

    it("returns false from verifySignature() for an unknown chargerId", async function () {
      const msgHash = keccak256(solidityPacked(["bytes32"], [CHARGER_1]));
      const fakeSig = new Uint8Array(65);
      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, fakeSig)).to.equal(false);
    });

    it("returns false from verifySignature() after revokeChip()", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);

      const msgHash = keccak256(solidityPacked(["bytes32"], [CHARGER_1]));
      const sig = signRaw(wallet1, msgHash);

      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, sig)).to.equal(true);
      await deviceRegistry.revokeChip(CHARGER_1);
      expect(await deviceRegistry.verifySignature(CHARGER_1, msgHash, sig)).to.equal(false);
    });

    it("verifies a P-256 signature through the RIP-7212 precompile", async function () {
      // RIP-7212 precompile (address 0x100) is only available on EnergyFi L1.
      // Run with: npx hardhat test --network energyfi-l1-testnet
      if (hre.network.name !== "energyfi-l1-testnet") {
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
    it("returns the correct reverse lookup result", async function () {
      const pub64 = getPublicKey64(wallet1);
      await deviceRegistry.enrollChip(CHARGER_1, pub64, SECP256K1);

      const pubkeyHash = keccak256(pub64);
      expect(await deviceRegistry.getChargerByPubkey(pubkeyHash)).to.equal(CHARGER_1);
    });

    it("returns bytes32(0) for an unknown pubkeyHash", async function () {
      const fakeHash = keccak256(getPublicKey64(wallet2));
      expect(await deviceRegistry.getChargerByPubkey(fakeHash)).to.equal(ZeroHash);
    });

    // T05: revokeChip 후 reverse lookup → bytes32(0)
    it("returns bytes32(0) from reverse lookup after revokeChip()", async function () {
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
    it("returns all expected fields from getChipRecord() after enrollment", async function () {
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
    it("sets getChipRecord().active to false after revokeChip()", async function () {
      const pub64 = getPublicKey64(wallet1);
      await deviceRegistry.enrollChip(CHARGER_1, pub64, SECP256K1);
      await deviceRegistry.revokeChip(CHARGER_1);

      const [, , , , active] = await deviceRegistry.getChipRecord(CHARGER_1);
      expect(active).to.equal(false);
    });
  });

  // ── R04: Pausable ──────────────────────────────────────────────────────────

  describe("Pausable (R04)", function () {
    it("allows admin pause() and emits Paused", async function () {
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

    it("reverts enrollChip() with EnforcedPause while paused", async function () {
      await deviceRegistry.pause();
      await expectRevertCustomError(
        deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1),
        "EnforcedPause"
      );
    });

    it("reverts revokeChip() with EnforcedPause while paused", async function () {
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      await deviceRegistry.pause();
      await expectRevertCustomError(
        deviceRegistry.revokeChip(CHARGER_1),
        "EnforcedPause"
      );
    });

    it("allows enrollChip() again after unpause()", async function () {
      await deviceRegistry.pause();
      await deviceRegistry.unpause();
      await deviceRegistry.enrollChip(CHARGER_1, getPublicKey64(wallet1), SECP256K1);
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(true);
    });

    it("keeps view functions working while paused", async function () {
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

  describe("UUPS upgrades (T04)", function () {
    it("allows admin upgrade", async function () {
      const DRv2 = await ethers.getContractFactory("DeviceRegistry");
      const v2Impl = await DRv2.deploy();
      await v2Impl.waitForDeployment();

      await deviceRegistry.upgradeToAndCall(await v2Impl.getAddress(), "0x");
      // Still functional after upgrade
      expect(await deviceRegistry.isActiveChip(CHARGER_1)).to.equal(false);
    });

    it("reverts upgrade from an unauthorized address", async function () {
      const DRv2 = await ethers.getContractFactory("DeviceRegistry");
      const v2Impl = await DRv2.deploy();
      await v2Impl.waitForDeployment();

      await expectRevert(
        deviceRegistry.connect(nonAdmin).upgradeToAndCall(await v2Impl.getAddress(), "0x")
      );
    });

    it("preserves enrolled chip data after upgrade", async function () {
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

    it("still allows new enrollChip() calls after upgrade", async function () {
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

  describe("initializer protection (R02)", function () {
    it("prevents reinitialize", async function () {
      await expectRevert(deviceRegistry.initialize(admin.address));
    });
  });
});
