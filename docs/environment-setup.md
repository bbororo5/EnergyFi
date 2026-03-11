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

### 2.3 L1 Infrastructure CLI

```bash
# Install Avalanche CLI
curl -sSfL https://raw.githubusercontent.com/ava-labs/avalanche-cli/main/scripts/install.sh | sh -s
avalanche --version
# AvalancheGo is auto-installed by the CLI

# Create and deploy local subnet
avalanche blockchain create energyfitest --test-defaults --evm --latest
avalanche blockchain deploy energyfitest --local

# Update .env with the RPC URL from deploy output
# ENERGYFI_L1_LOCAL_RPC=http://127.0.0.1:9654/ext/bc/<BlockchainID>/rpc
```

> For full details on local subnet configuration, anti-patterns, and troubleshooting, see **[Local Subnet Guide](local-subnet-guide.md)**.

### 2.4 Development Environments

| Environment | Purpose | Network | Deploy Command |
|:---|:---|:---|:---|
| **Hardhat EVM** | Unit tests and fast oracle validation | `localhost` (8545) | — |
| **Local Subnet** | Integration tests and E2E | `energyfi-l1-local` | `npm run deploy:local` |

### 2.5 Clone & Environment Variables
```bash
git clone <repo-url> && cd EnergyFi
cp .env.example .env
# Edit .env:
#   DEPLOYER_PRIVATE_KEY    — wallet used for contract deployment and oracle signing
#   ENERGYFI_L1_LOCAL_RPC   — local Avalanche-CLI subnet RPC URL
```

### 2.6 Install Dependencies
```bash
# Unit B: L1 Contracts
cd contracts && npm install
```

### 2.7 Compile & Verify
```bash
cd contracts && npm run compile    # solc 0.8.20
```

## 3. Version Matrix

| Unit | Path | Runtime | Module System | Key Dependencies | Status |
|:---|:---|:---|:---|:---|:---|
| **A** (L1 Config) | `l1-config/` | Avalanche-CLI | JSON | — | Active |
| **B** (L1 Contracts) | `contracts/` | Node.js 24 | ESM (`"type": "module"`) | hardhat@3.1.7, ethers@6, OZ@5 | Active |
| **C** (Mobile App) | `mobile/` | Node.js 24 | ESM | expo@54, react-native, expo-router | Active (demo) |

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
  - `msjsdiag.vscode-react-native` — React Native Tools
  - `dbaeumer.vscode-eslint` — TypeScript linting
- **Solidity version**: Set to `^0.8.20` in IDE settings to match compiler
