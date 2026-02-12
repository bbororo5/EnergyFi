# EnergyFi — Token Lifecycle

## 1. Overview

This document traces the complete lifecycle of an energy asset — from real-world charging station data to investor yield claim. Each stage maps to a specific component in the system architecture.

## 2. Lifecycle Stages

### Stage 1: Data Ingest
**Source**: STRIKON Platform (30+ microservices)

Real-time EV charging station data is collected:
- kWh dispensed per session
- Revenue generated (USD/KRW)
- Station uptime percentage
- Session count
- Grid electricity price

> For the hackathon MVP, realistic mock JSON data simulates this feed.

### Stage 2: AI Valuation
**Service**: APEX Engine (Python, Claude API)

The AI engine analyzes raw data to produce:

| Metric | Description |
|:---|:---|
| **NPV** | Net Present Value of the charging station |
| **IRR** | Internal Rate of Return |
| **Risk Score** | Risk rating (1–10) |
| **Price Recommendation** | Fair price for the STO token |
| **Revenue Forecast** | Projected monthly/annual revenue |

### Stage 3: Oracle Update
**Service**: Oracle Relay (TypeScript daemon)

Validated metrics are pushed on-chain:
1. `EnergyOracle.submitReport(kwh, usd, contentHash)` → **C-Chain**
2. `AssetLogger.logEvent(assetId, contentHash)` → **Subnet**

The `contentHash` is `keccak256(JSON.stringify(report))`, enabling off-chain data verification.

### Stage 4: Tokenization
**Contract**: EnergyToken.sol (C-Chain)

Energy assets are minted as ERC-20 STO tokens:
- Only whitelisted (KYC-verified) addresses can hold tokens.
- `owner` mints tokens representing fractional station ownership.
- Transfer restrictions enforced via `_update()` override.
- Token supply corresponds to asset valuation from Stage 2.

### Stage 5: P2P Trading (Phase 2)
**Contract**: EnergyDEX.sol (C-Chain)

KYC-verified users trade tokens peer-to-peer:
- Limit orders (buy/sell) with USDC pairs.
- Atomic settlement on match.
- Compliance check before every trade (via IdentityRegistry).

### Stage 6: Revenue Distribution
**Contract**: RevenueVault.sol (C-Chain)

Charging station revenue flows to token holders:
1. Revenue deposited into vault (native AVAX or stablecoin).
2. Owner calls `allocate()` to assign claimable amounts proportional to holdings.
3. Pull-payment pattern minimizes gas costs for the protocol.

### Stage 7: Yield Claim
**App**: Flutter Mobile App

Investors use the mobile app to:
- View accumulated yield in the dashboard.
- Execute `claim()` transaction via WalletConnect.
- Track historical yield payments and returns.

## 3. Flow Diagram

```
  ① STRIKON API (Real Data / Mock JSON)
          │
          ▼
  ② APEX Engine ──── AI Valuation (NPV, IRR, Risk Score)
          │
          ▼
  ③ Oracle Relay ──── submitReport() → C-Chain EnergyOracle
          │                logEvent()  → Subnet AssetLogger
          ▼
  ④ EnergyToken ──── mint() STO tokens (whitelist-gated)
          │
          ▼
  ⑤ EnergyDEX ────── P2P buy/sell orders (Phase 2)
          │
          ▼
  ⑥ RevenueVault ─── allocate() revenue to token holders
          │
          ▼
  ⑦ Flutter App ──── claim() yield via WalletConnect
```

## 4. On-Chain Verification

Every data point pushed by the Oracle Relay includes a `contentHash`:

```
contentHash = keccak256(JSON.stringify(report))
```

Anyone can verify the integrity of off-chain data by:
1. Fetching the original JSON report from the STRIKON API or Oracle logs.
2. Computing `keccak256(JSON.stringify(report))`.
3. Comparing with the on-chain value stored in `EnergyOracle.latestReport.contentHash`.

This provides a **tamper-evident audit trail** linking physical asset performance to on-chain state.

## 5. Phase Mapping

| Lifecycle Stage | Phase 1 (MVP) | Phase 2 | Phase 3 |
|:---|:---|:---|:---|
| Data Ingest | Mock JSON | STRIKON API | Real-time WebSocket |
| AI Valuation | Simplified NPV | Full APEX Engine | Multi-model ensemble |
| Oracle Update | Single relayer | Multi-relayer | Chainlink Functions |
| Tokenization | Whitelist-gated ERC-20 | Full ERC-3643 + Compliance | Cross-chain tokens |
| P2P Trading | — | EnergyDEX order book | AMM pool |
| Revenue Distribution | Manual allocate() | Automated on Oracle trigger | Streaming payments |
| Yield Claim | Manual claim() | Auto-compound option | Cross-chain claim |
