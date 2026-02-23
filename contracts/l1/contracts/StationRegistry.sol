// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/IStationRegistry.sol";
import "../interfaces/IDeviceRegistry.sol";

/**
 * @title StationRegistry
 * @notice Manages the CPO -> Station -> Charger hierarchy for EnergyFi charging infrastructure.
 *
 * Each Station has an ownerType (CPO or ENERGYFI) that determines revenue routing in Phase 2:
 *  - CPO-owned: 100% of distributableKrw goes to the CPO wallet. STO-unrelated.
 *  - ENERGYFI-owned: 100% of distributableKrw goes to the regional STO investor pool.
 *    regionId is mandatory for ENERGYFI-owned stations (STO revenue pool key).
 *
 * CPO -> Station -> Charger hierarchy:
 *  - registerCPO -> registerStation -> registerCharger (in that order).
 *  - Deactivation is blocked if child entities remain active.
 *
 * @dev 1st contract in Phase 1 (Category A: Infra).
 *      StationRegistry is Essential — RevenueTracker depends on ownerType for revenue routing.
 *      Phase 2 ChargeTransaction.mint() does not call StationRegistry directly;
 *      RevenueTracker reads ownerType post-mint to route revenue.
 *      R03: Converted to UUPS upgradeable.
 *      R04: Added Pausable.
 *      R07: Added input validation for registerCPO.
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
    // Types (additional — OwnerType + Station are in IStationRegistry)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice On-chain record for a Charge Point Operator.
    struct CPORecord {
        bytes32 cpoId;
        address walletAddress;  // CPO settlement wallet
        string  name;
        bool    active;
    }

    /// @notice On-chain record for a physical charger unit.
    struct Charger {
        bytes32 chargerId;
        bytes32 stationId;
        uint8   chargerType;   // 0: 완속 7kW, 1: 완속 11kW, 2: 완속 22kW
        bool    active;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────────────────────────────────

    error CPONotFound(bytes32 cpoId);
    error StationNotFound(bytes32 stationId);
    error ChargerNotFound(bytes32 chargerId);
    error CPOAlreadyExists(bytes32 cpoId);
    error StationAlreadyExists(bytes32 stationId);
    error ChargerAlreadyExists(bytes32 chargerId);
    error RegionRequired();
    error CpoRequired();
    error HasActiveStations(bytes32 cpoId);
    error HasActiveChargers(bytes32 stationId);
    error InvalidChargerType(uint8 chargerType);
    error ChipNotActive(bytes32 chargerId);
    error StationNotActive(bytes32 stationId);
    error CPONotActive(bytes32 cpoId);
    error ZeroWalletAddress();
    error EmptyName();

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev DeviceRegistry reference — used to verify SE chip enrollment at charger registration
    IDeviceRegistry public deviceRegistry;

    /// @dev Primary records
    mapping(bytes32 => CPORecord) private _cpos;
    mapping(bytes32 => Station)   private _stations;
    mapping(bytes32 => Charger)   private _chargers;

    /// @dev Index: CPO -> its stations
    mapping(bytes32 => bytes32[]) private _stationsByCPO;

    /// @dev Index: regionId -> all stations (CPO + ENERGYFI)
    mapping(bytes4  => bytes32[]) private _stationsByRegion;

    /// @dev Index: regionId -> ENERGYFI-owned stations only
    mapping(bytes4  => bytes32[]) private _efStationsByRegion;

    /// @dev Index: station -> its chargers
    mapping(bytes32 => bytes32[]) private _chargersByStation;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event CPORegistered(bytes32 indexed cpoId, address walletAddress, string name);
    event CPODeactivated(bytes32 indexed cpoId);
    event StationRegistered(
        bytes32 indexed stationId,
        bytes32 indexed cpoId,
        OwnerType ownerType,
        bytes4 regionId
    );
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
    // CPO Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new Charge Point Operator.
     * @param cpoId         bytes32 unique identifier for this CPO.
     * @param walletAddress CPO settlement wallet address.
     * @param name          Human-readable CPO name.
     */
    function registerCPO(
        bytes32 cpoId,
        address walletAddress,
        string calldata name
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (walletAddress == address(0)) revert ZeroWalletAddress();
        if (bytes(name).length == 0) revert EmptyName();
        if (_cpos[cpoId].cpoId != bytes32(0)) revert CPOAlreadyExists(cpoId);

        _cpos[cpoId] = CPORecord({
            cpoId:         cpoId,
            walletAddress: walletAddress,
            name:          name,
            active:        true
        });

        emit CPORegistered(cpoId, walletAddress, name);
    }

    /**
     * @notice Deactivate a CPO. Reverts if any of its stations are still active.
     * @param cpoId bytes32 identifier of the CPO.
     */
    function deactivateCPO(bytes32 cpoId) external onlyRole(ADMIN_ROLE) whenNotPaused {
        CPORecord storage cpo = _cpos[cpoId];
        if (cpo.cpoId == bytes32(0)) revert CPONotFound(cpoId);
        // _stationsByCPO only contains active stations (deactivateStation removes entries).
        if (_stationsByCPO[cpoId].length > 0) revert HasActiveStations(cpoId);

        cpo.active = false;
        emit CPODeactivated(cpoId);
    }

    /**
     * @notice Returns the CPO record.
     * @param cpoId bytes32 identifier of the CPO.
     */
    function getCPO(bytes32 cpoId) external view returns (CPORecord memory) {
        CPORecord storage c = _cpos[cpoId];
        if (c.cpoId == bytes32(0)) revert CPONotFound(cpoId);
        return c;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Station Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a charging station.
     * @dev Validation rules:
     *      - ownerType == ENERGYFI -> regionId must not be bytes4(0)  [RegionRequired]
     *      - ownerType == CPO      -> cpoId must not be bytes32(0)    [CpoRequired]
     *                                 and the CPO must exist and be active [CPONotFound / CPONotActive]
     * @param stationId  bytes32 unique identifier for this station.
     * @param cpoId      CPO owner ID; bytes32(0) for ENERGYFI-owned stations.
     * @param ownerType  OwnerType.CPO or OwnerType.ENERGYFI.
     * @param regionId   ISO 3166-2:KR bytes4 (e.g. "KR11"). Mandatory for ENERGYFI.
     * @param location   Human-readable address or coordinates.
     */
    function registerStation(
        bytes32   stationId,
        bytes32   cpoId,
        OwnerType ownerType,
        bytes4    regionId,
        string calldata location
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (_stations[stationId].stationId != bytes32(0)) revert StationAlreadyExists(stationId);

        if (ownerType == OwnerType.ENERGYFI) {
            if (regionId == bytes4(0)) revert RegionRequired();
        } else {
            // CPO-owned
            if (cpoId == bytes32(0)) revert CpoRequired();
            CPORecord storage cpo = _cpos[cpoId];
            if (cpo.cpoId == bytes32(0)) revert CPONotFound(cpoId);
            if (!cpo.active) revert CPONotActive(cpoId);
        }

        _stations[stationId] = Station({
            stationId: stationId,
            cpoId:     ownerType == OwnerType.CPO ? cpoId : bytes32(0),
            ownerType: ownerType,
            regionId:  regionId,
            location:  location,
            active:    true
        });

        // Update indexes
        if (ownerType == OwnerType.CPO) {
            _stationsByCPO[cpoId].push(stationId);
        }
        if (regionId != bytes4(0)) {
            _stationsByRegion[regionId].push(stationId);
            if (ownerType == OwnerType.ENERGYFI) {
                _efStationsByRegion[regionId].push(stationId);
            }
        }

        emit StationRegistered(stationId, cpoId, ownerType, regionId);
    }

    /**
     * @notice Deactivate a station. Reverts if any of its chargers are still active.
     * @param stationId bytes32 identifier of the station.
     */
    function deactivateStation(bytes32 stationId) external onlyRole(ADMIN_ROLE) whenNotPaused {
        Station storage station = _stations[stationId];
        if (station.stationId == bytes32(0)) revert StationNotFound(stationId);
        // _chargersByStation only contains active chargers (deactivateCharger removes entries).
        if (_chargersByStation[stationId].length > 0) revert HasActiveChargers(stationId);

        // Cache fields before modifying storage.
        OwnerType ownerType = station.ownerType;
        bytes32  cpoId      = station.cpoId;
        bytes4   regionId   = station.regionId;

        station.active = false;

        // Remove from all indexes so view functions return only active entities.
        if (ownerType == OwnerType.CPO) {
            _removeFromArray(_stationsByCPO[cpoId], stationId);
        }
        if (regionId != bytes4(0)) {
            _removeFromArray(_stationsByRegion[regionId], stationId);
            if (ownerType == OwnerType.ENERGYFI) {
                _removeFromArray(_efStationsByRegion[regionId], stationId);
            }
        }

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
        // Remove from station index so getChargersByStation() and deactivateStation() are consistent.
        _removeFromArray(_chargersByStation[stationId], chargerId);

        emit ChargerDeactivated(chargerId);
    }

    /**
     * @notice Returns the charger record.
     * @param chargerId bytes32 identifier of the charger.
     */
    function getCharger(bytes32 chargerId) external view returns (Charger memory) {
        Charger storage c = _chargers[chargerId];
        if (c.chargerId == bytes32(0)) revert ChargerNotFound(chargerId);
        return c;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IStationRegistry — View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IStationRegistry
    function isEnergyFiOwned(bytes32 stationId) external view override returns (bool) {
        Station storage s = _stations[stationId];
        if (s.stationId == bytes32(0)) revert StationNotFound(stationId);
        return s.ownerType == OwnerType.ENERGYFI;
    }

    /// @inheritdoc IStationRegistry
    function getStationOwner(
        bytes32 stationId
    ) external view override returns (OwnerType ownerType, address ownerAddress) {
        Station storage station = _stations[stationId];
        if (station.stationId == bytes32(0)) revert StationNotFound(stationId);

        ownerType = station.ownerType;
        if (ownerType == OwnerType.CPO) {
            ownerAddress = _cpos[station.cpoId].walletAddress;
        } else {
            ownerAddress = address(0);
        }
    }

    /// @inheritdoc IStationRegistry
    function getEnergyFiStationsByRegion(bytes4 regionId) external view override returns (bytes32[] memory) {
        return _efStationsByRegion[regionId];
    }

    /// @inheritdoc IStationRegistry
    function isRegistered(bytes32 stationId) external view override returns (bool) {
        return _stations[stationId].stationId != bytes32(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Additional View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns all station IDs belonging to a CPO.
     * @param cpoId bytes32 identifier of the CPO.
     */
    function getStationsByCPO(bytes32 cpoId) external view override returns (bytes32[] memory) {
        return _stationsByCPO[cpoId];
    }

    /**
     * @notice Returns all station IDs (CPO + ENERGYFI) in a region.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     */
    function getStationsByRegion(bytes4 regionId) external view returns (bytes32[] memory) {
        return _stationsByRegion[regionId];
    }

    /**
     * @notice Returns all charger IDs under a station.
     * @param stationId bytes32 identifier of the station.
     */
    function getChargersByStation(bytes32 stationId) external view returns (bytes32[] memory) {
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
