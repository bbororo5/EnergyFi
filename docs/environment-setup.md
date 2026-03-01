# EnergyFi — Environment Setup

## 1. Prerequisites

| Tool | Version | Purpose | Install |
|:---|:---|:---|:---|
| **Node.js** | 24.x LTS | Hardhat 3, scripts | `nvm install 24` |
| **NVM** | latest | Node version management | [nvm-sh/nvm](https://github.com/nvm-sh/nvm) |
| **npm** | 11.x | Package management (ships with Node 24) | — |
| **Hardhat** | ^3.1.7 | Smart contract framework (ESM-first) | project-local via npm |
| **Avalanche-CLI** | latest | L1 chain creation & deploy (Unit A) | [docs.avax.network](https://docs.avax.network) |
| **AvalancheGo** | latest | Avalanche node software (required for local L1) | Installed via Avalanche-CLI |
| **Python** | 3.11+ | APEX Engine (Phase 2) | system / pyenv |
| **OS** | macOS (Darwin arm64) | Primary dev environment | — |

## 2. Initial Setup

### 2.1 Node.js & NVM
```bash
nvm install 24
nvm use 24
node -v   # v24.x.x
npm -v    # 11.x.x
```

### 2.2 PATH Configuration
To prevent binary conflicts (e.g., Hardhat HHE3 errors), ensure NVM-managed paths take priority:
```bash
# ~/.zshrc
export PATH="$NVM_BIN:/opt/homebrew/bin:/usr/local/bin:$PATH"
```

### 2.3 Avalanche-CLI Installation

```bash
# Install Avalanche-CLI
curl -sSfL https://raw.githubusercontent.com/ava-labs/avalanche-cli/main/scripts/install.sh | sh -s

# Verify installation
avalanche --version

# The CLI will automatically download AvalancheGo when needed
```

### 2.4 Fuji Testnet AVAX

Deploying an L1 on Fuji requires AVAX on the P-Chain for staking and transaction fees.

```bash
# 1. Get test AVAX from the Fuji Faucet
#    Visit: https://faucet.avax.network
#    Select "Fuji (C-Chain)" and enter your wallet address

# 2. Create a key for the CLI (if you haven't already)
avalanche key create deployer

# 3. Export the key's C-Chain address
avalanche key list

# 4. Transfer AVAX from C-Chain to P-Chain (required for L1 deployment)
#    Use the Core wallet (https://core.app) or Avalanche-CLI:
avalanche key transfer deployer --amount 2 --from c-chain --to p-chain --fuji
```

### 2.5 Deployment Phases

EnergyFi L1 progresses through 3 deployment phases. All phases use the same `genesis.json` (Chain ID 270626, zero-gas). Only the infrastructure provider and RPC URL differ.

| Environment | Phase | Infrastructure | RPC Source | Deploy Command |
|:---|:---|:---|:---|:---|
| **Testnet** | Development | Avalanche-CLI `--fuji` | CLI 출력 URL | `npm run deploy:testnet` |
| **Testnet** | Hackathon | AvaCloud Testnet Starter | AvaCloud 콘솔 | `npm run deploy:testnet` |
| **Mainnet** | Production (June 2026~) | AvaCloud Mainnet | AvaCloud 콘솔 | `npm run deploy:mainnet` |

> **Development → Hackathon transition:** Replace `ENERGYFI_L1_TESTNET_RPC` in `.env` with the AvaCloud-provided URL. Contracts must be redeployed on the new AvaCloud chain.
>
> For detailed phase-by-phase instructions, see [deployment-guide.md](deployment-guide.md).

### 2.6 Clone & Environment Variables
```bash
git clone <repo-url> && cd EnergyFi
cp .env.example .env
# Edit .env:
#   DEPLOYER_PRIVATE_KEY        — wallet for contract deployment
#   ENERGYFI_L1_TESTNET_RPC     — Testnet RPC (Development: CLI, Hackathon: AvaCloud)
#   ENERGYFI_L1_MAINNET_RPC     — Mainnet RPC (Production: AvaCloud Mainnet)
```

### 2.7 Install Dependencies
```bash
# Unit B: L1 Contracts
cd contracts/l1 && npm install
```

### 2.8 Compile & Verify
```bash
cd contracts/l1 && npm run compile    # solc 0.8.20
```

## 3. Version Matrix

| Unit | Path | Runtime | Module System | Key Dependencies | Status |
|:---|:---|:---|:---|:---|:---|
| **A** (L1 Config) | `l1-config/` | Avalanche-CLI | JSON | — | Active |
| **B** (L1 Contracts) | `contracts/l1/` | Node.js 24 | ESM (`"type": "module"`) | hardhat@3.1.7, ethers@6, OZ@5 | Active |
| **C** (Frontend) | `frontend/` | TBD | TBD | TBD | Planned |

## 4. Hardhat 3 Notes

This project uses **Hardhat 3** which has an ESM-first architecture. Key differences from v2:

| Aspect | Hardhat 2 | Hardhat 3 |
|:---|:---|:---|
| Module system | CJS (`require()`) | ESM (`import`) |
| Config API | `HardhatUserConfig` type | `defineConfig()` function |
| Plugin loading | Side-effect imports | Explicit `plugins: [...]` array |
| TypeScript | Requires `ts-node` | Built-in TS support |
| package.json | No `type` field needed | Must have `"type": "module"` |
| tsconfig | CommonJS compatible | `"module": "node16"`, `"moduleResolution": "node16"` |
| Network config | `url` only | `type: "http"` + `url` |

Individual plugins used (no toolbox meta-package):
- `@nomicfoundation/hardhat-ethers` ^4.0.4
- `@nomicfoundation/hardhat-verify` ^3.0.10
- `@nomicfoundation/hardhat-ignition` ^3.0.7
- `@nomicfoundation/hardhat-ignition-ethers` ^3.0.7
- `@nomicfoundation/hardhat-keystore` ^3.0.4
- `@nomicfoundation/hardhat-network-helpers` ^3.0.3

## 5. IDE Recommendations

- **VS Code** with extensions:
  - `NomicFoundation.hardhat-solidity` — Solidity syntax & compilation
  - `Dart-Code.flutter` — Flutter & Dart support
  - `dbaeumer.vscode-eslint` — TypeScript linting
- **Solidity version**: Set to `^0.8.20` in IDE settings to match compiler
