// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../base/BridgeGuarded.sol";
import "../interfaces/core/IChargeTransaction.sol";
import "../interfaces/infra/IDeviceRegistry.sol";
import "../interfaces/infra/IStationRegistry.sol";

/**
 * @title ChargeTransaction
 * @notice ERC-721 Soulbound token recording settled EV charging sessions.
 *
 * Each token represents one invoice.paid event from STRIKON with a verified
 * SE chip signature proving physical metering integrity.
 *
 * Soulbound: tokens are minted to address(this) and cannot be transferred.
 *
 * @dev Essential contract — ROOT data source. UUPS upgradeable.
 *      R04: Added Pausable.
 *      R05: Bridge address rotation via BridgeGuarded._updateBridgeAddress().
 *      R06: Inherits BridgeGuarded for onlyBridge, CallerNotBridge, ZeroAddress.
 *      R08: getSession reverts with SessionNotFound for non-existent tokenId.
 *      R10: Added __UUPSUpgradeable_init() in initialize.
 */
contract ChargeTransaction is
    Initializable,
    ERC721Upgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    BridgeGuarded,
    IChargeTransaction
{
    // ─────────────────────────────────────────────────────────────────────────
    // Custom Errors
    // ─────────────────────────────────────────────────────────────────────────

    error SoulboundToken();
    error DuplicateSession();
    error StationNotRegistered();
    error ChipNotActive();
    error InvalidSESignature();
    error SessionNotFound(uint256 tokenId);

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    IDeviceRegistry public deviceRegistry;
    IStationRegistry public stationRegistry;

    uint256 private _nextTokenId;

    mapping(uint256 => ChargeSession) private _sessions;
    mapping(bytes32 => uint256) private _sessionToToken;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event ChargeSessionRecorded(
        uint256 indexed tokenId,
        bytes32 indexed sessionId,
        bytes32 indexed chargerId,
        bytes32         stationId,
        bytes4          gridRegionCode,
        uint256         energyKwh,
        uint256         distributableKrw,
        uint256         startTimestamp,
        uint256         endTimestamp,
        bytes           seSignature
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _deviceRegistry,
        address _stationRegistry,
        address _bridgeAddress,
        address _admin
    ) external initializer {
        if (_deviceRegistry == address(0) || _stationRegistry == address(0)
            || _admin == address(0)) revert ZeroAddress();

        __ERC721_init("EnergyFi Charge Session", "EFCS");
        __AccessControl_init();
        __Pausable_init();
        __BridgeGuarded_init(_bridgeAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        deviceRegistry = IDeviceRegistry(_deviceRegistry);
        stationRegistry = IStationRegistry(_stationRegistry);
        _nextTokenId = 1;
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
    // Core: mint
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IChargeTransaction
    function mint(ChargeSession calldata session)
        external
        onlyBridge
        whenNotPaused
        returns (uint256 tokenId)
    {
        // 1. Duplicate check
        if (_sessionToToken[session.sessionId] != 0) revert DuplicateSession();

        // 2. Station registered check
        if (!stationRegistry.isRegistered(session.stationId)) revert StationNotRegistered();

        // 3. Active chip check
        if (!deviceRegistry.isActiveChip(session.chargerId)) revert ChipNotActive();

        // 4. SE signature verification
        bytes32 msgHash = keccak256(
            abi.encodePacked(
                session.chargerId,
                session.energyKwh,
                session.startTimestamp,
                session.endTimestamp
            )
        );
        if (!deviceRegistry.verifySignature(session.chargerId, msgHash, session.seSignature))
            revert InvalidSESignature();

        // 5. Mint Soulbound token
        tokenId = _nextTokenId++;
        _mint(address(this), tokenId);

        // 6. Store session (excluding seSignature — verified above, preserved in event only)
        _sessions[tokenId] = session;
        delete _sessions[tokenId].seSignature;
        _sessionToToken[session.sessionId] = tokenId;

        // 7. Emit event (seSignature preserved here for off-chain audit)
        emit ChargeSessionRecorded(
            tokenId,
            session.sessionId,
            session.chargerId,
            session.stationId,
            session.gridRegionCode,
            session.energyKwh,
            session.distributableKrw,
            session.startTimestamp,
            session.endTimestamp,
            session.seSignature
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Soulbound: block all transfers after mint
    // ─────────────────────────────────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            revert SoulboundToken();
        }
        return super._update(to, tokenId, auth);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IChargeTransaction
    function getSession(uint256 tokenId) external view returns (ChargeSession memory) {
        if (_sessions[tokenId].sessionId == bytes32(0)) revert SessionNotFound(tokenId);
        return _sessions[tokenId];
    }

    /// @inheritdoc IChargeTransaction
    function getTokenIdBySessionId(bytes32 sessionId) external view returns (uint256) {
        return _sessionToToken[sessionId];
    }

    /// @inheritdoc IChargeTransaction
    function totalSessions() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return "";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERC-165 + UUPS
    // ─────────────────────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

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
