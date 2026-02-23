# frontend — Agent Instructions

Inherits all rules from [root CLAUDE.md](../CLAUDE.md). The following are additional constraints specific to this module.

## Scope

Investor-facing mobile application for STO portfolio management, revenue tracking, and claim transactions.

## Status

**Planned reimplementation.** The frontend will be rebuilt to align with the per-region STO model (17 administrative regions, ISO 3166-2:KR) and the 9-contract architecture.

## Planned Stack

- Flutter + Dart
- WalletConnect v2 (wallet integration)
- ethers.js (contract interaction)

## Key Rules

1. **Read-only by default** — The app primarily reads on-chain data. The only write operation is `claim()` for investor withdrawals.
2. **Never store private keys in app code or local storage** — Use WalletConnect for all signing operations.
3. **KYC gate required** — All investment-related screens must be gated behind KYC verification status.
4. **Securities firm role boundary** — KYC/AML and dividend calculation/execution are the securities firm's domain. The app provides on-chain data views only; do not implement dividend logic or KYC verification flows.

## Reference Docs

- [Frontend Design](docs/flutter-design.md)
- [Interface Spec](../docs/strikon-interface-spec.md) — Step ⑨ (investor app → L1)
