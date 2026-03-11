# EnergyFi — Judge Quick Start

This page is a short checklist for the current judge-facing review flow.

Use it together with:

- README entry point: [../README.md](../README.md)
- Contract deployment evidence: [contract-deployment-links.md](./contract-deployment-links.md)

## 1. Fast Review Order

1. Run `cd contracts && npm install && npm run judge:testnet`.
2. Open the transaction links printed by the script.
3. Open the contract list in [contract-deployment-links.md](./contract-deployment-links.md).
4. Use the live MVP from the README as a read-only UI check if needed.

## 2. Expected Result

After `npm run judge:testnet` succeeds:
- `ChargeTransaction.totalSessions()` should increase
- `RevenueTracker.getRegionRevenue(KR11)` should increase
- the explorer should show 3 new `processCharge` transactions
- `ChargeRouter.bridgeAddress()` should remain configured

The script output shows `KR11` region total pending revenue. The Home hero in the live MVP shows the demo investor's pending share across holdings, so those values should not match one-to-one.

## 3. Optional RPC Spot Check

If deeper validation is needed, confirm that a deployed contract returns non-empty bytecode:

```bash
curl -s -X POST https://subnets.avax.network/efy/testnet/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x743907BE700c527950D912ec2fe35D3e701D1286","latest"],"id":1}'
```

Expected shape:

```json
{"result":"0x60806040...","id":1,"jsonrpc":"2.0"}
```
