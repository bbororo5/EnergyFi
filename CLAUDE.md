# EnergyFi — CLAUDE.md

<!-- Contract-specific details (smart contract map, Hardhat config, ERC standards) are in contracts/CLAUDE.md -->

Agent instructions for the EnergyFi codebase. All technical decisions must align with this document.

---

## 1. Mission Statement

**Project**: EnergyFi — Blockchain protocol for tokenizing EV charging infrastructure revenue as RWA (Real World Asset).

**Problem**: Apartment complex EV charging station revenue is concentrated in operators; retail investors have no access to this asset class.

**Solution**: Issue per-region Security Token Offerings (STO) on Avalanche L1 so apartment residents and small investors can fractionally own charging infrastructure and receive revenue distributions.

**Target users**: Apartment-resident small investors. Charging station operators (CPOs) use STRIKON software only (off-chain).

**Launch target**: June 2026, South Korea apartment complexes. Charger + on-chain data recording from day one; STO activation January 2027 (Electronic Securities Act effective date).

---

## 2. Business Constraints

These constraints override all technical decisions. When in conflict, follow this priority order:

1. **Regulatory compliance > Technical optimization** — Always. Korean Capital Markets Act STO guidelines and the Electronic Securities Act (effective January 2027) govern design choices.
2. **Investor asset protection > Gas optimization** — Never sacrifice investor fund safety for performance. This is a private chain with zero gas; gas optimization is irrelevant.
3. **Hardware trust chain is inviolable** — Never propose changes that break the TPM 2.0 SE → STRIKON → On-chain data flow. This is the core differentiator.
4. **No new external contract dependencies without security audit** — All third-party contract imports must be audited or from OpenZeppelin.
5. **Securities firm role boundary** — Dividend calculation/execution and KYC/AML are the securities firm's domain. EnergyFi provides on-chain revenue data only. Do not implement ERC-2222 (dividends) or ERC-1643 (document management).
6. **Issuance only — no distribution design** — EnergyFi's scope ends at initial token issuance (mint/burn). Secondary market transfer rules, compliance module configuration, forced transfer, freeze, and recovery are entirely the securities firm's domain. Do not design or implement any distribution mechanics. Specific rules will be determined after the Presidential Decree is finalized and securities firm partnership is established.

---

## 3. Architecture Overview (3-Layer MSA)

```
Layer 1 (Hardware):   TPM 2.0 SE chip — Root of Trust (signs raw metering data)
Layer 2 (Platform):   STRIKON — Charging data aggregation & settlement middleware (external)
Layer 3 (Blockchain): EnergyFi — Avalanche L1 private chain (this repository)
```

**Key boundaries**:
- STRIKON is an external platform. From EnergyFi's perspective, it is a **trusted external caller** via the Bridge wallet (`onlyBridge` modifier).
- EnergyFi repo scope: smart contracts (`contracts/`) + investor mobile app (`mobile/`).
- Data flow: SE chip signature → Embedded System → STRIKON → Bridge wallet → On-chain `ChargeTransaction.mint()` → `DeviceRegistry.verifySignature()`.
- Trust model: Bookend Signature — SE chip signs at origin (P-256), Bridge wallet signs on-chain TX. DeviceRegistry verifies the SE signature on every mint(). Both match = path integrity verified.
- SE chip public keys are pre-enrolled in DeviceRegistry before charger launch. From Phase 1, all charging sessions carry real SE signatures.

---

## 4. Project Structure

```
EnergyFi/
├── contracts/       # Avalanche L1 smart contracts (Hardhat 3, ESM)
│   └── docs/           # Contract-specific docs (spec, roadmap, ERC analysis)
├── mobile/             # Investor mobile app (React Native + Expo)
│   └── docs/           # Mobile-specific docs
├── docs/               # Cross-cutting documentation
│   ├── architecture.md
│   ├── project-overview.md
│   ├── environment-setup.md
│   ├── deployment-guide.md
│   ├── strikon-interface-spec.md
│   ├── platform-policies.md
│   └── assets/         # Cross-cutting diagrams and images
└── CLAUDE.md           # This file
```

| Deployment Unit | Path | Stack | Status |
|:---|:---|:---|:---|
| L1 Infrastructure | AvaCloud (Fuji) | Avalanche-CLI / AvaCloud | Active (testnet) |
| L1 Smart Contracts | `contracts/` | Solidity ^0.8.20, Hardhat 3 | Active |
| Mobile App | `mobile/` | React Native + Expo, TypeScript | Active (demo) |

---

## 5. Non-Negotiables

These rules are absolute. Never bypass them.

1. **Never modify private key or signing logic** without explicit human approval.
2. **Never unilaterally change logic that affects investor balances** (mint, burn, transfer, distribute, claim). Always request human review.
3. **KYC/AML and transfer restriction logic** — Any refactoring of regulatory compliance logic requires explicit human confirmation before implementation.
4. **L1 chain configuration changes are highest risk** — Target-chain genesis/runtime config has broader blast radius than any contract change. Always confirm with human before modifying or reintroducing canonical L1 configuration files.

---

## 6. Tech Stack

| Component | Technology | Version |
|:---|:---|:---|
| Runtime | Node.js | 24.x LTS (NVM) |
| Package Manager | npm | 11.x |
| TypeScript | TypeScript | ^5.7.0 |
| Module System | ESM | `"type": "module"` throughout |
| Blockchain | Avalanche L1 (Subnet-EVM) | Chain ID 59823 |
| Smart Contracts | Solidity ^0.8.20, Hardhat 3 | See `contracts/CLAUDE.md` |
| Mobile App | React Native + Expo (SDK 54), TypeScript, expo-router | Active (demo) |

---

## 7. Development Workflow

### Environment Setup

```bash
nvm install 24 && nvm use 24
cp .env.example .env     # Fill in DEPLOYER_PRIVATE_KEY, RPC URLs
cd contracts && npm install
```

### Network Configuration

| Network | Chain ID | RPC Env Var |
|:---|:---|:---|
| EnergyFi L1 Testnet | 59823 | `ENERGYFI_L1_TESTNET_RPC` |

---

## 8. Key Terminology

| Term | Definition |
|:---|:---|
| **Charging station revenue** | Revenue based on settlement-completed STRIKON data only. Unsettled data is excluded from all on-chain calculations. |
| **Issuer Account Management Institution** | Under the amended Electronic Securities Act, issuers meeting capital and operational requirements may directly record and manage token securities on their own distributed ledger (Path A). If EnergyFi qualifies, EnergyFi L1 can host RegionSTO with KSD as a node. Alternatively, a securities firm serves this role (Path B / CCIP Path). |
| **CCIP (Chainlink Cross-Chain Interoperability Protocol)** | Cross-chain messaging protocol used to transmit Revenue Attestation data from EnergyFi L1 to KSD-supported chains. Validated by DTCC (US equivalent of KSD) using Avalanche + Hyperledger Besu + CCIP in 2025. Supports Risk Management Network (independent message validation), Blockchain Privacy Manager (encrypted financial data), ISO 27001 + SOC 2 certified. EnergyFi's preferred Phase 3 integration path. |
| **Revenue Attestation** | Cryptographically verifiable revenue proof transmitted via CCIP. Contains: regionId, period (start/end), distributableKrw, Merkle root of included ChargeTransaction IDs, stationCount. Enables KSD-chain RegionSTO issuance without deploying tokens on EnergyFi L1. |
| **Token holder** | STO investor holding RegionSTO tokens. Token standard and issuance location determined after Presidential Decree finalizes requirements: Path A (EnergyFi as issuer-account manager → tokens on EnergyFi L1, KSD participates as validator node), Path B (delegation to securities firm → tokens on securities firm's ledger), or CCIP Path (Revenue Attestation sent to KSD chain via CCIP, preferred). KYC/AML and compliance are the securities firm's domain. |
| **STRIKON oracle** | Internal module within STRIKON that calls EnergyFi contracts via the Bridge wallet (`onlyBridge`). |
| **Bridge wallet** | AWS KMS HSM-backed wallet. Single entry point from STRIKON to EnergyFi L1. |
| **CPO** | Charge Point Operator — third-party entity that uses STRIKON software to operate charging stations. **Off-chain STRIKON platform only.** CPOs are not registered on-chain. All on-chain stations are EnergyFi-owned. |
| **Region** | South Korean administrative division (ISO 3166-2:KR, 17 regions). The investment unit for STO tokenization. |
| **Station** | Physical charging station. All on-chain stations are EnergyFi-owned. Belongs to a region (regionId). Revenue flows 100% to the region's STO investor pool. |
| **SE signature** | TPM 2.0 Secure Element digital signature on raw metering data (P-256/secp256r1). Active from Phase 1 (platform + hardware launch simultaneously). Verified on-chain via DeviceRegistry. |
| **DeviceRegistry** | 10th contract in the architecture. Stores SE chip public keys (P-256, 64 bytes) bound to chargerId. Called by ChargeTransaction.mint() to verify every seSignature. |
| **RIP-7212** | EIP-7212 P-256 verification precompile at address(0x100). Required for DeviceRegistry SE signature verification. It must be enabled in the target L1 genesis configuration (separate approval). |
| **dMRV** | Digital Measurement, Reporting, and Verification — blockchain transparency for carbon credit verification (Verra VCS VM0038). |
| **VVB** | Validation and Verification Body — independent auditor for carbon credits. |
| **VCU** | Verified Carbon Unit — carbon credit issued by Verra after VVB verification. |
| **Essential contracts** | DeviceRegistry, StationRegistry, ChargeTransaction, and RevenueTracker — the Phase 1-2 core data pipeline. The system cannot operate without them. |
| **Derived contracts** | Optional and extended contracts, plus related helper contracts, that consume data produced by the Essential contracts. |
| **`invoice.paid`** | STRIKON event indicating payment complete. Sole trigger for `ChargeTransaction.mint()` + `RevenueTracker.recordRevenue()` (called consecutively by Bridge). |
| **Bookend signature model** | SE chip (Layer 1) + Bridge wallet (Layer 2) sign at both ends. If both match, intermediate path integrity is proven. |
| **RevenueTracker** | Phase 2 contract. Accumulates `distributableKrw` per station after each `invoice.paid`. All revenue flows to the region's STO investor pool. Source for STOPortfolio. |
| **Tranche** | Batch issuance unit for STO. Each tranche records the issuance date, token amount, and the list of EnergyFi-owned stations added. No real-time minting; issuance is periodic. |
| **ownerType** | **(Removed)** Previously a StationRegistry field (`CPO` or `ENERGYFI`). Removed because all on-chain stations are now EnergyFi-owned. CPO concept exists only in STRIKON off-chain platform. |

---

## 9. Reference Documents

| Document | Path | When to Read |
|:---|:---|:---|
| Architecture | `docs/architecture.md` | System-level understanding, data flows |
| Project Overview | `docs/project-overview.md` | Quick orientation, scope |
| Implementation Roadmap | `contracts/docs/implementation-roadmap.md` | Architecture overview, dependency graph, dual-signature model, risk registry |
| Phase 1 Spec | `contracts/docs/phase1-infra-spec.md` | Implementation guide for DeviceRegistry and StationRegistry |
| Phase 2 Spec | `contracts/docs/phase2-transaction-spec.md` | Implementation guide for ChargeTransaction and RevenueTracker |
| Phase 3 Spec | `contracts/docs/phase3-sto-spec.md` | STO issuance paths (Path A/B/CCIP) and Revenue Attestation infrastructure. Token implementation remains on hold. |
| Phase 4 Reputation Spec | `contracts/docs/phase4-reputation-spec.md` | Region-level reputation snapshot specification for Explore |
| Phase 5 Spec | `contracts/docs/phase5-carbon-spec.md` | Carbon credit pipeline implementation guide |
| ERC Standards Analysis | `contracts/docs/erc-standards-analysis.md` | ERC standard mapping, audit preparation |
| T-REX Architecture | `contracts/docs/trex-architecture.md` | Reference-only material to revisit after the issuance path is finalized |
| Interface Spec | `docs/strikon-interface-spec.md` | STRIKON ↔ EnergyFi pipeline |
| Mobile Docs | `mobile/docs/README.md` | Investor app documentation index |
| Platform Policies | `docs/platform-policies.md` | Confirmed policies P1~P6 |
| Environment Setup | `docs/environment-setup.md` | Prerequisites, toolchain |
| Local Subnet Guide | `docs/local-subnet-guide.md` | Local L1 creation, anti-patterns, troubleshooting |
| Deployment Guide | `docs/deployment-guide.md` | L1 infra, validator roadmap |

---

*End of Document*
