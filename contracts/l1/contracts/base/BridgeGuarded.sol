// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title BridgeGuarded
 * @notice Abstract base contract providing bridge address management and
 *         the `onlyBridge` access modifier for EnergyFi contracts.
 *
 * Inherited by ChargeTransaction, ChargeRouter, and RevenueTracker.
 * The bridge address is the sole entry point from STRIKON to EnergyFi L1.
 *
 * @dev R06: Extracts common bridge logic from CT, CR, RT into a single base.
 *      R05: Provides internal `_updateBridgeAddress()` for admin-controlled rotation.
 */
abstract contract BridgeGuarded is Initializable {
    address public bridgeAddress;

    error CallerNotBridge();
    error ZeroAddress();

    event BridgeAddressUpdated(address indexed oldAddress, address indexed newAddress);

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert CallerNotBridge();
        _;
    }

    function __BridgeGuarded_init(address _bridgeAddress) internal onlyInitializing {
        if (_bridgeAddress == address(0)) revert ZeroAddress();
        bridgeAddress = _bridgeAddress;
    }

    // R05: rotation function — must be called with access control in the inheriting contract
    function _updateBridgeAddress(address newBridge) internal {
        if (newBridge == address(0)) revert ZeroAddress();
        address old = bridgeAddress;
        bridgeAddress = newBridge;
        emit BridgeAddressUpdated(old, newBridge);
    }
}
