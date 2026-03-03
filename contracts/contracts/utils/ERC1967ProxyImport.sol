// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @dev Thin wrapper so Hardhat 3 generates a named artifact for ERC1967Proxy.
 *
 * Overrides _unsafeAllowUninitialized() because EnergyFi deploys proxies
 * with empty _data then calls initialize() immediately after (to resolve
 * circular dependencies: CT/RT need CR address, CR needs CT/RT addresses).
 *
 * Used by deploy scripts and tests to create proxy instances.
 */
contract EnergyFiProxy is ERC1967Proxy {
    constructor(address implementation, bytes memory _data)
        ERC1967Proxy(implementation, _data)
    {}

    function _unsafeAllowUninitialized() internal pure override returns (bool) {
        return true;
    }
}
