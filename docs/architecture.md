# EnergyFi — System Architecture

> This document is the top-level architecture narrative for the current repository snapshot. For contract-layer authority, prioritize [`../contracts/docs/README.md`](../contracts/docs/README.md) and the phase specs it indexes.

## 1. Overview

EnergyFi currently spans four practical layers:

```text
Layer 4 (Top)    : Investor Surfaces           — Mobile app (`mobile/`) + admin demo routes
Layer 3          : EnergyFi Blockchain Layer   — Avalanche L1 contract surface in `contracts/`
Layer 2          : STRIKON Platform            — External settlement and relay services
Layer 1 (Bottom) : Hardware Root of Trust      — TPM 2.0 SE + charger embedded system
```

- **Repository scope**: Layer 3 smart contracts and Layer 4 client surfaces.
- **External scope**: Layer 1 hardware and Layer 2 STRIKON platform operations.
- **Core principle**: trusted charging data enters through the Bridge path, is validated against enrolled SE-chip keys, and is stored as immutable on-chain evidence plus deterministic revenue aggregates.

## 2. Current Implemented Surface

### 2.1 Layer 4: Investor Surfaces (`mobile/`)

The repository contains two distinct frontend surfaces:

| Surface | Current role |
|:---|:---|
| **Investor app** | Read-oriented mobile/web client for Home, Explore, Analytics, and Portfolio views |
| **Admin demo routes** | Demo/operator flows such as wallet-connected oracle controls under `mobile/app/admin/` |

Current mobile behavior:

- investor flows are read-first and partner-handoff oriented
- KYC/AML, subscription, and payout execution remain outside EnergyFi
- wallet connection exists in the admin demo surface, not as the primary investor onboarding pattern

Mobile document authority starts at [`../mobile/docs/README.md`](../mobile/docs/README.md).

### 2.2 Layer 3: Smart Contracts (`contracts/`)

The current implemented contract surface is:

| Category | Contract | Status | Notes |
|:---|:---|:---|:---|
| Infra | **DeviceRegistry** | Implemented | Enrolls charger chip public keys and verifies SE signatures |
| Infra | **StationRegistry** | Implemented | Maintains station -> charger hierarchy and region grouping |
| Core write path | **ChargeRouter** | Implemented | Sole Bridge entry for atomic mint + revenue record flow |
| Core evidence | **ChargeTransaction** | Implemented | Soulbound ERC-721 session record per settled charge |
| Finance | **RevenueTracker** | Implemented | Accumulates station revenue and region settlement views |
| Operations | **ReputationRegistry** | Implemented | Region-level snapshot registry for Explore/analytics surfaces |
| STO prototype | **RegionSTO** | Implemented prototype | ERC-20-based prototype, policy still on hold |
| STO prototype | **RegionSTOFactory** | Implemented | Deploys RegionSTO instances when needed for demo/prototype flows |

Deployed repo-managed testnet addresses live in [`../contracts/deployments.json`](../contracts/deployments.json).

### 2.3 Layer 2: STRIKON Platform (External)

STRIKON is the off-chain operating platform. From EnergyFi's perspective it is a trusted external caller through the Bridge path.

| External component | Role |
|:---|:---|
| **Embedded system** | Relays hardware-signed charger data upward |
| **Settlement/payment services** | Determine when `invoice.paid` is emitted |
| **Bridge/oracle path** | Converts platform data into the on-chain call to `ChargeRouter.processCharge()` |

The interface boundary is documented in [`strikon-interface-spec.md`](strikon-interface-spec.md).

### 2.4 Layer 1: Hardware Root of Trust (External)

- TPM 2.0 SE chip signs charging-session source data at origin
- charger embedded systems preserve and relay that signature upstream
- enrolled public keys are stored in `DeviceRegistry`
- on-chain minting reverts if the submitted signature does not validate for the enrolled chip

## 3. Current On-Chain Data Flow

The live write path exercised by tests, scripts, and deployments is:

```text
TPM 2.0 SE signature
  -> STRIKON settlement path
  -> Bridge wallet / Bridge-controlled caller
  -> ChargeRouter.processCharge(session, period)
       -> ChargeTransaction.mint(session)
            -> DeviceRegistry.verifySignature(...)
            -> StationRegistry.isRegistered(...)
       -> RevenueTracker.recordRevenue(stationId, distributableKrw, period)
```

### 3.1 Atomic write path

`ChargeRouter` is the write-path coordinator.

- the Bridge calls `ChargeRouter`, not `ChargeTransaction` and `RevenueTracker` separately
- if minting fails, revenue recording does not persist
- if revenue recording fails, the session mint does not persist

This atomicity is part of the current implementation, not a future design note.

### 3.2 Session evidence model

`ChargeTransaction` records one token per settled session.

- token uniqueness is modeled with ERC-721
- tokens are minted to `address(this)`
- transfers are blocked after mint
- the submitted `seSignature` is verified during mint and emitted in `ChargeSessionRecorded`
- the signature is not retained in storage after verification

That last point matters: current on-chain integrity comes from verification-at-ingest plus emitted audit evidence, not from persistent signature re-checking against stored session state.

### 3.3 Revenue aggregation model

`RevenueTracker` accumulates:

- total revenue per station
- pending vs settled revenue per station
- monthly history per station
- region-level pending totals
- region-level finalized settlement attestations for Phase 3-oriented read flows

`RevenueTracker` is already wider than a simple counter. It contains the region attestation primitives that later planning documents build on.

## 4. Trust Chain

EnergyFi uses a bookend trust model.

| Layer | Current mechanism | What it proves |
|:---|:---|:---|
| **L1 Hardware** | SE chip signature | data originated from the enrolled physical charger path |
| **L2 Platform** | Bridge-controlled submission path | an authorized off-chain relay submitted the record |
| **L3 On-chain** | signature verification + station/chip checks during mint | invalid or mismatched records cannot enter the dataset |
| **L4 Frontend** | direct reads from contract state/events | investors and reviewers can inspect published evidence |

This means EnergyFi does not need to trust every intermediate service independently. It trusts the enrolled hardware root and the authorized submission boundary, then rejects invalid writes on-chain.

## 5. Planned Surface Not Yet Implemented

The following items appear in planning documents but are not implemented as contracts in this repository snapshot:

| Planned item | Planning source | Notes |
|:---|:---|:---|
| **CCIPRevenueSender** | Phase 3 spec | Planned only; depends on issuance-path and partner-chain decisions |
| **STOPortfolio** | Phase 3 planning references | Not implemented in contracts; portfolio UX currently uses demo/read overlays |
| **ParameterRegistry** | Phase 5 spec | Planned only |
| **CarbonReduction** | Phase 5 spec | Planned only |
| **CarbonBatch** | Phase 5 spec | Planned only |
| **VCUReference** | Phase 5 spec | Planned only |

These should be treated as future design surfaces, not part of the current deployed contract graph.

## 6. Document Authority

- For current contract behavior: [`../contracts/docs/phase1-infra-spec.md`](../contracts/docs/phase1-infra-spec.md), [`../contracts/docs/phase2-transaction-spec.md`](../contracts/docs/phase2-transaction-spec.md), [`../contracts/docs/phase4-reputation-spec.md`](../contracts/docs/phase4-reputation-spec.md)
- For contract planning and dependency order: [`../contracts/docs/implementation-roadmap.md`](../contracts/docs/implementation-roadmap.md)
- For future STO path design: [`../contracts/docs/phase3-sto-spec.md`](../contracts/docs/phase3-sto-spec.md)
- For future carbon pipeline design: [`../contracts/docs/phase5-carbon-spec.md`](../contracts/docs/phase5-carbon-spec.md)
- For mobile UX and data-consumption docs: [`../mobile/docs/README.md`](../mobile/docs/README.md)
