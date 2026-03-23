// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../base/BridgeGuarded.sol";
import "../interfaces/ops/IReputationRegistry.sol";

/**
 * @title ReputationRegistry
 * @notice Stores region-level derived reputation snapshots for Explore.
 *
 * Bridge/oracle writers publish structured metrics per region and cadence.
 * Frontends read the stored snapshots directly and compose human narratives
 * off-chain.
 *
 * @dev Phase 4 derived contract. UUPS upgradeable.
 */
contract ReputationRegistry is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    BridgeGuarded,
    IReputationRegistry
{
    uint16 private constant MAX_BPS = 10_000;

    mapping(bytes32 => RegionSnapshot) private _snapshots;
    mapping(bytes32 => bool) private _snapshotExists;
    mapping(bytes32 => uint256[]) private _periodsByScope;
    mapping(bytes32 => mapping(uint256 => bool)) private _periodKnownByScope;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address bridge) external initializer {
        if (admin == address(0)) revert ZeroAddress();

        __AccessControl_init();
        __Pausable_init();
        __BridgeGuarded_init(bridge);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function updateBridgeAddress(address newBridge)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _updateBridgeAddress(newBridge);
    }

    /// @inheritdoc IReputationRegistry
    function upsertRegionSnapshot(RegionSnapshotInput calldata snapshot)
        external
        onlyBridge
        whenNotPaused
    {
        _validateSnapshotInput(snapshot);
        _storeSnapshot(snapshot);
    }

    /// @inheritdoc IReputationRegistry
    function upsertRegionSnapshots(RegionSnapshotInput[] calldata snapshots)
        external
        onlyBridge
        whenNotPaused
    {
        for (uint256 i = 0; i < snapshots.length; i++) {
            _validateSnapshotInput(snapshots[i]);
            _storeSnapshot(snapshots[i]);
        }
    }

    /// @inheritdoc IReputationRegistry
    function getRegionSnapshot(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId
    ) external view returns (RegionSnapshot memory) {
        _validateSnapshotKey(regionId, granularity, periodId);

        bytes32 snapshotKey = _snapshotKey(regionId, granularity, periodId);
        if (!_snapshotExists[snapshotKey]) {
            revert RegionSnapshotNotFound(regionId, granularity, periodId);
        }

        return _snapshots[snapshotKey];
    }

    /// @inheritdoc IReputationRegistry
    function getLatestRegionSnapshot(
        bytes4 regionId,
        PeriodGranularity granularity
    ) external view returns (RegionSnapshot memory) {
        if (granularity == PeriodGranularity.UNKNOWN) {
            revert InvalidSnapshotKey(regionId, granularity, 0);
        }

        uint256[] storage periods = _periodsByScope[_scopeKey(regionId, granularity)];
        if (periods.length == 0) {
            revert LatestRegionSnapshotNotFound(regionId, granularity);
        }

        uint256 latestPeriodId = periods[periods.length - 1];
        return _snapshots[_snapshotKey(regionId, granularity, latestPeriodId)];
    }

    /// @inheritdoc IReputationRegistry
    function getRegionSnapshotPeriods(
        bytes4 regionId,
        PeriodGranularity granularity
    ) external view returns (uint256[] memory) {
        if (granularity == PeriodGranularity.UNKNOWN) {
            revert InvalidSnapshotKey(regionId, granularity, 0);
        }

        return _periodsByScope[_scopeKey(regionId, granularity)];
    }

    /// @inheritdoc IReputationRegistry
    function hasRegionSnapshot(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId
    ) external view returns (bool) {
        _validateSnapshotKey(regionId, granularity, periodId);
        return _snapshotExists[_snapshotKey(regionId, granularity, periodId)];
    }

    function _storeSnapshot(RegionSnapshotInput calldata snapshot) internal {
        bytes32 snapshotKey = _snapshotKey(
            snapshot.regionId,
            snapshot.granularity,
            snapshot.periodId
        );
        bytes32 scopeKey_ = _scopeKey(snapshot.regionId, snapshot.granularity);

        if (!_snapshotExists[snapshotKey]) {
            _snapshotExists[snapshotKey] = true;
            _insertPeriodSorted(scopeKey_, snapshot.periodId);
        }

        _snapshots[snapshotKey] = RegionSnapshot({
            regionId: snapshot.regionId,
            granularity: snapshot.granularity,
            periodId: snapshot.periodId,
            metricVersion: snapshot.metricVersion,
            sourceHash: snapshot.sourceHash,
            trust: snapshot.trust,
            rhythm: snapshot.rhythm,
            site: snapshot.site,
            updatedAt: block.timestamp
        });

        emit RegionSnapshotUpserted(
            snapshot.regionId,
            snapshot.granularity,
            snapshot.periodId,
            snapshot.metricVersion,
            snapshot.sourceHash,
            block.timestamp
        );
    }

    function _validateSnapshotInput(RegionSnapshotInput calldata snapshot)
        internal
        pure
    {
        _validateSnapshotKey(snapshot.regionId, snapshot.granularity, snapshot.periodId);
        _validateTrustMetrics(snapshot.regionId, snapshot.granularity, snapshot.periodId, snapshot.trust);
        _validateRhythmMetrics(snapshot.regionId, snapshot.granularity, snapshot.periodId, snapshot.rhythm);
        _validateSiteMetrics(snapshot.regionId, snapshot.granularity, snapshot.periodId, snapshot.site);
    }

    function _validateSnapshotKey(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId
    ) internal pure {
        if (granularity == PeriodGranularity.UNKNOWN) {
            revert InvalidSnapshotKey(regionId, granularity, periodId);
        }

        uint256 year = periodId / 100;
        uint256 subPeriod = periodId % 100;
        if (year < 1000 || year > 9999) {
            revert InvalidSnapshotKey(regionId, granularity, periodId);
        }

        if (granularity == PeriodGranularity.MONTHLY) {
            if (subPeriod == 0 || subPeriod > 12) {
                revert InvalidSnapshotKey(regionId, granularity, periodId);
            }
            return;
        }

        uint256 maxIsoWeek = _isoWeeksInYear(year);
        if (subPeriod == 0 || subPeriod > maxIsoWeek) {
            revert InvalidSnapshotKey(regionId, granularity, periodId);
        }
    }

    function _validateTrustMetrics(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId,
        TrustMetrics calldata trust
    ) internal pure {
        if (
            trust.activeChargerRatioBps > MAX_BPS
                || trust.maintenanceResolutionRateBps > MAX_BPS
                || trust.settlementContinuityBps > MAX_BPS
        ) {
            revert InvalidSnapshotKey(regionId, granularity, periodId);
        }
    }

    function _validateRhythmMetrics(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId,
        RhythmMetrics calldata rhythm
    ) internal pure {
        if (rhythm.revenueStabilityBps > MAX_BPS) {
            revert InvalidSnapshotKey(regionId, granularity, periodId);
        }

        if (rhythm.peakStartHour > 23 || rhythm.peakEndHour > 23) {
            revert InvalidSnapshotKey(regionId, granularity, periodId);
        }

        if (rhythm.peakStartHour == rhythm.peakEndHour) {
            revert InvalidSnapshotKey(regionId, granularity, periodId);
        }
    }

    function _validateSiteMetrics(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId,
        SiteMetrics calldata site
    ) internal pure {
        if (
            site.residentialBps > MAX_BPS
                || site.workplaceBps > MAX_BPS
                || site.publicCommercialBps > MAX_BPS
                || site.mixedBps > MAX_BPS
        ) {
            revert InvalidSnapshotKey(regionId, granularity, periodId);
        }

        uint256 sum = uint256(site.residentialBps)
            + uint256(site.workplaceBps)
            + uint256(site.publicCommercialBps)
            + uint256(site.mixedBps);

        if (sum == 0) {
            if (site.primaryType != SiteType.UNKNOWN) {
                revert InvalidSnapshotKey(regionId, granularity, periodId);
            }
            return;
        }

        if (sum != MAX_BPS) {
            revert InvalidSnapshotKey(regionId, granularity, periodId);
        }

        uint16 maxValue = site.residentialBps;
        uint8 winnerCount = 1;
        SiteType dominantType = SiteType.RESIDENTIAL;

        if (site.workplaceBps > maxValue) {
            maxValue = site.workplaceBps;
            winnerCount = 1;
            dominantType = SiteType.WORKPLACE;
        } else if (site.workplaceBps == maxValue) {
            winnerCount++;
        }

        if (site.publicCommercialBps > maxValue) {
            maxValue = site.publicCommercialBps;
            winnerCount = 1;
            dominantType = SiteType.PUBLIC_COMMERCIAL;
        } else if (site.publicCommercialBps == maxValue) {
            winnerCount++;
        }

        if (site.mixedBps > maxValue) {
            maxValue = site.mixedBps;
            winnerCount = 1;
            dominantType = SiteType.MIXED;
        } else if (site.mixedBps == maxValue) {
            winnerCount++;
        }

        SiteType requiredPrimary = winnerCount > 1 ? SiteType.MIXED : dominantType;
        if (site.primaryType != requiredPrimary) {
            revert InvalidSnapshotKey(regionId, granularity, periodId);
        }
    }

    function _insertPeriodSorted(bytes32 scopeKey_, uint256 periodId) internal {
        if (_periodKnownByScope[scopeKey_][periodId]) {
            return;
        }

        uint256[] storage periods = _periodsByScope[scopeKey_];
        uint256 insertAt = periods.length;
        periods.push(periodId);

        while (insertAt > 0 && periods[insertAt - 1] > periodId) {
            periods[insertAt] = periods[insertAt - 1];
            unchecked {
                insertAt--;
            }
        }
        periods[insertAt] = periodId;
        _periodKnownByScope[scopeKey_][periodId] = true;
    }

    function _scopeKey(bytes4 regionId, PeriodGranularity granularity)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(regionId, granularity));
    }

    function _snapshotKey(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(regionId, granularity, periodId));
    }

    function _isoWeeksInYear(uint256 year) internal pure returns (uint256) {
        uint256 jan1Weekday = _weekday(year, 1, 1);
        if (jan1Weekday == 4 || (jan1Weekday == 3 && _isLeapYear(year))) {
            return 53;
        }
        return 52;
    }

    function _isLeapYear(uint256 year) internal pure returns (bool) {
        return (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    }

    function _weekday(uint256 year, uint256 month, uint256 day)
        internal
        pure
        returns (uint256)
    {
        uint256 adjustedYear = year;
        if (month < 3) {
            adjustedYear -= 1;
        }

        uint256 monthOffset;
        if (month == 1) monthOffset = 0;
        else if (month == 2) monthOffset = 3;
        else if (month == 3) monthOffset = 2;
        else if (month == 4) monthOffset = 5;
        else if (month == 5) monthOffset = 0;
        else if (month == 6) monthOffset = 3;
        else if (month == 7) monthOffset = 5;
        else if (month == 8) monthOffset = 1;
        else if (month == 9) monthOffset = 4;
        else if (month == 10) monthOffset = 6;
        else if (month == 11) monthOffset = 2;
        else monthOffset = 4;

        return (
            adjustedYear
                + adjustedYear / 4
                - adjustedYear / 100
                + adjustedYear / 400
                + monthOffset
                + day
        ) % 7;
    }

    function _authorizeUpgrade(address)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    uint256[45] private __gap;
}
