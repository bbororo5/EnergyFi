# EnergyFi — Judge Quick Start

This page is the fastest way for technical judges to validate the EnergyFi MVP without asking for repository access.

## 1. Public Materials

- Public repository: [https://github.com/Seon-ung/EnergyFi](https://github.com/Seon-ung/EnergyFi)
- Live MVP: [https://energyfi-mobile-demo.vercel.app](https://energyfi-mobile-demo.vercel.app)
- Contract deployment evidence: [contract-deployment-links.md](./contract-deployment-links.md)

## 2. Network To Inspect

The current public MVP reads from the EnergyFi Avalanche L1 testnet deployment below.

- Chain ID: `64058`
- JSON-RPC: [https://subnets.avax.network/efy/testnet/rpc](https://subnets.avax.network/efy/testnet/rpc)
- Explorer: [https://explorer-test.avax.network/efy](https://explorer-test.avax.network/efy)

Quick RPC proof:

```bash
curl -s -X POST https://subnets.avax.network/efy/testnet/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# Expected result:
# {"result":"0xfa3a","id":1,"jsonrpc":"2.0"}
```

## 3. What Judges Can Test

### Home

- Monthly revenue hero data from `RevenueTracker`
- Region evidence cards from on-chain settlement + snapshot reads
- Live feed from `ChargeTransaction`

### Explore

- Region story cards from `ReputationRegistry`
- Search and filter behavior on live region snapshot data

### Analytics

- Network evidence overview from `ChargeTransaction`, `RevenueTracker`, `StationRegistry`, `DeviceRegistry`, and `ReputationRegistry`
- Region detail drilldown using the same contract reads

## 4. How To Verify That Contracts Are Actually Deployed

Use both methods below.

### A. Human verification via explorer

Open the address pages in [contract-deployment-links.md](./contract-deployment-links.md).

### B. Machine verification via JSON-RPC

`eth_getCode` must return non-empty bytecode for deployed contract addresses:

```bash
curl -s -X POST https://subnets.avax.network/efy/testnet/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x681dCb012cC66ea2f6BF2dC41876A3bb52b1F153","latest"],"id":1}'
```

Expected shape:

```json
{"result":"0x60806040...","id":1,"jsonrpc":"2.0"}
```

## 5. Current Public MVP Source Of Truth

For the public demo that judges can access, the active contract wiring is taken from the live MVP environment configuration in `mobile/.env`.

This matters because the repository also contains older deployment artifacts for previous test deployments. The judge-facing proof package should always follow the addresses used by the live MVP.

## 6. Read-Back Evidence Snapshot

As of March 10, 2026, direct RPC reads from the public MVP contract set returned:

- `ChargeTransaction.totalSessions() = 105`
- `RevenueTracker.getRegionRevenue(KR11) = 13627`
- `StationRegistry.getStationsByRegion(KR11).length = 2`
- `ReputationRegistry.getRegionSnapshotPeriods(KR11, MONTHLY) = [202602, 202603]`
- `ChargeRouter.bridgeAddress() = 0xBdDFc6fdF2F28cBb67eadeCdB0165a15741387aD`
- `ReputationRegistry.bridgeAddress() = 0xBdDFc6fdF2F28cBb67eadeCdB0165a15741387aD`

## 7. Judge Recommendation

For technical review, use the following order:

1. Open the live MVP.
2. Open the contract address list in [contract-deployment-links.md](./contract-deployment-links.md).
3. Cross-check one or two addresses in the explorer.
4. If deeper validation is needed, run the JSON-RPC commands above.
