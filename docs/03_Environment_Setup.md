# EnergyFi — Environment Setup

## 1. Prerequisites

| Tool | Version | Purpose | Install |
|:---|:---|:---|:---|
| **Node.js** | 24.x LTS | Hardhat 3, Oracle Relay, scripts | `nvm install 24` |
| **NVM** | latest | Node version management | [nvm-sh/nvm](https://github.com/nvm-sh/nvm) |
| **npm** | 11.x | Package management (ships with Node 24) | — |
| **Hardhat** | ^3.1.7 | Smart contract framework (ESM-first) | project-local via npm |
| **Flutter** | ^3.7.0 | Mobile app (Unit E) | [flutter.dev](https://flutter.dev) |
| **Avalanche-CLI** | latest | Subnet creation & deploy (Unit A) | [docs.avax.network](https://docs.avax.network) |
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

### 2.3 Clone & Environment Variables
```bash
git clone <repo-url> && cd EnergyFi
cp .env.example .env
# Edit .env: set DEPLOYER_PRIVATE_KEY, ORACLE_RELAYER_KEY, RPC URLs
```

### 2.4 Install Dependencies
```bash
# Unit B: C-Chain Contracts
cd contracts/c-chain && npm install

# Unit C: Subnet Contracts
cd ../subnet && npm install

# Unit D: Oracle Relay
cd ../../services/oracle-relay && npm install

# Unit E: Flutter App (requires Flutter SDK)
cd ../../frontend && flutter pub get
```

### 2.5 Compile & Verify
```bash
cd contracts/c-chain && npm run compile    # solc 0.8.20
cd ../subnet && npm run compile
cd ../../services/oracle-relay && npm run build  # tsc
```

## 3. Version Matrix

| Unit | Path | Runtime | Module System | Key Dependencies |
|:---|:---|:---|:---|:---|
| **B** (C-Chain) | `contracts/c-chain/` | Node.js 24 | ESM (`"type": "module"`) | hardhat@3.1.7, ethers@6, OZ@5 |
| **C** (Subnet) | `contracts/subnet/` | Node.js 24 | ESM | hardhat@3.1.7, ethers@6, OZ@5 |
| **D** (Oracle) | `services/oracle-relay/` | Node.js 24 | CJS | ethers@6, axios, ts-node |
| **E** (Frontend) | `frontend/` | Flutter 3.7+ | Dart | web3dart, riverpod, go_router |

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
