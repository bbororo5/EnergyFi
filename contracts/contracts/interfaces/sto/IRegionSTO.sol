// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRegionSTO — Per-Region Security Token Interface
 *
 * @notice ERC-20 based regional STO token conforming to the amended
 *         Korean Electronic Securities Act (passed 2026.01.15, effective 2027.02.04).
 *
 *         Defines STO-specific functions only; standard ERC-20 functions
 *         (transfer, balanceOf, totalSupply, etc.) are inherited from OpenZeppelin.
 *
 *         - Issuer (EnergyFi) mints tokens directly on Avalanche L1.
 *         - totalSupply() is verifiable by the KSD total-supply management node.
 *         - Dividend calculation/execution is handled off-chain (traditional securities model).
 *         - Admin-only transfer: only DEFAULT_ADMIN_ROLE may move tokens.
 *
 * @dev Phase 3 contract. UUPS upgradeable.
 *      References StationRegistry to validate ownership and region during issueTranche.
 */
interface IRegionSTO {
    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Tranche (batch issuance) record.
    ///         KSD total-supply management: records token count and station list per tranche.
    struct Tranche {
        uint256   trancheId;       // Tranche ID (1-based)
        uint256   tokenAmount;     // Tokens minted in this tranche
        bytes32[] stationIds;      // EnergyFi-owned stations included in this tranche
        uint256   issuedAt;        // block.timestamp
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new tranche is issued.
    ///         KSD total-supply node monitors this event to track supply changes.
    event TrancheIssued(
        uint256 indexed trancheId,
        address indexed to,
        uint256 tokenAmount,
        uint256 stationCount,
        uint256 issuedAt
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Mutative Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Issue a new tranche and mint tokens.
     *
     * @dev Admin-only. Validates each stationId via StationRegistry:
     *      - Must be a registered station (isRegistered)
     *      - Must be active (station.active)
     *      - Must belong to this token's region (getStation().regionId == regionId)
     *      - Must not already be assigned to another tranche (duplicate prevention)
     *
     *      Uses a single-pass loop for both validation and state writes, so
     *      duplicate stationIds within the same call are detected and reverted.
     *
     * @param to           Token recipient address (issuer or investor account)
     * @param tokenAmount  Number of tokens to mint
     * @param stationIds   EnergyFi-owned station IDs to include in this tranche
     * @return trancheId   Created tranche ID (1-based)
     */
    function issueTranche(
        address to,
        uint256 tokenAmount,
        bytes32[] calldata stationIds
    ) external returns (uint256 trancheId);

    /**
     * @notice Admin transfers tokens between investor accounts.
     *
     * @dev Admin-only. In the traditional securities model, only the
     *      securities firm or issuer may transfer tokens.
     *      Regular user transfer/transferFrom calls revert.
     *
     * @param from   Source address
     * @param to     Destination address
     * @param amount Transfer amount
     */
    function adminTransfer(address from, address to, uint256 amount) external;

    /**
     * @notice Burn tokens (capital reduction).
     *
     * @dev Admin-only. Used when stations are decommissioned or STO is reduced.
     *      Decreases totalSupply, which is reflected in KSD total-supply management.
     *
     * @param from   Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external;

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice ISO 3166-2:KR region code this token represents (e.g. 0x4B523131 = "KR11" = Seoul).
    function regionId() external view returns (bytes4);

    /// @notice Returns 0 — STO tokens represent whole securities with no fractional units.
    function decimals() external view returns (uint8);

    /// @notice Get tranche details.
    /// @param trancheId Tranche ID to query (1-based).
    function getTranche(uint256 trancheId) external view returns (Tranche memory);

    /// @notice Total number of issued tranches.
    function getTrancheCount() external view returns (uint256);

    /// @notice Get the tranche ID that contains a given station.
    /// @return trancheId Tranche ID containing the station. 0 if not in any tranche.
    function getStationTranche(bytes32 stationId) external view returns (uint256);

    /**
     * @notice Returns active vs total station counts for a tranche.
     *
     * @dev Queries StationRegistry.getStation().active in real-time.
     *      Investor transparency: tranche records are immutable, but stations
     *      may be deactivated later.
     *
     * @param trancheId Tranche ID to query.
     * @return activeCount Currently active stations in the tranche.
     * @return totalCount  Total stations recorded in the tranche.
     */
    function getTrancheActiveStations(uint256 trancheId)
        external view returns (uint256 activeCount, uint256 totalCount);
}
