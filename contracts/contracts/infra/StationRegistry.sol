// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/infra/IStationRegistry.sol";
import "../interfaces/infra/IDeviceRegistry.sol";

/**
 * @title StationRegistry
 * @notice Manages a two-level hierarchy: Station -> Charger.
 *         All stations are EnergyFi-owned. RevenueTracker references this contract
 *         to look up station metadata and regional groupings for STO revenue aggregation.
 *
 * Station -> Charger hierarchy:
 *  - registerStation -> registerCharger (in that order).
 *  - Deactivation is blocked if child entities remain active.
 *
 * @dev 1st contract in Phase 1 (Category A: Infra).
 *      StationRegistry is Essential — RevenueTracker depends on it directly.
 *      Phase 2 ChargeTransaction.mint() does not call StationRegistry directly;
 *      RevenueTracker reads station metadata post-mint to route revenue.
 *      R03: Converted to UUPS upgradeable.
 *      R04: Added Pausable.
 */
contract StationRegistry is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    IStationRegistry
{
    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────────────────────────────────

    error StationNotFound(bytes32 stationId);
    error ChargerNotFound(bytes32 chargerId);
    error StationAlreadyExists(bytes32 stationId);
    error ChargerAlreadyExists(bytes32 chargerId);
    error RegionRequired();
    error HasActiveChargers(bytes32 stationId);
    error InvalidChargerType(uint8 chargerType);
    error ChipNotActive(bytes32 chargerId);
    error StationNotActive(bytes32 stationId);

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev DeviceRegistry reference — used to verify SE chip enrollment at charger registration
    IDeviceRegistry public deviceRegistry;

    /// @dev Primary records
    mapping(bytes32 => Station)   private _stations;
    mapping(bytes32 => Charger)   private _chargers;

    /// @dev Index: regionId -> all stations in that region
    mapping(bytes4  => bytes32[]) private _stationsByRegion;

    /// @dev Index: station -> its chargers
    mapping(bytes32 => bytes32[]) private _chargersByStation;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event StationRegistered(bytes32 indexed stationId, bytes4 indexed regionId);
    event StationDeactivated(bytes32 indexed stationId);
    event ChargerRegistered(bytes32 indexed chargerId, bytes32 indexed stationId, uint8 chargerType);
    event ChargerDeactivated(bytes32 indexed chargerId);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor (R03: disable initializers for UUPS)
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Initializer (R03: replaces constructor)
    // ─────────────────────────────────────────────────────────────────────────

    function initialize(address admin, address _deviceRegistry) external initializer {
        __AccessControl_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        deviceRegistry = IDeviceRegistry(_deviceRegistry);
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
    // Internal Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Swap-and-pop removal from an unsorted bytes32 array.
     *      Order is NOT preserved. O(n) scan, suitable for small fleets.
     */
    function _removeFromArray(bytes32[] storage arr, bytes32 value) private {
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == value) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Station Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a charging station. All stations are EnergyFi-owned.
     * @param stationId  bytes32 unique identifier for this station.
     * @param regionId   ISO 3166-2:KR bytes4 (e.g. "KR11"). Always required.
     * @param location   Human-readable address or coordinates.
     */
    function registerStation(
        bytes32 stationId,
        bytes4  regionId,
        string calldata location
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (_stations[stationId].stationId != bytes32(0)) revert StationAlreadyExists(stationId);
        if (regionId == bytes4(0)) revert RegionRequired();

        _stations[stationId] = Station({
            stationId: stationId,
            regionId:  regionId,
            location:  location,
            active:    true
        });

        _stationsByRegion[regionId].push(stationId);

        emit StationRegistered(stationId, regionId);
    }

    /**
     * @notice Deactivate a station. Reverts if any of its chargers are still active.
     * @param stationId bytes32 identifier of the station.
     */
    function deactivateStation(bytes32 stationId) external onlyRole(ADMIN_ROLE) whenNotPaused {
        Station storage station = _stations[stationId];
        if (station.stationId == bytes32(0)) revert StationNotFound(stationId);
        if (_chargersByStation[stationId].length > 0) revert HasActiveChargers(stationId);

        bytes4 regionId = station.regionId;
        station.active = false;

        _removeFromArray(_stationsByRegion[regionId], stationId);

        emit StationDeactivated(stationId);
    }

    /// @inheritdoc IStationRegistry
    function getStation(bytes32 stationId) external view override returns (Station memory) {
        Station storage s = _stations[stationId];
        if (s.stationId == bytes32(0)) revert StationNotFound(stationId);
        return s;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Charger Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a charger unit under a station.
     * @dev The station must exist and be active.
     * @param chargerId   bytes32 unique identifier for this charger.
     * @param stationId   bytes32 identifier of the parent station.
     * @param chargerType 0 = 완속 7kW, 1 = 완속 11kW, 2 = 완속 22kW.
     */
    function registerCharger(
        bytes32 chargerId,
        bytes32 stationId,
        uint8   chargerType
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (_chargers[chargerId].chargerId != bytes32(0)) revert ChargerAlreadyExists(chargerId);
        if (chargerType > 2) revert InvalidChargerType(chargerType);
        if (!deviceRegistry.isActiveChip(chargerId)) revert ChipNotActive(chargerId);

        Station storage station = _stations[stationId];
        if (station.stationId == bytes32(0)) revert StationNotFound(stationId);
        if (!station.active) revert StationNotActive(stationId);

        _chargers[chargerId] = Charger({
            chargerId:   chargerId,
            stationId:   stationId,
            chargerType: chargerType,
            active:      true
        });

        _chargersByStation[stationId].push(chargerId);

        emit ChargerRegistered(chargerId, stationId, chargerType);
    }

    /**
     * @notice Deactivate a charger.
     * @param chargerId bytes32 identifier of the charger.
     */
    function deactivateCharger(bytes32 chargerId) external onlyRole(ADMIN_ROLE) whenNotPaused {
        Charger storage charger = _chargers[chargerId];
        if (charger.chargerId == bytes32(0)) revert ChargerNotFound(chargerId);

        bytes32 stationId = charger.stationId;
        charger.active = false;
        _removeFromArray(_chargersByStation[stationId], chargerId);

        emit ChargerDeactivated(chargerId);
    }

    /// @inheritdoc IStationRegistry
    function getCharger(bytes32 chargerId) external view override returns (Charger memory) {
        Charger storage c = _chargers[chargerId];
        if (c.chargerId == bytes32(0)) revert ChargerNotFound(chargerId);
        return c;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IStationRegistry
    function isRegistered(bytes32 stationId) external view override returns (bool) {
        return _stations[stationId].stationId != bytes32(0);
    }

    /// @inheritdoc IStationRegistry
    function getStationsByRegion(bytes4 regionId) external view override returns (bytes32[] memory) {
        return _stationsByRegion[regionId];
    }

    /// @inheritdoc IStationRegistry
    function getChargersByStation(bytes32 stationId) external view override returns (bytes32[] memory) {
        return _chargersByStation[stationId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UUPS (R03)
    // ─────────────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Storage Gap (R01)
    // ─────────────────────────────────────────────────────────────────────────

    uint256[50] private __gap;
}
