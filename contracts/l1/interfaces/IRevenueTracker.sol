// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRevenueTracker
 * @notice Interface for the RevenueTracker contract.
 *
 * Accumulates per-station revenue after each invoice.paid event and provides
 * CPO / EnergyFi region aggregation views.
 *
 * @dev Essential contract — data source for Phase 3 STOPortfolio.
 */
interface IRevenueTracker {
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
     * @notice Settle all pending revenue for a CPO's stations.
     * @dev Only callable by DEFAULT_ADMIN_ROLE.
     *      WARNING: May hit block gas limit for CPOs with 100+ stations.
     *      Use claimPaginated() for large CPOs.
     * @param cpoId bytes32 CPO identifier.
     * @param period_yyyyMM Settlement period.
     * @return totalClaimed Total settled amount across all CPO stations.
     */
    function claim(bytes32 cpoId, uint256 period_yyyyMM) external returns (uint256 totalClaimed);

    /**
     * @notice Settle pending revenue for a CPO's stations with pagination.
     * @dev Only callable by DEFAULT_ADMIN_ROLE. Safe for large CPOs.
     * @param cpoId bytes32 CPO identifier.
     * @param period_yyyyMM Settlement period.
     * @param offset Starting index in the CPO's station list.
     * @param limit Maximum number of stations to process.
     * @return totalClaimed Total settled amount in this batch.
     * @return processed Number of stations processed.
     * @return hasMore True if more stations remain after this batch.
     */
    function claimPaginated(
        bytes32 cpoId,
        uint256 period_yyyyMM,
        uint256 offset,
        uint256 limit
    ) external returns (uint256 totalClaimed, uint256 processed, bool hasMore);

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
     * @notice Returns aggregated revenue for all stations belonging to a CPO.
     * @dev WARNING: May be expensive for CPOs with 100+ stations.
     *      Use getCPORevenuePaginated() for large CPOs.
     * @param cpoId bytes32 CPO identifier.
     */
    function getCPORevenue(bytes32 cpoId)
        external view returns (uint256 accumulated, uint256 settled, uint256 pending);

    /**
     * @notice Returns aggregated revenue for a CPO's stations with pagination.
     * @param cpoId bytes32 CPO identifier.
     * @param offset Starting index in the CPO's station list.
     * @param limit Maximum number of stations to aggregate.
     * @return accumulated Total accumulated revenue in this batch.
     * @return settled Total settled revenue in this batch.
     * @return pending Total pending revenue in this batch.
     * @return processed Number of stations processed.
     * @return hasMore True if more stations remain.
     */
    function getCPORevenuePaginated(
        bytes32 cpoId,
        uint256 offset,
        uint256 limit
    ) external view returns (
        uint256 accumulated,
        uint256 settled,
        uint256 pending,
        uint256 processed,
        bool hasMore
    );

    /**
     * @notice Returns total pending revenue for EnergyFi-owned stations in a region.
     * @dev WARNING: May be expensive for regions with 100+ stations.
     *      Use getEnergyFiRegionRevenuePaginated() for large regions.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     */
    function getEnergyFiRegionRevenue(bytes4 regionId)
        external view returns (uint256 pending);

    /**
     * @notice Returns paginated pending revenue for EnergyFi-owned stations in a region.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @param offset Starting index in the region's station list.
     * @param limit Maximum number of stations to aggregate.
     * @return pending Total pending revenue in this batch.
     * @return processed Number of stations processed.
     * @return hasMore True if more stations remain.
     */
    function getEnergyFiRegionRevenuePaginated(
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
}
