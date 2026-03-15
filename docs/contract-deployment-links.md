# EnergyFi — Contract Deployment Links

This document lists the contract addresses that the current public MVP uses, together with direct explorer links and a minimal on-chain proof signal for each address.

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
| ChargeRouter | `0x7e5946d30b4E9AfFe5eA0523ea198d41c9EF1B73` | [open](https://explorer-test.avax.network/efy/address/0x7e5946d30b4E9AfFe5eA0523ea198d41c9EF1B73) | `eth_getCode != 0x`, `bridgeAddress() = 0xBdDFc6fdF2F28cBb67eadeCdB0165a15741387aD` |
| ReputationRegistry | `0x41C497115528b0867bAf4fa32f07Fb49B6622FbF` | [open](https://explorer-test.avax.network/efy/address/0x41C497115528b0867bAf4fa32f07Fb49B6622FbF) | `eth_getCode != 0x`, `getRegionSnapshotPeriods(KR11, 2) = [202602, 202603]` |

## 2. Additional Deployed Contract

The contract below is deployed on the same chain, but is not yet wired into the current public MVP route set.

| Contract | Address | Explorer | Proof |
|:---|:---|:---|:---|
| RegionSTOFactory | `0x1D7a808E68f890431Da1492F11219f069E008116` | [open](https://explorer-test.avax.network/efy/address/0x1D7a808E68f890431Da1492F11219f069E008116) | `eth_getCode != 0x`, `getRegionCount() = 0` |

## 3. Proof Method

### Explorer proof

Each link above opens the address on the Avalanche test explorer.

### JSON-RPC proof

The following checks were performed directly against the public RPC:

```bash
curl -s -X POST https://subnets.avax.network/efy/testnet/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

curl -s -X POST https://subnets.avax.network/efy/testnet/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x681dCb012cC66ea2f6BF2dC41876A3bb52b1F153","latest"],"id":1}'
```

Interpretation:

- `eth_chainId = 0xfa3a` confirms the expected chain (`64058`)
- `eth_getCode != 0x` confirms that the address is a deployed contract, not an EOA or empty account

## 4. Important Submission Note

For judge review, this file should be treated as the canonical contract evidence set for the public MVP. It intentionally follows the addresses wired into the live site rather than older local deployment artifacts.
