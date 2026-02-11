# EnergyFi — Deployment Guide

This document covers the **5 independent Deployment Units** and their execution procedures.

## 1. Deployment Units

| Unit | Name | Path | Stack | Depends On |
|:---|:---|:---|:---|:---|
| **A** | Subnet Infrastructure | `subnet-evm/` | Avalanche-CLI | AvalancheGo node |
| **B** | C-Chain Contracts | `contracts/c-chain/` | Solidity, Hardhat 3 | AVAX gas (Fuji/Mainnet) |
| **C** | Subnet Contracts | `contracts/subnet/` | Solidity, Hardhat 3 | **Unit A** running |
| **D** | Oracle Relay | `services/oracle-relay/` | TypeScript, Node.js 24 | **Unit B, C** addresses |
| **E** | Mobile App | `frontend/` | Dart, Flutter 3.x | **Unit B, C** ABI & addresses |

## 2. Prerequisites

### 2.1 Environment Variables
```bash
cp .env.example .env
# Fill in:
#   DEPLOYER_PRIVATE_KEY   — wallet for contract deployment
#   ORACLE_RELAYER_KEY     — wallet for Oracle Relay transactions
#   AVAX_CCHAIN_RPC        — C-Chain RPC endpoint
#   WINGSIDE_SUBNET_RPC    — Subnet RPC endpoint (after Unit A)
```

### 2.2 Install Dependencies
```bash
cd contracts/c-chain && npm install
cd ../subnet && npm install
cd ../../services/oracle-relay && npm install
cd ../../frontend && flutter pub get
```

## 3. [Unit A] Subnet Infrastructure

One-time setup to launch the custom EVM chain.

```bash
# Create Subnet from genesis config
avalanche subnet create wingside --file subnet-evm/genesis.json

# Deploy to local node
avalanche subnet deploy wingside --local

# Save the output RPC URL to .env
# WINGSIDE_SUBNET_RPC=http://127.0.0.1:9650/ext/bc/<SUBNET_ID>/rpc
```

**Verification:**
```bash
curl -X POST --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  -H "Content-Type: application/json" $WINGSIDE_SUBNET_RPC
# Expected: {"result":"0x3039"}  (chainId 12345)
```

## 4. [Unit B] C-Chain Smart Contracts

Deploy financial logic to public network (Fuji testnet or Mainnet).

```bash
cd contracts/c-chain
npm run compile
npx hardhat run scripts/deploy_cchain.ts --network fuji
```

**Output:** `EnergyToken`, `EnergyOracle`, `RevenueVault` addresses.

Save these to `.env`:
```
ENERGY_TOKEN_ADDRESS=0x...
ENERGY_ORACLE_ADDRESS=0x...
REVENUE_VAULT_ADDRESS=0x...
```

## 5. [Unit C] Subnet Smart Contracts

Deploy logging system onto the Wingside Subnet (requires Unit A running).

```bash
cd contracts/subnet
npm run compile
npx hardhat run scripts/deploy_subnet.ts --network wingside
```

**Output:** `AssetLogger`, `DeviceRegistry` addresses.

Save these to `.env`:
```
ASSET_LOGGER_ADDRESS=0x...
DEVICE_REGISTRY_ADDRESS=0x...
```

## 6. [Unit D] Oracle Relay Service

Bind Unit B and Unit C addresses, then start the daemon.

```bash
cd services/oracle-relay

# Verify all 5 contract addresses are in .env
npm run start
```

**Expected log output:**
```
=== Oracle Relay Service ===
  C-Chain  : https://api.avax-test.network/ext/bc/C/rpc
  Subnet   : http://127.0.0.1:9650/ext/bc/.../rpc
  Relayer  : 0x...
[2026-...] Polling APEX Engine...
  C-Chain TX: 0x...  confirmed.
  Subnet TX: 0x...  confirmed.
```

## 7. [Unit E] Mobile App

Build and deploy the Flutter investor app.

```bash
cd frontend
flutter pub get

# Development (hot reload)
flutter run

# Release builds
flutter build apk --release   # Android
flutter build ios --release   # iOS (macOS only)
```

After deployment, update `lib/config/constants.dart` with the deployed contract addresses from Units B and C.

## 8. Deployment Checklist

```
[1]  .env.example → .env (all keys populated)
[2]  Unit A: Subnet node running (RPC responds to eth_chainId)
[3]  Unit B: C-Chain contracts deployed (3 addresses saved)
[4]  Unit C: Subnet contracts deployed (2 addresses saved)
[5]  .env updated with all 5 contract addresses
[6]  Unit D: Oracle Relay running (TX success in logs)
[7]  Unit E: Flutter app built
[8]  frontend/lib/config/constants.dart updated with addresses
```

## 9. Rollback Strategy

| Scenario | Action |
|:---|:---|
| Contract bug | Call `pause()` on affected contract → deploy new version → update .env → restart Unit D |
| Oracle failure | Restart Unit D process (on-chain state is unaffected) |
| Subnet failure | `avalanche subnet deploy wingside --local` to restart node |
| Wrong addresses | Update `.env` and `constants.dart` → restart Unit D → rebuild Unit E |

## 10. Network Configuration

| Network | Chain ID | RPC | Explorer |
|:---|:---|:---|:---|
| Avalanche Fuji (testnet) | 43113 | `https://api.avax-test.network/ext/bc/C/rpc` | [testnet.snowtrace.io](https://testnet.snowtrace.io) |
| Avalanche Mainnet | 43114 | `https://api.avax.network/ext/bc/C/rpc` | [snowtrace.io](https://snowtrace.io) |
| Wingside Subnet (local) | 12345 | `http://127.0.0.1:9650/ext/bc/<ID>/rpc` | — |
