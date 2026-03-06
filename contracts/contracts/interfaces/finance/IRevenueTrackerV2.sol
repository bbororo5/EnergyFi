// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IRevenueTracker.sol";

/**
 * @title IRevenueTrackerV2
 * @notice Phase 3 extension — per-region revenue finalization.
 *
 * Inherits IRevenueTracker without modifying any existing function signatures.
 * Implemented by RevenueTrackerV2 (UUPS upgrade from V1).
 *
 * Additional capabilities:
 *  - claimRegion(): Finalize station revenue per region (settlement).
 *  - claimRegionPaginated(): Gas-safe paginated version for large regions.
 *  - RegionAttestation: Immutable on-chain record of finalized revenue
 *    (legal basis for off-chain dividend distribution in traditional securities model).
 *
 * @dev Essential contract — data source for Phase 3 RegionSTO.
 */
interface IRevenueTrackerV2 is IRevenueTracker {
    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a region's revenue is finalized.
    ///         KSD total-supply management node monitors this event for settlement tracking.
    event RegionSettlementFinalized(
        bytes4  indexed regionId,
        uint256 period_yyyyMM,
        uint256 totalAmount,
        uint256 stationCount,
        uint256 finalizedAt
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Mutative Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Finalize station revenue for a region.
     *
     * @dev Admin-only. Resets pending to 0 for all stations in the region
     *      and records a RegionAttestation on-chain.
     *
     *      Traditional securities model: this attestation serves as the legal basis
     *      for off-chain KRW dividend execution.
     *      Per-investor dividend = (balance / totalSupply) × distributableKrw.
     *
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @param period_yyyyMM Settlement period label (e.g. 202603).
     * @return totalClaimed Total finalized revenue (KRW).
     * @return stationCount Number of stations included in settlement.
     */
    function claimRegion(bytes4 regionId, uint256 period_yyyyMM)
        external returns (uint256 totalClaimed, uint256 stationCount);

    /**
     * @notice Finalize region revenue — paginated version.
     *
     * @dev Admin-only. Prevents block gas limit issues for large regions
     *      (hundreds of stations). Same logic as claimRegion() but processes
     *      only the [offset, offset+limit) slice.
     *      Does NOT record a RegionAttestation — page-level settlement only.
     *      Use claimRegion() when a full attestation is needed.
     *
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @param period_yyyyMM Settlement period label.
     * @param offset Start index in the region's station list.
     * @param limit Maximum number of stations to process.
     * @return totalClaimed Revenue finalized in this page.
     * @return stationCount Stations settled in this page.
     * @return processed Actual number of items processed.
     * @return hasMore Whether more pages remain.
     */
    function claimRegionPaginated(
        bytes4 regionId,
        uint256 period_yyyyMM,
        uint256 offset,
        uint256 limit
    ) external returns (uint256 totalClaimed, uint256 stationCount, uint256 processed, bool hasMore);

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Query the finalization record for a region and period.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @param period_yyyyMM Settlement period to query.
     */
    function getRegionAttestation(bytes4 regionId, uint256 period_yyyyMM)
        external view returns (RegionAttestation memory);

    /**
     * @notice List all finalized periods for a region.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     */
    function getRegionAttestationPeriods(bytes4 regionId)
        external view returns (uint256[] memory);
}
