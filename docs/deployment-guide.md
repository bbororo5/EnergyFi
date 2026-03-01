# EnergyFi — Deployment Guide

This document covers the deployment units, their execution procedures, and the phased infrastructure roadmap.

## 1. Deployment Units

| Unit | Name | Path | Stack | Depends On | Status |
|:---|:---|:---|:---|:---|:---|
| **A** | L1 Infrastructure | `l1-config/` | Avalanche-CLI / AvaCloud | AvalancheGo node | Active |
| **B** | L1 Smart Contracts | `contracts/l1/` | Solidity, Hardhat 3 | **Unit A** running | Active |
| **C** | Frontend | `frontend/` | TBD | **Unit B** deployed | Planned |

> **Note:** Off-chain services (data relay, oracle pattern) are managed by the STRIKON platform and are outside the scope of this repository.

## 2. Prerequisites

### 2.1 Environment Variables
```bash
cp .env.example .env
# Fill in:
#   DEPLOYER_PRIVATE_KEY        — wallet for contract deployment
#   ENERGYFI_L1_TESTNET_RPC     — Testnet RPC (after Unit A)
#   ENERGYFI_L1_MAINNET_RPC     — Mainnet RPC (Production phase)
```

### 2.2 Install Dependencies
```bash
cd contracts/l1 && npm install
```

## 3. [Unit A] L1 Infrastructure

### 3.1 Phase Overview

EnergyFi L1 infrastructure progresses through 3 phases. All phases use the same `genesis.json` (Chain ID 270626, zero-gas). Only the RPC URL and infrastructure provider differ.

| Phase | Environment | Infrastructure | Validators | `.env` Variable | Deploy Command |
|:---|:---|:---|:---|:---|:---|
| **Development** | Testnet (Fuji) | Avalanche-CLI | CLI-managed | `ENERGYFI_L1_TESTNET_RPC` | `npm run deploy:testnet` |
| **Hackathon** | Testnet (Fuji) | AvaCloud Testnet Starter | AvaCloud 2 nodes | `ENERGYFI_L1_TESTNET_RPC` | `npm run deploy:testnet` |
| **Production** | Mainnet | AvaCloud Mainnet | Self-managed + External | `ENERGYFI_L1_MAINNET_RPC` | `npm run deploy:mainnet` |

> **Testnet → Mainnet transition:** Change `.env` RPC URL from `ENERGYFI_L1_TESTNET_RPC` to `ENERGYFI_L1_MAINNET_RPC` and redeploy contracts with `npm run deploy:mainnet`.

### 3.2 Phase 1: Development (Avalanche-CLI + Fuji)

Local development using Avalanche-CLI to create and manage the L1 on Fuji testnet.

```bash
# Ensure Fuji AVAX is available (see docs/03_Environment_Setup.md)

# Create L1 from genesis config
avalanche blockchain create energyfi-l1 --genesis l1-config/genesis.json

# Deploy to Fuji testnet
avalanche blockchain deploy energyfi-l1 --fuji

# Save the output RPC URL to .env
# ENERGYFI_L1_TESTNET_RPC=https://api.avax-test.network/ext/bc/<BLOCKCHAIN_ID>/rpc
```

Verify the chain is running:

```bash
curl -X POST --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  -H "Content-Type: application/json" $ENERGYFI_L1_TESTNET_RPC
# Expected: {"result":"0x42122"}  (chainId 270626)
```

### 3.3 Phase 2: Hackathon Submission (AvaCloud Testnet)

For hackathon submission, the L1 is deployed via [AvaCloud](https://avacloud.io) Testnet Starter plan, which provides 2 managed validator nodes.

```bash
# 1. Subscribe to AvaCloud Testnet Starter plan (https://console.avacloud.io)

# 2. Create an L1 in the AvaCloud console
#    - Upload l1-config/genesis.json (same file as CLI deployment)
#    - Select Fuji testnet
#    - AvaCloud provisions 2 validator nodes automatically

# 3. Save the AvaCloud-provided RPC URL to .env
#    ENERGYFI_L1_TESTNET_RPC=<AvaCloud console에서 제공하는 RPC URL>

# 4. Deploy contracts (same command as Phase 1)
cd contracts/l1
npm run deploy:testnet
```

> **Note:** The same `genesis.json` (Chain ID 270626, zero-gas) works for both Avalanche-CLI and AvaCloud deployments. The Hardhat `energyfi-l1-testnet` network reads `ENERGYFI_L1_TESTNET_RPC` regardless of infrastructure provider.

> **Development → Hackathon transition:** Replace `ENERGYFI_L1_TESTNET_RPC` in `.env` with the AvaCloud-provided URL. Contracts must be redeployed on the new chain.

### 3.4 Phase 3: Production (AvaCloud Mainnet)

For production launch (June 2026~), the L1 is deployed via AvaCloud Mainnet with self-managed validator nodes.

```bash
# 1. Subscribe to AvaCloud Mainnet plan (https://console.avacloud.io)

# 2. Create an L1 in the AvaCloud console
#    - Upload l1-config/genesis.json (same file)
#    - Select Mainnet
#    - Configure validator nodes (company-operated, separate regions)

# 3. Save the AvaCloud-provided RPC URL to .env
#    ENERGYFI_L1_MAINNET_RPC=<AvaCloud console에서 제공하는 RPC URL>

# 4. Deploy contracts
cd contracts/l1
npm run deploy:mainnet
```

**Validator structure in production:**
- **Company nodes (2):** Self-managed via AvaCloud Mainnet, deployed in separate geographic regions for redundancy
- **External validators:** Securities firms and professional node operators (e.g., DSRV, Blocko) operate their own computing infrastructure and join as validators independently

### 3.5 Validator Composition Roadmap

| Phase | Timeline | Nodes | Operators |
|:---|:---|:---|:---|
| **Hackathon** | ~May 2026 | 2 | AvaCloud Testnet Starter (managed) |
| **Launch** | June 2026 | 2 | Company (2, separate regions, AvaCloud Mainnet) |
| **Pre-STO** | 2026 H2 | 3~4 | Company (2) + Securities firm (1~2) |
| **Production** | 2027 Jan~ | 5+ | Company (2) + Securities firm (1~2) + Professional node operator (1+) |

Adding validators to an existing L1 (Phase: Launch → Pre-STO → Production):

```bash
# Avalanche-CLI (self-managed)
avalanche key create validator-node-2
avalanche blockchain addValidator energyfi-l1 --fuji \
  --node-id <NODE_ID> \
  --stake-amount 1 \
  --staking-period 365d

# Verify validator set
avalanche blockchain describe energyfi-l1 --fuji
```

> For AvaCloud-managed L1s, validators are added via the AvaCloud console.

## 4. [Unit B] L1 Smart Contracts

Deploy contracts onto the EnergyFi L1 (requires Unit A running).

```bash
cd contracts/l1
npm run compile

# Deploy to target environment:
npm run deploy:testnet    # Testnet (Development or Hackathon)
npm run deploy:mainnet    # Mainnet (Production)
```

As the 9-contract architecture is implemented, deployment scripts and addresses will be updated:
```
STATION_REGISTRY_ADDRESS=0x...
CHARGE_TRANSACTION_ADDRESS=0x...
CARBON_REDUCTION_ADDRESS=0x...
PARAMETER_REGISTRY_ADDRESS=0x...
CARBON_BATCH_ADDRESS=0x...
VCU_REFERENCE_ADDRESS=0x...
REPUTATION_REGISTRY_ADDRESS=0x...
STO_PORTFOLIO_ADDRESS=0x...
REGION_STO_FACTORY_ADDRESS=0x...
```

## 5. [Unit C] Frontend — PLANNED

> The frontend will be reimplemented to support the per-region STO model (17 administrative regions, ISO 3166-2:KR) and the 9-contract architecture. Frontend spec is planned for a future phase.

## 6. Deployment Checklist

```
[1]  .env.example → .env (all keys populated)
[2]  Unit A: L1 chain running (RPC responds to eth_chainId with 0x42122)
[3]  Unit B: L1 contracts deployed (addresses saved to .env)
[4]  Unit C: Frontend deployed (pending reimplementation)
```

## 7. Rollback Strategy

| Scenario | Action |
|:---|:---|
| Contract bug | Call `pause()` on affected contract → deploy new version → update .env |
| L1 node failure (Fuji/CLI) | Check status: `avalanche blockchain describe energyfi-l1 --fuji` |
| L1 node failure (AvaCloud) | Check status in AvaCloud console → contact AvaCloud support if needed |
| Wrong addresses | Update `.env` with correct contract addresses |

## 8. Network Configuration

| Network | Chain ID | RPC | Explorer |
|:---|:---|:---|:---|
| EnergyFi L1 Testnet | 270626 | `ENERGYFI_L1_TESTNET_RPC` (Avalanche-CLI or AvaCloud) | [subnets-test.avax.network](https://subnets-test.avax.network) |
| EnergyFi L1 Mainnet | 270626 | `ENERGYFI_L1_MAINNET_RPC` (AvaCloud Mainnet) | TBD |
| Avalanche Fuji C-Chain | 43113 | `https://api.avax-test.network/ext/bc/C/rpc` | [testnet.snowtrace.io](https://testnet.snowtrace.io) |
| Avalanche Mainnet | 43114 | `https://api.avax.network/ext/bc/C/rpc` | [snowtrace.io](https://snowtrace.io) |
