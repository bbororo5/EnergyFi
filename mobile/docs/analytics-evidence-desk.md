# Analytics Evidence Desk

## Purpose

`Analytics` is the evidence layer of the investor app.

- `Home` answers: what changed and what needs attention now
- `Explore` answers: what kind of region this is
- `Analytics` answers: why the current state should be read that way

This screen is intentionally guest-safe.
It explains the network and each region with contract-readable facts, not personal P&L, APY, or ranking language.

## Contract Sources

`mobile` reads these contracts directly with `viem`.

- `IChargeTransaction.totalSessions()`
  - source for total recorded session count
- `IRevenueTracker`
  - `getRegionRevenue(bytes4)`
  - `getRegionAttestationPeriods(bytes4)`
  - `getRegionAttestation(bytes4,uint256)`
- `IStationRegistry`
  - `getStationsByRegion(bytes4)`
  - `getStation(bytes32)`
  - `getChargersByStation(bytes32)`
  - `getCharger(bytes32)`
- `IDeviceRegistry.isActiveChip(bytes32)`
  - source for active SE chip coverage
- `IReputationRegistry`
  - `getLatestRegionSnapshot(bytes4,uint8)`
  - `getRegionSnapshot(bytes4,uint8,uint256)`
  - `getRegionSnapshotPeriods(bytes4,uint8)`
- `IRegionSTOFactory.getRegionToken(bytes4)`
- `IRegionSTO`
  - `getTrancheCount()`
  - `getTrancheActiveStations(uint256)`

Runtime files:

- overview hook: `mobile/hooks/use-analytics-overview.ts`
- region detail hook: `mobile/hooks/use-region-analytics.ts`
- overview screen: `mobile/app/(tabs)/portfolio/index.tsx`
- detail screen: `mobile/app/(tabs)/portfolio/[id].tsx`

Runtime config can be overridden with:

- `EXPO_PUBLIC_ENERGYFI_RPC_URL`
- `EXPO_PUBLIC_CHARGE_TRANSACTION_ADDRESS`
- `EXPO_PUBLIC_REVENUE_TRACKER_ADDRESS`
- `EXPO_PUBLIC_STATION_REGISTRY_ADDRESS`
- `EXPO_PUBLIC_DEVICE_REGISTRY_ADDRESS`
- `EXPO_PUBLIC_REPUTATION_REGISTRY_ADDRESS`
- `EXPO_PUBLIC_REGION_STO_FACTORY_ADDRESS`

## Overview Sections

### 1. Evidence Snapshot

Top-of-screen desk showing:

- total recorded sessions
- published monthly snapshot regions
- latest finalized settlement period
- STO-live region count

This is the contract-backed equivalent of a dashboard headline.

### 2. Settlement & Revenue Proof

Network-level proof of value composed from:

- aggregated pending revenue across the region catalog
- latest finalized attestation period visible on-chain

If a region has pending revenue but no attestation yet, it is shown as `pending only`.

### 3. Operational Integrity

Coverage roll-up composed from:

- stations: active / total
- chargers: active / total
- active chip coverage

This section exists to explain whether revenue is being produced by a live and verifiable infrastructure base.

### 4. Region Evidence Cards

Each region card shows:

- pending revenue
- active charger ratio
- peak window
- primary site type
- latest finalized attestation state
- issuance state

Cards route to `/(tabs)/portfolio/[id]`, where `id` is the region code such as `KR11`.

### 5. Attention

This list surfaces explanation-worthy states, not alerts for drama.

Current triggers:

- monthly snapshot not published
- settlement continuity below threshold
- active charger ratio below threshold
- SE chip coverage below threshold
- issuance not live

## Region Detail Sections

Each detail screen is a region evidence drilldown.

### 1. Region Hero

- region identity
- latest snapshot period
- pending revenue
- latest finalized attested revenue
- STO state

### 2. Settlement Proof

- latest attestation period
- finalized revenue history
- pending-only fallback when no attestation exists

### 3. Operational Trust

- active / total stations
- active / total chargers
- active chips
- charger ratio
- chip coverage
- settlement continuity

### 4. Usage Rhythm

- session volume
- revenue stability
- peak window
- optional delta narrative against the previous monthly snapshot

### 5. Site Character

- primary site type
- 4-bucket site mix

### 6. Issuance Readiness

- STO deployed or not
- tranche count
- latest tranche active station coverage when available

## Fallback Rules

- Missing `ReputationRegistry` address does not break the tab.
  - reputation-backed fields become neutral fallbacks
- Missing attestation history does not hide the region.
  - the region reads as `pending only`
- Missing STO deployment does not imply failure.
  - the region reads as `Not issued yet`
- Unknown route params render a safe fallback instead of a crash

## Current Scope Boundary

- No personal holdings or wallet-specific P&L in v1
- No ranking, APY, or speculative scoring
- No full `ChargeTransaction.getSession()` scan for region rhythm
  - region rhythm is derived from `ReputationRegistry` monthly snapshots
