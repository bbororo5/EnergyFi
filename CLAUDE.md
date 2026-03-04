# EnergyFi — CLAUDE.md

<!-- Contract-specific details (smart contract map, Hardhat config, ERC standards) are in contracts/l1/CLAUDE.md -->

Agent instructions for the EnergyFi codebase. All technical decisions must align with this document.

---

## 1. Mission Statement

**Project**: EnergyFi — Blockchain protocol for tokenizing EV charging infrastructure revenue as RWA (Real World Asset).

**Problem**: Apartment complex EV charging station revenue is concentrated in operators; retail investors have no access to this asset class.

**Solution**: Issue per-region Security Token Offerings (STO) on Avalanche L1 so apartment residents and small investors can fractionally own charging infrastructure and receive revenue distributions.

**Target users**: Apartment-resident small investors, charging station operators (CPOs).

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
- EnergyFi repo scope: smart contracts (`contracts/l1/`) + L1 chain config (`l1-config/`) + investor frontend (`frontend/`, planned).
- Data flow: SE chip signature → Embedded System → STRIKON → Bridge wallet → On-chain `ChargeTransaction.mint()` → `DeviceRegistry.verifySignature()`.
- Trust model: Bookend Signature — SE chip signs at origin (P-256), Bridge wallet signs on-chain TX. DeviceRegistry verifies the SE signature on every mint(). Both match = path integrity verified.
- SE chip public keys are pre-enrolled in DeviceRegistry before charger launch. From Phase 1, all charging sessions carry real SE signatures.

---

## 4. Project Structure

```
EnergyFi/
├── contracts/l1/       # Avalanche L1 smart contracts (Hardhat 3, ESM)
│   └── docs/           # Contract-specific docs (spec, roadmap, ERC analysis)
├── l1-config/          # L1 chain configuration (genesis.json, config.json)
├── frontend/           # Investor app (React Native + Expo)
│   └── docs/           # Frontend-specific docs (design, screenshots)
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
| L1 Infrastructure | `l1-config/` | Avalanche-CLI / AvaCloud | Active |
| L1 Smart Contracts | `contracts/l1/` | Solidity ^0.8.20, Hardhat 3 | Active |
| Frontend | `frontend/` | React Native + Expo, TypeScript | Planned |

---

## 5. Non-Negotiables

These rules are absolute. Never bypass them.

1. **Never modify private key or signing logic** without explicit human approval.
2. **Never unilaterally change logic that affects investor balances** (mint, burn, transfer, distribute, claim). Always request human review.
3. **KYC/AML and transfer restriction logic** — Any refactoring of regulatory compliance logic requires explicit human confirmation before implementation.
4. **`l1-config/` changes are highest risk** — L1 chain configuration has broader blast radius than any contract change. Always confirm with human before modifying `genesis.json` or `config.json`.

---

## 6. Tech Stack

| Component | Technology | Version |
|:---|:---|:---|
| Runtime | Node.js | 24.x LTS (NVM) |
| Package Manager | npm | 11.x |
| TypeScript | TypeScript | ^5.7.0 |
| Module System | ESM | `"type": "module"` throughout |
| Blockchain | Avalanche L1 (Subnet-EVM) | Chain ID 270626 |
| Smart Contracts | Solidity ^0.8.20, Hardhat 3 | See `contracts/l1/CLAUDE.md` |
| Frontend | React Native + Expo (SDK 54), TypeScript, expo-router | TBD (planned) |

---

## 7. Development Workflow

### Environment Setup

```bash
nvm install 24 && nvm use 24
cp .env.example .env     # Fill in DEPLOYER_PRIVATE_KEY, RPC URLs
cd contracts/l1 && npm install
```

### Network Configuration

| Network | Chain ID | RPC Env Var |
|:---|:---|:---|
| EnergyFi L1 Testnet | 270626 | `ENERGYFI_L1_TESTNET_RPC` |
| EnergyFi L1 Mainnet | 270626 | `ENERGYFI_L1_MAINNET_RPC` |
| Avalanche Fuji C-Chain | 43113 | `AVAX_CCHAIN_RPC` |

---

## 8. Key Terminology

| Term | Definition |
|:---|:---|
| **Charging station revenue** | Revenue based on settlement-completed STRIKON data only. Unsettled data is excluded from all on-chain calculations. |
| **발행인계좌관리기관** | Issuer Account Management Institution. Under the amended Electronic Securities Act, issuers meeting capital/operational requirements may directly record and manage token securities on their own distributed ledger (Path A). If EnergyFi qualifies, EnergyFi L1 hosts RegionSTO with KSD as a node. Alternatively, a securities firm serves this role (Path B / CCIP Path). |
| **CCIP (Chainlink Cross-Chain Interoperability Protocol)** | Cross-chain messaging protocol used to transmit Revenue Attestation data from EnergyFi L1 to KSD-supported chains. Validated by DTCC (US equivalent of KSD) using Avalanche + Hyperledger Besu + CCIP in 2025. Supports Risk Management Network (independent message validation), Blockchain Privacy Manager (encrypted financial data), ISO 27001 + SOC 2 certified. EnergyFi's preferred Phase 3 integration path. |
| **Revenue Attestation** | Cryptographically verifiable revenue proof transmitted via CCIP. Contains: regionId, period (start/end), distributableKrw, Merkle root of included ChargeTransaction IDs, stationCount. Enables KSD-chain RegionSTO issuance without deploying tokens on EnergyFi L1. |
| **Token holder** | STO investor holding RegionSTO tokens. Token standard and issuance location determined after Presidential Decree finalizes requirements: Path A (EnergyFi as issuer-account manager → tokens on EnergyFi L1, KSD participates as validator node), Path B (delegation to securities firm → tokens on securities firm's ledger), or CCIP Path (Revenue Attestation sent to KSD chain via CCIP, preferred). KYC/AML and compliance are the securities firm's domain. |
| **STRIKON oracle** | Internal module within STRIKON that calls EnergyFi contracts via the Bridge wallet (`onlyBridge`). |
| **Bridge wallet** | AWS KMS HSM-backed wallet. Single entry point from STRIKON to EnergyFi L1. |
| **CPO** | Charge Point Operator — owns and operates charging stations. Registered in StationRegistry. |
| **Region** | South Korean administrative division (ISO 3166-2:KR, 17 regions). The investment unit for STO tokenization. |
| **Station** | Physical charging station. Belongs to a CPO (or EnergyFi directly) and a region. ownerType determines revenue routing: CPO-owned → CPO; EnergyFi-owned → STO investor pool. |
| **SE signature** | TPM 2.0 Secure Element digital signature on raw metering data (P-256/secp256r1). Active from Phase 1 (platform + hardware launch simultaneously). Verified on-chain via DeviceRegistry. |
| **DeviceRegistry** | 10th contract in the architecture. Stores SE chip public keys (P-256, 64 bytes) bound to chargerId. Called by ChargeTransaction.mint() to verify every seSignature. |
| **RIP-7212** | EIP-7212 P-256 verification precompile at address(0x100). Required for DeviceRegistry SE signature verification. Must be enabled in l1-config/genesis.json (separate approval). |
| **dMRV** | Digital Measurement, Reporting, and Verification — blockchain transparency for carbon credit verification (Verra VCS VM0038). |
| **VVB** | Validation and Verification Body — independent auditor for carbon credits. |
| **VCU** | Verified Carbon Unit — carbon credit issued by Verra after VVB verification. |
| **Essential contracts** | DeviceRegistry, StationRegistry, ChargeTransaction, RevenueTracker — Phase 1-2 핵심 데이터 파이프라인. 이들 없이는 시스템 동작 불가. |
| **Derived contracts** | All other 8 contracts — consume data produced by Essential contracts. |
| **`invoice.paid`** | STRIKON event indicating payment complete. Sole trigger for `ChargeTransaction.mint()` + `RevenueTracker.recordRevenue()` (called consecutively by Bridge). |
| **Bookend signature model** | SE chip (Layer 1) + Bridge wallet (Layer 2) sign at both ends. If both match, intermediate path integrity is proven. |
| **RevenueTracker** | Phase 2 contract. Accumulates `distributableKrw` per station after each `invoice.paid`. Distinguishes CPO-owned vs EnergyFi-owned revenue. Source for STOPortfolio. |
| **Tranche (차수)** | Batch issuance unit for STO. Each Tranche records issuance date, token amount, and the list of EnergyFi-owned stations added. No real-time minting; issuance is periodic. |
| **ownerType** | StationRegistry field: `CPO` or `ENERGYFI`. Determines whether station revenue flows to CPO or STO investor pool. |

---

## 9. Reference Documents

| Document | Path | When to Read |
|:---|:---|:---|
| Architecture | `docs/architecture.md` | System-level understanding, data flows |
| Project Overview | `docs/project-overview.md` | Quick orientation, scope |
| Implementation Roadmap | `contracts/l1/docs/implementation-roadmap.md` | Architecture overview, dependency graph, dual-signature model, risk registry |
| Phase 1 Spec | `contracts/l1/docs/phase1-infra-spec.md` | DeviceRegistry + StationRegistry 구현 가이드 |
| Phase 2 Spec | `contracts/l1/docs/phase2-transaction-spec.md` | ChargeTransaction + RevenueTracker 구현 가이드 |
| Phase 3 Spec | `contracts/l1/docs/phase3-sto-spec.md` | STO 발행 경로(Path A/B) + Revenue Attestation 인프라. 토큰 구현 보류 |
| Phase 4 Spec | `contracts/l1/docs/phase4-carbon-spec.md` | 탄소배출권 파이프라인 구현 가이드 |
| ERC Standards Analysis | `contracts/l1/docs/erc-standards-analysis.md` | ERC standard mapping, audit preparation |
| T-REX Architecture | `contracts/l1/docs/trex-architecture.md` | 참고용 (발행 경로 확정 후 재검토) |
| Interface Spec | `docs/strikon-interface-spec.md` | STRIKON ↔ EnergyFi pipeline |
| Frontend Design | `frontend/docs/flutter-design.md` | Investor app design, screens |
| Platform Policies | `docs/platform-policies.md` | Confirmed policies P1~P5 |
| Environment Setup | `docs/environment-setup.md` | Prerequisites, toolchain |
| Deployment Guide | `docs/deployment-guide.md` | L1 infra, validator roadmap |

---

*End of Document*
