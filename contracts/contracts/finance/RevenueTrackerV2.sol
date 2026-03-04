// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RevenueTracker.sol";
import "../interfaces/finance/IRevenueTrackerV2.sol";

/**
 * @title RevenueTrackerV2
 * @notice Phase 3 extension — per-region revenue finalization.
 *
 * UUPS upgrade from V1. Preserves 100% of existing storage layout.
 *
 * Additional capabilities:
 *  - claimRegion(): Finalize station revenue per region.
 *  - claimRegionPaginated(): Gas-safe paginated version for large regions.
 *  - RegionAttestation: Immutable on-chain record of finalized revenue
 *    (legal basis for off-chain dividend in traditional securities model).
 *
 * @dev Essential contract — data source for Phase 3 RegionSTO.
 */
contract RevenueTrackerV2 is RevenueTracker, IRevenueTrackerV2 {
    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors (V2)
    // ─────────────────────────────────────────────────────────────────────────

    error PeriodAlreadyFinalized();

    // ─────────────────────────────────────────────────────────────────────────
    // Storage (appended after V1 layout including __gap)
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev regionId => period => RegionAttestation
    mapping(bytes4 => mapping(uint256 => RegionAttestation)) private _regionAttestations;

    /// @dev regionId => list of finalized periods
    mapping(bytes4 => uint256[]) private _regionAttestationPeriods;

    // ─────────────────────────────────────────────────────────────────────────
    // IRevenueTrackerV2: Mutative
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRevenueTrackerV2
    function claimRegion(bytes4 regionId, uint256 period_yyyyMM)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        whenNotPaused
        returns (uint256 totalClaimed, uint256 stationCount)
    {
        if (_regionAttestations[regionId][period_yyyyMM].finalizedAt != 0)
            revert PeriodAlreadyFinalized();

        bytes32[] memory stationIds = stationRegistry.getStationsByRegion(regionId);
        (totalClaimed, stationCount) = _settleStations(stationIds, period_yyyyMM, 0, stationIds.length);

        if (totalClaimed == 0) revert NothingToClaim();

        _regionAttestations[regionId][period_yyyyMM] = RegionAttestation({
            regionId: regionId,
            period_yyyyMM: period_yyyyMM,
            distributableKrw: totalClaimed,
            stationCount: stationCount,
            finalizedAt: block.timestamp
        });

        _regionAttestationPeriods[regionId].push(period_yyyyMM);

        emit RegionSettlementFinalized(regionId, period_yyyyMM, totalClaimed, stationCount, block.timestamp);
    }

    /// @inheritdoc IRevenueTrackerV2
    function claimRegionPaginated(
        bytes4 regionId,
        uint256 period_yyyyMM,
        uint256 offset,
        uint256 limit
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        whenNotPaused
        returns (uint256 totalClaimed, uint256 stationCount, uint256 processed, bool hasMore)
    {
        if (limit == 0) revert LimitZero();
        bytes32[] memory stationIds = stationRegistry.getStationsByRegion(regionId);
        if (offset >= stationIds.length && stationIds.length > 0) revert OffsetOutOfBounds();

        uint256 end = offset + limit;
        if (end > stationIds.length) end = stationIds.length;

        (totalClaimed, stationCount) = _settleStations(stationIds, period_yyyyMM, offset, end);
        processed = end - offset;
        hasMore = end < stationIds.length;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal: shared station settlement (V2)
    // ─────────────────────────────────────────────────────────────────────────

    function _settleStations(
        bytes32[] memory stationIds,
        uint256 period_yyyyMM,
        uint256 start,
        uint256 end
    ) internal returns (uint256 totalClaimed, uint256 stationCount) {
        for (uint256 i = start; i < end; i++) {
            bytes32 sid = stationIds[i];
            uint256 pending = stationAccumulated[sid] - stationSettled[sid];
            if (pending > 0) {
                stationSettled[sid] += pending;
                totalClaimed += pending;
                stationCount++;

                _settlementHistory[sid].push(SettlementRecord({
                    period_yyyyMM: period_yyyyMM,
                    amount: pending,
                    settledAt: block.timestamp
                }));

                emit SettlementRecorded(sid, pending, period_yyyyMM, block.timestamp);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IRevenueTrackerV2: View
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRevenueTrackerV2
    function getRegionAttestation(bytes4 regionId, uint256 period_yyyyMM)
        external view returns (RegionAttestation memory)
    {
        return _regionAttestations[regionId][period_yyyyMM];
    }

    /// @inheritdoc IRevenueTrackerV2
    function getRegionAttestationPeriods(bytes4 regionId)
        external view returns (uint256[] memory)
    {
        return _regionAttestationPeriods[regionId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Storage Gap (V2)
    // ─────────────────────────────────────────────────────────────────────────

    uint256[48] private __gapV2;
}
