# EnergyFi — Contract Deployment Evidence

This document separates two committed evidence sets so reviewers can see which addresses come from which code path:

- the current judge-facing review flow in `contracts/scripts/verify/judge-demo.ts`
- the repository-managed deployment artifact in `contracts/deployments.json`

## Network

- Chain ID: `59823`
- JSON-RPC: [https://subnets.avax.network/enf/testnet/rpc](https://subnets.avax.network/enf/testnet/rpc)
- Explorer base: [https://explorer-test.avax.network/enf](https://explorer-test.avax.network/enf)

## 1. Judge Review Contracts

These are the contracts directly used by `cd contracts && npm run judge:testnet`. This is the narrowest committed proof path for public review.

| Contract | Address | Explorer | Proof |
|:---|:---|:---|:---|
| ChargeRouter | `0xACb74aAA9D8f479c72780849BCEd1c43F0AfB3F7` | [open](https://explorer-test.avax.network/enf/address/0xACb74aAA9D8f479c72780849BCEd1c43F0AfB3F7) | `eth_getCode != 0x`; `bridgeAddress()` is configured |
| ChargeTransaction | `0x3c1d0E0572b00D67d6E4e8f7381C7960eB0ADDC3` | [open](https://explorer-test.avax.network/enf/address/0x3c1d0E0572b00D67d6E4e8f7381C7960eB0ADDC3) | `eth_getCode != 0x`; `totalSessions()` increases after judge runs |
| RevenueTracker | `0x693F237E5e15884A19cC81bA584F0535Bb9b3D02` | [open](https://explorer-test.avax.network/enf/address/0x693F237E5e15884A19cC81bA584F0535Bb9b3D02) | `eth_getCode != 0x`; `getRegionRevenue(KR11)` increases after judge runs |

## 2. Repository-Managed Deployment Artifact

These addresses come from [contracts/deployments.json](../contracts/deployments.json) under `energyfi-l1-testnet`. They match the committed repo deployment artifact and the mobile fallback defaults where applicable, but they are not the same thing as the current judge review flow above.

| Contract | Address | Explorer | Proof |
|:---|:---|:---|:---|
| DeviceRegistry | `0x2b7c0388F71797724666B609Ca09131b14B6Cc1b` | [open](https://explorer-test.avax.network/enf/address/0x2b7c0388F71797724666B609Ca09131b14B6Cc1b) | `eth_getCode != 0x` |
| StationRegistry | `0x462fA3589f3483FD19885b6996F72142CBaB85DB` | [open](https://explorer-test.avax.network/enf/address/0x462fA3589f3483FD19885b6996F72142CBaB85DB) | `eth_getCode != 0x` |
| ChargeTransaction | `0x3c1d0E0572b00D67d6E4e8f7381C7960eB0ADDC3` | [open](https://explorer-test.avax.network/enf/address/0x3c1d0E0572b00D67d6E4e8f7381C7960eB0ADDC3) | `eth_getCode != 0x` |
| RevenueTracker | `0x693F237E5e15884A19cC81bA584F0535Bb9b3D02` | [open](https://explorer-test.avax.network/enf/address/0x693F237E5e15884A19cC81bA584F0535Bb9b3D02) | `eth_getCode != 0x` |
| ChargeRouter | `0xACb74aAA9D8f479c72780849BCEd1c43F0AfB3F7` | [open](https://explorer-test.avax.network/enf/address/0xACb74aAA9D8f479c72780849BCEd1c43F0AfB3F7) | `eth_getCode != 0x` |
| ReputationRegistry | `0x073b6b6917141EB0Fb40316C30897EAF1394AFDe` | [open](https://explorer-test.avax.network/enf/address/0x073b6b6917141EB0Fb40316C30897EAF1394AFDe) | `eth_getCode != 0x` |
| RegionSTOImpl | `0x01D2A62351a1204D8B32a7D72E6a6C1969F3273b` | [open](https://explorer-test.avax.network/enf/address/0x01D2A62351a1204D8B32a7D72E6a6C1969F3273b) | `eth_getCode != 0x` |
| RegionSTOFactory | `0xC954bAb6db0b83e33b5B753c966B08Cafe904076` | [open](https://explorer-test.avax.network/enf/address/0xC954bAb6db0b83e33b5B753c966B08Cafe904076) | `eth_getCode != 0x` |

## 3. Review Note

For repository review, this file should be treated as the canonical bridge between the committed judge script and the committed deployment artifact. It does not rely on any uncommitted `mobile/.env` file.

For step-by-step validation procedures, see [judge-quick-start.md](./judge-quick-start.md).
