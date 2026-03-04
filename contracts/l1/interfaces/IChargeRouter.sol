// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IChargeTransaction.sol";

/**
 * @title IChargeRouter
 * @notice Interface for the ChargeRouter contract.
 *
 * Atomically executes ChargeTransaction.mint() + RevenueTracker.recordRevenue()
 * in a single transaction. Bridge calls only this contract.
 */
interface IChargeRouter {
    /**
     * @notice Process a settled charging session atomically.
     * @dev Only callable by bridgeAddress (AWS KMS Bridge wallet).
     *      1. Mints ERC-721 Soulbound token via ChargeTransaction
     *      2. Records revenue via RevenueTracker
     *      If either fails, the entire transaction reverts.
     * @param session The full charging session data.
     * @param period_yyyyMM Revenue period calculated off-chain by Bridge.
     * @return tokenId The minted ERC-721 token ID.
     */
    function processCharge(
        IChargeTransaction.ChargeSession calldata session,
        uint256 period_yyyyMM
    ) external returns (uint256 tokenId);
}
