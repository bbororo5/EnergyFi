# EnergyFi — Project Overview

> For business context, vision, and design rationale, see [CLAUDE.md](../CLAUDE.md).

## 1. Scope

EnergyFi = **Layer 3** (smart contracts) + **Layer 4** (investor mobile app) on a dedicated Avalanche L1 private chain (Chain ID `59823`, zero-gas). EnergyFi receives SE-signed charging data from the STRIKON platform (Layers 1-2) and records it immutably on-chain.

```
EnergyFi scope
    Layer 4: Investor Interface (mobile app)
    Layer 3: Avalanche L1 Private Chain (contract surface defined in contracts/docs)
    ──────────────────────────────────────────────────────────────
    Layer 2: STRIKON Platform (external — 30+ microservices)
    Layer 1: Hardware Root of Trust (external — TPM 2.0 SE)
```

## 2. Solution

| Layer | What | How |
|:---|:---|:---|
| **Data** | Settled charging session records | SE-signed data -> ChargeRouter -> ChargeTransaction (ERC-721) on-chain |
| **Revenue** | Station and region revenue aggregation | RevenueTracker over StationRegistry-linked settlement data |
| **Registry** | Station → Charger hierarchy (all EnergyFi-owned) | StationRegistry on Avalanche L1 |
| **Operations** | Region-level reputation snapshots for client surfaces | ReputationRegistry |
| **Tokenization** | Per-region STO prototype surface | RegionSTO via RegionSTOFactory (final issuance path still undecided) |
| **Future carbon** | Carbon credit evidence pipeline | Planned Phase 5 contracts, not implemented in this repo snapshot |

## 3. Deployment Units

EnergyFi manages **3 deployment units**: L1 chain infrastructure, smart contracts, and investor mobile app. Off-chain services (oracle relay, data aggregation) are managed by the STRIKON platform layer and are outside the scope of this repository.

| Unit | Name | Path | Stack | Status |
|:---|:---|:---|:---|:---|
| A | L1 Infrastructure | AvaCloud (Fuji) | Avalanche-CLI / AvaCloud | Active (testnet) |
| B | L1 Smart Contracts | `contracts/` | Solidity, Hardhat 3 | Active |
| C | Mobile App | `mobile/` | React Native + Expo (SDK 54), TypeScript | Active (demo) |

## 4. Repository Structure

```
EnergyFi/
├── contracts/             # Unit B: Avalanche L1 smart contracts (Hardhat 3)
│   ├── contracts/         # Essential + derived contracts (see contracts/docs/implementation-roadmap.md)
│   ├── scripts/           # deploy/, seed/, verify/ entrypoints
│   ├── tools/             # Non-canonical live verification + dashboard helpers
│   │   ├── live/          # shared live-network execution core
│   │   └── dashboard/     # Express UI and HTTP routes
│   ├── test/              # Hardhat unit tests
│   └── hardhat.config.ts
├── mobile/                # Unit C: React Native + Expo SDK 54 (TypeScript, expo-router v6)
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

## 6. Current Surface vs Planned Surface

### Currently implemented in code

- `DeviceRegistry`
- `StationRegistry`
- `ChargeRouter`
- `ChargeTransaction`
- `RevenueTracker`
- `ReputationRegistry`
- `RegionSTO` and `RegionSTOFactory` as a prototype/demo issuance surface

### Planned but not implemented in this repo snapshot

- `CCIPRevenueSender`
- `STOPortfolio`
- `ParameterRegistry`
- `CarbonReduction`
- `CarbonBatch`
- `VCUReference`

For exact contract authority, use [`../contracts/docs/README.md`](../contracts/docs/README.md) and the relevant phase specs rather than treating this overview as the contract source of truth.
