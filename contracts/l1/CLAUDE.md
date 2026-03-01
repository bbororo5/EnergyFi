# contracts/l1 — Agent Instructions

Inherits all rules from [root CLAUDE.md](../../CLAUDE.md). The following are additional constraints specific to this module.

## Scope

Avalanche L1 smart contracts — 9-contract architecture deployed on a single private chain (Chain ID 270626, zero-gas).

## Key Rules

1. **Solidity ^0.8.20** — Do not change the compiler version without explicit approval.
2. **Hardhat 3 (ESM-first)** — All imports use `import`, not `require()`. Config uses `defineConfig()`.
3. **OpenZeppelin ^5.3.0** — The only approved external contract library. Do not add other dependencies without security audit.
4. **Test before deploy** — `npm run compile` → `npm run test` → `npm run deploy:*`. Never skip tests.
5. **`onlyBridge` access control** — The Bridge wallet address is the trust boundary with STRIKON. Never change this entry point without platform team confirmation.
6. **CarbonReduction is immutable** — No upgrade proxy. New methodology version = new contract deployment with timestamp boundary. VVB auditors verify deployed bytecode.
7. **ERC-3643 sub-contract interfaces** (IIdentityRegistry, ICompliance, ITrustedIssuersRegistry, IClaimTopicsRegistry) — Define interfaces only in Phase 1. Full implementation deferred to Phase 3 after securities firm partnership.

## Commands

```bash
npm run compile          # solc 0.8.20
npm run test             # Hardhat tests
npm run clean            # Clean artifacts
npm run deploy:testnet   # Deploy to EnergyFi L1 testnet (Fuji)
npm run deploy:mainnet   # Deploy to EnergyFi L1 mainnet
```

## Hardhat 3 Specifics

Differs from Hardhat v2:
- Config uses `defineConfig()`, not `HardhatUserConfig` type.
- Plugins loaded via explicit `plugins: [...]` array, not side-effect imports.
- Network config requires `type: "http"` + `url`.
- TypeScript built-in (no `ts-node` needed).
- `tsconfig.json` must use `"module": "node16"`, `"moduleResolution": "node16"`.

**Plugins in use** (no toolbox meta-package):
- `@nomicfoundation/hardhat-ethers` ^4.0.4
- `@nomicfoundation/hardhat-verify` ^3.0.10
- `@nomicfoundation/hardhat-ignition` ^3.0.7
- `@nomicfoundation/hardhat-ignition-ethers` ^3.0.7
- `@nomicfoundation/hardhat-keystore` ^3.0.4
- `@nomicfoundation/hardhat-network-helpers` ^3.0.3

## Smart Contract Map

9 contracts + 1 factory, organized in 4 categories. Data flows from Physical Layer → Investment Layer. **ChargeTransaction is the ROOT** — every downstream contract depends on it.

### Dependency Graph

```
ChargeTransaction (ROOT)
    ├── CarbonReduction (+ ParameterRegistry) → CarbonBatch → VCUReference   [Carbon Pipeline]
    ├── ReputationRegistry (+ StationRegistry)                                 [Operations]
    └── STOPortfolio → RegionSTO (via RegionSTOFactory)                        [Investment Pipeline]
```

### Contract Table

| # | Contract | Category | Token Std | Mutable | Phase | Upgradeability |
|:---|:---|:---|:---|:---|:---|:---|
| 1 | **StationRegistry** | A: Infra | N/A | Yes | June 2026 | Upgradeable (RBAC) |
| 2 | **ChargeTransaction** | B: Carbon | ERC-721 | No | June 2026 | Upgradeable |
| 3 | **CarbonReduction** | B: Carbon | ERC-721 | **Immutable** | June 2026 | **Non-upgradeable** |
| 4 | **ParameterRegistry** | B: Carbon | N/A | Yes (versioned) | June 2026 | Upgradeable |
| 5 | **CarbonBatch** | C: VCM | N/A | Lock only | 2027+ | Upgradeable |
| 6 | **VCUReference** | C: VCM | N/A | Append only | 2027+ | Upgradeable |
| 7 | **ReputationRegistry** | D: Investment | N/A | Yes (oracle) | 2026 H2 | Upgradeable |
| 8 | **STOPortfolio** | D: Investment | N/A | Yes | 2027 Jan | Upgradeable (lightweight) |
| 9 | **RegionSTO** | D: Investment | **ERC-3643** | Configurable | 2027 Jan | Configurable |
| -- | **RegionSTOFactory** | D: Investment | N/A | Yes | 2027 Jan | Upgradeable |

### Essential vs Derived

- **Essential** (3): ChargeTransaction, ParameterRegistry, CarbonReduction — system cannot function without these.
- **Derived** (7): All others — consume data produced by Essential contracts.

### Implementation Phases

| Phase | Contracts | Timeline | Trigger |
|:---|:---|:---|:---|
| 1a | ChargeTransaction | Now ~ Apr 2026 | Immediate (ROOT data source) |
| 1b | ParameterRegistry, CarbonReduction | Apr ~ May 2026 | Phase 1a complete |
| 2 | StationRegistry, ReputationRegistry | June 2026~ | Charger launch |
| 3a | RegionSTO, RegionSTOFactory | Jan 2027~ | Electronic Securities Act |
| 3b | STOPortfolio | Jan 2027~ | Securities firm onboarding |
| 3c | CarbonBatch, VCUReference | Jan 2027~ | VVB verification start |
| 4 | SE on-chain verification, AWM bridge, Accumulator pattern | 2027 H2~ | Scale thresholds |

### Existing Scaffolds

`AssetLogger.sol` and `DeviceRegistry.sol` exist as early infrastructure scaffolds. They will be integrated into the 9-contract architecture.

## Deployment Phases

| Phase | Infrastructure | Validators |
|:---|:---|:---|
| Development | Avalanche-CLI on Fuji | CLI-managed |
| Hackathon | AvaCloud Testnet Starter | AvaCloud 2 nodes |
| Production (June 2026~) | AvaCloud Mainnet | Company (2) + Securities firm (1-2) + Professional operators (1+) |

## Reference Docs

- [Smart Contract Spec](docs/smart-contract-spec.md)
- [Implementation Roadmap](docs/implementation-roadmap.md)
- [ERC Standards Analysis](docs/erc-standards-analysis.md)
- [Interface Spec](../../docs/strikon-interface-spec.md)

### External Standards

| Standard | Relevance |
|:---|:---|
| [ERC-3643 (T-REX)](https://eips.ethereum.org/EIPS/eip-3643) | RegionSTO — regulated security token with permissioned transfers |
| [ERC-721](https://eips.ethereum.org/EIPS/eip-721) | ChargeTransaction and CarbonReduction token standard |
| [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | Inspiration for ReputationRegistry pattern |
| [Verra VCS VM0038](https://verra.org/methodologies/vm0038-methodology-for-electric-vehicle-charging-systems/) | Carbon reduction methodology for EV charging |
| [Avalanche L1 (Subnet-EVM)](https://docs.avax.network/) | Chain runtime and configuration |
| [Avalanche Warp Messaging (AWM)](https://docs.avax.network/) | Future cross-chain communication (Phase 4) |
| Korean Electronic Securities Act (effective Jan 2027) | STO regulatory framework |
