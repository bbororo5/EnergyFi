# EnergyFi — System Architecture

> Canonical maps live in [`README.md`](README.md) and [`../contracts/docs/README.md`](../contracts/docs/README.md). The old interactive HTML diagram is not the current source of truth.

## 1. Overview

EnergyFi employs a **4-layer architecture** on a dedicated Avalanche L1 private chain:

```
Layer 4 (Top)    : Investor Interface           — Mobile App (`mobile/`)                    ← EnergyFi
Layer 3          : Avalanche L1 Private Chain   — Contract surface defined in `contracts/docs/` ← EnergyFi
Layer 2          : Platform Services            — STRIKON Platform (30+ microservices)      ← External
Layer 1 (Bottom) : Hardware Root of Trust       — TPM 2.0 SE + Embedded System              ← External
```

- **EnergyFi Scope**: Layer 3 (smart contracts + chain config) and Layer 4 (mobile app). Layers 1-2 are managed by the STRIKON platform.
- **Design Principle**: Receive trusted data at the boundary (Bridge wallet + SE signature), record immutably on L1, compute deterministically, expose transparently. For business context, see [CLAUDE.md](../CLAUDE.md).
- **STO Model**: Per-region tokenization (17 administrative regions, ISO 3166-2:KR). Station is the operational unit; region is the investment unit.

## 2. Layer Details

### 2.1 Layer 4: Investor Interface
Cross-platform application for STO investors.

| Module | Description |
|:---|:---|
| **Region Portfolio Dashboard** | Per-region token holdings, aggregated station performance |
| **Carbon Reduction Tracker** | VM0038 reduction records, VCU pipeline status |
| **Station Operations** | Station operational metrics, reputation scores |
| **Wallet / Holdings** | Wallet connection and holdings display for the final issuance ledger or token surface |
| **Onboarding Handoff** | Entry point that hands users off to the securities-firm-side KYC/AML process |

> **Note:** Investor client is implemented in `mobile/` with React Native + Expo SDK 54 (`expo-router` v6). Mobile docs live under [`../mobile/docs/README.md`](../mobile/docs/README.md).

### 2.2 Layer 3: Avalanche L1 Private Chain — Smart Contracts (`contracts/`)
The contract surface is organized into **Essential** (Phase 1-2 data pipeline, cannot operate without) and **Derived** (consume Essential data) groups. The exact set evolves by phase and is tracked in [`../contracts/docs/implementation-roadmap.md`](../contracts/docs/implementation-roadmap.md).

**Category A: Physical Infrastructure Layer — Essential**

| Contract | Role | Phase |
|:---|:---|:---|
| **DeviceRegistry** | Stores enrolled SE chip public keys (P-256, 64 bytes) and enables SE signature verification during `ChargeTransaction.mint()` | Phase 1 (2026.04) |
| **StationRegistry** | Maintains the station -> charger hierarchy and region mapping. All on-chain stations are EnergyFi-owned | Phase 1 (2026.04) |

**Category B: Charging Data & Revenue Layer — Essential**

| Contract | Role | Phase |
|:---|:---|:---|
| **ChargeTransaction** | ERC-721 token per charging session (SE-signed). ROOT data source | Phase 2 (2026.06) |
| **RevenueTracker** | Accumulates settled revenue and aggregates it by station and region for the investor pool of the mapped region | Phase 2 (2026.06) |

**Category C: Carbon Credit Pipeline Layer — Derived**

| Contract | Role | Phase |
|:---|:---|:---|
| **ParameterRegistry** | Versioned emission factors (EFkw, AFEC, etc.) | Phase 5 (2027+) |
| **CarbonReduction** | VM0038 emission reduction calculation (immutable) | Phase 5 (2027+) |
| **CarbonBatch** | Groups reductions into verification batches, prevents double-counting | Phase 5 (2027+) |
| **VCUReference** | Records Verra VCU issuance results on-chain | Phase 5 (2027+) |

**Category D: Investment & Operations Layer — Derived**

| Contract | Role | Phase |
|:---|:---|:---|
| **CCIPRevenueSender** | Formats `RevenueTracker` data into Revenue Attestation payloads and sends them through CCIP to the KSD-supported chain | Phase 3 (2027.01~, on hold) |
| **ReputationRegistry** | Region-level operational and attractiveness snapshots for Explore (oracle pattern, optional) | Phase 4 (optional, after Phase 3) |
| **STOPortfolio** | Maps investor wallets to region holdings and revenue views once the issuance path is finalized | Phase 3 (2027.01~, on hold) |
| **RegionSTO** | Security-token surface per region. The final token standard is not fixed yet, and in the CCIP path the token may live on a KSD-supported chain instead of EnergyFi L1 | Phase 3 (2027.01~, on hold) |

**Factory Contract:**

| Contract | Role | Phase |
|:---|:---|:---|
| **RegionSTOFactory** | Deploys RegionSTO instances when the selected issuance path requires on-ledger region token deployment | Phase 3 (2027.01~, on hold) |

> See [implementation-roadmap.md](../contracts/docs/implementation-roadmap.md) for full architecture and contract specifications.

### 2.3 Layer 2: Platform Services (External — STRIKON Platform)
Off-chain services bridging physical infrastructure to on-chain state. **This layer is managed by the STRIKON platform and is outside the scope of EnergyFi.** EnergyFi provides the on-chain contracts (Layer 3) that the platform calls.

| Service | Role | Stack | Managed By |
|:---|:---|:---|:---|
| **Embedded System** | Transmits TPM 2.0 SE-signed charging data to platform | Proprietary | STRIKON Platform |
| **STRIKON Platform** | 30+ microservices, data relay, oracle pattern, operational dashboards | REST API | STRIKON Platform |
| **AI Valuation Engine (APEX)** | NPV/IRR analysis, revenue forecasting, risk scoring | Python, Claude API | STRIKON Platform (planned) |

> **Note:** The STRIKON platform handles all off-chain data relay (receiving SE-signed data from embedded systems, calling on-chain contracts). EnergyFi's scope is limited to smart contracts, chain configuration, and the mobile investor app.

### 2.4 Layer 1: Hardware Root of Trust + STRIKON Platform
Physical measurement layer with hardware-level data integrity.

- **TPM 2.0 SE Chip**: Company-specified secure element signs raw metering data (kWh, timestamps) at the point of physical measurement.
- **Embedded System**: Company's proprietary system transmits SE-signed data to the platform.
- **STRIKON Platform**: 30+ microservices handling real EV charging infrastructure operations.
- **Data Flow**: SE chip signature → Embedded System → Platform → Avalanche L1 on-chain record.
- This architecture solves the oracle problem at the hardware level, providing tamper-proof data from physical reality to on-chain state.

### 2.5 L1 Chain Configuration (`l1-config/`)
Dedicated Avalanche L1 private chain for all EnergyFi smart contracts.

| Property | Value |
|:---|:---|
| **Chain ID** | 270626 |
| **Finality** | Sub-second (Avalanche consensus, BFT-compatible) |
| **Gas Fee** | 0 (private chain, controlled access) |
| **EVM Compatible** | Supports general EVM standards such as ERC-20, ERC-721, ERC-1155. Final STO token standard remains TBD. |
| **Cross-chain** | Avalanche Warp Messaging (AWM) for future public chain connectivity |

See [implementation-roadmap.md](../contracts/docs/implementation-roadmap.md) for the canonical phase-by-phase contract specification.

## 3. Cross-Chain Communication

### 3.1 Chainlink CCIP — Phase 3 Revenue Attestation (preferred planning path)
- **Direction**: EnergyFi L1 (Avalanche) -> KSD-supported chain (for example Hyperledger Besu)
- **Purpose**: format `RevenueTracker` data into a Revenue Attestation payload and deliver it to the destination chain, where issuance-side processes can consume it
- **Phase**: planned for Phase 3 once the destination chain and partner-side design are finalized
- **Rationale**: DTCC demonstrated an Avalanche + Hyperledger Besu + CCIP architecture in 2025. CCIP also provides an independent verification layer and privacy tooling that fit regulated data-transfer use cases.

### 3.2 Avalanche Warp Messaging (AWM) — Phase 5
- **Direction**: L1 Private Chain → Avalanche C-Chain (public)
- **Purpose**: State anchoring for data integrity verification; future public market VCU trading.
- **Phase**: Full cross-chain bridge planned for Phase 5 (2027+).

## 4. Data Flow

### 4.1 Carbon Credit Pipeline
```
TPM 2.0 SE Chip (signs kWh data at hardware level)
        │
        ▼
  Embedded System (transmits SE-signed data)
        │
        ▼
  STRIKON Platform (30+ microservices)
        │
        ▼
  ┌─── Avalanche L1 Private Chain ─────────────────────┐
  │  ChargeTransaction (ERC-721, SE signature recorded) │
  │        │                                            │
  │        ▼                                            │
  │  CarbonReduction (VM0038 formula, immutable)        │
  │  + ParameterRegistry (versioned emission factors)   │
  │        │                                            │
  │        ▼                                            │
  │  CarbonBatch (locks records for VVB verification)   │
  │        │                                            │
  │        ▼                                            │
  │  VCUReference (Verra VCU issuance result on-chain)  │
  └─────────────────────────────────────────────────────┘
```

### 4.2 Investment Pipeline (CCIP Path — preferred planning path)
```
  StationRegistry (Station → Charger hierarchy)
        │
        ├── ChargeTransaction (revenue data, ERC-721)
        ├── CarbonReduction (reduction data)
        ├── ReputationRegistry (station quality scores)
        │
        ▼
  RevenueTracker (accumulates distributable KRW by region)
        │
        ▼
  CCIPRevenueSender [EnergyFi L1]
        │  Revenue Attestation payload (regionId, distributableKrw, merkleRoot)
        ▼  ──── CCIP ────▶
  KSD-supported chain CCIP receiver
        │
        ├── executes the tranche-issuance flow on the selected issuance ledger
        └── Securities firm handles KYC/AML and dividend-side operations
```

> In Path A (direct issuance), RegionSTO would be deployed on an EnergyFi-controlled ledger and KSD would participate according to the finalized regulatory and operating model. The final issuance path remains undecided. See [phase3-sto-spec.md](../contracts/docs/phase3-sto-spec.md).

> See [implementation-roadmap.md](../contracts/docs/implementation-roadmap.md) for the phased implementation roadmap.

## 5. Technology Stack

| Component | Technology | Description |
|:---|:---|:---|
| **Smart Contracts** | Solidity ^0.8.20, Hardhat 3 | Essential + derived contract surface on the EnergyFi L1 |
| **L1 Runtime** | Avalanche L1 (Subnet-EVM) | Private chain, zero-gas, BFT consensus |
| **Hardware Security** | TPM 2.0 SE | Company-specified secure element for Root of Trust |
| **Data Source** | STRIKON Platform | 30+ microservice production platform |
| **AI Engine** | Python, Claude API | Asset valuation (APEX), risk scoring (planned) |
| **Mobile App** | React Native + Expo (SDK 54), TypeScript | Investor-facing client in `mobile/` |

## 6. Trust Chain — Multi-Layer Signature & On-Chain Verification

### 6.1 Data Dependency Structure

`ChargeTransaction` is the **root** of the on-chain data graph. Every derived contract depends on this dataset.

```
ChargeTransaction (root)
    ├── CarbonReduction → CarbonBatch → VCUReference   (carbon pipeline)
    └── STOPortfolio → RegionSTO                        (investment pipeline)
```

Because `ChargeTransaction` is the root dataset, its integrity is a prerequisite for trust across the entire system. That is why the design relies on signatures and verification across Layers 1 through 4. For the business boundary, see [CLAUDE.md](../CLAUDE.md).

### 6.2 Bookend Signature Model

Layer 1 (the SE chip) and Layer 2 (the Bridge wallet) sign the two ends of the data path. EnergyFi treats those signatures as bookends: if the origin signature and the final submission path agree on the same session payload, the full path is treated as intact.

```
[Layer 1: SE]──kWh,ts──→[L2: Platform]──→[L3: On-Chain]──→[L4: Mobile App]
  signing                 relay            verification      transparency

SE-signed source payload  vs  on-chain ChargeSession payload  -> match proves path integrity
```

### 6.3 Signature and Verification by Layer

| Layer | Signer | Verification | Guarantee |
|:---|:---|:---|:---|
| **L1 HW** | TPM 2.0 SE chip | `ecrecover` or the P-256 precompile | proves the physical origin of the measured data |
| **L2 Platform** | Bridge wallet (AWS KMS) | `onlyBridge` (`msg.sender`) | proves that the authorized pipeline submitted the record |
| **L3 On-Chain** | — | comparison of the SE-signed source payload and stored session data | proves that the intermediate path did not alter the data |
| **L4 Mobile** | — | direct reads from on-chain state | gives investors and auditors transparent access to the evidence |

### 6.4 Trust Evolution by Phase

> **Design update (March 2026):** the platform and chargers launch together. Real SE chips are therefore present from Phase 1 onward, and the old assumption that Phase 1 would use `seSignature = 0x` is no longer valid.

| Phase | Timing | L1 (HW) | L2 (Platform) | On-chain state |
|:---|:---|:---|:---|:---|
| **1** | through 2026.04 | `DeviceRegistry` deployed and chip keys enrolled | not active yet because the charge write path is not deployed | trust chain prepared |
| **2** | from launch | real SE signatures verified on-chain | `onlyBridge` and payment-complete gate enforced | full bookend trust model active |
| **3+** | 2027.01 onward | unchanged | unchanged | later phases reuse the same hardware trust model |

> **Detail:** [implementation-roadmap.md §1 — Dual-Signature Trust Model](../contracts/docs/implementation-roadmap.md#1-dual-signature-trust-model)

### 6.5 Security Considerations

| Concern | Approach |
|:---|:---|
| **Hardware Root of Trust** | TPM 2.0 SE chip signs data at physical measurement point. Company specifies chip model to manufacturers. |
| **Private keys** | Never committed. `.env` (local) or KMS (production). |
| **Chain reliability** | Multi-party validator: company nodes + financial institution + professional node operators. |
| **Data immutability** | CarbonReduction deployed as immutable contract. New methodology versions get new contract deployments. |
| **L1 permissioning** | Only whitelisted validators; IoT gateways authorized via DeviceRegistry. |
| **Transfer compliance** | The final RegionSTO token surface and compliance-module design remain on hold until the issuance path and regulatory details are finalized. KYC/AML and dividend-side execution stay on the securities-firm side. |

> **CPO policy update (March 2026):** third-party CPOs may use STRIKON software off-chain, but they are not represented on-chain. All on-chain stations are EnergyFi-owned, and `OwnerType`, `CPORecord`, and `cpoId` were removed from `StationRegistry`.
