# Hackathon Demo Runbook

Use this flow when the AvaCloud `energyfi-l1-testnet` contracts are already deployed and you need the mobile demo surface to read fully populated on-chain data.

## 1. Root `.env`

Copy [.env.example](/Users/jeonseon-ung/Documents/github/EnergyFi/.env.example) to `.env` and fill at least:

```bash
DEPLOYER_PRIVATE_KEY=0x...
ENERGYFI_L1_TESTNET_RPC=https://...
ENERGYFI_L1_TESTNET_CHAIN_ID=<set only if you want Hardhat to enforce a specific chain ID>
```

`ENERGYFI_L1_TESTNET_CHAIN_ID` is optional in the current Hardhat configuration. If you set it, use whatever `eth_chainId` the target RPC actually returns.

For `scripts/seed/demo.ts` (`npm run seed:demo:testnet`), the signer behind `DEPLOYER_PRIVATE_KEY` must satisfy all of these on the deployed contracts:

- `DeviceRegistry.ADMIN_ROLE`
- `StationRegistry.ADMIN_ROLE`
- `RevenueTracker.DEFAULT_ADMIN_ROLE`
- `ChargeRouter.bridgeAddress == signer`
- `ReputationRegistry.bridgeAddress == signer`

## 2. Seed Demo Data

From [contracts/package.json](/Users/jeonseon-ung/Documents/github/EnergyFi/contracts/package.json):

```bash
cd contracts
npm run seed:demo:testnet
```

The seeder guarantees this order:

1. deterministic SE chip enrollment
2. station registration
3. charger registration
4. historical session minting
5. historical `claimRegion()` finalization
6. current-month pending sessions
7. chip revocation for coverage variance
8. monthly reputation snapshot publication

It is idempotent. Running it twice should skip existing demo records instead of duplicating them.

## 3. Mobile `.env`

Copy [mobile/.env.example](/Users/jeonseon-ung/Documents/github/EnergyFi/mobile/.env.example) to `mobile/.env` and fill:

```bash
EXPO_PUBLIC_ENERGYFI_RPC_URL=https://...
EXPO_PUBLIC_ENERGYFI_CHAIN_ID=<target RPC chain ID>
EXPO_PUBLIC_CHARGE_TRANSACTION_ADDRESS=0x...
EXPO_PUBLIC_REVENUE_TRACKER_ADDRESS=0x...
EXPO_PUBLIC_STATION_REGISTRY_ADDRESS=0x...
EXPO_PUBLIC_DEVICE_REGISTRY_ADDRESS=0x...
EXPO_PUBLIC_REPUTATION_REGISTRY_ADDRESS=0x...
EXPO_PUBLIC_REGION_STO_FACTORY_ADDRESS=0x0000000000000000000000000000000000000000
```

Address source:

- [contracts/deployments.json](/Users/jeonseon-ung/Documents/github/EnergyFi/contracts/deployments.json) under `energyfi-l1-testnet`

`mobile/constants/contracts.ts` contains repo fallback defaults. For this runbook, override them explicitly with `mobile/.env` values taken from the target deployment artifact.

## 4. Run Mobile

```bash
cd mobile
npm install
npm run web
```

## 5. Demo Expectations

- `Home`
  - hero value shows `Current month revenue` for the demo investor when RegionSTO holdings are present
  - published monthly chart follows the target testnet's live attestation periods; on the current public testnet it publishes through `Apr 2026`
  - 4 recent live-feed sessions
  - non-empty impact summary and region carousel
- `Explore`
  - 7 published region stories from `ReputationRegistry`
  - no Fuji-specific UI copy
- `Analytics`
  - 100+ total sessions
  - latest published period follows the live target testnet; on the current public testnet `KR11` publishes through `Apr 2026`
  - `KR29`, `KR49` show pending-only settlement fallback
  - chip coverage warning and issuance-not-live attention visible

## 6. Video Recording

For the hackathon feature video timeline, presenter guidance, narration beats, and Korean subtitle file, use:

- [hackathon-feature-demo-presenter-guide.md](./hackathon-feature-demo-presenter-guide.md)
- [hackathon-feature-demo-video.md](./hackathon-feature-demo-video.md)
- [hackathon-feature-demo-video.ko.srt](./hackathon-feature-demo-video.ko.srt)
