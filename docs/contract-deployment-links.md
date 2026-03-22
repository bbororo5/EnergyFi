# EnergyFi — Contract Deployment Evidence

This document separates two committed evidence sets so reviewers can see which addresses come from which code path:

- the current judge-facing review flow in `contracts/scripts/verify/public-demo.ts`
- the repository-managed deployment artifact in `contracts/deployments.json`

## Network

- Chain ID: `64058`
- JSON-RPC: [https://subnets.avax.network/efy/testnet/rpc](https://subnets.avax.network/efy/testnet/rpc)
- Explorer base: [https://explorer-test.avax.network/efy](https://explorer-test.avax.network/efy)

## 1. Judge Review Contracts

These are the contracts directly used by `cd contracts && npm run judge:testnet`. This is the narrowest committed proof path for public review.

| Contract | Address | Explorer | Proof |
|:---|:---|:---|:---|
| ChargeRouter | `0x8Fae69Bf1Bc4e1c987508a5fC6Cc0f65BaC829E7` | [open](https://explorer-test.avax.network/efy/address/0x8Fae69Bf1Bc4e1c987508a5fC6Cc0f65BaC829E7) | `eth_getCode != 0x`; `bridgeAddress()` is configured |
| ChargeTransaction | `0x743907BE700c527950D912ec2fe35D3e701D1286` | [open](https://explorer-test.avax.network/efy/address/0x743907BE700c527950D912ec2fe35D3e701D1286) | `eth_getCode != 0x`; `totalSessions()` increases after judge runs |
| RevenueTracker | `0x3D23900e2AFF32363d129c2237e606efb00C9777` | [open](https://explorer-test.avax.network/efy/address/0x3D23900e2AFF32363d129c2237e606efb00C9777) | `eth_getCode != 0x`; `getRegionRevenue(KR11)` increases after judge runs |

## 2. Repository-Managed Deployment Artifact

These addresses come from [contracts/deployments.json](../contracts/deployments.json) under `energyfi-l1-testnet`. They match the committed repo deployment artifact and the mobile fallback defaults where applicable, but they are not the same thing as the current judge review flow above.

| Contract | Address | Explorer | Proof |
|:---|:---|:---|:---|
| DeviceRegistry | `0x08c36c0C0e249F8dcfA891997Ee95808C6150C13` | [open](https://explorer-test.avax.network/efy/address/0x08c36c0C0e249F8dcfA891997Ee95808C6150C13) | `eth_getCode != 0x` |
| StationRegistry | `0x7755040f6B6032eF126DA24eE5aC33BC366DFb7f` | [open](https://explorer-test.avax.network/efy/address/0x7755040f6B6032eF126DA24eE5aC33BC366DFb7f) | `eth_getCode != 0x` |
| ChargeTransaction | `0x743907BE700c527950D912ec2fe35D3e701D1286` | [open](https://explorer-test.avax.network/efy/address/0x743907BE700c527950D912ec2fe35D3e701D1286) | `eth_getCode != 0x` |
| RevenueTracker | `0x3D23900e2AFF32363d129c2237e606efb00C9777` | [open](https://explorer-test.avax.network/efy/address/0x3D23900e2AFF32363d129c2237e606efb00C9777) | `eth_getCode != 0x` |
| ChargeRouter | `0x8Fae69Bf1Bc4e1c987508a5fC6Cc0f65BaC829E7` | [open](https://explorer-test.avax.network/efy/address/0x8Fae69Bf1Bc4e1c987508a5fC6Cc0f65BaC829E7) | `eth_getCode != 0x` |
| ReputationRegistry | `0xc608EBd33C135DCe1c3C73D84eB91877B612dc4a` | [open](https://explorer-test.avax.network/efy/address/0xc608EBd33C135DCe1c3C73D84eB91877B612dc4a) | `eth_getCode != 0x` |
| RegionSTOImpl | `0xBD05461CaB00aB5011734F3cB2D8f4382b006Bba` | [open](https://explorer-test.avax.network/efy/address/0xBD05461CaB00aB5011734F3cB2D8f4382b006Bba) | `eth_getCode != 0x` |
| RegionSTOFactory | `0x2524e8cFBeBd81afFe25C38BCb82226427c22abB` | [open](https://explorer-test.avax.network/efy/address/0x2524e8cFBeBd81afFe25C38BCb82226427c22abB) | `eth_getCode != 0x` |

## 3. Review Note

For repository review, this file should be treated as the canonical bridge between the committed judge script and the committed deployment artifact. It does not rely on any uncommitted `mobile/.env` file.

For step-by-step validation procedures, see [judge-quick-start.md](./judge-quick-start.md).
