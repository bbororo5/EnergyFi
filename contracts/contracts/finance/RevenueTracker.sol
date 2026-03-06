// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../base/BridgeGuarded.sol";
import "../interfaces/finance/IRevenueTracker.sol";
import "../interfaces/infra/IStationRegistry.sol";

/**
 * @title RevenueTracker
 * @notice Accumulates per-station revenue from settled charging sessions
 *         and provides region aggregation views for STO revenue data.
 *
 * All stations are EnergyFi-owned. Called by ChargeRouter.processCharge()
 * immediately after ChargeTransaction.mint().
 * Phase 3 STOPortfolio reads getRegionRevenue() for STO revenue data.
 *
 * @dev Essential contract. UUPS upgradeable.
 *      R04: Added Pausable.
 *      R05: Bridge address rotation via BridgeGuarded._updateBridgeAddress().
 *      R06: Inherits BridgeGuarded for onlyBridge, CallerNotBridge, ZeroAddress.
 *      R10: Added __UUPSUpgradeable_init() in initialize.
 */
contract RevenueTracker is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    BridgeGuarded,
    IRevenueTracker
{
    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────────────────────────────────

    error StationNotRegistered();
    error ZeroAmount();
    error NothingToClaim();
    error OffsetOutOfBounds();
    error LimitZero();
    error PeriodAlreadyFinalized();

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    IStationRegistry public stationRegistry;

    /// @dev Cumulative revenue per station (KRW)
    mapping(bytes32 => uint256) public stationAccumulated;
    /// @dev Settled revenue per station (KRW)
    mapping(bytes32 => uint256) public stationSettled;

    /// @dev Monthly history array per station
    mapping(bytes32 => MonthlyRevenue[]) private _monthlyHistory;
    /// @dev Fast lookup: stationId => period => amount
    mapping(bytes32 => mapping(uint256 => uint256)) private _monthlyAmounts;
    /// @dev Index lookup: stationId => period => (array index + 1). 0 = not present.
    mapping(bytes32 => mapping(uint256 => uint256)) private _monthlyIndex;

    /// @dev Settlement history per station
    mapping(bytes32 => SettlementRecord[]) internal _settlementHistory;

    /// @dev regionId => period => RegionAttestation (Phase 3)
    mapping(bytes4 => mapping(uint256 => RegionAttestation)) private _regionAttestations;

    /// @dev regionId => list of finalized periods (Phase 3)
    mapping(bytes4 => uint256[]) private _regionAttestationPeriods;

    // ─────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _stationRegistry,
        address _bridgeAddress,
        address _admin
    ) external initializer {
        if (_stationRegistry == address(0)
            || _admin == address(0)) revert ZeroAddress();

        __AccessControl_init();
        __Pausable_init();
        __BridgeGuarded_init(_bridgeAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        stationRegistry = IStationRegistry(_stationRegistry);
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
    // Bridge Rotation (R05)
    // ─────────────────────────────────────────────────────────────────────────

    function updateBridgeAddress(address newBridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _updateBridgeAddress(newBridge);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core: recordRevenue
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRevenueTracker
    function recordRevenue(
        bytes32 stationId,
        uint256 distributableKrw,
        uint256 period_yyyyMM
    ) external onlyBridge whenNotPaused {
        if (!stationRegistry.isRegistered(stationId)) revert StationNotRegistered();
        if (distributableKrw == 0) revert ZeroAmount();

        // Accumulate
        stationAccumulated[stationId] += distributableKrw;

        // Monthly history update (dual structure)
        uint256 existing = _monthlyAmounts[stationId][period_yyyyMM];
        if (existing == 0) {
            // New month — push new entry, record its index
            uint256 idx = _monthlyHistory[stationId].length;
            _monthlyHistory[stationId].push(MonthlyRevenue({
                period_yyyyMM: period_yyyyMM,
                amount: distributableKrw
            }));
            _monthlyIndex[stationId][period_yyyyMM] = idx + 1; // +1 to distinguish from default 0
        } else {
            // Existing month — update by stored index
            uint256 idx = _monthlyIndex[stationId][period_yyyyMM] - 1;
            _monthlyHistory[stationId][idx].amount = existing + distributableKrw;
        }
        _monthlyAmounts[stationId][period_yyyyMM] += distributableKrw;

        emit RevenueRecorded(
            stationId,
            distributableKrw,
            stationAccumulated[stationId],
            period_yyyyMM
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core: claimStation (admin-only single station settlement)
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRevenueTracker
    function claimStation(bytes32 stationId, uint256 period_yyyyMM)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        whenNotPaused
        returns (uint256 amount)
    {
        if (!stationRegistry.isRegistered(stationId)) revert StationNotRegistered();

        amount = stationAccumulated[stationId] - stationSettled[stationId];
        if (amount == 0) revert NothingToClaim();

        stationSettled[stationId] += amount;

        _settlementHistory[stationId].push(SettlementRecord({
            period_yyyyMM: period_yyyyMM,
            amount: amount,
            settledAt: block.timestamp
        }));

        emit SettlementRecorded(stationId, amount, period_yyyyMM, block.timestamp);
        emit StationClaimed(stationId, amount, period_yyyyMM, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRevenueTracker
    function getStationRevenue(bytes32 stationId)
        external view returns (uint256 accumulated, uint256 settled, uint256 pending)
    {
        accumulated = stationAccumulated[stationId];
        settled = stationSettled[stationId];
        pending = accumulated - settled;
    }

    /// @inheritdoc IRevenueTracker
    function getStationRevenuePeriod(bytes32 stationId, uint256 period_yyyyMM)
        external view returns (uint256)
    {
        return _monthlyAmounts[stationId][period_yyyyMM];
    }

    /// @inheritdoc IRevenueTracker
    function getRegionRevenue(bytes4 regionId)
        external view returns (uint256 pending)
    {
        bytes32[] memory stationIds = stationRegistry.getStationsByRegion(regionId);
        for (uint256 i = 0; i < stationIds.length; i++) {
            bytes32 sid = stationIds[i];
            pending += stationAccumulated[sid] - stationSettled[sid];
        }
    }

    /// @inheritdoc IRevenueTracker
    function getRegionRevenuePaginated(
        bytes4 regionId,
        uint256 offset,
        uint256 limit
    )
        external view returns (uint256 pending, uint256 processed, bool hasMore)
    {
        if (limit == 0) revert LimitZero();
        bytes32[] memory stationIds = stationRegistry.getStationsByRegion(regionId);
        if (offset >= stationIds.length && stationIds.length > 0) revert OffsetOutOfBounds();

        uint256 end = offset + limit;
        if (end > stationIds.length) {
            end = stationIds.length;
        }

        for (uint256 i = offset; i < end; i++) {
            bytes32 sid = stationIds[i];
            pending += stationAccumulated[sid] - stationSettled[sid];
        }
        processed = end - offset;
        hasMore = end < stationIds.length;
    }

    /// @inheritdoc IRevenueTracker
    function getSettlementHistory(bytes32 stationId)
        external view returns (SettlementRecord[] memory)
    {
        return _settlementHistory[stationId];
    }

    /// @inheritdoc IRevenueTracker
    function getMonthlyHistory(bytes32 stationId)
        external view returns (MonthlyRevenue[] memory)
    {
        return _monthlyHistory[stationId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3: Region Settlement
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRevenueTracker
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

    /// @inheritdoc IRevenueTracker
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

    /// @inheritdoc IRevenueTracker
    function getRegionAttestation(bytes4 regionId, uint256 period_yyyyMM)
        external view returns (RegionAttestation memory)
    {
        return _regionAttestations[regionId][period_yyyyMM];
    }

    /// @inheritdoc IRevenueTracker
    function getRegionAttestationPeriods(bytes4 regionId)
        external view returns (uint256[] memory)
    {
        return _regionAttestationPeriods[regionId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UUPS
    // ─────────────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    // ─────────────────────────────────────────────────────────────────────────
    // Storage Gap (R01)
    // ─────────────────────────────────────────────────────────────────────────

    uint256[48] private __gap;
}
