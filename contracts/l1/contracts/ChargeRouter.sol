// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./base/BridgeGuarded.sol";
import "../interfaces/IChargeRouter.sol";
import "../interfaces/IChargeTransaction.sol";
import "../interfaces/IRevenueTracker.sol";

/**
 * @title ChargeRouter
 * @notice Atomically executes ChargeTransaction.mint() + RevenueTracker.recordRevenue()
 *         in a single transaction. Bridge calls only this contract.
 *
 * If either mint() or recordRevenue() fails, the entire transaction reverts,
 * preventing partial records (EVM atomicity guarantee).
 *
 * @dev UUPS upgradeable.
 *      R04: Added Pausable.
 *      R05: Bridge address rotation via BridgeGuarded._updateBridgeAddress().
 *      R06: Inherits BridgeGuarded for onlyBridge, CallerNotBridge, ZeroAddress.
 *      R10: Added __UUPSUpgradeable_init() in initialize.
 */
contract ChargeRouter is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    BridgeGuarded,
    IChargeRouter
{
    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    IChargeTransaction public chargeTransaction;
    IRevenueTracker public revenueTracker;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ChargeProcessed(
        uint256 indexed tokenId,
        bytes32 indexed sessionId,
        bytes32 indexed stationId,
        uint256         period_yyyyMM
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _chargeTransaction,
        address _revenueTracker,
        address _bridgeAddress,
        address _admin
    ) external initializer {
        if (_chargeTransaction == address(0) || _revenueTracker == address(0)
            || _admin == address(0)) revert ZeroAddress();

        __AccessControl_init();
        __Pausable_init();
        __BridgeGuarded_init(_bridgeAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        chargeTransaction = IChargeTransaction(_chargeTransaction);
        revenueTracker = IRevenueTracker(_revenueTracker);
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
    // Core: processCharge
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IChargeRouter
    function processCharge(
        IChargeTransaction.ChargeSession calldata session,
        uint256 period_yyyyMM
    ) external onlyBridge whenNotPaused returns (uint256 tokenId) {
        // 1. Mint ERC-721 Soulbound token
        tokenId = chargeTransaction.mint(session);

        // 2. Record revenue (same TX — atomic)
        revenueTracker.recordRevenue(
            session.stationId,
            session.distributableKrw,
            period_yyyyMM
        );

        emit ChargeProcessed(tokenId, session.sessionId, session.stationId, period_yyyyMM);
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

    uint256[50] private __gap;
}
