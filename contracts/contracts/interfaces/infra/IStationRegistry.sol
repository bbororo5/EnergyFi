// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStationRegistry
 * @notice Interface for the StationRegistry contract.
 *
 * Phase 2 RevenueTracker references this interface to determine revenue routing:
 *  - isEnergyFiOwned(): decides if revenue goes to CPO or STO investor pool.
 *  - getEnergyFiStationsByRegion(): used by STOPortfolio for per-region revenue aggregation.
 *
 * @dev StationRegistry is Essential — RevenueTracker depends on it directly.
 */
interface IStationRegistry {
    /// @notice Ownership type of a charging station.
    enum OwnerType { CPO, ENERGYFI }

    /// @notice On-chain record for a charging station.
    struct Station {
        bytes32   stationId;
        bytes32   cpoId;         // bytes32(0) if ownerType == ENERGYFI
        OwnerType ownerType;
        bytes4    regionId;      // ISO 3166-2:KR bytes4 (e.g. 0x4B523131 = "KR11" = Seoul)
        string    location;
        bool      active;
    }

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

    /**
     * @notice Returns true if the station is owned and operated by EnergyFi.
     * @param stationId bytes32 identifier of the station.
     */
    function isEnergyFiOwned(bytes32 stationId) external view returns (bool);

    /**
     * @notice Returns the ownership type and owner address for a station.
     * @param stationId bytes32 identifier of the station.
     * @return ownerType   OwnerType.CPO or OwnerType.ENERGYFI.
     * @return ownerAddress CPO wallet address if CPO-owned; address(0) if ENERGYFI-owned.
     */
    function getStationOwner(bytes32 stationId) external view returns (OwnerType ownerType, address ownerAddress);

    /**
     * @notice Returns the full station record.
     * @param stationId bytes32 identifier of the station.
     */
    function getStation(bytes32 stationId) external view returns (Station memory);

    /**
     * @notice Returns all EnergyFi-owned station IDs in a given region.
     * @dev Used by STOPortfolio and RevenueTracker.getEnergyFiRegionRevenue().
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @return Array of stationIds owned by EnergyFi in that region.
     */
    function getEnergyFiStationsByRegion(bytes4 regionId) external view returns (bytes32[] memory);

    /**
     * @notice Returns true if a station with the given stationId is registered.
     * @param stationId bytes32 identifier of the station.
     */
    function isRegistered(bytes32 stationId) external view returns (bool);

    /**
     * @notice Returns all station IDs belonging to a CPO.
     * @param cpoId bytes32 identifier of the CPO.
     */
    function getStationsByCPO(bytes32 cpoId) external view returns (bytes32[] memory);

    /**
     * @notice Returns all station IDs (CPO + ENERGYFI) in a region.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     */
    function getStationsByRegion(bytes4 regionId) external view returns (bytes32[] memory);

    /**
     * @notice Returns all charger IDs registered under a station.
     * @param stationId bytes32 identifier of the station.
     */
    function getChargersByStation(bytes32 stationId) external view returns (bytes32[] memory);

    /**
     * @notice Returns the CPO record.
     * @param cpoId bytes32 identifier of the CPO.
     */
    function getCPO(bytes32 cpoId) external view returns (CPORecord memory);

    /**
     * @notice Returns the charger record.
     * @param chargerId bytes32 identifier of the charger.
     */
    function getCharger(bytes32 chargerId) external view returns (Charger memory);
}
