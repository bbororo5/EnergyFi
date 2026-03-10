# Explore Redesign Spec

## Purpose

`Explore` is the neutral story browser for EnergyFi regions.

- `Home` answers: what changed and what matters now
- `Analytics` answers: why the current state should be read that way
- `Explore` answers: what kind of region this is

The screen must not behave like a ranking board, watchlist leaderboard, or APY funnel.

## Data Source

`mobile` reads `ReputationRegistry` directly on Avalanche Fuji through `viem`.

Source-of-truth chain contract:
- interface: `contracts/contracts/interfaces/ops/IReputationRegistry.sol`
- implementation: `contracts/contracts/ops/ReputationRegistry.sol`

Mobile runtime files:
- hook: `mobile/hooks/use-region-stories.ts`
- ABI sync script: `mobile/scripts/sync-contract-abi.mjs`
- runtime config: `mobile/constants/contracts.ts`

## Card Model

Each published region card is built from the latest monthly snapshot plus, when available, the previous monthly snapshot.

### Story axes

- Operational trust
  - active charger ratio
  - maintenance resolution rate
  - settlement continuity
- Revenue rhythm
  - session volume
  - revenue stability
  - peak window
- Site character
  - primary site type
  - site mix ratios

### Card structure

- Region identity
  - region name
  - ISO region code
  - published badge
- Snapshot metadata
  - monthly period label
  - relative update time
- Summary sentence
  - short neutral narrative composed from trust, rhythm, and site mix
- Change summary
  - current snapshot versus previous monthly snapshot
- Three story chips
  - one chip per axis
- Three supporting metrics
  - active chargers
  - settlement continuity
  - session volume

## Fallback Rules

- If a region has no published snapshot, the region still appears in the list.
- Fallback copy is neutral and must not imply poor quality or underperformance.
- Fallback label: `Data not yet published`.
- This is deliberate so Explore preserves breadth without fabricating narratives.

## Filters

The filter row is descriptive, not competitive.

- All Regions
- Published
- Awaiting Data
- Residential
- Workplace
- Public-Commercial
- Mixed

Filtering preserves the catalog order and never re-sorts by score.

## Search

Search matches:
- short region name
- full region name
- ISO region code

## Runtime Notes

- `mobile` defaults to Avalanche Fuji public RPC unless `EXPO_PUBLIC_AVAX_FUJI_RPC_URL` overrides it.
- `mobile` will use `EXPO_PUBLIC_REPUTATION_REGISTRY_ADDRESS` when provided.
- If the address is not configured, Explore remains functional in neutral fallback mode.

## Deployment Notes

Contract-side helper scripts added for this flow:

- `contracts/scripts/deploy-reputation.ts`
- `contracts/scripts/seed-reputation.ts`

Related npm commands:

- `cd contracts && npm run deploy:reputation:fuji`
- `cd contracts && npm run seed:reputation:fuji`

The current Fuji deployment is blocked until the configured deployer wallet has test AVAX.
