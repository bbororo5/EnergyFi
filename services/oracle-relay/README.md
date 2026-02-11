# Oracle Relay Service

A persistent TypeScript service that bridges Off-chain data (APEX Engine) to On-chain (C-Chain & Subnet).

## Responsibilities
1. Poll APEX Engine API (or Mock Data).
2. Sign transactions with Relayer Wallet.
3. Push `Revenue` data to C-Chain `EnergyOracle`.
4. Push `Detailed Logs` to Subnet `AssetLogger`.
