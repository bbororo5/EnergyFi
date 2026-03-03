// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDeviceRegistry
 * @notice Interface for the DeviceRegistry contract.
 *
 * ChargeTransaction and any future contract that needs to verify SE chip
 * signatures should reference this interface, not the concrete contract.
 *
 * Message format signed by the SE chip:
 *   msgHash = keccak256(abi.encodePacked(chargerId, energyKwh, startTimestamp, endTimestamp))
 *
 * @dev This is the first file in the interfaces/ directory.
 *      Follows the ERC-3643 interface pattern: define interfaces early,
 *      bind to concrete implementations at deployment time.
 */
interface IDeviceRegistry {
    /**
     * @notice Returns true if a SE chip is enrolled and active for the given charger.
     * @param chargerId bytes32 identifier of the physical charger.
     */
    function isActiveChip(bytes32 chargerId) external view returns (bool);

    /**
     * @notice Verify a SE chip signature against the enrolled public key.
     * @param chargerId bytes32 identifier of the charger.
     * @param msgHash   keccak256 hash reconstructed from: (chargerId, energyKwh, startTimestamp, endTimestamp).
     * @param sig       Signature bytes from the SE chip.
     *                  P-256: 64 bytes (r || s).
     *                  secp256k1: 65 bytes (r || s || v).
     * @return True if the signature is valid and the chip is active.
     */
    function verifySignature(
        bytes32 chargerId,
        bytes32 msgHash,
        bytes calldata sig
    ) external view returns (bool);

    /**
     * @notice Returns the chip record for a given charger.
     * @param chargerId bytes32 identifier of the charger.
     * @return publicKey     Uncompressed public key (64 bytes).
     * @return publicKeyHash keccak256(publicKey).
     * @return algorithm     0 = secp256k1, 1 = P-256 (secp256r1).
     * @return enrolledAt    block.timestamp at enrollment.
     * @return active        Whether the chip record is currently active.
     */
    function getChipRecord(bytes32 chargerId) external view returns (
        bytes memory publicKey,
        bytes32 publicKeyHash,
        uint8 algorithm,
        uint256 enrolledAt,
        bool active
    );

    /**
     * @notice Reverse lookup: find the chargerId bound to a given public key hash.
     * @param pubkeyHash keccak256(publicKey).
     * @return chargerId The charger bound to this public key, or bytes32(0) if not found.
     */
    function getChargerByPubkey(bytes32 pubkeyHash) external view returns (bytes32);
}
