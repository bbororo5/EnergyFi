# l1-config — Agent Instructions

Inherits all rules from [root CLAUDE.md](../CLAUDE.md). The following are additional constraints specific to this module.

## Scope

Avalanche L1 chain configuration — genesis block and runtime parameters.

## Key Rules

1. **Highest risk module** — Changes here have broader blast radius than any contract change. Always confirm with human before modifying any file.
2. **Chain ID 270626** — Do not change. Hardcoded in `genesis.json`, `hardhat.config.ts`, and STRIKON platform configuration.
3. **Zero-gas configuration** — `minBaseFee: 0`, `minBlockGasCost: 0`, `maxBlockGasCost: 0`. This is intentional for a private chain. Do not add fees.
4. **Same genesis across all environments** — Development, Hackathon, and Production all use the same `genesis.json`. Only the RPC URL differs.

## Files

- `genesis.json` — L1 genesis block configuration (Chain ID, gas limits, fee config, pre-funded accounts)
- `config.json` — Runtime configuration

## Reference Docs

- [Deployment Guide](../docs/deployment-guide.md)
- [Architecture](../docs/architecture.md) §2.5
