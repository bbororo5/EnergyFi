# EnergyFi — System Architecture

> **Interactive version**: Open [`architecture-diagram.html`](architecture-diagram.html) in a browser for the full interactive diagram with hover effects.

## 1. Overview

EnergyFi employs a **4-layer hybrid architecture** that maps directly to the interactive diagram:

```
Layer 4 (Top)    : Flutter Mobile App          — User Interface
Layer 3          : Avalanche C-Chain           — Smart Contracts (Settlement)
Layer 2          : AI Backend & Services       — Intelligence & Oracle
Layer 1 (Bottom) : STRIKON Platform            — Production Data Source
```

Additionally, a **Wingside Subnet (L2)** operates as a parallel execution layer for high-frequency IoT data logging.

- **Project Identity**: Wingside (L1+L2 Infra) / EnergyFi (Application Layer)
- **Core Philosophy**: "Log locally (Subnet), Settle globally (C-Chain)."

## 2. Layer Details

### 2.1 Layer 4: Flutter Mobile App (`frontend/`)
Cross-platform mobile application for STO investors.

| Module | Description |
|:---|:---|
| **Portfolio Dashboard** | Token holdings, P&L tracking, monthly summary |
| **STO Marketplace** | Browse and trade energy tokens |
| **AI Insights** | Valuation analytics from APEX Engine |
| **Wallet** | WalletConnect v2 integration (MetaMask, Core Wallet) |
| **KYC Module** | Compliance gate for onboarding |

**Stack**: Flutter 3.x, Dart, web3dart, WalletConnect, Riverpod

> See [07_Frontend_Spec.md](07_Frontend_Spec.md) for detailed screen map and project structure.

### 2.2 Layer 3: Avalanche C-Chain — Smart Contracts (`contracts/c-chain/`)
The public settlement layer for STO tokenization and DeFi.

| Contract | Role | Status |
|:---|:---|:---|
| **EnergyToken.sol** | ERC-20 STO with whitelist compliance | ✅ Phase 1 |
| **EnergyOracle.sol** | On-chain data feed from Oracle Relay | ✅ Phase 1 |
| **RevenueVault.sol** | Pull-payment yield distribution | ✅ Phase 1 |
| **EnergyDEX.sol** | P2P order matching (limit orders) | 📋 Phase 2 |
| **IdentityRegistry.sol** | On-chain KYC registry | 📋 Phase 2 |
| **ComplianceModule.sol** | Modular compliance rules engine | 📋 Phase 2 |

> See [02_Smart_Contract_Spec.md](02_Smart_Contract_Spec.md) for full contract specifications.

### 2.3 Layer 2: AI Backend & Services (`services/`)
Intelligence layer bridging off-chain data to on-chain state.

| Service | Role | Stack | Status |
|:---|:---|:---|:---|
| **AI Valuation Engine (APEX)** | NPV/IRR analysis, revenue forecasting, risk scoring | Python, Claude API | 📋 Phase 2 |
| **Oracle Relay Service** | STRIKON/APEX data → C-Chain & Subnet transactions | TypeScript, Node.js 24, ethers.js | ✅ Phase 1 |
| **Notification Service** | Trade alerts, yield notifications | — | 📋 Phase 2 |
| **STRIKON Data Gateway** | Adapter for production data (mock for hackathon) | REST API | ✅ Phase 1 (mock) |

> See [06_Oracle_Relay_Spec.md](06_Oracle_Relay_Spec.md) for detailed Oracle Relay architecture.

### 2.4 Layer 1: STRIKON Platform (External)
Production data source — **not part of this repository**.
- 30+ microservices handling real EV charging infrastructure.
- Provides: kWh dispensed, revenue, uptime, session count, station health, grid price.
- Integration: REST API (mock JSON for hackathon, production API for mainnet).

### 2.5 Parallel Layer: Wingside Subnet (`subnet-evm/`, `contracts/subnet/`)
A sovereign, permissioned EVM Subnet dedicated to **DER Data Integrity**.

| Property | Value |
|:---|:---|
| **Chain ID** | 12345 |
| **Finality** | Sub-second |
| **Gas Token** | WING (or zero-gas for whitelisted gateways) |
| **Purpose** | High-frequency IoT data logging |

| Contract | Role |
|:---|:---|
| **AssetLogger.sol** | Immutable logging of energy asset events (Solar, ESS, EVSE) |
| **DeviceRegistry.sol** | RBAC for IoT gateways (AccessControl-based) |

## 3. Cross-Chain Communication

### 3.1 Avalanche Teleporter (AWM)
- **Direction**: Subnet → C-Chain
- **Payload**: Periodic "Revenue Summary" proving asset events occurred on the Subnet.
- **Validation**: C-Chain contract validates BLS signature of the Subnet validator set.
- **Benefit**: Raw data stays on Subnet (low cost); only verified summaries reach C-Chain.

## 4. Data Flow

```
IoT Gateways (Solar, ESS, EVSE)
        │
        ▼
  STRIKON Platform (30+ microservices)
        │
        ├──── REST API ────┐
        │                  ▼
        │         APEX Engine (Python)
        │         NPV/IRR/Risk Analysis
        │                  │
        │                  ▼
        │         Oracle Relay (TypeScript)
        │              │          │
        │              ▼          ▼
        │     ┌─── C-Chain ──┐  Subnet
        │     │EnergyOracle  │  AssetLogger
        │     │EnergyToken   │  DeviceRegistry
        │     │RevenueVault  │
        │     │EnergyDEX (P2)│
        │     └──────────────┘
        │              │
        │              ▼
        └──── Flutter Mobile App
              (Portfolio, Trade, Yield Claim)
```

> See [08_Token_Lifecycle.md](08_Token_Lifecycle.md) for the complete token lifecycle documentation.

## 5. Technology Stack

| Component | Technology | Description |
|:---|:---|:---|
| **Mobile App** | Flutter 3.x, Riverpod | Cross-platform UI, state management |
| **Web3 Client** | web3dart, WalletConnect v2 | RPC interaction, transaction signing |
| **Smart Contracts** | Solidity ^0.8.20, Hardhat 3 | STO token, Oracle, Vault, DEX |
| **Subnet Runtime** | Subnet-EVM | Custom L2 with sub-second finality |
| **Oracle Relay** | TypeScript, Node.js 24, ethers.js | Off-chain → On-chain data bridge |
| **AI Engine** | Python, Claude API | Asset valuation (APEX), risk scoring |
| **Data Source** | STRIKON REST API | Real-world energy infrastructure data |

## 6. Security Considerations

| Concern | Approach |
|:---|:---|
| **Private keys** | Never committed. `.env` (local) or KMS (production). |
| **Oracle trust** | Single relayer for MVP. Multi-sig or Chainlink for mainnet. |
| **Contract upgradability** | Not implemented for MVP. Proxy pattern planned for Phase 3. |
| **Subnet permissioning** | Only whitelisted validators; IoT gateways authorized via DeviceRegistry. |
| **Transfer compliance** | Whitelist-gated ERC-20 (Phase 1); full IdentityRegistry + ComplianceModule (Phase 2). |