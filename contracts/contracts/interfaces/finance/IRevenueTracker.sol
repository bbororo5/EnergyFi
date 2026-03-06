// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRevenueTracker
 * @notice Interface for the RevenueTracker contract.
 *
 * Accumulates per-station revenue after each invoice.paid event and provides
 * per-station revenue tracking with region aggregation views.
 *
 * Phase 3 additions:
 *  - claimRegion(): Finalize station revenue per region
 *    (on-chain basis for traditional securities model dividend).
 *  - claimRegionPaginated(): Gas-safe paginated version for large regions.
 *  - RegionAttestation: Immutable finalized revenue record (KSD node verifiable).
 *
 * @dev Essential contract — data source for Phase 3 RegionSTO.
 */
interface IRevenueTracker {
    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when revenue is recorded for a station via recordRevenue().
    event RevenueRecorded(
        bytes32 indexed stationId,
        uint256         distributableKrw,
        uint256         accumulated,
        uint256         period_yyyyMM
    );

    /// @notice Emitted for each station settled during claimRegion/claimRegionPaginated.
    event SettlementRecorded(
        bytes32 indexed stationId,
        uint256         amount,
        uint256         period_yyyyMM,
        uint256         settledAt
    );

    /// @notice Emitted when a single station is settled via claimStation().
    event StationClaimed(
        bytes32 indexed stationId,
        uint256         amount,
        uint256         period_yyyyMM,
        uint256         claimedAt
    );

    /// @notice Emitted when a region's revenue is finalized via claimRegion().
    ///         KSD total-supply management node monitors this event for settlement tracking.
    event RegionSettlementFinalized(
        bytes4  indexed regionId,
        uint256 period_yyyyMM,
        uint256 totalAmount,
        uint256 stationCount,
        uint256 finalizedAt
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Monthly revenue record for a station.
    struct MonthlyRevenue {
        uint256 period_yyyyMM;  // e.g. 202606
        uint256 amount;         // distributableKrw 합계(원)
    }

    /// @notice Settlement record for a station.
    struct SettlementRecord {
        uint256 period_yyyyMM;
        uint256 amount;
        uint256 settledAt;      // block.timestamp
    }

    /// @notice Per-region revenue finalization record (legal basis for off-chain settlement).
    ///         Created by claimRegion(). Queryable by KSD total-supply management node.
    struct RegionAttestation {
        bytes4  regionId;          // ISO 3166-2:KR bytes4 region code
        uint256 period_yyyyMM;     // Settlement period (e.g. 202603)
        uint256 distributableKrw;  // Finalized regional revenue (KRW)
        uint256 stationCount;      // Number of stations included
        uint256 finalizedAt;       // block.timestamp
    }

    /**
     * @notice Record revenue for a station. Called by ChargeRouter after mint().
     * @dev Only callable by bridgeAddress (ChargeRouter proxy).
     * @param stationId bytes32 station identifier.
     * @param distributableKrw Revenue amount in KRW (must be > 0).
     * @param period_yyyyMM Period calculated off-chain by Bridge.
     */
    function recordRevenue(
        bytes32 stationId,
        uint256 distributableKrw,
        uint256 period_yyyyMM
    ) external;

    /**
     * @notice Settle pending revenue for a single station.
     * @dev Only callable by DEFAULT_ADMIN_ROLE.
     * @param stationId bytes32 station identifier.
     * @param period_yyyyMM Settlement period.
     * @return amount Settled amount.
     */
    function claimStation(bytes32 stationId, uint256 period_yyyyMM) external returns (uint256 amount);

    /**
     * @notice Returns accumulated, settled, and pending revenue for a station.
     * @param stationId bytes32 station identifier.
     */
    function getStationRevenue(bytes32 stationId)
        external view returns (uint256 accumulated, uint256 settled, uint256 pending);

    /**
     * @notice Returns revenue for a specific station and period.
     * @param stationId bytes32 station identifier.
     * @param period_yyyyMM Period to query.
     */
    function getStationRevenuePeriod(bytes32 stationId, uint256 period_yyyyMM)
        external view returns (uint256);

    /**
     * @notice Returns total pending revenue for all stations in a region.
     * @dev WARNING: May be expensive for regions with 100+ stations.
     *      Use getRegionRevenuePaginated() for large regions.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     */
    function getRegionRevenue(bytes4 regionId)
        external view returns (uint256 pending);

    /**
     * @notice Returns paginated pending revenue for stations in a region.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @param offset Starting index in the region's station list.
     * @param limit Maximum number of stations to aggregate.
     * @return pending Total pending revenue in this batch.
     * @return processed Number of stations processed.
     * @return hasMore True if more stations remain.
     */
    function getRegionRevenuePaginated(
        bytes4 regionId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256 pending, uint256 processed, bool hasMore);

    /**
     * @notice Returns settlement history for a station.
     * @param stationId bytes32 station identifier.
     */
    function getSettlementHistory(bytes32 stationId)
        external view returns (SettlementRecord[] memory);

    /**
     * @notice Returns monthly revenue history for a station.
     * @param stationId bytes32 station identifier.
     */
    function getMonthlyHistory(bytes32 stationId)
        external view returns (MonthlyRevenue[] memory);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3: Region Settlement
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
