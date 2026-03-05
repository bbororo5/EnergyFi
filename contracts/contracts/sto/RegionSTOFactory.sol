// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/sto/IRegionSTOFactory.sol";
import "../utils/ERC1967ProxyImport.sol";
import "./RegionSTO.sol";

/**
 * @title RegionSTOFactory — Per-Region Security Token Factory
 *
 * @notice Deploys and manages RegionSTO tokens for each of the 17 Korean
 *         metropolitan administrative divisions (ISO 3166-2:KR).
 *
 *         - Each region is deployed as an independent RegionSTO proxy (ERC-1967 UUPS).
 *         - All proxies share the same RegionSTO implementation.
 *         - deployAllRegions() deploys all 17 regions in one transaction.
 *         - Implementation and registry addresses are updatable for future flexibility.
 *
 * @dev Phase 3 contract. UUPS upgradeable.
 */
contract RegionSTOFactory is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IRegionSTOFactory
{
    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────────────────────────────────

    error RegionAlreadyDeployed();
    error ZeroAddress();

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    address private _regionSTOImpl;
    address private _stationRegistry;

    mapping(bytes4 => address) private _regionTokens;
    bytes4[] private _regionIds;

    // ─────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin_,
        address regionSTOImpl_,
        address stationRegistry_
    ) external initializer {
        if (admin_ == address(0) || regionSTOImpl_ == address(0) || stationRegistry_ == address(0))
            revert ZeroAddress();

        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _regionSTOImpl = regionSTOImpl_;
        _stationRegistry = stationRegistry_;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IRegionSTOFactory: Mutative — Deploy
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRegionSTOFactory
    function deployRegion(
        bytes4 regionId_,
        string calldata name,
        string calldata symbol
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (address tokenAddress) {
        return _deployRegion(regionId_, name, symbol);
    }

    /// @inheritdoc IRegionSTOFactory
    function deployAllRegions() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _deployRegion(bytes4("KR11"), "EnergyFi Seoul STO",     "EFI-KR11");
        _deployRegion(bytes4("KR26"), "EnergyFi Busan STO",     "EFI-KR26");
        _deployRegion(bytes4("KR27"), "EnergyFi Daegu STO",     "EFI-KR27");
        _deployRegion(bytes4("KR28"), "EnergyFi Incheon STO",   "EFI-KR28");
        _deployRegion(bytes4("KR29"), "EnergyFi Gwangju STO",   "EFI-KR29");
        _deployRegion(bytes4("KR30"), "EnergyFi Daejeon STO",   "EFI-KR30");
        _deployRegion(bytes4("KR31"), "EnergyFi Ulsan STO",     "EFI-KR31");
        _deployRegion(bytes4("KR36"), "EnergyFi Sejong STO",    "EFI-KR36");
        _deployRegion(bytes4("KR41"), "EnergyFi Gyeonggi STO",  "EFI-KR41");
        _deployRegion(bytes4("KR42"), "EnergyFi Gangwon STO",   "EFI-KR42");
        _deployRegion(bytes4("KR43"), "EnergyFi Chungbuk STO",  "EFI-KR43");
        _deployRegion(bytes4("KR44"), "EnergyFi Chungnam STO",  "EFI-KR44");
        _deployRegion(bytes4("KR45"), "EnergyFi Jeonbuk STO",   "EFI-KR45");
        _deployRegion(bytes4("KR46"), "EnergyFi Jeonnam STO",   "EFI-KR46");
        _deployRegion(bytes4("KR47"), "EnergyFi Gyeongbuk STO", "EFI-KR47");
        _deployRegion(bytes4("KR48"), "EnergyFi Gyeongnam STO", "EFI-KR48");
        _deployRegion(bytes4("KR49"), "EnergyFi Jeju STO",      "EFI-KR49");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IRegionSTOFactory: Mutative — Config Setters
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRegionSTOFactory
    function updateRegionSTOImpl(address newImpl) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newImpl == address(0)) revert ZeroAddress();
        address old = _regionSTOImpl;
        _regionSTOImpl = newImpl;
        emit RegionSTOImplUpdated(old, newImpl);
    }

    /// @inheritdoc IRegionSTOFactory
    function updateStationRegistry(address newRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRegistry == address(0)) revert ZeroAddress();
        address old = _stationRegistry;
        _stationRegistry = newRegistry;
        emit StationRegistryUpdated(old, newRegistry);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _deployRegion(
        bytes4 regionId_,
        string memory name,
        string memory symbol
    ) internal returns (address tokenAddress) {
        if (_regionTokens[regionId_] != address(0)) revert RegionAlreadyDeployed();

        EnergyFiProxy proxy = new EnergyFiProxy(_regionSTOImpl, "");
        tokenAddress = address(proxy);

        RegionSTO(tokenAddress).initialize(
            regionId_,
            name,
            symbol,
            msg.sender,
            _stationRegistry
        );

        _regionTokens[regionId_] = tokenAddress;
        _regionIds.push(regionId_);

        emit RegionDeployed(regionId_, tokenAddress, name, symbol);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IRegionSTOFactory: View
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRegionSTOFactory
    function regionSTOImpl() external view returns (address) {
        return _regionSTOImpl;
    }

    /// @inheritdoc IRegionSTOFactory
    function stationRegistry() external view returns (address) {
        return _stationRegistry;
    }

    /// @inheritdoc IRegionSTOFactory
    function getRegionToken(bytes4 regionId_) external view returns (address) {
        return _regionTokens[regionId_];
    }

    /// @inheritdoc IRegionSTOFactory
    function getAllRegionIds() external view returns (bytes4[] memory) {
        return _regionIds;
    }

    /// @inheritdoc IRegionSTOFactory
    function getRegionCount() external view returns (uint256) {
        return _regionIds.length;
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
    // Storage Gap
    // ─────────────────────────────────────────────────────────────────────────

    uint256[50] private __gap;
}
