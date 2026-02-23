# EnergyFi — Project Overview

> For business context, vision, and design rationale, see [CLAUDE.md](../../CLAUDE.md).

## 1. Scope

EnergyFi = **Layer 3** (smart contracts + L1 chain config) + **Layer 4** (investor frontend) on a dedicated Avalanche L1 private chain. It receives SE-signed charging data from the STRIKON platform (Layers 1-2) and records it immutably on-chain.

```
EnergyFi scope
    Layer 4: Investor Interface (frontend — planned)
    Layer 3: Avalanche L1 Private Chain (9 smart contracts)
    ─────────────────────────────────────────────────────
    Layer 2: STRIKON Platform (external — 30+ microservices)
    Layer 1: Hardware Root of Trust (external — TPM 2.0 SE)
```

## 2. Solution

| Layer | What | How |
|:---|:---|:---|
| **Data** | Real-time charging session records | SE-signed data → ChargeTransaction (ERC-721) on-chain |
| **Carbon** | VM0038 carbon reduction calculation | CarbonReduction (immutable contract) + ParameterRegistry |
| **Registry** | CPO → Station → Charger hierarchy | StationRegistry on Avalanche L1 |
| **Tokenization** | Per-region fractional ownership (17 regions) | RegionSTO (ERC-20) via RegionSTOFactory |
| **Portfolio** | Investor dashboard data | STOPortfolio + ReputationRegistry |
| **Verification** | Carbon credit pipeline | CarbonBatch → VVB → VCUReference |

## 3. Deployment Units

EnergyFi manages **3 deployment units**: L1 chain infrastructure, smart contracts, and investor frontend. Off-chain services (oracle relay, data aggregation) are managed by the STRIKON platform layer and are outside the scope of this repository.

| Unit | Name | Path | Stack | Status |
|:---|:---|:---|:---|:---|
| A | L1 Infrastructure | `l1-config/` | Avalanche-CLI, JSON config | Active |
| B | L1 Smart Contracts | `contracts/l1/` | Solidity, Hardhat 3 | Active |
| C | Frontend | `frontend/` | TBD | Planned (reimplementation for per-region STO model) |

## 4. Repository Structure

```
EnergyFi/
├── contracts/
│   └── l1/                # Unit B: Avalanche L1 private chain contracts
│       ├── contracts/     # 9-contract architecture (see docs/contracts/smart-contract-spec.md)
│       ├── scripts/       # Deployment scripts
│       └── hardhat.config.ts
├── l1-config/             # Unit A: L1 genesis & runtime config
│   ├── genesis.json
│   └── config.json
├── frontend/              # Unit C: Investor frontend (planned reimplementation)
├── docs/                  # Project documentation
└── .env.example           # Environment variable template
```

> **Note:** The oracle relay and other off-chain data services are managed by the STRIKON platform (30+ microservices) and are not part of this repository. EnergyFi provides the on-chain contracts that the platform calls.

## 5. Tech Stack

| Category | Technology | Version |
|:---|:---|:---|
| Runtime | Node.js | 24.x LTS |
| Smart Contract | Solidity | ^0.8.20 |
| Framework | Hardhat | 3.1.7 (ESM-first) |
| Library | OpenZeppelin Contracts | ^5.3.0 |
| Web3 | ethers.js | ^6.14.0 |
| Language | TypeScript | ^5.7.0 |
| Blockchain | Avalanche | L1 Private Chain (zero-gas, BFT consensus) |
