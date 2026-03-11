# Phase 5: Carbon Credit Smart Contract Spec

## EnergyFi — Parameter Versioning, Reduction Records, Verification Batches, and Verra References

2026.03.03 | Ver 1.1

---

## Objective

Phase 5 extends the trusted charging dataset into a carbon-credit evidence pipeline.

The goal is to:

- calculate EV charging-session reduction records using Verra VCS VM0038-aligned logic
- preserve the parameter set that was effective when each calculation was made
- group reductions into verification batches
- connect verified batches to append-only Verra issuance references

**Prerequisite:** a stable Phase 2 dataset and VVB process readiness
**Target window:** after the carbon verification workflow is operational

---

## 1. Methodology Summary

Phase 5 follows the VM0038-style high-level relationship:

```text
Net Reduction = Baseline Emissions - Project Emissions

Baseline = EC x (1 / AFEC) x EFfuel
Project  = EC x EFkw x efficiency adjustment
Leakage  = 0
```

Working interpretation:

- `EC`: charging energy from `ChargeTransaction`
- `AFEC`: average fuel economy parameter from `ParameterRegistry`
- `EFfuel`: fuel emission factor from `ParameterRegistry`
- `EFkw`: grid emission factor from `ParameterRegistry`
- efficiency adjustments may depend on charger or project assumptions captured in the parameter set

The exact code-level formula must remain auditable and version-aware.

---

## 2. Contract Graph

```text
ChargeTransaction
  -> CarbonReduction
     <- ParameterRegistry
  -> CarbonBatch
  -> VCUReference
```

Roles:

- `ParameterRegistry` preserves the parameter history
- `CarbonReduction` converts trusted charging sessions into reduction records
- `CarbonBatch` locks reduction sets for verification
- `VCUReference` records the external Verra issuance result

---

## 3. ParameterRegistry

### Purpose

`ParameterRegistry` stores versioned methodology parameters so EnergyFi and auditors can reconstruct which values applied to a historical session at a specific timestamp.

### Managed parameter categories

| Parameter | Typical role |
|:---|:---|
| `EFkw` | grid emission factor |
| `EFfuel` | fuel emission factor |
| `AFEC` | average fuel economy baseline parameter |
| `DCFC_EFF` | DC fast-charging efficiency adjustment |
| `EV_EFF` | EV efficiency parameter if used by the approved formula |

### Expected storage model

```solidity
struct ParameterEntry {
    uint256 value;
    uint256 effectiveFrom;
    uint256 setAt;
    address setBy;
}
```

Each parameter key maps to a chronological history of `ParameterEntry` values.

### Functional expectations

- admin-only writes
- future-effective entries allowed
- retroactive backdating disallowed unless an explicit governance policy says otherwise
- historical lookup by timestamp
- full history retrieval for audit reconstruction

### Why this matters

Without versioned parameter history, a reduction record cannot be independently re-derived by a VVB or later reviewer.

---

## 4. CarbonReduction

### Purpose

`CarbonReduction` creates the session-level reduction record. It is conceptually one step above `ChargeTransaction`.

### Critical design choice: immutable deployment

`CarbonReduction` should be deployed as an immutable contract, not behind a proxy.

Reason:

- methodology logic must be auditable as deployed bytecode
- if the methodology changes materially, a new contract version is easier to audit than an upgraded proxy implementation
- version boundaries can then be expressed by deployment date and operating window

### Expected reduction record shape

```solidity
struct ReductionRecord {
    uint256 chargeTransactionId;
    uint256 energyKwh;
    uint256 baselineEmissions;
    uint256 projectEmissions;
    uint256 netReduction;
    uint256 appliedEFkw;
    uint256 appliedEFfuel;
    uint256 appliedAFEC;
    uint256 appliedDCFC_EFF;
    uint256 calculatedAt;
}
```

### Functional expectations

- calculate a reduction from one `ChargeTransaction`
- support batch calculation for operational efficiency
- provide reverse lookup from `chargeTransactionId` to reduction record
- persist the parameter values that were applied at calculation time

### Data integrity rule

Each reduction record must be reproducible from:

1. the original `ChargeTransaction`
2. the parameter values effective at the session timestamp
3. the reduction contract version used at calculation time

---

## 5. CarbonBatch

### Purpose

`CarbonBatch` groups reduction records into verification windows and prevents double counting.

### Status model

```text
OPEN -> LOCKED -> VERIFIED
```

The status is one-way and irreversible.

### Expected batch record shape

```solidity
struct BatchRecord {
    uint256 batchId;
    uint256 timeStart;
    uint256 timeEnd;
    BatchStatus status;
    uint256 createdAt;
    uint256 lockedAt;
    uint256 verifiedAt;
    uint256[] reductionIds;
}
```

### Functional expectations

- create a time-bounded batch
- add reduction IDs while the batch is `OPEN`
- reject reduction IDs already committed to another batch
- lock the batch before verification
- mark the batch as verified only after the external verification step completes

### Why this matters

The batch layer is the protection against counting the same reduction twice across verification cycles.

---

## 6. VCUReference

### Purpose

`VCUReference` is the append-only bridge between EnergyFi's on-chain batch model and the external Verra issuance result.

### Append-only rule

Once a VCU record is written, it must not be edited or deleted.

### Expected record shape

```solidity
struct VCURecord {
    uint256 batchId;
    uint256 vcuQuantity;
    string  verraRegistryNumber;
    uint256 issuanceDate;
    bytes32 verificationHash;
}
```

### Functional expectations

- record a Verra issuance result for a verified batch
- reject writes for batches that are not yet verified
- allow reverse lookup from `batchId` to the recorded Verra reference

### Audit rationale

This contract provides the final on-chain pointer needed for end-to-end traceability:

`ChargeTransaction -> CarbonReduction -> CarbonBatch -> VCUReference`

---

## 7. Cross-Phase Dependency Rules

Phase 5 must preserve the following boundaries:

1. it may read Phase 2 data, but must not mutate Phase 2 source records
2. it may introduce its own immutable and append-only layers, but not retroactively rewrite charging evidence
3. it must remain compatible with the hardware-rooted trust chain established in Phases 1 and 2

Carbon logic is derived logic. It must never become a reason to weaken the charging-record pipeline.

---

## 8. Deployment and Versioning Guidance

Recommended sequencing:

1. deploy `ParameterRegistry`
2. seed the approved parameter set
3. deploy the current `CarbonReduction` version
4. deploy `CarbonBatch`
5. deploy `VCUReference`

Versioning rule:

- parameter changes are handled inside `ParameterRegistry`
- formula changes should trigger a new `CarbonReduction` deployment
- verification history is recorded at the batch and VCU-reference layers, not by rewriting past reductions

---

## 9. Test Checklist

- [ ] parameter lookup returns the value effective at a historical timestamp
- [ ] future-effective parameters become active only after the effective time
- [ ] reduction calculation reproduces the expected value for representative sessions
- [ ] the same `chargeTransactionId` cannot be minted into conflicting reduction records if uniqueness is required by the implementation
- [ ] batches reject duplicate or already-assigned reduction IDs
- [ ] `OPEN -> LOCKED -> VERIFIED` is strictly one-way
- [ ] VCU references reject unverified batches
- [ ] append-only guarantees are enforced for VCU records

---

## References

| Document | Path |
|:---|:---|
| Implementation Roadmap | [implementation-roadmap.md](implementation-roadmap.md) |
| Phase 2 Spec | [phase2-transaction-spec.md](phase2-transaction-spec.md) |
| Phase 3 Spec | [phase3-sto-spec.md](phase3-sto-spec.md) |
| Root Architecture | [../../docs/architecture.md](../../docs/architecture.md) |

---

*End of Document*
