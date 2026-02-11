# EnergyFi — Oracle Relay Service Specification

## 1. Overview

The Oracle Relay is a **persistent TypeScript daemon** (Unit D) that bridges off-chain data from the STRIKON platform and APEX Engine to on-chain smart contracts on both the C-Chain and Wingside Subnet.

| Property | Value |
|:---|:---|
| **Path** | `services/oracle-relay/` |
| **Language** | TypeScript (CJS) |
| **Runtime** | Node.js 24.x LTS |
| **Key Dependency** | ethers.js ^6.14.0, axios |

## 2. Architecture

```
┌──────────────────┐     ┌──────────────────┐
│  STRIKON API     │     │  APEX Engine     │
│  (Production)    │     │  (AI Valuation)  │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         └────────┬───────────────┘
                  │  REST / JSON
                  ▼
         ┌────────────────────┐
         │   Oracle Relay     │
         │   (TypeScript)     │
         │                    │
         │   Polling Loop     │
         │   60s interval     │
         └──┬─────────────┬───┘
            │             │
   ethers.js│    ethers.js│
            ▼             ▼
   ┌─────────────┐  ┌──────────────┐
   │  C-Chain     │  │  Subnet      │
   │EnergyOracle  │  │AssetLogger   │
   │.submitReport │  │.logEvent     │
   └─────────────┘  └──────────────┘
```

## 3. Data Flow

| Step | Action | Target |
|:---|:---|:---|
| 1 | Poll APEX Engine API (or mock data) | External |
| 2 | Compute `contentHash` = keccak256(JSON report) | Local |
| 3 | Call `EnergyOracle.submitReport(kwh, usd, hash)` | C-Chain |
| 4 | Call `AssetLogger.logEvent(assetId, hash)` | Subnet |

## 4. Configuration

| Env Variable | Purpose |
|:---|:---|
| `ORACLE_RELAYER_KEY` | Private key for signing transactions |
| `AVAX_CCHAIN_RPC` | C-Chain JSON-RPC endpoint |
| `WINGSIDE_SUBNET_RPC` | Subnet JSON-RPC endpoint |
| `ENERGY_ORACLE_ADDRESS` | Deployed EnergyOracle contract address |
| `ASSET_LOGGER_ADDRESS` | Deployed AssetLogger contract address |
| `APEX_API_URL` | APEX Engine endpoint (empty = mock mode) |

## 5. Mock Mode

When `APEX_API_URL` is not set, the relay generates realistic mock data:

```json
{
  "totalGenerationKwh": 7421,
  "totalRevenueUsd": 3200,
  "assetCount": 42,
  "timestamp": "2026-02-10T12:00:00.000Z"
}
```

This enables full end-to-end testing without external dependencies.

## 6. Files

| File | Purpose |
|:---|:---|
| `index.ts` | Main entry point, polling loop, contract interactions |
| `api.ts` | APEX Engine API client (with mock fallback) — planned |
| `abi/` | Contract ABI files — planned |
| `tsconfig.json` | TypeScript configuration (CJS, es2020) |
| `package.json` | Dependencies and npm scripts |

## 7. Running

```bash
cd services/oracle-relay
npm install
npm run start       # Development (ts-node)
npm run build       # Compile to JS (tsc → dist/)
node dist/index.js  # Production
```

## 8. Production Considerations

| Concern | Current (MVP) | Production |
|:---|:---|:---|
| **Relayer key** | Single private key in `.env` | Multi-sig wallet or KMS |
| **Oracle pattern** | Self-hosted relay daemon | Chainlink Functions or multi-relayer |
| **Rate limiting** | None | Exponential backoff with jitter |
| **Health monitoring** | Console logs | Health check endpoint + alerting |
| **Data verification** | contentHash only | BLS signature + multi-source consensus |
