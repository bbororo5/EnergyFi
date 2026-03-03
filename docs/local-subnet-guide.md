# EnergyFi — Local Subnet Guide

Guide for creating, deploying, and operating a local Avalanche L1 subnet for EnergyFi development.

---

## 1. Toolchain

| Tool | Version | Notes |
|:---|:---|:---|
| Avalanche CLI | v1.9.6 | `~/bin/avalanche` (maintenance mode) |
| AvalancheGo | v1.14.1 | Auto-installed by CLI; includes Subnet-EVM v0.8.0 (grafted) |
| Subnet-EVM | v0.8.0 | Cancun EVM opcodes supported |

---

## 2. Quick Start

```bash
# 1. Create the chain
avalanche blockchain create energyfitest --test-defaults --evm --latest

# 2. Deploy locally
avalanche blockchain deploy energyfitest --local

# 3. Update .env with the new RPC URL (printed in deploy output)
#    ENERGYFI_L1_LOCAL_RPC=http://127.0.0.1:9654/ext/bc/<BlockchainID>/rpc

# 4. Fund the deployer from the ewoq test account
#    (see Section 5 below)

# 5. Deploy contracts
cd contracts && npm run deploy:local

# 6. Run tests
npm test              # Unit tests (in-memory EVM, ~14s)
npm run test:live     # Live integration tests (local subnet, ~230s)
```

---

## 3. What `--test-defaults` Does

The `--test-defaults` flag is the only reliable way to create a working local L1 as of CLI v1.9.6. It auto-configures:

| Setting | Value | Why It Matters |
|:---|:---|:---|
| Mode | Sovereign L1 + PoA | Validator Manager contracts are properly allocated and initialized |
| Genesis timestamp | Current wall-clock time | Must be after the hardcoded Shanghai/Cancun activation times |
| EVM upgrades | Shanghai + Cancun active | Hardcoded internally by Subnet-EVM v0.8.0 (`1607144400`) |
| feeConfig | Standard (minBaseFee: 25 gwei) | Zero-gas config causes block production failures locally |
| warpConfig | Enabled | Required for Validator Manager initialization |
| Alloc | ewoq account + Validator Manager contracts | ewoq receives ~1,000,000 EFI; deployer receives ~10 EFI |

### Generated Files

All files are stored at `~/.avalanche-cli/subnets/<chainName>/`:

| File | Purpose |
|:---|:---|
| `genesis.json` | Chain initial state (alloc, feeConfig, upgrades) |
| `sidecar.json` | CLI metadata (VM version, network info, mode) |
| `chain.json` | Subnet-EVM runtime config (logging, enabled APIs) |

---

## 4. Rules — What to Follow

### 4.1 Always use `--test-defaults`

Do not use the CLI wizard or `--genesis` flag with a custom genesis file. The CLI default genesis includes critical components (Validator Manager alloc, warpConfig, correct timestamps) that are difficult to replicate manually.

### 4.2 Update `.env` after every `network clean`

Running `avalanche network clean` destroys the chain state. After recreating, the Blockchain ID changes, which means the RPC URL changes.

```bash
# After deploy, update .env:
ENERGYFI_L1_LOCAL_RPC=http://127.0.0.1:9654/ext/bc/<NEW_BLOCKCHAIN_ID>/rpc
```

### 4.3 Chain name: no hyphens

Avalanche CLI does not allow hyphens in chain names. Use `energyfitest`, not `energyfi-test`.

### 4.4 Fund the deployer before testing

`--test-defaults` allocates most funds to the **ewoq** account. Transfer funds to the deployer before running tests (see Section 5).

### 4.5 Keep `solidity: "0.8.28"` in hardhat.config.ts

Do not downgrade `evmVersion` to `"paris"`. The local subnet supports Cancun, and OpenZeppelin 5.x requires `PUSH0` (Shanghai) and `MCOPY` (Cancun).

---

## 5. The ewoq Test Account

The ewoq account is a well-known Avalanche local test account pre-funded by `--test-defaults`.

| Field | Value |
|:---|:---|
| Address | `0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC` |
| Private Key | `REDACTED_LOCAL_TEST_PRIVATE_KEY` |
| Balance | ~1,000,000 EFI |

### Transfer Script

```javascript
const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider(process.env.ENERGYFI_L1_LOCAL_RPC);
const ewoq = new ethers.Wallet(
  "REDACTED_LOCAL_TEST_PRIVATE_KEY",
  provider
);

const tx = await ewoq.sendTransaction({
  to: "0xBdDFc6fdF2F28cBb67eadeCdB0165a15741387aD", // deployer
  value: ethers.parseEther("10000"),
});
await tx.wait();
```

---

## 6. Anti-Patterns — What to Avoid

### 6.1 Do NOT add explicit EVM upgrade timestamps to genesis

Subnet-EVM v0.8.0 hardcodes Shanghai and Cancun activation times (`1607144400`, Dec 2020) for local networks. Adding any of these keys to a custom genesis causes **block production to stop**:

```json
// DO NOT add any of these:
"shanghaiTime": 0,
"cancunTime": 0,
"subnetEVMTimestamp": 0,
"durangoTimestamp": 0,
"etnaTimestamp": 0,
"fortunaTimestamp": 0,
"graniteTimestamp": 0
```

### 6.2 Do NOT set genesis timestamp to `0x0`

A zero timestamp is earlier than the hardcoded Shanghai/Cancun activation time (`1607144400`), so Cancun opcodes (`PUSH0`, `MCOPY`) will be **disabled**. This causes OpenZeppelin 5.x contracts to fail at deployment with `invalid opcode` errors.

### 6.3 Do NOT use zero-gas feeConfig locally

While EnergyFi mainnet is a zero-gas chain, the local subnet fails to produce blocks with:
```json
// This breaks local block production:
"baseFeeChangeDenominator": 1,
"maxBlockGasCost": 0,
"blockGasCostStep": 0
```
Use the standard feeConfig from `--test-defaults` instead. Gas costs are irrelevant for testing since ewoq has ~1M EFI.

### 6.4 Do NOT use `--genesis` with a custom genesis file

Passing `--genesis l1-config/genesis.json` skips the CLI's auto-generated components:
- Validator Manager contract alloc (required for PoA block production)
- warpConfig (required for Validator Manager initialization)
- Correct genesis timestamp

Without these, the chain either fails to produce blocks or fails to initialize the Validator Manager.

### 6.5 Do NOT set `evmVersion: "paris"` in Hardhat config

This was a previous workaround that disabled Cancun opcodes at compile time. It causes runtime failures because OpenZeppelin 5.x internally relies on `PUSH0` and `MCOPY`.

### 6.6 Do NOT hardcode RPC URLs in hardhat.config.ts

Always read from `.env` via `process.env.ENERGYFI_L1_LOCAL_RPC`. The Blockchain ID changes on every `network clean` + recreate cycle.

---

## 7. Network Lifecycle Commands

```bash
# Start a previously deployed chain
avalanche network start

# Stop the chain (preserves state)
avalanche network stop

# Full reset (destroys state, Blockchain ID changes)
avalanche network stop
avalanche network clean
avalanche blockchain delete energyfitest
avalanche blockchain create energyfitest --test-defaults --evm --latest
avalanche blockchain deploy energyfitest --local
# → Update .env with new RPC URL
# → Fund deployer from ewoq
# → Redeploy contracts: cd contracts && npm run deploy:local
```

---

## 8. Test Environments

| Environment | Command | EVM Level | P-256 (RIP-7212) | Speed |
|:---|:---|:---|:---|:---|
| Hardhat in-memory | `npm test` | Cancun | Not supported (skipped) | ~14s |
| Local subnet | `npm run test:live` | Cancun | Requires custom genesis | ~230s |

### P-256 Precompile (RIP-7212) — Known Limitation

The `--test-defaults` genesis does not include `secp256r1SignVerifyConfig`. Enabling P-256 requires a custom genesis, but custom genesis files currently cause block production failures (see Section 6.1, 6.4). This remains unresolved.

The DeviceRegistry P-256 test is marked as `pending` in unit tests and uses `@noble/curves/nist.js` for off-chain signature generation.

> **Note:** `@noble/curves` v2.0.1 changed the import path from `@noble/curves/p256` to `@noble/curves/nist.js`.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|:---|:---|:---|
| `invalid opcode` on deploy | Cancun not active (timestamp too old or `evmVersion: "paris"`) | Recreate chain with `--test-defaults`; ensure no `evmVersion` override in hardhat config |
| Deploy TX hangs indefinitely | Blocks not being produced | Recreate chain with `--test-defaults` (do not use custom genesis) |
| 404 on RPC calls | Wrong Blockchain ID in `.env` | Update `ENERGYFI_L1_LOCAL_RPC` with new ID from deploy output |
| `insufficient funds` in tests | Deployer ran out of EFI | Transfer from ewoq account (see Section 5) |
| `connection refused` on port 9654 | Chain not running | `avalanche network start` |
| CLI rejects chain name | Hyphen in name | Use alphanumeric only (e.g., `energyfitest`) |

---

*Last updated: 2026-03-05*
