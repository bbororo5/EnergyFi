// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/IDeviceRegistry.sol";

/**
 * @title DeviceRegistry
 * @notice Manages TPM 2.0 SE chip public keys bound to physical charger IDs.
 *
 * Each charger is equipped with a TPM 2.0 SE chip at launch (Phase 1).
 * The chip's public key must be enrolled here before ChargeTransaction.mint()
 * can verify the seSignature attached to each charging session.
 *
 * Signature verification:
 *  - P-256 (secp256r1): uses RIP-7212 precompile at address(0x100).
 *    Requires the EnergyFi L1 genesis.json to enable the precompile.
 *    See: l1-config/genesis.json (separate approval required per CLAUDE.md §5).
 *  - secp256k1: uses ecrecover (fallback, not expected for TPM 2.0 chips).
 *
 * Message format signed by the SE chip:
 *   msgHash = keccak256(abi.encodePacked(chargerId, energyKwh, startTimestamp, endTimestamp))
 * ChargeTransaction reconstructs msgHash and passes it here for verification.
 *
 * @dev 10th contract in the EnergyFi 10-contract architecture (Category A: Infra).
 *      DeviceRegistry is Essential — ChargeTransaction depends on it directly.
 *      R02: Converted to UUPS upgradeable.
 *      R04: Added Pausable.
 *      R09: _verifySecp256k1 changed from pure to view.
 */
contract DeviceRegistry is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    IDeviceRegistry
{
    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────────────────────────────────

    error ZeroChargerId();
    error InvalidPublicKeyLength(uint256 length);
    error ChipAlreadyActive(bytes32 chargerId);
    error PublicKeyAlreadyRegistered(bytes32 pubkeyHash);
    error NoActiveChip(bytes32 chargerId);

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Supported signature algorithms for SE chips.
    enum SignatureAlgorithm {
        SECP256K1,      // 0 — standard Ethereum secp256k1 (ecrecover)
        P256_SECP256R1  // 1 — TPM 2.0 default: P-256 / secp256r1 (RIP-7212 precompile)
    }

    /// @notice On-chain record for a chip enrolled to a specific charger.
    struct ChipRecord {
        /// @dev Uncompressed P-256 public key: 64 bytes (x || y, each 32 bytes).
        ///      For secp256k1 keys: 64 bytes uncompressed (without 0x04 prefix).
        bytes     publicKey;
        /// @dev keccak256(publicKey) — enables reverse lookup: pubkeyHash → chargerId.
        bytes32   publicKeyHash;
        SignatureAlgorithm algorithm;
        uint256   enrolledAt;  // block.timestamp at enrollment
        bool      active;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Primary index: chargerId → chip record.
    mapping(bytes32 chargerId => ChipRecord) private _chipByCharger;

    /// @dev Reverse index: keccak256(publicKey) → chargerId.
    ///      Allows lookup "which charger owns this public key?"
    mapping(bytes32 pubkeyHash => bytes32 chargerId) private _chargerByPubkey;

    /// @dev RIP-7212 P-256 verification precompile address.
    ///      Must be enabled in l1-config/genesis.json (approved separately).
    address private constant P256_PRECOMPILE = address(0x100);

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a chip is successfully enrolled for a charger.
    event ChipEnrolled(
        bytes32 indexed chargerId,
        bytes32 indexed pubkeyHash,
        SignatureAlgorithm algorithm
    );

    /// @notice Emitted when a chip record is revoked (e.g., chip replacement, decommission).
    event ChipRevoked(
        bytes32 indexed chargerId,
        bytes32 indexed pubkeyHash
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor (R02: disable initializers for UUPS)
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Initializer (R02: replaces constructor)
    // ─────────────────────────────────────────────────────────────────────────

    function initialize(address admin) external initializer {
        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pausable (R04)
    // ─────────────────────────────────────────────────────────────────────────

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Enroll a SE chip's public key for a specific charger.
     * @dev Caller must have ADMIN_ROLE. A chargerId can only have one active chip.
     *      Revoke the existing chip first before re-enrolling.
     * @param chargerId   bytes32 identifier of the physical charger.
     * @param publicKey   Uncompressed public key bytes (64 bytes for P-256 or secp256k1).
     * @param algorithm   Signature algorithm used by this chip.
     */
    function enrollChip(
        bytes32 chargerId,
        bytes calldata publicKey,
        SignatureAlgorithm algorithm
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (chargerId == bytes32(0)) revert ZeroChargerId();
        if (publicKey.length != 64) revert InvalidPublicKeyLength(publicKey.length);
        if (_chipByCharger[chargerId].active) revert ChipAlreadyActive(chargerId);

        bytes32 pubkeyHash = keccak256(publicKey);
        if (_chargerByPubkey[pubkeyHash] != bytes32(0)) revert PublicKeyAlreadyRegistered(pubkeyHash);

        _chipByCharger[chargerId] = ChipRecord({
            publicKey:     publicKey,
            publicKeyHash: pubkeyHash,
            algorithm:     algorithm,
            enrolledAt:    block.timestamp,
            active:        true
        });
        _chargerByPubkey[pubkeyHash] = chargerId;

        emit ChipEnrolled(chargerId, pubkeyHash, algorithm);
    }

    /**
     * @notice Revoke the active chip record for a charger.
     * @dev Sets active = false and clears the reverse pubkey index.
     *      ChipRecord data is retained for historical auditability.
     * @param chargerId bytes32 identifier of the charger whose chip is being revoked.
     */
    function revokeChip(bytes32 chargerId) external onlyRole(ADMIN_ROLE) whenNotPaused {
        ChipRecord storage record = _chipByCharger[chargerId];
        if (!record.active) revert NoActiveChip(chargerId);

        bytes32 pubkeyHash = record.publicKeyHash;
        record.active = false;
        delete _chargerByPubkey[pubkeyHash];

        emit ChipRevoked(chargerId, pubkeyHash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IDeviceRegistry — View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IDeviceRegistry
    function isActiveChip(bytes32 chargerId) external view override returns (bool) {
        return _chipByCharger[chargerId].active;
    }

    /// @inheritdoc IDeviceRegistry
    function verifySignature(
        bytes32 chargerId,
        bytes32 msgHash,
        bytes calldata sig
    ) external view override returns (bool) {
        ChipRecord storage record = _chipByCharger[chargerId];
        if (!record.active) return false;

        if (record.algorithm == SignatureAlgorithm.P256_SECP256R1) {
            return _verifyP256(record.publicKey, msgHash, sig);
        } else {
            return _verifySecp256k1(record.publicKey, msgHash, sig);
        }
    }

    /// @inheritdoc IDeviceRegistry
    function getChipRecord(bytes32 chargerId) external view override returns (
        bytes memory publicKey,
        bytes32 publicKeyHash,
        uint8 algorithm,
        uint256 enrolledAt,
        bool active
    ) {
        ChipRecord storage r = _chipByCharger[chargerId];
        return (r.publicKey, r.publicKeyHash, uint8(r.algorithm), r.enrolledAt, r.active);
    }

    /**
     * @notice Reverse lookup: find the chargerId that owns a given public key.
     * @param pubkeyHash keccak256(publicKey).
     * @return chargerId The charger bound to this public key, or bytes32(0) if not found.
     */
    function getChargerByPubkey(bytes32 pubkeyHash) external view returns (bytes32) {
        return _chargerByPubkey[pubkeyHash];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal: Signature Verification
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Verify a P-256 (secp256r1) signature using the RIP-7212 precompile at 0x100.
     *
     * Precompile input layout (160 bytes total):
     *   [0..31]   msgHash (bytes32)
     *   [32..63]  r (bytes32)
     *   [64..95]  s (bytes32)
     *   [96..127] x — public key x-coordinate (bytes32)
     *   [128..159] y — public key y-coordinate (bytes32)
     *
     * Precompile returns 32 bytes: 0x0000...0001 on success, 0x0000...0000 or empty on failure.
     *
     * @param publicKey 64-byte uncompressed public key (x || y) from storage.
     * @param msgHash   keccak256 hash of the signed message.
     * @param sig       64-byte DER-free signature (r || s, each 32 bytes) from calldata.
     */
    function _verifyP256(
        bytes storage publicKey,
        bytes32 msgHash,
        bytes calldata sig
    ) private view returns (bool) {
        if (sig.length != 64) return false;

        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);

        // Copy storage bytes to memory so we can slice x and y.
        bytes memory pubkeyMem = publicKey;
        bytes32 x;
        bytes32 y;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            x := mload(add(pubkeyMem, 32))   // first 32 bytes after length prefix
            y := mload(add(pubkeyMem, 64))   // next 32 bytes
        }

        bytes memory input = abi.encode(msgHash, r, s, x, y);

        (bool ok, bytes memory result) = P256_PRECOMPILE.staticcall(input);
        if (!ok || result.length == 0) return false;

        return abi.decode(result, (uint256)) == 1;
    }

    /**
     * @dev Verify a secp256k1 signature using ecrecover.
     *      publicKey must be 64 bytes (uncompressed, without 0x04 prefix) from storage.
     *      sig must be 65 bytes (r || s || v) from calldata.
     *
     * @param publicKey 64-byte uncompressed secp256k1 public key.
     * @param msgHash   keccak256 hash of the signed message.
     * @param sig       65-byte Ethereum signature (r || s || v).
     */
    function _verifySecp256k1(
        bytes storage publicKey,
        bytes32 msgHash,
        bytes calldata sig
    ) private view returns (bool) {
        if (sig.length != 65) return false;

        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8   v = uint8(sig[64]);

        address recovered = ecrecover(msgHash, v, r, s);
        if (recovered == address(0)) return false;

        // Derive Ethereum address from uncompressed public key for comparison.
        address expected = address(uint160(uint256(keccak256(publicKey))));
        return recovered == expected;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UUPS (R02)
    // ─────────────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Storage Gap (R01)
    // ─────────────────────────────────────────────────────────────────────────

    uint256[50] private __gap;
}
