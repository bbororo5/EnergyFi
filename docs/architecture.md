# EnergyFi — System Architecture

> **Interactive version**: Open [`architecture-diagram.html`](architecture-diagram.html) in a browser for the full interactive diagram with hover effects.

## 1. Overview

EnergyFi employs a **4-layer architecture** on a dedicated Avalanche L1 private chain:

```
Layer 4 (Top)    : Investor Interface          — Frontend (planned reimplementation)      ← EnergyFi
Layer 3          : Avalanche L1 Private Chain   — 9 Smart Contracts (4 categories)         ← EnergyFi
Layer 2          : Platform Services            — STRIKON Platform (30+ microservices)      ← External
Layer 1 (Bottom) : Hardware Root of Trust       — TPM 2.0 SE + Embedded System              ← External
```

- **EnergyFi Scope**: Layer 3 (smart contracts + chain config) and Layer 4 (frontend). Layers 1-2 are managed by the STRIKON platform.
- **Design Principle**: Receive trusted data at the boundary (Bridge wallet + SE signature), record immutably on L1, compute deterministically, expose transparently. For business context, see [CLAUDE.md](../../CLAUDE.md).
- **STO Model**: Per-region tokenization (17 administrative regions, ISO 3166-2:KR). Station is the operational unit; region is the investment unit.

## 2. Layer Details

### 2.1 Layer 4: Investor Interface (planned)
Cross-platform application for STO investors and CPO dashboards.

| Module | Description |
|:---|:---|
| **Region Portfolio Dashboard** | Per-region token holdings, aggregated station performance |
| **Carbon Reduction Tracker** | VM0038 reduction records, VCU pipeline status |
| **Station Operations** | CPO operational metrics, reputation scores |
| **Wallet** | Wallet integration for RegionSTO token management |
| **KYC Module** | Compliance gate for onboarding |

> **Note:** The `frontend/` scaffold has been removed. The frontend will be reimplemented to align with the per-region STO model and 9-contract architecture. Frontend spec is planned for a future phase.

### 2.2 Layer 3: Avalanche L1 Private Chain — Smart Contracts (`contracts/l1/`)
9 smart contracts organized into 4 functional categories on a dedicated Avalanche L1 (zero-gas, BFT consensus).

**Category A: Physical Infrastructure Layer**

| Contract | Role | Phase |
|:---|:---|:---|
| **StationRegistry** | CPO -> Station -> Charger tree structure | June 2026 |

**Category B: Charging Data & Carbon Reduction Layer**

| Contract | Role | Phase |
|:---|:---|:---|
| **ChargeTransaction** | ERC-721 token per charging session (SE-signed) | June 2026 |
| **CarbonReduction** | VM0038 emission reduction calculation (immutable) | June 2026 |
| **ParameterRegistry** | Versioned emission factors (EFkw, AFEC, etc.) | June 2026 |

**Category C: Carbon Credit Pipeline Layer**

| Contract | Role | Phase |
|:---|:---|:---|
| **CarbonBatch** | Groups reductions into verification batches, prevents double-counting | 2027+ |
| **VCUReference** | Records Verra VCU issuance results on-chain | 2027+ |

**Category D: Investment & Operations Layer**

| Contract | Role | Phase |
|:---|:---|:---|
| **ReputationRegistry** | CPO operational quality scores (oracle pattern) | 2026 H2 |
| **STOPortfolio** | Maps investor wallets to region holdings | 2027 Jan |
| **RegionSTO** | ERC-3643 security token per region (17 regions, ISO 3166-2:KR) | 2027 Jan |

**Factory Contract:**

| Contract | Role | Phase |
|:---|:---|:---|
| **RegionSTOFactory** | Deploys RegionSTO instances per region, dynamic mintable supply | 2027 Jan |

> See [smart-contract-spec.md](../contracts/smart-contract-spec.md) for full contract specifications.

### 2.3 Layer 2: Platform Services (External — STRIKON Platform)
Off-chain services bridging physical infrastructure to on-chain state. **This layer is managed by the STRIKON platform and is outside the scope of EnergyFi.** EnergyFi provides the on-chain contracts (Layer 3) that the platform calls.

| Service | Role | Stack | Managed By |
|:---|:---|:---|:---|
| **Embedded System** | Transmits TPM 2.0 SE-signed charging data to platform | Proprietary | STRIKON Platform |
| **STRIKON Platform** | 30+ microservices, data relay, oracle pattern, operational dashboards | REST API | STRIKON Platform |
| **AI Valuation Engine (APEX)** | NPV/IRR analysis, revenue forecasting, risk scoring | Python, Claude API | STRIKON Platform (planned) |

> **Note:** The STRIKON platform handles all off-chain data relay (receiving SE-signed data from embedded systems, calling on-chain contracts). EnergyFi's scope is limited to smart contracts, chain configuration, and frontend.

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
| **EVM Compatible** | Supports ERC-20, ERC-721, ERC-1155, ERC-3643 standards |
| **Cross-chain** | Avalanche Warp Messaging (AWM) for future public chain connectivity |

See [smart-contract-spec.md](../contracts/smart-contract-spec.md) for the full 9-contract specification.

## 3. Cross-Chain Communication (Future)

### 3.1 Avalanche Warp Messaging (AWM)
- **Direction**: L1 Private Chain → Avalanche C-Chain (public)
- **Purpose**: State anchoring for data integrity verification; future public market VCU trading.
- **Phase**: Launch phase uses public chain anchoring for pre-production data integrity. Full cross-chain bridge planned for Phase 4.

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

### 4.2 Investment Pipeline
```
  StationRegistry (CPO → Station → Charger tree)
        │
        ├── ChargeTransaction (revenue data)
        ├── CarbonReduction (reduction data)
        ├── ReputationRegistry (CPO quality scores)
        │
        ▼
  STOPortfolio (region-level aggregated investor view)
        │
        ▼
  RegionSTO (ERC-3643, per-region token via RegionSTOFactory)
        │
        ▼
  Securities Firm Platform (dividend calculation & execution)
```

> See [implementation-roadmap.md](../contracts/implementation-roadmap.md) for the phased implementation roadmap.

## 5. Technology Stack

| Component | Technology | Description |
|:---|:---|:---|
| **Smart Contracts** | Solidity ^0.8.20, Hardhat 3 | 9 contracts across 4 categories on L1 |
| **L1 Runtime** | Avalanche L1 (Subnet-EVM) | Private chain, zero-gas, BFT consensus |
| **Hardware Security** | TPM 2.0 SE | Company-specified secure element for Root of Trust |
| **Data Source** | STRIKON Platform | 30+ microservice production platform |
| **AI Engine** | Python, Claude API | Asset valuation (APEX), risk scoring (planned) |
| **Frontend** | TBD | Will be reimplemented for per-region STO model |

## 6. Trust Chain — Multi-Layer Signature & On-Chain Verification

### 6.1 데이터 의존성 구조

ChargeTransaction은 온체인 데이터 그래프의 **루트**이다. 모든 파생 컨트랙트가 이 데이터에 의존한다.

```
ChargeTransaction (root)
    ├── CarbonReduction → CarbonBatch → VCUReference   (탄소 파이프라인)
    └── STOPortfolio → RegionSTO                        (투자 파이프라인)
```

ChargeTransaction 데이터의 무결성이 전체 시스템 신뢰의 전제 조건이므로, **Layer 1~4 전체에서 서명·검증**이 필요하다. 비즈니스 맥락은 [CLAUDE.md §2](../../CLAUDE.md)를 참조.

### 6.2 Bookend Signature Model

Layer 1(SE 칩)과 Layer 2(Bridge 지갑)가 데이터 경로의 **양 끝(bookend)**을 서명한다. 중간 레이어 각각에 별도 서명을 넣지 않아도, 양 끝의 서명 데이터가 일치하면 전체 경로의 무결성이 보장된다.

```
[Layer 1: SE]──kWh,ts──→[L2: Platform]──→[L3: On-Chain]──→[L4: Frontend]
  서명 생성               전달              검증             투명성

SE 서명 원본 데이터  vs  온체인 ChargeSession 데이터  → 일치 시 중간 경로 무결성 증명
```

### 6.3 레이어별 서명·검증

| Layer | 서명 주체 | 검증 방법 | 보장 |
|:---|:---|:---|:---|
| **L1 HW** | TPM 2.0 SE 칩 | `ecrecover` / P-256 precompile | 물리 측정값의 출처 증명 — 데이터가 특정 물리 장치에서 생성되었음을 암호학적으로 보장 |
| **L2 Platform** | Bridge Wallet (AWS KMS) | `onlyBridge` (`msg.sender` 검증) | 인가된 파이프라인만 온체인 기록 — 결제 완료(P1)된 건만 DERA 검증을 통과하여 기록 |
| **L3 On-Chain** | — | SE 서명 vs ChargeSession 데이터 비교 | 중간 변조 부재 — 양 끝 데이터 일치로 전체 경로 무결성 증명 |
| **L4 Frontend** | — | 온체인 데이터 직접 조회 | 투자자 투명성 — STO 투자자·VVB 감사관이 데이터를 직접 확인 |

### 6.4 Phase별 신뢰 진화 (요약)

| Phase | 시점 | L1 (HW) | L2 (Platform) | 온체인 검증 |
|:---|:---|:---|:---|:---|
| **1** | ~2026.05 | 비활성 (`seSignature = 0x`) | `onlyBridge` + 결제 완료 게이트 | DERA 이상치 탐지 + Bridge 권한 제어 |
| **2** | 2026.06~ | SE 서명 저장 (검증은 off-chain) | 동일 | VVB가 off-chain에서 SE 서명 검증 가능 |
| **3+** | 2027.01~ | SE 서명 온체인 검증 | 동일 | 컨트랙트가 SE 서명 직접 검증 (P-256 precompile). 완전한 HW→온체인 Chain of Trust |

> **상세**: [implementation-roadmap.md §1 — 이중 서명 신뢰 모델](../contracts/implementation-roadmap.md#1-이중-서명-신뢰-모델)

### 6.5 Security Considerations

| Concern | Approach |
|:---|:---|
| **Hardware Root of Trust** | TPM 2.0 SE chip signs data at physical measurement point. Company specifies chip model to manufacturers. |
| **Private keys** | Never committed. `.env` (local) or KMS (production). |
| **Chain reliability** | Multi-party validator: company nodes + financial institution + professional node operators. |
| **Data immutability** | CarbonReduction deployed as immutable contract. New methodology versions get new contract deployments. |
| **L1 permissioning** | Only whitelisted validators; IoT gateways authorized via DeviceRegistry. |
| **Transfer compliance** | RegionSTO implements ERC-3643 (T-REX) with on-chain identity verification and modular compliance rules. ERC-3643 sub-contract interfaces defined in Phase 1; full implementation with securities firm in Phase 2~3. |