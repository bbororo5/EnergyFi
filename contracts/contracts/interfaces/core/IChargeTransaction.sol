// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IChargeTransaction
 * @notice Interface for the ChargeTransaction ERC-721 Soulbound contract.
 *
 * Each settled charging session (STRIKON invoice.paid) is recorded as a
 * non-transferable ERC-721 token. The SE chip signature proves physical
 * metering integrity (Bookend signature model).
 *
 * @dev Essential contract — ROOT data source for the entire EnergyFi system.
 */
interface IChargeTransaction {
    /// @notice On-chain record for a single EV charging session.
    struct ChargeSession {
        bytes32 sessionId;         // STRIKON UUID -> bytes32
        bytes32 chargerId;         // DeviceRegistry에 등록된 충전기 ID
        uint8   chargerType;       // 0: L1, 1: L2, 2: DCFC
        uint256 energyKwh;         // kWh x 100 (6.780 kWh -> 678)
        uint256 startTimestamp;    // Unix timestamp
        uint256 endTimestamp;      // Unix timestamp
        uint8   vehicleCategory;   // 0: UNKNOWN, 1: BEV, 2: PHEV
        bytes4  gridRegionCode;    // ISO 3166-2:KR (탄소 EFkw 조회용)
        bytes32 cpoId;             // CPO ID
        bytes32 stationId;         // Station ID
        uint256 distributableKrw;  // STRIKON 수수료 차감 후 배분 가능 금액(원)
        bytes   seSignature;       // TPM 2.0 SE 칩 서명
    }

    /**
     * @notice Mint a new Soulbound ERC-721 token for a settled charging session.
     * @dev Only callable by bridgeAddress (ChargeRouter proxy).
     * @param session The full charging session data including SE signature.
     * @return tokenId The minted token ID.
     */
    function mint(ChargeSession calldata session) external returns (uint256 tokenId);

    /**
     * @notice Returns the stored charging session for a given token.
     * @param tokenId ERC-721 token ID.
     */
    function getSession(uint256 tokenId) external view returns (ChargeSession memory);

    /**
     * @notice Reverse lookup: sessionId -> tokenId.
     * @param sessionId bytes32 session identifier.
     * @return tokenId The corresponding ERC-721 token ID, or 0 if not found.
     */
    function getTokenIdBySessionId(bytes32 sessionId) external view returns (uint256);

    /**
     * @notice Total number of minted charging session tokens.
     * @return count The total session count (_nextTokenId - 1).
     */
    function totalSessions() external view returns (uint256);
}
