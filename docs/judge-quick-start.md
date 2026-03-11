# EnergyFi — Judge Quick Start

This page is the fastest way to validate the current judge-facing EnergyFi review flow from committed code.

## 1. Public Materials

- Live MVP: [https://energyfi-mobile-demo.vercel.app](https://energyfi-mobile-demo.vercel.app)
- Contract deployment evidence: [contract-deployment-links.md](./contract-deployment-links.md)
- README entry point: [../README.md](../README.md)

## 2. Network To Inspect

The current judge flow uses the review network hardcoded in [contracts/scripts/verify/public-demo.ts](../contracts/scripts/verify/public-demo.ts).

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
  --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x743907BE700c527950D912ec2fe35D3e701D1286","latest"],"id":1}'
```

Expected shape:

```json
{"result":"0x60806040...","id":1,"jsonrpc":"2.0"}
```

## 5. Repository Source of Truth

For GitHub review, treat committed code as the source of truth:

- [contracts/scripts/verify/public-demo.ts](../contracts/scripts/verify/public-demo.ts) is the source of truth for the current judge command, review RPC, explorer, and the contract addresses it actively writes through.
- [contracts/deployments.json](../contracts/deployments.json) is the source of truth for the repository-managed `energyfi-l1-testnet` deployment artifact set.
- [mobile/constants/contracts.ts](../mobile/constants/contracts.ts) is the source of truth for committed mobile fallback wiring. It is a repo default, not proof of the live public review environment.

Do not treat an uncommitted `mobile/.env` file as repository evidence.

## 6. What Should Change After A Judge Run

After `npm run judge:testnet` succeeds:

- `ChargeTransaction.totalSessions()` should increase
- `RevenueTracker.getRegionRevenue(KR11)` should increase
- the explorer should show 3 new `processCharge` transactions
- `ChargeRouter.bridgeAddress()` should remain configured

## 7. Recommended Review Order

For a quick technical review, use the following order:

1. Run `cd contracts && npm install && npm run judge:testnet`.
2. Open the transaction links printed by the script in the explorer.
3. Open the contract address list in [contract-deployment-links.md](./contract-deployment-links.md).
4. If deeper validation is needed, run the JSON-RPC commands above.
5. Use the live MVP as a read-only UI check, not as the repository source of truth.
