// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStationRegistry
 * @notice Interface for the StationRegistry contract.
 *
 * Manages a two-level hierarchy: Station → Charger.
 * All stations are EnergyFi-owned. RevenueTracker references this interface
 * to look up station metadata and regional groupings for STO revenue aggregation.
 *
 * @dev StationRegistry is Essential — RevenueTracker depends on it directly.
 */
interface IStationRegistry {
    /// @notice On-chain record for a charging station.
    struct Station {
        bytes32 stationId;
        bytes4  regionId;   // ISO 3166-2:KR bytes4 (e.g. 0x4B523131 = "KR11" = Seoul)
        string  location;
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
     * @notice Returns the full station record.
     * @param stationId bytes32 identifier of the station.
     */
    function getStation(bytes32 stationId) external view returns (Station memory);

    /**
     * @notice Returns true if a station with the given stationId is registered.
     * @param stationId bytes32 identifier of the station.
     */
    function isRegistered(bytes32 stationId) external view returns (bool);

    /**
     * @notice Returns all station IDs in a region.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @return Array of stationIds registered in that region.
     */
    function getStationsByRegion(bytes4 regionId) external view returns (bytes32[] memory);

    /**
     * @notice Returns all charger IDs registered under a station.
     * @param stationId bytes32 identifier of the station.
     */
    function getChargersByStation(bytes32 stationId) external view returns (bytes32[] memory);

    /**
     * @notice Returns the charger record.
     * @param chargerId bytes32 identifier of the charger.
     */
    function getCharger(bytes32 chargerId) external view returns (Charger memory);
}
