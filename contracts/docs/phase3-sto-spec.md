# Phase 3: STO Issuance Boundary and Revenue Attestation Spec

## EnergyFi — Path Comparison, On-Hold Token Scope, and CCIP-Oriented Revenue Messaging

2026.03.03 | Ver 3.1

---

## Status

Phase 3 remains **partially on hold**.

What is defined now:

- the business boundary for STO-related contracts
- the candidate issuance paths
- the Revenue Attestation payload model
- the restart conditions for implementation work

What is not fixed yet:

- the final token standard
- the final issuance ledger or chain
- the securities-firm integration surface for distribution-side operations

The repository currently contains a `RegionSTO` implementation based on ERC-20. Treat it as a prototype that reflects current code, not as the final policy decision for the production STO surface.

---

## 1. Why Phase 3 Is Not Fully Implemented Yet

Phase 3 depends on external legal and institutional decisions that EnergyFi does not control yet.

| Dependency | Why it blocks final implementation |
|:---|:---|
| Presidential Decree details | they determine the concrete issuer-account-manager requirements for direct issuance |
| KSD-supported chain decision | it determines where CCIP messages would terminate and how issuance would be anchored |
| Securities-firm partnership | it defines the production handoff for KYC/AML, distribution, and investor servicing |
| Issuance-path selection | it determines whether RegionSTO must exist on EnergyFi L1, another ledger, or not at all |

Because of those dependencies, the canonical Phase 3 scope is intentionally narrower than "build the STO token now."

---

## 2. Candidate Issuance Paths

EnergyFi documents three possible issuance paths.

| Path | Structure | Where the token lives | What EnergyFi provides | Main gating condition |
|:---|:---|:---|:---|:---|
| **CCIP Path (preferred for planning)** | EnergyFi L1 -> CCIP -> KSD-supported chain | KSD-supported chain or another approved issuance ledger | Revenue Attestation plus trusted charging and revenue data | KSD-supported chain and CCIP design finalized |
| **Path A: direct issuance** | EnergyFi acts as issuer-account manager on its own ledger | EnergyFi-controlled ledger | token issuance plus charging and revenue evidence | legal qualification and operating requirements confirmed |
| **Path B: delegated issuance** | a securities firm manages the issuance ledger | securities-firm ledger | charging and revenue evidence only | securities-firm partnership finalized |

### Why the CCIP path is the current planning default

- it minimizes the assumption that EnergyFi itself must qualify as the issuer-account manager
- it preserves the Phase 1-2 data model without forcing token logic into the EnergyFi L1 prematurely
- it matches the business rule that EnergyFi's strongest asset is trusted revenue evidence, not downstream securities operations

That planning preference is not the same thing as a final implementation decision.

---

## 3. Common Business Rules Across All Paths

The following rules apply regardless of which issuance path is selected.

### 3.1 On-chain station boundary

- all on-chain stations are EnergyFi-owned
- third-party CPO operations remain off-chain inside STRIKON
- on-chain revenue therefore always belongs to the investor pool for the mapped region

### 3.2 Region is the issuance unit

- issuance is grouped by Korean administrative region
- region identifiers follow the existing `bytes4` encoding used by Phase 1 and Phase 2
- Phase 3 must not introduce a second incompatible region-key system

### 3.3 Issuance is tranche-based

- issuance is periodic, not real-time per charging session
- each tranche must preserve the issuance period, referenced station set, and supporting revenue evidence
- the exact token mechanics remain path-dependent

### 3.4 Securities-firm boundary remains fixed

EnergyFi does **not** implement:

- on-chain KYC/AML logic
- dividend execution logic
- secondary-market transfer rules
- recovery, freeze, or forced-transfer workflows

Those concerns remain outside the EnergyFi contract scope until regulation and partnership terms make a specific integration necessary.

---

## 4. Revenue Attestation Model

Revenue Attestation is the core Phase 3 concept that is valid even before the final issuance path is locked.

### 4.1 Purpose

Revenue Attestation packages trusted revenue information from EnergyFi L1 into a verifiable payload that another ledger or operator can consume.

### 4.2 Planned payload shape

```solidity
struct RevenueAttestation {
    bytes4   regionId;
    uint256  periodStart;
    uint256  periodEnd;
    uint256  distributableKrw;
    bytes32  merkleRoot;
    uint256  stationCount;
}
```

Field intent:

- `regionId`: the region whose investor pool the revenue belongs to
- `periodStart` / `periodEnd`: the attested settlement window
- `distributableKrw`: the total revenue attributable to that region and period
- `merkleRoot`: a compact commitment to the included `ChargeTransaction` dataset
- `stationCount`: the number of contributing EnergyFi-owned stations

### 4.3 Data sources

Revenue Attestation is built from Phase 1-2 data:

- `RevenueTracker` supplies the region-level revenue total
- `StationRegistry` supplies region and station membership context
- `ChargeTransaction` supplies the session-level evidence set that can back the Merkle commitment

This is why Phase 2 is the real prerequisite for Phase 3, regardless of the final path.

---

## 5. CCIPRevenueSender Responsibilities

If the CCIP path is selected, the primary new contract on EnergyFi L1 is `CCIPRevenueSender`.

| Responsibility | Description |
|:---|:---|
| Data read | collects the required region-period revenue and supporting evidence references |
| Payload assembly | formats the `RevenueAttestation` structure |
| Transmission | sends the payload to the configured CCIP router / destination chain |
| Access control | follows the Bridge-gated ingestion pattern for outbound attestation submission |
| Audit surface | emits enough metadata for off-chain reconciliation with the destination-side issuance event |

`CCIPRevenueSender` is planned but not yet canonical implementation code.

---

## 6. What Is Fixed vs What Remains On Hold

| Topic | Status | Notes |
|:---|:---|:---|
| Region key system | **fixed** | same `bytes4` region scheme as earlier phases |
| Revenue source of truth | **fixed** | `RevenueTracker` remains the canonical revenue source |
| On-chain station ownership boundary | **fixed** | only EnergyFi-owned stations are on-chain |
| Tranche issuance principle | **fixed** | issuance is periodic and evidence-backed |
| Revenue Attestation payload category | **fixed** | region + period + amount + proof commitment |
| Final token standard | **on hold** | current ERC-20 prototype is not the final commitment |
| Final issuance ledger | **on hold** | depends on path selection |
| Compliance / transfer modules | **on hold** | out of scope until regulation and partner design are fixed |
| Production CCIP integration | **on hold** | depends on destination-chain and partner confirmation |

---

## 7. Restart Triggers for Implementation

Phase 3 implementation should resume only after the following questions are answered.

| # | Trigger | Why it matters |
|:---|:---|:---|
| 1 | the issuance path is selected | determines whether the token exists on EnergyFi L1, another ledger, or not at all |
| 2 | the Presidential Decree details are finalized | determines the feasibility of direct issuance |
| 3 | the KSD-supported chain is known | determines the target environment for CCIP receiver-side work |
| 4 | the securities-firm operating partner is chosen | fixes the operational boundary for investor-facing flows |
| 5 | the distribution venue strategy is chosen | may affect the production ledger and integration design |

Until then, Phase 3 work should stay at the spec and interface-design level.

---

## 8. Relationship to Phase 2

Phase 3 does not stand on its own. It packages and reuses the data created in Phase 2.

### 8.1 Required Phase 2 capabilities

- accurate `RevenueTracker.getRegionRevenue(...)` style aggregation
- region-consistent station registration in `StationRegistry`
- reliable session evidence from `ChargeTransaction`
- deterministic period boundaries for attestation assembly

### 8.2 Practical implication

If Phase 2 data quality is weak, Phase 3 cannot be trusted regardless of token standard choice. Revenue evidence quality outranks token-surface completeness.

---

## 9. Non-Canonical Items

The following are intentionally outside the canonical Phase 3 scope for now:

- UI mockups for issuance consoles
- final transfer compliance mechanics
- production KSD receiver contract details
- exchange-specific distribution integration logic

Those items may become real deliverables later, but they should not be confused with the current Phase 3 contract scope.

---

## References

| Document | Path |
|:---|:---|
| Implementation Roadmap | [implementation-roadmap.md](implementation-roadmap.md) |
| Phase 2 Spec | [phase2-transaction-spec.md](phase2-transaction-spec.md) |
| Phase 5 Spec | [phase5-carbon-spec.md](phase5-carbon-spec.md) |
| ERC Standards Analysis | [erc-standards-analysis.md](erc-standards-analysis.md) |
| Root Architecture | [../../docs/architecture.md](../../docs/architecture.md) |

---

*End of Document*
