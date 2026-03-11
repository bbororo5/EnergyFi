# Platform Team Questions & Confirmed Policies

> This document tracks confirmed policies and pending questions agreed with the STRIKON platform team.
> For on-chain design decisions, see [implementation-roadmap.md](../contracts/docs/implementation-roadmap.md).

## Confirmed Policies

| # | Policy | Status | Design Impact |
|:---|:---|:---|:---|
| **P1** | Only settlement-complete records are written on-chain (`invoice.paid`) | Confirmed | `ChargeTransaction.mint()` is triggered only from the `invoice.paid` event. Failed payments and DERA anomaly cases are never submitted to the blockchain. |
| **P2** | Two contract writes occur at the `invoice.paid` point | Confirmed | `invoice.paid` → Bridge → `ChargeRouter.processCharge()` → `ChargeTransaction.mint()` + `RevenueTracker.recordRevenue()` in a single transaction with EVM atomicity. ChargeRouter is already implemented. |
| **P3** | RegionSTO token standard remains undecided | On hold | Decided after the issuance path (CCIP Path / Path A / Path B) and Presidential Decree details are finalized. ERC-3643 / T-REX is reference-only for now. |
| **P4** | Real SE-chip signatures are active from Phase 1 | Confirmed (design change on 2026-03) | The platform and chargers launch together. SE public keys are pre-enrolled in DeviceRegistry before ChargeTransaction deployment. The old `seSignature = 0x` assumption is retired. |
| **P5** | CarbonReduction performs on-chain internal calculation (no external oracle) | Confirmed | CarbonReduction applies the VM0038 formula using only ChargeTransaction data and ParameterRegistry parameters. |
| **P6** | Recommended Phase 3 issuance path: CCIP Path | Recommended (path still unfinalized) | EnergyFi L1 (Avalanche) → Chainlink CCIP → KSD-supported chain for Revenue Attestation. No issuer-account-manager qualification required. Based on the DTCC Avalanche + Besu + CCIP validation in 2025. CCIPRevenueSender starts after the KSD-supported chain is confirmed. |

## Pending Questions

### STRIKON Interface

| # | Question | Current Status | Impact |
|:---|:---|:---|:---|
| Q1 | Timeline for including `se_signature` in the `invoice.paid` payload | Implemented | The `ChargeSession.seSignature` field is confirmed. `mint()` verifies it through `DeviceRegistry.verifySignature()` and preserves it only in the `ChargeSessionRecorded` event, not in storage, for off-chain audit use. |
| Q2 | `charger_id` UUID → bytes32 encoding rule | Implemented | Remove the prefix, remove hyphens, then convert to hex bytes32 (upper 16 bytes used, lower 16 bytes zero-padded). The Bridge owns this transformation responsibility. |
| Q3 | Whether the Bridge can call both contracts (ChargeTransaction + RevenueTracker) in sequence | Implemented | ChargeRouter is implemented. The Bridge calls only ChargeRouter, and ChargeRouter handles both writes atomically in one transaction. |

### Open Phase 3 Items

| # | Item | Current Status |
|:---|:---|:---|
| KSD-supported chain stack | Chain that will host the CCIP Receiver (such as Hyperledger Besu) | Unconfirmed |
| Secondary market partner | Choice among KDX / NXT consortium / Lucentblock | Undecided |
| Presidential Decree details | Capital and operational requirements for issuer-account-manager status | Unconfirmed |
| Securities-firm partnership | Securities firm responsible for KYC/AML and dividend execution | Not established |
