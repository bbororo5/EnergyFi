// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRegionSTOFactory — Per-Region Security Token Factory Interface
 *
 * @notice Deploys and manages RegionSTO tokens for each of the 17 Korean
 *         metropolitan administrative divisions (ISO 3166-2:KR).
 *
 *         - Each region is deployed as an independent RegionSTO proxy (ERC-1967 UUPS).
 *         - All proxies share the same RegionSTO implementation.
 *         - deployAllRegions() deploys all 17 regions in a single transaction.
 *
 * @dev Phase 3 contract. UUPS upgradeable.
 *      Stores StationRegistry address and passes it to each RegionSTO on deploy.
 */
interface IRegionSTOFactory {
    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a region token is deployed.
    event RegionDeployed(
        bytes4  indexed regionId,
        address indexed tokenAddress,
        string  name,
        string  symbol
    );

    /// @notice Emitted when the RegionSTO implementation address is updated.
    event RegionSTOImplUpdated(address indexed oldImpl, address indexed newImpl);

    /// @notice Emitted when the StationRegistry address is updated.
    event StationRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    // ─────────────────────────────────────────────────────────────────────────
    // Mutative Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Deploy a single region token.
     *
     * @dev Admin-only. Deploys RegionSTO impl -> EnergyFiProxy -> initialize.
     *      Reverts if the region is already deployed.
     *
     * @param regionId  ISO 3166-2:KR bytes4 region code (e.g. 0x4B523131 = "KR11")
     * @param name      Token name (e.g. "EnergyFi Seoul STO")
     * @param symbol    Token symbol (e.g. "EFI-KR11")
     * @return tokenAddress Deployed RegionSTO proxy address
     */
    function deployRegion(
        bytes4 regionId,
        string calldata name,
        string calldata symbol
    ) external returns (address tokenAddress);

    /**
     * @notice Deploy all 17 Korean regions in a single transaction.
     *
     * @dev Admin-only. Internally calls _deployRegion() 17 times.
     *      Reverts if any region is already deployed.
     */
    function deployAllRegions() external;

    /**
     * @notice Update the RegionSTO implementation address.
     *
     * @dev Admin-only. Affects only future deployments; existing proxies
     *      retain their current implementation until individually upgraded.
     *
     * @param newImpl New RegionSTO implementation address (must not be zero).
     */
    function updateRegionSTOImpl(address newImpl) external;

    /**
     * @notice Update the StationRegistry address.
     *
     * @dev Admin-only. Affects only future deployments; existing proxies
     *      retain their StationRegistry reference.
     *
     * @param newRegistry New StationRegistry address (must not be zero).
     */
    function updateStationRegistry(address newRegistry) external;

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice RegionSTO implementation address used for new deployments.
    function regionSTOImpl() external view returns (address);

    /// @notice StationRegistry address passed to newly deployed RegionSTO proxies.
    function stationRegistry() external view returns (address);

    /// @notice Get the deployed token address for a region. Returns address(0) if not deployed.
    function getRegionToken(bytes4 regionId) external view returns (address);

    /// @notice List all deployed region codes.
    function getAllRegionIds() external view returns (bytes4[] memory);

    /// @notice Number of deployed regions.
    function getRegionCount() external view returns (uint256);
}
