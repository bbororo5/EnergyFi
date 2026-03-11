# EnergyFi — Contract Deployment Evidence

This document lists the contract addresses used by the current public MVP, together with direct explorer links and a minimal on-chain proof signal for each address.

## Network

- Chain ID: `64058`
- JSON-RPC: [https://subnets.avax.network/efy/testnet/rpc](https://subnets.avax.network/efy/testnet/rpc)
- Explorer base: [https://explorer-test.avax.network/efy](https://explorer-test.avax.network/efy)

## 1. Public MVP-Connected Contracts

These are the addresses currently wired into the live MVP via the environment configuration used by `mobile`.

| Contract | Address | Explorer | Proof |
|:---|:---|:---|:---|
| DeviceRegistry | `0x28A1F923FCf9DbCB8a4eA247837F08D892980a8D` | [open](https://explorer-test.avax.network/efy/address/0x28A1F923FCf9DbCB8a4eA247837F08D892980a8D) | `eth_getCode != 0x` |
| StationRegistry | `0x5e5806ea08D8ddFa50E5af86d18859831e8618cf` | [open](https://explorer-test.avax.network/efy/address/0x5e5806ea08D8ddFa50E5af86d18859831e8618cf) | `eth_getCode != 0x`, `getStationsByRegion(KR11).length = 2` |
| ChargeTransaction | `0x681dCb012cC66ea2f6BF2dC41876A3bb52b1F153` | [open](https://explorer-test.avax.network/efy/address/0x681dCb012cC66ea2f6BF2dC41876A3bb52b1F153) | `eth_getCode != 0x`, `totalSessions() = 105` |
| RevenueTracker | `0x44Ce2984AAe78a9E6Cd5a4677236A8b8f5ae1250` | [open](https://explorer-test.avax.network/efy/address/0x44Ce2984AAe78a9E6Cd5a4677236A8b8f5ae1250) | `eth_getCode != 0x`, `getRegionRevenue(KR11) = 13627` |
| ChargeRouter | `0x7e5946d30b4E9AfFe5eA0523ea198d41c9EF1B73` | [open](https://explorer-test.avax.network/efy/address/0x7e5946d30b4E9AfFe5eA0523ea198d41c9EF1B73) | `eth_getCode != 0x`, `bridgeAddress() returns a configured bridge wallet` |
| ReputationRegistry | `0x41C497115528b0867bAf4fa32f07Fb49B6622FbF` | [open](https://explorer-test.avax.network/efy/address/0x41C497115528b0867bAf4fa32f07Fb49B6622FbF) | `eth_getCode != 0x`, `getRegionSnapshotPeriods(KR11, 2) = [202602, 202603]` |

## 2. Additional Deployed Contract

The contract below is deployed on the same chain, but is not yet wired into the current public MVP route set.

| Contract | Address | Explorer | Proof |
|:---|:---|:---|:---|
| RegionSTOFactory | `0x1D7a808E68f890431Da1492F11219f069E008116` | [open](https://explorer-test.avax.network/efy/address/0x1D7a808E68f890431Da1492F11219f069E008116) | `eth_getCode != 0x`, `getRegionCount() = 0` |

## 3. Review Note

For public MVP review, this file should be treated as the canonical contract evidence set. It intentionally follows the addresses wired into the live site rather than older local deployment artifacts.

For step-by-step validation procedures, see [judge-quick-start.md](./judge-quick-start.md).
