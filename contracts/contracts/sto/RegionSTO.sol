// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/sto/IRegionSTO.sol";
import "../interfaces/infra/IStationRegistry.sol";

/**
 * @title RegionSTO — Per-Region Security Token (ERC-20)
 *
 * @notice Issues STO tokens in Tranche (batch) units, recording the list of
 *         charging stations included in each tranche on-chain.
 *
 *         - Admin-only transfer: only DEFAULT_ADMIN_ROLE may move tokens.
 *         - totalSupply() is verifiable by the KSD total-supply management node.
 *         - Dividend calculation/execution is off-chain (traditional securities model).
 *         - decimals() returns 0 — tokens represent whole securities.
 *
 * @dev Phase 3 contract. UUPS upgradeable.
 */
contract RegionSTO is
    Initializable,
    ERC20Upgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    IRegionSTO
{
    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────────────────────────────────

    error StationNotRegistered();
    error RegionMismatch();
    error StationAlreadyInTranche();
    error ZeroAmount();
    error EmptyStations();
    error TransferNotAllowed();
    error StationNotActive();

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    bytes4 private _regionId;
    IStationRegistry public stationRegistry;

    uint256 private _trancheCount;
    mapping(uint256 => Tranche) private _tranches;
    mapping(bytes32 => uint256) private _stationTranche; // stationId => trancheId

    // ─────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        bytes4 regionId_,
        string memory name_,
        string memory symbol_,
        address admin_,
        address stationRegistry_
    ) external initializer {
        __ERC20_init(name_, symbol_);
        __AccessControl_init();
        __Pausable_init();

        _regionId = regionId_;
        stationRegistry = IStationRegistry(stationRegistry_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IRegionSTO: Mutative
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRegionSTO
    function issueTranche(
        address to,
        uint256 tokenAmount,
        bytes32[] calldata stationIds
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused returns (uint256 trancheId) {
        if (tokenAmount == 0) revert ZeroAmount();
        if (stationIds.length == 0) revert EmptyStations();

        _trancheCount++;
        trancheId = _trancheCount;

        Tranche storage t = _tranches[trancheId];
        t.trancheId = trancheId;
        t.tokenAmount = tokenAmount;
        t.issuedAt = block.timestamp;

        // Single-pass: validate + write together.
        // Duplicate stationIds within the same call are caught because the
        // first occurrence sets _stationTranche[sid] = trancheId (non-zero),
        // and the second occurrence hits StationAlreadyInTranche.
        for (uint256 i = 0; i < stationIds.length; i++) {
            bytes32 sid = stationIds[i];
            if (!stationRegistry.isRegistered(sid)) revert StationNotRegistered();

            IStationRegistry.Station memory station = stationRegistry.getStation(sid);
            if (!station.active) revert StationNotActive();
            if (station.regionId != _regionId) revert RegionMismatch();
            if (_stationTranche[sid] != 0) revert StationAlreadyInTranche();

            t.stationIds.push(sid);
            _stationTranche[sid] = trancheId;
        }

        _mint(to, tokenAmount);

        emit TrancheIssued(trancheId, to, tokenAmount, stationIds.length, block.timestamp);
    }

    /// @inheritdoc IRegionSTO
    function adminTransfer(
        address from,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _transfer(from, to, amount);
    }

    /// @inheritdoc IRegionSTO
    function burn(address from, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(from, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transfer Restriction (Admin-only)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Overrides ERC-20 _update to enforce admin-only transfer policy.
     *      Mint (from == address(0)) and burn (to == address(0)) are allowed
     *      through issueTranche() and burn() respectively.
     *      Regular transfers require DEFAULT_ADMIN_ROLE.
     */
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            if (!hasRole(DEFAULT_ADMIN_ROLE, _msgSender())) revert TransferNotAllowed();
        }
        super._update(from, to, value);
    }

    /**
     * @dev Disable approve — STO tokens use admin-only transfers.
     *      Allowing approve would create misleading allowances since
     *      transferFrom is blocked for non-admins anyway.
     */
    function approve(address, uint256) public pure override returns (bool) {
        revert TransferNotAllowed();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IRegionSTO: View
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IRegionSTO
    function regionId() external view returns (bytes4) {
        return _regionId;
    }

    /**
     * @notice Returns 0 — STO tokens represent whole securities with no fractional units.
     * @dev Overrides ERC-20 default of 18 decimals. This is a deliberate design
     *      choice for securities tokens where each token is an indivisible unit.
     */
    function decimals() public pure override(ERC20Upgradeable, IRegionSTO) returns (uint8) {
        return 0;
    }

    /// @inheritdoc IRegionSTO
    function getTranche(uint256 trancheId_) external view returns (Tranche memory) {
        return _tranches[trancheId_];
    }

    /// @inheritdoc IRegionSTO
    function getTrancheCount() external view returns (uint256) {
        return _trancheCount;
    }

    /// @inheritdoc IRegionSTO
    function getStationTranche(bytes32 stationId) external view returns (uint256) {
        return _stationTranche[stationId];
    }

    /// @inheritdoc IRegionSTO
    function getTrancheActiveStations(uint256 trancheId_)
        external view returns (uint256 activeCount, uint256 totalCount)
    {
        Tranche storage t = _tranches[trancheId_];
        totalCount = t.stationIds.length;
        for (uint256 i = 0; i < totalCount; i++) {
            IStationRegistry.Station memory station = stationRegistry.getStation(t.stationIds[i]);
            if (station.active) {
                activeCount++;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pausable
    // ─────────────────────────────────────────────────────────────────────────

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
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
