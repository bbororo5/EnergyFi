# Phase 4: Reputation Snapshot Spec

## EnergyFi — Region-Level Derived Metrics for Explore

2026.03.09 | Ver 1.1

---

## Objective

Phase 4 defines the on-chain snapshot model for region-level reputation data used by the Explore experience.

The core rule is simple:

- the chain stores machine-readable derived metrics
- the mobile client turns those metrics into narrative or visual storytelling
- the chain does not store user-facing story text

This keeps the contract surface stable while allowing Explore to evolve independently at the UI layer.

---

## 1. Product Role of the Reputation Layer

The three main investor-facing surfaces have different jobs.

| Surface | Primary question | Reputation role |
|:---|:---|:---|
| **Home** | what is happening now | summary and monitoring |
| **Explore** | what kind of region is this | narrative browsing based on derived metrics |
| **Analytics** | why should I trust this interpretation | evidence and drill-down |

`ReputationRegistry` exists for Explore. It is not a ranking engine and it is not a text-content store.

---

## 2. Scope

### Included in v1

- region-level snapshots keyed by `bytes4 regionId`
- weekly and monthly cadence support
- three metric families: trust, rhythm, and site character
- Bridge/oracle-driven upsert publishing
- provenance via `sourceHash`

### Excluded from v1

- station-level reputation snapshots
- stored narrative sentences or story chips
- final ranking or grade labels
- policy-subsidy or government-support datasets
- direct frontend rendering rules

---

## 3. Contract Surface

| Item | Path |
|:---|:---|
| Interface | `contracts/contracts/interfaces/ops/IReputationRegistry.sol` |
| Implementation | `contracts/contracts/ops/ReputationRegistry.sol` |

The contract follows the same general control model as the rest of the data-ingestion surface:

- writers are Bridge- or oracle-controlled
- readers are public
- the contract stores published derived facts, not raw operational logs

---

## 4. Snapshot Key Model

### 4.1 Primary key

Each snapshot is keyed by:

```text
(regionId, granularity, periodId)
```

### 4.2 Granularity enum

```solidity
enum PeriodGranularity {
    UNKNOWN,
    WEEKLY,
    MONTHLY
}
```

Rules:

- `UNKNOWN` is a sentinel only and must never be used for a published snapshot
- `WEEKLY` uses `YYYYWW` based on ISO week numbering in the `Asia/Seoul` timezone
- `MONTHLY` uses `YYYYMM` in the `Asia/Seoul` timezone

Examples:

- `202610` means ISO week 10 of 2026
- `202603` means March 2026

### 4.3 Upsert behavior

- a snapshot key may be overwritten if the source data is recomputed
- `updatedAt` tracks the most recent publication time
- `getLatestRegionSnapshot()` should treat the largest `periodId` as the latest canonical period
- `getRegionSnapshotPeriods()` should return unique periods sorted oldest to newest

---

## 5. Snapshot Invariants

The registry must enforce the following invariants.

### 5.1 Common invariants

- `granularity != UNKNOWN`
- all basis-point fields stay within `0..10_000`
- `periodId` must match the chosen granularity format

### 5.2 Site metrics invariants

- if all site mix ratios are zero, `primaryType` must be `UNKNOWN`
- otherwise the site mix ratios must sum to exactly `10_000`
- if exactly one bucket is the maximum, `primaryType` must equal that bucket
- if the maximum is tied, `primaryType` must be `MIXED`

### 5.3 Rhythm metrics invariants

- `peakStartHour` and `peakEndHour` must both be in `0..23`
- time windows are interpreted as half-open intervals in the `Asia/Seoul` timezone
- `start > end` means an overnight window
- published snapshots must not use `start == end`

---

## 6. Metric Families

### 6.1 Trust metrics

These answer: "how operationally reliable does this region look?"

| Field | Meaning | Unit |
|:---|:---|:---|
| `activeChargerRatioBps` | share of chargers currently active | basis points |
| `maintenanceResolutionRateBps` | maintenance resolution performance | basis points |
| `settlementContinuityBps` | continuity of settled revenue periods | basis points |

### 6.2 Rhythm metrics

These answer: "what kind of usage rhythm does this region have?"

| Field | Meaning | Unit |
|:---|:---|:---|
| `sessionVolume` | session count in the period | count |
| `revenueStabilityBps` | stability of revenue over time | basis points |
| `peakStartHour` | beginning of the dominant usage window | hour |
| `peakEndHour` | end of the dominant usage window | hour |

### 6.3 Site metrics

These answer: "what kind of place is this region dominated by?"

```solidity
enum SiteType {
    UNKNOWN,
    RESIDENTIAL,
    WORKPLACE,
    PUBLIC_COMMERCIAL,
    MIXED
}
```

| Field | Meaning | Unit |
|:---|:---|:---|
| `primaryType` | dominant site category | enum |
| `residentialBps` | residential share | basis points |
| `workplaceBps` | workplace share | basis points |
| `publicCommercialBps` | public or commercial share | basis points |
| `mixedBps` | mixed-use share | basis points |

### 6.4 Metric versioning

`metricVersion` exists so the calculation formula can evolve without renaming the public field set.

What stays stable:

- field names
- semantic direction
- units

What may change:

- the exact weighting or calculation logic used by the publisher

If that logic changes, increment `metricVersion`.

---

## 7. Provenance: Canonical `sourceHash`

`sourceHash` is the publisher's compact commitment to the input bundle used to compute the snapshot.

```solidity
keccak256(
    abi.encode(
        regionId,
        granularity,
        periodId,
        metricVersion,
        chargeDataRoot,
        revenueDataRoot,
        stationDataRoot,
        opsDataRoot
    )
)
```

Input-root meaning:

- `chargeDataRoot`: normalized charge/session input digest
- `revenueDataRoot`: normalized revenue input digest
- `stationDataRoot`: normalized station / charger inventory digest
- `opsDataRoot`: normalized maintenance and site-classification digest

Unused source domains should be represented as `bytes32(0)`.

---

## 8. Source Mapping

`ReputationRegistry` does not derive its metrics on-chain from scratch. STRIKON calculates the snapshot off-chain and publishes the final values plus provenance.

| Source | Contribution |
|:---|:---|
| `IChargeTransaction` | session volume, time-window distribution, charger and station context |
| `IRevenueTracker` | revenue stability and settlement continuity inputs |
| `IStationRegistry` | active charger ratio and region inventory context |
| `IDeviceRegistry` | trust-boundary context for future metric evolution; not a v1 headline metric source |
| STRIKON operational data | maintenance handling and site classification inputs |

---

## 9. Writer Model and Admin Surface

The intended writer is the STRIKON Bridge/oracle.

Operational rules:

- end users never write directly to the registry
- the chain stores derived facts only
- the frontend reads snapshots and composes the narrative presentation

Expected implementation pattern:

- UUPS upgradeability
- `AccessControl`
- Bridge- or publisher-gated write functions
- pausability for operational safety

---

## 10. Public Interface Expectations

The registry should guarantee at least the following surfaces.

### Write

- `upsertRegionSnapshot`
- `upsertRegionSnapshots`

### Read

- `getRegionSnapshot`
- `getLatestRegionSnapshot`
- `getRegionSnapshotPeriods`
- `hasRegionSnapshot`

### Missing-data semantics

- `getRegionSnapshot` reverts for a missing key
- `getLatestRegionSnapshot` reverts if no snapshot exists for the cadence
- `hasRegionSnapshot` is the existence guard for callers

### Event

- `RegionSnapshotUpserted`

---

## 11. Test Checklist

- [ ] publishing reverts when `granularity == UNKNOWN`
- [ ] weekly and monthly `periodId` validation works correctly
- [ ] site mix invariants reject invalid basis-point totals
- [ ] latest-snapshot reads follow the highest `periodId`
- [ ] period listings remain unique and sorted oldest to newest
- [ ] unauthorized writers cannot upsert snapshots
- [ ] batch upsert emits the expected event surface

---

## References

| Document | Path |
|:---|:---|
| Implementation Roadmap | [implementation-roadmap.md](implementation-roadmap.md) |
| Phase 2 Spec | [phase2-transaction-spec.md](phase2-transaction-spec.md) |
| Root Architecture | [../../docs/architecture.md](../../docs/architecture.md) |

---

*End of Document*
