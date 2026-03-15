# contracts — Agent Instructions

Inherits all rules from [root CLAUDE.md](../../CLAUDE.md). The following are additional constraints specific to this module.

## Scope

Avalanche L1 smart contracts — 12 contracts + ChargeRouter (13개) deployed on a single private chain (Chain ID 270626, zero-gas).

## Key Rules

1. **Solidity ^0.8.20** — Do not change the compiler version without explicit approval.
2. **Hardhat 3 (ESM-first)** — All imports use `import`, not `require()`. Config uses `defineConfig()`.
3. **OpenZeppelin ^5.3.0** — The only approved external contract library. Do not add other dependencies without security audit.
4. **Test before deploy** — `npm run compile` → `npm run test` → `npm run deploy:*`. Never skip tests.
5. **`onlyBridge` access control** — The Bridge wallet address is the trust boundary with STRIKON. Never change this entry point without platform team confirmation.
6. **CarbonReduction is immutable** — No upgrade proxy. New methodology version = new contract deployment with timestamp boundary. VVB auditors verify deployed bytecode.
7. **RegionSTO 설계 보류** — 발행 경로 미결정 (Path A: EnergyFi = 발행인계좌관리기관, 직접 발행 / Path B: 증권사 위탁). ERC-3643 인터페이스 정의를 포함한 모든 RegionSTO 구현은 대통령령 세부 요건 확정 + 경로 결정 후 재개. KSD는 단일 체인을 운영하지 않으며 EnergyFi L1에 노드로 참여하는 구조 — Avalanche L1 선택은 유효.

## Commands

```bash
npm run compile          # solc 0.8.20
npm run test             # Hardhat tests
npm run clean            # Clean artifacts
npm run deploy             # Essential surface to EnergyFi L1 testnet
npm run deploy:full:testnet  # Essential + frontend read surface to AvaCloud L1
npm run deploy:reputation  # Deploy only ReputationRegistry to EnergyFi L1 testnet
npm run seed:reputation    # Publish demo monthly region snapshots to ReputationRegistry
npm run test:live        # Run live integration tests on EnergyFi L1 testnet
npm run dashboard        # Launch web dashboard connected to EnergyFi L1 testnet
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

12 contracts + ChargeRouter (13개), organized in 4 phases. Data flows from Physical Layer → Investment Layer.

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
| 4 | **CarbonReduction** | B: Carbon | ERC-721 | **Immutable** | Phase 4 | **Non-upgradeable** |
| 5 | **ParameterRegistry** | B: Carbon | N/A | Yes (versioned) | Phase 4 | Upgradeable |
| 6 | **CarbonBatch** | C: VCM | N/A | Lock only | Phase 4 | Upgradeable |
| 7 | **VCUReference** | C: VCM | N/A | Append only | Phase 4 | Upgradeable |
| 3.5 | **CCIPRevenueSender** | D: Investment | N/A | No | Phase 3 | Non-upgradeable |
| 8 | **ReputationRegistry** | D: Investment | N/A | Yes (bridge/oracle) | Phase 3 (선택) | Upgradeable |
| 9 | **STOPortfolio** | D: Investment | N/A | Yes | Phase 3 | Upgradeable |
| 10 | **RegionSTO** | D: Investment | **미확정 (경로 결정 후)** | — | Phase 3 | — |
| -- | **RegionSTOFactory** | D: Investment | N/A | Yes | Phase 3 | Upgradeable |

### Essential vs Derived

- **Essential** (5): DeviceRegistry, StationRegistry, ChargeRouter, ChargeTransaction, RevenueTracker — Phase 1-2 핵심 데이터 파이프라인. 없으면 시스템 동작 불가.
  - DeviceRegistry: ChargeTransaction이 `verifySignature()`를 직접 호출. SE 서명 검증의 기반.
  - StationRegistry: RevenueTracker가 regionId 조회에 의존. 수익 귀속 불가능.
  - ChargeRouter: Bridge의 유일한 진입점. mint() + recordRevenue()를 단일 TX 원자적 실행. 없으면 Bridge 호출 불가.
  - ChargeTransaction: 전체 시스템의 ROOT 데이터 소스.
  - RevenueTracker: mint() 직후 수익 누적. 지역별 STO 투자자 수익 추적 불가.
- **Derived** (8): All others — consume data produced by Essential contracts.
  - ReputationRegistry: Explore용 region reputation snapshot 저장소. 공개 규격은 `contracts/contracts/interfaces/ops/IReputationRegistry.sol`, concrete 구현은 `contracts/contracts/ops/ReputationRegistry.sol`, 상세 스펙은 `docs/phase3-reputation-spec.md`.

### Implementation Phases

| Phase | 목표 | Contracts | Timeline |
|:---|:---|:---|:---|
| **1** ✅ | 충전 인프라 등록 | DeviceRegistry, StationRegistry | 완료 |
| **2** ✅ | 충전 트랜잭션 + 수익 추적 | ChargeTransaction, RevenueTracker, ChargeRouter | 완료 |
| **3** | STO 발행 + Explore reputation | RegionSTO, RegionSTOFactory, STOPortfolio, ReputationRegistry(선택) | 2027.01~ |
| **4** | 탄소배출권 | ParameterRegistry, CarbonReduction, CarbonBatch, VCUReference | VVB 개시~ |

### Existing Scaffolds

`AssetLogger.sol` exists as an early infrastructure scaffold and will be evaluated for integration.
`DeviceRegistry.sol` has been fully implemented as the first contract in Phase 1.

## Deployment Phases

| Phase | Infrastructure | Validators |
|:---|:---|:---|
| Hackathon | AvaCloud Testnet Starter | AvaCloud 2 nodes |
| Production (June 2026~) | AvaCloud Mainnet | Company (2) + Securities firm (1-2) + Professional operators (1+) |

### AvaCloud Demo Deploy

- `deploy:full:testnet` is the demo-oriented deployment path.
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

| 문서 | 경로 | 참조 시점 |
|:---|:---|:---|
| **Implementation Roadmap** | `docs/implementation-roadmap.md` | 전체 아키텍처 파악, Phase별 의존성 그래프, 이중 서명 신뢰 모델, 리스크 레지스트리 |
| **Phase 1 스펙** | `docs/phase1-infra-spec.md` | DeviceRegistry + StationRegistry 구현. SE 칩 등록, 충전소·충전기 계층 설계. |
| **Phase 2 스펙** | `docs/phase2-transaction-spec.md` | ChargeTransaction + RevenueTracker 구현. invoice.paid 매핑, 수익 귀속 모델. |
| **Phase 3 스펙** | `docs/phase3-sto-spec.md` | STO 발행 경로(Path A/B) + Revenue Attestation 인프라. 토큰 구현은 경로 확정 후 보류. |
| **Phase 3 Reputation 스펙** | `docs/phase3-reputation-spec.md` | Explore용 region reputation snapshot 규격. `IReputationRegistry` 인터페이스와 metric 정의. |
| **Phase 4 스펙** | `docs/phase4-carbon-spec.md` | 탄소배출권 파이프라인. VM0038 수식, CarbonBatch, VCUReference. |
| **ERC Standards Analysis** | `docs/erc-standards-analysis.md` | ERC 표준 매핑, 감사 준비 참고. |
| **T-REX Architecture** | `docs/trex-architecture.md` | 참고용 (발행 경로 확정 + 대통령령 세부 요건 확인 후 재검토). |
| **Interface Spec** | `../../docs/strikon-interface-spec.md` | STRIKON ↔ EnergyFi 파이프라인. invoice.paid 페이로드, se_signature 필드 포함 확정. |

### External Standards

| Standard | Relevance |
|:---|:---|
| [ERC-3643 (T-REX)](https://eips.ethereum.org/EIPS/eip-3643) | 참고용. EnergyFi L1 구현 방식은 발행 경로(Path A/B) 확정 + 대통령령 세부 요건 확인 후 결정. 현재 보류. |
| [ERC-721](https://eips.ethereum.org/EIPS/eip-721) | ChargeTransaction and CarbonReduction token standard |
| [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | Inspiration for ReputationRegistry pattern (reference only, not a strict implementation target) |
| [Verra VCS VM0038](https://verra.org/methodologies/vm0038-methodology-for-electric-vehicle-charging-systems/) | Carbon reduction methodology for EV charging |
| [Avalanche L1 (Subnet-EVM)](https://docs.avax.network/) | Chain runtime and configuration |
| [Avalanche Warp Messaging (AWM)](https://docs.avax.network/) | Future cross-chain communication (Phase 4) |
| [Chainlink CCIP](https://docs.chain.link/ccip) | Phase 3 cross-chain Revenue Attestation. Transmits RevenueTracker data from EnergyFi L1 to KSD-supported chain (Hyperledger Besu 등). DTCC-validated: Avalanche + Besu + CCIP 2025 실증. ISO 27001 + SOC 2. |
| Korean Electronic Securities Act (effective Jan 2027) | STO regulatory framework |
| [Hardhat 3](https://hardhat.org/docs) | Build framework. v3 ESM-first, defineConfig(), explicit plugin loading. v2 패턴 사용 금지. |
