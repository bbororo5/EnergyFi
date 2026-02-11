# EnergyFi — Smart Contract Specification

## 1. Overview

| Property | Value |
|:---|:---|
| Language | Solidity ^0.8.20 |
| Framework | Hardhat 3.1.7 (ESM-first) |
| Library | OpenZeppelin Contracts ^5.3.0 |
| Strategy | Dual-Chain Deployment (C-Chain + Subnet) |

All contracts are organized into two independent Hardhat projects:
- **`contracts/c-chain/`** — Settlement layer (L1)
- **`contracts/subnet/`** — Execution layer (L2)

## 2. C-Chain Contracts — Settlement Layer

### 2.1 EnergyToken.sol ✅ Phase 1

**Purpose**: ERC-20 STO token with whitelist-gated transfers.

| Item | Detail |
|:---|:---|
| **Inherits** | `ERC20`, `Ownable`, `Pausable` (OpenZeppelin) |
| **Access** | Only whitelisted addresses can send/receive |
| **Emergency** | `pause()` / `unpause()` by owner |

**Key Functions:**
```
mint(address to, uint256 amount)          — onlyOwner
addToWhitelist(address account)           — onlyOwner
removeFromWhitelist(address account)      — onlyOwner
pause() / unpause()                       — onlyOwner
_update(from, to, value)                  — internal, enforces whitelist + pause
```

### 2.2 EnergyOracle.sol ✅ Phase 1

**Purpose**: Receives validated STRIKON/APEX data via Oracle Relay.

| Item | Detail |
|:---|:---|
| **Inherits** | `Ownable` |
| **Access** | Only designated `relayer` can submit reports |
| **Data** | totalGenerationKwh, totalRevenueUsd, contentHash, timestamp |

**Key Functions:**
```
submitReport(uint256 kwh, uint256 usd, bytes32 hash) — onlyRelayer
setRelayer(address newRelayer)                         — onlyOwner
latestReport()                                         — view
```

**Data Structure:**
```
struct Report {
    uint256 timestamp;
    uint256 totalGenerationKwh;
    uint256 totalRevenueUsd;
    bytes32 contentHash;          // keccak256(JSON report) for verification
}
```

### 2.3 RevenueVault.sol ✅ Phase 1

**Purpose**: Pull-payment yield distribution vault.

| Item | Detail |
|:---|:---|
| **Inherits** | `Ownable`, `ReentrancyGuard` |
| **Pattern** | Pull-payment (beneficiaries call `claim()`) |
| **Safety** | Reentrancy guard on all withdrawals |

**Key Functions:**
```
allocate(address[] beneficiaries, uint256[] amounts) — onlyOwner
claim()                                               — nonReentrant, msg.sender
receive()                                             — accept deposits
```

### 2.4 EnergyDEX.sol 📋 Phase 2

**Purpose**: P2P order book for STO token trading.

| Item | Detail |
|:---|:---|
| **Pair** | EnergyToken / USDC |
| **Order Type** | Limit orders (buy/sell) |
| **Compliance** | Only KYC-verified users (via IdentityRegistry) |
| **Settlement** | Atomic swap on match |

**Planned Functions:**
```
createOrder(bool isBuy, uint256 price, uint256 amount)
matchOrder(uint256 orderId)
cancelOrder(uint256 orderId)
```

### 2.5 IdentityRegistry.sol 📋 Phase 2

**Purpose**: On-chain KYC/AML registry.

| Item | Detail |
|:---|:---|
| **Role** | Maps wallet addresses to verified identity claims |
| **Integration** | Called by EnergyToken and EnergyDEX before transfers/trades |

**Planned Functions:**
```
registerUser(address user, bytes32 identityHash) — onlyOperator
verifyKYC(address user)                          — view returns (bool)
checkEligible(address user, bytes32 jurisdiction) — view returns (bool)
```

### 2.6 ComplianceModule.sol 📋 Phase 2

**Purpose**: Modular compliance rules engine.

| Item | Detail |
|:---|:---|
| **Rules** | Investor count limits, transfer restrictions, jurisdiction checks, holding periods |
| **Design** | Pluggable module pattern — rules can be added/removed by admin |

**Planned Functions:**
```
checkTransfer(address from, address to, uint256 amount) — view returns (bool)
setRestriction(bytes32 ruleId, bytes calldata params)    — onlyOwner
```

## 3. Subnet Contracts — Execution Layer

### 3.1 AssetLogger.sol ✅ Phase 1

**Purpose**: Immutable logging of energy asset events (Solar, ESS, EVSE).

| Item | Detail |
|:---|:---|
| **Inherits** | `Ownable` |
| **Access** | Only `authorizedDevices` can write logs |
| **Storage** | `bytes32 contentHash` (not raw strings, saves gas) |
| **Throughput** | Optimized for high TPS writes from IoT Gateways |

**Key Functions:**
```
logEvent(bytes32 assetId, bytes32 contentHash) — onlyAuthorized
authorizeDevice(address device)                — onlyOwner
revokeDevice(address device)                   — onlyOwner
```

**Data Structure:**
```
struct LogEntry {
    uint256 timestamp;
    address device;
    bytes32 assetId;
    bytes32 contentHash;
}
```

### 3.2 DeviceRegistry.sol ✅ Phase 1

**Purpose**: RBAC for IoT devices on Wingside Subnet.

| Item | Detail |
|:---|:---|
| **Inherits** | `AccessControl` (OpenZeppelin) |
| **Roles** | `DEFAULT_ADMIN_ROLE`, `OPERATOR_ROLE`, `DEVICE_ROLE` |
| **Data** | deviceType, location, active status |

**Key Functions:**
```
registerDevice(address device, string deviceType, string location) — OPERATOR_ROLE
deactivateDevice(address device)                                    — OPERATOR_ROLE
isActiveDevice(address device)                                      — view returns (bool)
```

## 4. Cross-Chain Messaging (Teleporter)

| Direction | Payload | Frequency |
|:---|:---|:---|
| Subnet → C-Chain | Revenue Summary (aggregated kWh, USD) | Periodic (configurable) |

Validation: C-Chain contract verifies the BLS signature of the Subnet validator set via AWM (Avalanche Warp Messaging).

## 5. Phase Roadmap

| Phase | Contracts | Status |
|:---|:---|:---|
| **Phase 1 (MVP)** | EnergyToken, EnergyOracle, RevenueVault, AssetLogger, DeviceRegistry | ✅ Scaffold ready |
| **Phase 2** | EnergyDEX, IdentityRegistry, ComplianceModule | 📋 Planned |
| **Phase 3** | Teleporter integration, Multi-sig Oracle, Proxy upgradability | 📋 Planned |

## 6. Deployment

See [04_Deployment_Guide.md](04_Deployment_Guide.md) for step-by-step deployment instructions for each unit.