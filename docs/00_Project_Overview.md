# EnergyFi — Project Overview

## 1. Vision
EnergyFi is the **DeFi layer for real-world energy infrastructure**. Built on top of the production-grade [STRIKON](https://strikon.io) EV charging platform (30+ microservices), it tokenizes charging station revenue as Security Tokens (STO), enables P2P trading, and distributes yields — all on Avalanche.

> _"We are not starting from scratch. Our production infrastructure's real-time data flows directly on-chain."_

## 2. Problem Statement
- Energy infrastructure assets (EV chargers, Solar, ESS) generate predictable cash flows but are **illiquid** and **inaccessible** to retail investors.
- Existing STO platforms lack **real-time data feeds** from physical infrastructure.
- Regulatory uncertainty in Korea has been resolved with the **Jan 2026 Capital Markets Act amendment** enabling tokenized securities.

## 3. Solution

| Layer | What | How |
|:---|:---|:---|
| **Data** | Real-time charging station metrics | STRIKON API → Oracle Relay → On-chain |
| **Valuation** | AI-powered asset pricing | APEX Engine (Claude API) → NPV/IRR |
| **Tokenization** | Fractional ownership | ERC-20 STO with whitelist compliance |
| **Trading** | P2P marketplace | On-chain order book (EnergyDEX) |
| **Yield** | Revenue distribution | RevenueVault pull-payment pattern |
| **App** | Investor dashboard | Flutter mobile (iOS/Android) |

## 4. Key Differentiators

| Typical Hackathon Project | EnergyFi |
|:---|:---|
| Starts from blank canvas | Built on **30+ microservice production platform** |
| Mock data only | Real infrastructure data pipeline |
| Web demo | **Flutter native mobile app** |
| Proof of concept | Production-ready architecture (Subnet L2 + C-Chain L1) |

## 5. Deployment Units

The system comprises **5 independently deployable units**:

| Unit | Name | Path | Stack |
|:---|:---|:---|:---|
| A | Subnet Infrastructure | `subnet-evm/` | Avalanche-CLI, JSON config |
| B | C-Chain Contracts | `contracts/c-chain/` | Solidity, Hardhat 3 |
| C | Subnet Contracts | `contracts/subnet/` | Solidity, Hardhat 3 |
| D | Oracle Relay Service | `services/oracle-relay/` | TypeScript, Node.js 24 |
| E | Mobile App | `frontend/` | Dart, Flutter 3.x |

## 6. Repository Structure

```
EnergyFi/
├── contracts/
│   ├── c-chain/           # Unit B: L1 Settlement contracts
│   │   ├── contracts/     # EnergyToken, EnergyOracle, RevenueVault
│   │   ├── scripts/       # deploy_cchain.ts
│   │   └── hardhat.config.ts
│   └── subnet/            # Unit C: L2 Execution contracts
│       ├── contracts/     # AssetLogger, DeviceRegistry
│       ├── scripts/       # deploy_subnet.ts
│       └── hardhat.config.ts
├── services/
│   └── oracle-relay/      # Unit D: Off-chain → On-chain bridge
│       ├── index.ts       # Polling loop main entry
│       └── tsconfig.json
├── frontend/              # Unit E: Flutter mobile app
│   ├── lib/
│   │   ├── main.dart
│   │   └── config/constants.dart
│   └── pubspec.yaml
├── subnet-evm/            # Unit A: Genesis & runtime config
│   ├── genesis.json
│   └── config.json
├── docs/                  # Project documentation
└── .env.example           # Environment variable template
```

## 7. Tech Stack Summary

| Category | Technology | Version |
|:---|:---|:---|
| Runtime | Node.js | 24.x LTS |
| Smart Contract | Solidity | ^0.8.20 |
| Framework | Hardhat | 3.1.7 (ESM-first) |
| Library | OpenZeppelin Contracts | ^5.3.0 |
| Web3 | ethers.js | ^6.14.0 |
| Language | TypeScript | ^5.7.0 |
| Mobile | Flutter | ^3.7.0 |
| State Mgmt | Riverpod | ^2.6.1 |
| Blockchain | Avalanche | C-Chain + Custom Subnet |
| AI | Claude API | Asset Valuation (APEX) |
