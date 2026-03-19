# contracts — Agent Instructions

Inherits all rules from [root CLAUDE.md](../CLAUDE.md). The following are additional constraints specific to this module.

## Scope

Avalanche L1 smart contracts deployed on a single private chain (Chain ID 270626, zero-gas). The exact contract surface evolves by phase; treat `contracts/docs/implementation-roadmap.md` as the canonical map.

## Key Rules

1. **Solidity ^0.8.20** — Do not change the compiler version without explicit approval.
2. **Hardhat 3 (ESM-first)** — All imports use `import`, not `require()`. Config uses `defineConfig()`.
3. **OpenZeppelin ^5.3.0** — The only approved external contract library. Do not add other dependencies without security audit.
4. **Test before deploy** — `npm run compile` → `npm run test` → `npm run deploy:*`. Never skip tests.
5. **`onlyBridge` access control** — The Bridge wallet address is the trust boundary with STRIKON. Never change this entry point without platform team confirmation.
6. **CarbonReduction is immutable** — No upgrade proxy. New methodology version = new contract deployment with timestamp boundary. VVB auditors verify deployed bytecode.
7. **RegionSTO design is on hold** — the issuance path is not finalized (Path A: EnergyFi as the issuer-account manager with direct issuance / Path B: delegated issuance via a securities firm). All RegionSTO implementation work, including ERC-3643 interface decisions, resumes only after the Presidential Decree details and issuance path are finalized. KSD does not operate a single chain; it participates as a node in the issuer ledger, so the Avalanche L1 choice remains valid.

## Commands

```bash
npm run compile                 # solc 0.8.20
npm run test                    # Hardhat tests
npm run clean                   # Clean artifacts
npm run deploy:essential:testnet  # Phase 1-2 essential surface to EnergyFi L1 testnet
npm run deploy:surface:testnet    # Essential + demo read surface to EnergyFi L1 testnet
npm run seed:reputation:testnet   # Publish monthly region snapshots to ReputationRegistry
npm run seed:demo:testnet         # Populate deterministic public demo data
npm run verify:public:testnet     # Process 3 public demo charging sessions on the live testnet
npm run dashboard:testnet         # Launch the dashboard against EnergyFi L1 testnet
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

Essential + derived contracts, organized in 5 phases. Data flows from Physical Layer → Investment Layer.

### Dependency Graph

```
Bridge → ChargeRouter → { ChargeTransaction (ROOT), RevenueTracker }
ChargeTransaction → { DeviceRegistry (verifySignature), StationRegistry (isRegistered) }
RevenueTracker → StationRegistry [regionId]
ChargeTransaction → CarbonReduction (+ ParameterRegistry) → CarbonBatch → VCUReference
RevenueTracker → STOPortfolio → RegionSTO (via RegionSTOFactory)
ChargeTransaction + RevenueTracker + StationRegistry + STRIKON ops data
                 → ReputationRegistry (Explore story substrate)
```

### Contract Table

| # | Contract | Category | Token Std | Mutable | Phase | Upgradeability |
|:---|:---|:---|:---|:---|:---|:---|
| 0 | **DeviceRegistry** | A: Infra | N/A | Yes | Phase 1 | Upgradeable |
| 1 | **StationRegistry** | A: Infra | N/A | Yes | Phase 1 | Upgradeable |
| — | **ChargeRouter** | B: Transaction | N/A | Yes | Phase 2 | Upgradeable |
| 2 | **ChargeTransaction** | B: Transaction | ERC-721 | No | Phase 2 | Upgradeable |
| 3 | **RevenueTracker** | B: Transaction | N/A | Yes | Phase 2 | Upgradeable |
| 4 | **CarbonReduction** | B: Carbon | ERC-721 | **Immutable** | Phase 5 | **Non-upgradeable** |
| 5 | **ParameterRegistry** | B: Carbon | N/A | Yes (versioned) | Phase 5 | Upgradeable |
| 6 | **CarbonBatch** | C: VCM | N/A | Lock only | Phase 5 | Upgradeable |
| 7 | **VCUReference** | C: VCM | N/A | Append only | Phase 5 | Upgradeable |
| 3.5 | **CCIPRevenueSender** | D: Investment | N/A | No | Phase 3 | Non-upgradeable |
| 8 | **ReputationRegistry** | D: Investment | N/A | Yes (bridge/oracle) | Phase 4 (optional) | Upgradeable |
| 9 | **STOPortfolio** | D: Investment | N/A | Yes | Phase 3 | Upgradeable |
| 10 | **RegionSTO** | D: Investment | **TBD (after issuance-path decision)** | — | Phase 3 | — |
| -- | **RegionSTOFactory** | D: Investment | N/A | Yes | Phase 3 | Upgradeable |

### Essential vs Derived

- **Essential** (5): DeviceRegistry, StationRegistry, ChargeRouter, ChargeTransaction, and RevenueTracker — the Phase 1-2 core pipeline. The system cannot operate without them.
  - DeviceRegistry: ChargeTransaction calls `verifySignature()` directly. It is the basis of SE-signature verification.
  - StationRegistry: RevenueTracker depends on it for region lookup. Without it, revenue attribution is impossible.
  - ChargeRouter: The only Bridge entry point. It executes `mint()` and `recordRevenue()` atomically in one transaction.
  - ChargeTransaction: The root data source of the entire system.
  - RevenueTracker: Accumulates revenue immediately after minting and enables region-level investor revenue tracking.
- **Derived**: Optional and extended contracts that consume data produced by the Essential contracts.
  - ReputationRegistry: Region-level reputation snapshot storage for Explore. The public interface is `contracts/contracts/interfaces/ops/IReputationRegistry.sol`, the concrete implementation is `contracts/contracts/ops/ReputationRegistry.sol`, and the detailed spec is `docs/phase4-reputation-spec.md`.

### Implementation Phases

| Phase | Objective | Contracts | Timeline |
|:---|:---|:---|:---|
| **1** ✅ | Charging infrastructure registration | DeviceRegistry, StationRegistry | Completed |
| **2** ✅ | Charging transactions and revenue tracking | ChargeTransaction, RevenueTracker, ChargeRouter | Completed |
| **3** | STO issuance and Revenue Attestation | CCIPRevenueSender, RegionSTO, RegionSTOFactory, STOPortfolio | 2027.01~ |
| **4** | Explore reputation | ReputationRegistry (optional) | After Phase 3 |
| **5** | Carbon credits | ParameterRegistry, CarbonReduction, CarbonBatch, VCUReference | From VVB launch onward |

### Existing Scaffolds

`AssetLogger.sol` exists as an early infrastructure scaffold and will be evaluated for integration.
`DeviceRegistry.sol` has been fully implemented as the first contract in Phase 1.

## Deployment Phases

| Phase | Infrastructure | Validators |
|:---|:---|:---|
| Hackathon | AvaCloud Testnet Starter | AvaCloud 2 nodes |
| Production (June 2026~) | AvaCloud Mainnet | Company (2) + Securities firm (1-2) + Professional operators (1+) |

### AvaCloud Demo Deploy

- `deploy:surface:testnet` is the demo-oriented deployment path.
- Required root `.env` variables:
  - `DEPLOYER_PRIVATE_KEY`
  - `ENERGYFI_L1_TESTNET_RPC`
  - `ENERGYFI_ADMIN_ADDRESS`
  - `ENERGYFI_BRIDGE_ADDRESS`
  - `ENERGYFI_REPUTATION_BRIDGE_ADDRESS`
- Bridge wiring is intentionally split:
  - `ChargeTransaction` / `RevenueTracker` trust the `ChargeRouter` proxy
  - `ChargeRouter` trusts `ENERGYFI_BRIDGE_ADDRESS`
  - `ReputationRegistry` trusts `ENERGYFI_REPUTATION_BRIDGE_ADDRESS`
- `deployments.json` must contain:
  - `DeviceRegistry`, `StationRegistry`, `ChargeTransaction`, `RevenueTracker`, `ChargeRouter`
  - `ReputationRegistry`, `RegionSTOImpl`, `RegionSTOFactory`

## Reference Docs

| Document | Path | When to read |
|:---|:---|:---|
| **Implementation Roadmap** | `docs/implementation-roadmap.md` | Overall architecture, phase dependency graph, dual-signature trust model, and risk register |
| **Phase 1 Spec** | `docs/phase1-infra-spec.md` | DeviceRegistry and StationRegistry implementation, SE chip enrollment, station/charger hierarchy |
| **Phase 2 Spec** | `docs/phase2-transaction-spec.md` | ChargeTransaction and RevenueTracker implementation, `invoice.paid` mapping, revenue attribution model |
| **Phase 3 Spec** | `docs/phase3-sto-spec.md` | STO issuance paths (Path A/B/CCIP) and Revenue Attestation infrastructure. Token implementation remains on hold until the path is finalized. |
| **Phase 4 Reputation Spec** | `docs/phase4-reputation-spec.md` | Region-level reputation snapshot spec for Explore, including `IReputationRegistry` and metric definitions |
| **Phase 5 Spec** | `docs/phase5-carbon-spec.md` | Carbon credit pipeline, VM0038 formula, CarbonBatch, and VCUReference |
| **ERC Standards Analysis** | `docs/erc-standards-analysis.md` | ERC standard mapping and audit-preparation reference |
| **T-REX Architecture** | `docs/trex-architecture.md` | Reference-only material to revisit after the issuance path and Presidential Decree details are finalized |
| **Interface Spec** | `../../docs/strikon-interface-spec.md` | STRIKON ↔ EnergyFi pipeline, including the `invoice.paid` payload and confirmed `se_signature` field |

### External Standards

| Standard | Relevance |
|:---|:---|
| [ERC-3643 (T-REX)](https://eips.ethereum.org/EIPS/eip-3643) | Reference only. The EnergyFi L1 implementation approach will be chosen after the issuance path (Path A/B) and the Presidential Decree details are finalized. Currently on hold. |
| [ERC-721](https://eips.ethereum.org/EIPS/eip-721) | ChargeTransaction and CarbonReduction token standard |
| [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | Inspiration for ReputationRegistry pattern (reference only, not a strict implementation target) |
| [Verra VCS VM0038](https://verra.org/methodologies/vm0038-methodology-for-electric-vehicle-charging-systems/) | Carbon reduction methodology for EV charging |
| [Avalanche L1 (Subnet-EVM)](https://docs.avax.network/) | Chain runtime and configuration |
| [Avalanche Warp Messaging (AWM)](https://docs.avax.network/) | Future cross-chain communication (Phase 5) |
| [Chainlink CCIP](https://docs.chain.link/ccip) | Phase 3 cross-chain Revenue Attestation. Transmits RevenueTracker data from the EnergyFi L1 to a KSD-supported chain such as Hyperledger Besu. DTCC validated the Avalanche + Besu + CCIP pattern in 2025. ISO 27001 + SOC 2 certified. |
| Korean Electronic Securities Act (effective January 2027) | STO regulatory framework |
| [Hardhat 3](https://hardhat.org/docs) | Build framework. Version 3 is ESM-first, uses `defineConfig()`, and requires explicit plugin loading. Do not use Hardhat v2 patterns. |
