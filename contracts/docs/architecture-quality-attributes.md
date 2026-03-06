# Architecture Quality Attributes

## EnergyFi — Evaluation Framework for Design, Implementation, and Code Review

2026.03.06 | Ver 1.0

---

## Purpose

This document defines the architecture quality attributes (a.k.a. "-ilities") that EnergyFi must satisfy. These attributes serve as **evaluation criteria** at every stage of the development lifecycle:

- **Architecture design**: Does the proposed design preserve these attributes?
- **Code implementation**: Does the code meet attribute-specific requirements?
- **Code review**: Does the change maintain or improve attribute compliance?

Each attribute is assigned a **tier** reflecting its criticality to the business:

| Tier | Meaning | Consequence of Violation |
|:---|:---|:---|
| **Tier 1 — Non-Negotiable** | Violation means the system cannot operate legally or safely | Regulatory penalty, investor loss, trust chain breach |
| **Tier 2 — Critical** | Violation degrades system quality to unacceptable levels | Data inconsistency, audit failure, upgrade breakage |
| **Tier 3 — Important** | Violation increases technical debt or operational cost | Maintainability burden, onboarding difficulty |

---

## Tier 1: Non-Negotiable (Must Never Be Compromised)

### 1. Regulatory Compliance

**Definition**: All on-chain behavior must conform to applicable Korean financial regulations — the Capital Markets Act, the Electronic Securities Act (effective 2027.02.04), and KSD total-supply management requirements.

**Evaluation Criteria**:
- [ ] STO tokens enforce admin-only transfer (no unauthorized secondary market movement)
- [ ] `totalSupply()` is always verifiable and matches issued tranches exactly
- [ ] No on-chain dividend distribution logic (securities firm domain per CLAUDE.md §2.5)
- [ ] No on-chain KYC/AML logic (securities firm domain per CLAUDE.md §2.6)
- [ ] Issuance scope only — no distribution mechanics (CLAUDE.md §2.6)

**Relevant Contracts**: RegionSTO, RegionSTOFactory, RevenueTracker

---

### 2. Investor Asset Protection

**Definition**: Token balances, revenue records, and settlement attestations must never be corrupted, lost, or incorrectly calculated. Investor-facing state changes require the highest level of correctness guarantees.

**Evaluation Criteria**:
- [ ] Mint/burn/transfer functions are admin-gated (`onlyRole(DEFAULT_ADMIN_ROLE)`)
- [ ] No arithmetic overflow/underflow (Solidity ^0.8.20 built-in checks)
- [ ] Settlement records are append-only and immutable once written
- [ ] RegionAttestation records are idempotent (PeriodAlreadyFinalized guard)
- [ ] Storage layout is upgrade-safe (gap pattern, append-only storage)

**Relevant Contracts**: RegionSTO, RevenueTracker, RevenueTracker

---

### 3. Hardware Trust Chain Integrity

**Definition**: The TPM 2.0 SE → Bridge → On-chain data flow must never be bypassed or weakened. This is EnergyFi's core differentiator (Bookend Signature Model).

**Evaluation Criteria**:
- [ ] `DeviceRegistry.verifySignature()` is called on every `ChargeTransaction.mint()`
- [ ] `onlyBridge` modifier is enforced on all external data ingestion points
- [ ] SE chip public keys are enrolled before charger deployment
- [ ] No bypass mode exists in production code paths
- [ ] Bridge wallet uses AWS KMS HSM (FIPS 140-2 Level 3)

**Relevant Contracts**: DeviceRegistry, ChargeTransaction, ChargeRouter

---

### 4. On-Chain Data Immutability

**Definition**: Once recorded, charging session data and carbon reduction calculations must not be retroactively modifiable. This is required for VVB audit integrity and investor trust.

**Evaluation Criteria**:
- [ ] ChargeTransaction tokens are Soulbound (non-transferable after mint)
- [ ] CarbonReduction contract is deployed as immutable (no proxy)
- [ ] Settlement and attestation records have no delete/update functions
- [ ] seSignature is preserved in events (not in storage, for gas efficiency)

**Relevant Contracts**: ChargeTransaction, CarbonReduction, RevenueTracker

---

## Tier 2: Critical (Must Be Maintained for System Quality)

### 5. Atomicity & Data Consistency

**Definition**: Multi-contract operations must succeed or fail as a unit. No partial state is acceptable.

**Evaluation Criteria**:
- [ ] `ChargeRouter.processCharge()` atomically executes mint + recordRevenue
- [ ] `claimRegion()` settles all eligible stations or reverts entirely
- [ ] `issueTranche()` validates all stations before minting any tokens
- [ ] Single-pass validation pattern (validate + write in one loop, no two-phase)

**Relevant Contracts**: ChargeRouter, RevenueTracker, RegionSTO

---

### 6. Upgradeability Safety

**Definition**: UUPS proxy upgrades must never corrupt storage layout or break existing functionality. This is critical because 7 of 10 deployed contracts use UUPS proxies.

**Evaluation Criteria**:
- [ ] All upgradeable contracts include `uint256[50] private __gap` (or appropriate size)
- [ ] New storage is appended after existing storage — gap size adjusted accordingly
- [ ] `_authorizeUpgrade()` is restricted to `DEFAULT_ADMIN_ROLE`
- [ ] Regression tests verify V1 data survives V2 upgrade
- [ ] `_disableInitializers()` is called in constructors

**Relevant Contracts**: All UUPS contracts (DeviceRegistry, StationRegistry, ChargeTransaction, RevenueTracker, ChargeRouter, RegionSTO, RegionSTOFactory)

---

### 7. Auditability & Transparency

**Definition**: All state-changing operations must emit events with sufficient data for off-chain audit reconstruction. KSD, VVB auditors, and investors must be able to independently verify on-chain state.

**Evaluation Criteria**:
- [ ] Every state-changing function emits an indexed event
- [ ] Events include both old and new values for configuration changes
- [ ] `totalSupply()` matches sum of all issued tranches (KSD verification)
- [ ] RegionAttestation provides complete settlement proof (amount, station count, timestamp)
- [ ] SE signatures are preserved in events for off-chain verification

**Relevant Contracts**: All contracts

---

### 8. Access Control Correctness

**Definition**: Role-based access control must be correctly applied at every entry point. The system distinguishes three caller categories: admin, bridge, and public (view-only).

**Evaluation Criteria**:
- [ ] Admin functions use `onlyRole(DEFAULT_ADMIN_ROLE)`
- [ ] Bridge functions use `onlyBridge` modifier
- [ ] No function accidentally exposes state-changing capability to unauthorized callers
- [ ] `initialize()` uses `initializer` modifier (prevents re-initialization)
- [ ] Zero-address validation on all address parameters in constructors/initializers

**Relevant Contracts**: All contracts

---

## Tier 3: Important (Reduces Technical Debt)

### 9. Extensibility Without Full Upgrade

**Definition**: Common configuration changes should not require a full UUPS proxy upgrade. Admin-only setter functions with events provide a lighter-weight extension mechanism.

**Evaluation Criteria**:
- [ ] Mutable references (impl addresses, registry addresses) have setter functions
- [ ] Setter functions validate inputs (zero-address check) and emit events
- [ ] New features can be added via V2 upgrade without breaking V1 storage

**Relevant Contracts**: RegionSTOFactory (updateRegionSTOImpl, updateStationRegistry)

---

### 10. Test Coverage & Regression Safety

**Definition**: Every public function must have corresponding unit tests. Upgrade scenarios must have regression tests verifying data preservation.

**Evaluation Criteria**:
- [ ] Unit test count ≥ function count × 3 (happy path + failure + edge case)
- [ ] Integration tests cover cross-contract flows (Phase 1→2→3 pipeline)
- [ ] Upgrade tests verify existing storage is preserved after UUPS upgrade
- [ ] Custom errors are tested (not just revert, but correct error name)

**Current Status**: 329 passing, 1 pending (P-256 precompile skip)

---

### 11. Documentation Quality

**Definition**: All contracts, interfaces, and test files must have English NatSpec/comments. Architecture decisions must be documented with rationale.

**Evaluation Criteria**:
- [ ] All public/external functions have `@notice` and `@param` NatSpec
- [ ] All custom errors have descriptive names (not generic codes)
- [ ] Interface files define the full contract API surface
- [ ] Architecture decisions are recorded in spec documents

---

### 12. Code Clarity & Minimalism

**Definition**: Prefer simple, readable code over clever optimizations. This is a zero-gas private chain — gas optimization is irrelevant. Correctness and auditability are paramount.

**Evaluation Criteria**:
- [ ] No premature abstractions (three similar lines > one clever abstraction)
- [ ] No dead code or unused imports
- [ ] Single responsibility per function
- [ ] Error messages are descriptive custom errors (not `require` strings)
- [ ] Storage gap pattern is consistent across all upgradeable contracts

---

## Attribute × Contract Matrix

| Contract | Tier 1 (1-4) | Tier 2 (5-8) | Tier 3 (9-12) |
|:---|:---|:---|:---|
| DeviceRegistry | 3, 4 | 6, 7, 8 | 10, 11, 12 |
| StationRegistry | — | 6, 7, 8 | 10, 11, 12 |
| ChargeTransaction | 3, 4 | 5, 6, 7, 8 | 10, 11, 12 |
| RevenueTracker | 1, 2, 4 | 5, 6, 7, 8 | 10, 11, 12 |
| ChargeRouter | 3 | 5, 6, 7, 8 | 10, 11, 12 |
| RegionSTO | 1, 2 | 5, 6, 7, 8 | 10, 11, 12 |
| RegionSTOFactory | 1 | 6, 7, 8 | 9, 10, 11, 12 |

---

## How to Use This Framework

### During Architecture Design
> "Does this design choice satisfy all Tier 1 attributes? Does it maintain Tier 2?"

### During Implementation
> "Does this code change preserve attribute X? If not, what is the justification?"

### During Code Review
> "Grade each relevant attribute A/B/C. Any attribute below B requires remediation before merge."

### Grading Scale

| Grade | Meaning |
|:---|:---|
| **A+** | Exceeds requirements, sets a positive example |
| **A** | Fully satisfies all criteria |
| **B** | Satisfies most criteria, minor gaps |
| **C** | Significant gaps, remediation needed |
| **F** | Attribute violated, must fix before merge |

---

## References

| Document | Path |
|:---|:---|
| CLAUDE.md (Business Constraints) | `CLAUDE.md` §2 |
| Implementation Roadmap | `contracts/docs/implementation-roadmap.md` |
| Phase 3 STO Spec | `contracts/docs/phase3-sto-spec.md` |
| Platform Policies | `docs/platform-policies.md` |

---

*End of Document*
