# Phase 2: Charging Transaction Smart Contract Spec

## EnergyFi — ChargeTransaction + RevenueTracker + ChargeRouter Implementation Guide

2026.03.03 | Ver 2.1

---

## Objective

When STRIKON emits `invoice.paid`, EnergyFi permanently records the charging session on-chain and updates station-level and region-level revenue aggregates in the same transaction.

**Timeline**: 2026.04 to 2026.06
**Prerequisite**: Phase 1 completed (`DeviceRegistry` + `StationRegistry` deployed, SE chips enrolled)

---

## Confirmed Design Decisions

| # | Topic | Decision |
|:---|:---|:---|
| 1 | ERC-721 ownership | Soulbound, minted to the contract itself |
| 2 | SE signature verification | Production uses real SE signatures; development and testing may use generated P-256 keys, but no bypass is allowed |
| 3 | UUID encoding | Remove prefix and hyphens, then encode as deterministic `bytes32` |
| 4 | Operational tooling | Dashboards and mock oracles are non-canonical helper tools |
| 5 | `period_yyyyMM` | Computed off-chain by the Bridge and passed as a parameter |
| 6 | Upgradeability | UUPS proxy pattern |
| 7 | Atomicity | `ChargeRouter` executes mint + revenue record in a single call |
| 8 | Station validation | Unregistered `stationId` always reverts |
| 9 | Period ordering | Attestation periods must be unique and sorted oldest → newest |
| 10 | Data transformation | The Bridge owns UUID, timestamp, kWh, and period transformations |

---

## Contracts

### ChargeTransaction (ERC-721, Soulbound, UUPS)

**Purpose**: mint one ERC-721 token per settled charging session after verifying the SE signature.
The token is not a consumer NFT. It is a permanent session-level proof record.

#### Soulbound behavior

- `mint()` always mints to `address(this)`
- Transfers after mint are blocked
- The contract uses ERC-721 as a uniqueness model, not as a tradable NFT model

```solidity
function _update(address to, uint256 tokenId, address auth)
    internal override returns (address)
{
    address from = _ownerOf(tokenId);
    if (from != address(0)) {
        revert SoulboundToken();
    }
    return super._update(to, tokenId, auth);
}
```

#### ChargeSession struct

```solidity
struct ChargeSession {
    bytes32 sessionId;
    bytes32 chargerId;
    uint8   chargerType;       // 0: L1, 1: L2, 2: DCFC
    uint256 energyKwh;         // kWh * 100
    uint256 startTimestamp;
    uint256 endTimestamp;
    uint8   vehicleCategory;   // 0: UNKNOWN, 1: BEV, 2: PHEV
    bytes4  gridRegionCode;    // carbon grid factor lookup
    bytes32 stationId;
    uint256 distributableKrw;
    bytes   seSignature;
}
```

#### Mint flow

```solidity
function mint(ChargeSession calldata session)
    external onlyBridge returns (uint256 tokenId)
```

Validation sequence:

1. Reject duplicate `sessionId`
2. Verify `stationId` in `StationRegistry`
3. Confirm the chip is active in `DeviceRegistry`
4. Verify the SE signature
5. Mint the ERC-721 token to `address(this)`
6. Store session data
7. Emit `ChargeSessionRecorded`

#### Events

```solidity
event ChargeSessionRecorded(
    uint256 indexed tokenId,
    bytes32 indexed sessionId,
    bytes32 indexed chargerId,
    bytes32         stationId,
    bytes4          gridRegionCode,
    uint256         energyKwh,
    uint256         distributableKrw,
    uint256         startTimestamp,
    uint256         endTimestamp,
    bytes           seSignature
);
```

#### Custom errors

```solidity
error SoulboundToken();
error DuplicateSession();
error StationNotRegistered();
error ChipNotActive();
error InvalidSESignature();
error SessionNotFound(uint256 tokenId);
error CallerNotBridge();
```

---

### RevenueTracker (UUPS)

**Purpose**: accumulate revenue immediately after a successful mint.
All on-chain stations are EnergyFi-owned, so on-chain revenue always belongs to the corresponding region investor pool.

#### Revenue model

```text
All on-chain stations (EnergyFi-owned)
  -> distributableKrw accumulates on-chain
  -> 100% attributable to the relevant region investor pool

Third-party CPO stations
  -> not registered on-chain
  -> remain off-chain in STRIKON only
```

#### Core storage model

```solidity
mapping(bytes32 => uint256) public stationAccumulated;
mapping(bytes32 => uint256) public stationSettled;
mapping(bytes32 => MonthlyRevenue[]) private _monthlyHistory;
mapping(bytes32 => SettlementRecord[]) private _settlementHistory;
```

#### Key functions

```solidity
recordRevenue(bytes32 stationId, uint256 distributableKrw, uint256 period_yyyyMM)
getStationRevenue(bytes32 stationId)
getStationRevenuePeriod(bytes32 stationId, uint256 period_yyyyMM)
getRegionRevenue(bytes4 regionId)
claimStation(bytes32 stationId)
claimRegion(bytes4 regionId, uint256 period_yyyyMM)
getSettlementHistory(bytes32 stationId)
getRegionAttestationPeriods(bytes4 regionId)
```

Key rules:

- `distributableKrw == 0` reverts
- Unknown `stationId` reverts
- `claimRegion()` settles all eligible stations atomically per call
- `getRegionAttestationPeriods()` returns unique periods in ascending order

#### Events

Representative events:

```solidity
event RevenueRecorded(bytes32 indexed stationId, uint256 amount, uint256 period_yyyyMM);
event SettlementRecorded(bytes32 indexed stationId, uint256 amount, uint256 period_yyyyMM);
event RegionClaimed(bytes4 indexed regionId, uint256 period_yyyyMM, uint256 totalAmount);
```

---

### ChargeRouter (UUPS)

**Purpose**: make the charging data write path atomic.
The Bridge calls only `ChargeRouter`, not `ChargeTransaction` and `RevenueTracker` separately.

```solidity
function processCharge(ChargeSession calldata session, uint256 period_yyyyMM)
    external onlyBridge
```

Execution order:

1. `ChargeTransaction.mint(session)`
2. `RevenueTracker.recordRevenue(session.stationId, session.distributableKrw, period_yyyyMM)`

If either call fails, the whole transaction reverts.

#### Bridge wiring

```text
AWS KMS Bridge wallet -> ChargeRouter.processCharge()
ChargeRouter -> ChargeTransaction.mint()
ChargeRouter -> RevenueTracker.recordRevenue()
```

Address configuration:

- `ChargeRouter.bridgeAddress` = AWS KMS Bridge wallet
- `ChargeTransaction.bridgeAddress` = ChargeRouter proxy
- `RevenueTracker.bridgeAddress` = ChargeRouter proxy

---

## UUID → bytes32 Encoding Rule

The Bridge converts STRIKON UUIDs to `bytes32` deterministically.

```text
1. Remove the prefix (for example `sess_`, `chrg_`, `stn_`, `inv_`)
2. Remove hyphens
3. Left-align the 16-byte UUID inside bytes32
4. Zero-pad the remaining 16 bytes
```

Example:

```text
sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890
-> a1b2c3d4e5f67890abcdef1234567890
-> 0xa1b2c3d4e5f67890abcdef123456789000000000000000000000000000000000
```

---

## SE Signature Verification Modes

Production and non-production environments follow the same verification path.

### Production

- `invoice.paid` contains a real `seSignature`
- The signature is passed through the Bridge to `ChargeRouter`
- `ChargeTransaction` always verifies it through `DeviceRegistry`

### Development / testing

- Generate a P-256 key pair
- Enroll the public key in `DeviceRegistry`
- Sign the same message format with the private key
- Run the exact same mint path without any verification bypass

---

## `invoice.paid` → ChargeSession Mapping

| `invoice.paid` payload | ChargeSession field | Note |
|:---|:---|:---|
| `charging.energy_delivered_kwh` | `energyKwh` | scaled by 100 |
| `charging.charging_started_at` | `startTimestamp` | ISO 8601 → Unix timestamp |
| `charging.charging_stopped_at` | `endTimestamp` | ISO 8601 → Unix timestamp |
| `charger_id` | `chargerId` | UUID → `bytes32` |
| `station_id` | `stationId` | UUID → `bytes32` |
| `region_id` | `gridRegionCode` | carbon lookup region |
| `session_id` | `sessionId` | idempotency key |
| `StationRegistry.getCharger(chargerId)` | `chargerType` | resolved by the Bridge |
| fixed `UNKNOWN(0)` for now | `vehicleCategory` | enabled later for richer data |
| `amount.distributable_krw` | `distributableKrw` | net distributable amount |
| `se_signature` | `seSignature` | verified on-chain, preserved in event |
| Bridge-computed | `period_yyyyMM` | separate router parameter |

Additional notes:

- Revenue recognition follows the `invoice.paid` handling time
- `sessionId` is the on-chain idempotency key
- `gridRegionCode` and `StationRegistry.regionId` use the same format but serve different purposes

---

## Deployment Order

1. Deploy ChargeTransaction implementation
2. Deploy ChargeTransaction proxy
3. Deploy RevenueTracker implementation
4. Deploy RevenueTracker proxy
5. Deploy ChargeRouter implementation
6. Deploy ChargeRouter proxy
7. Initialize ChargeTransaction with DeviceRegistry, StationRegistry, ChargeRouter, and admin
8. Initialize RevenueTracker with StationRegistry, ChargeRouter, and admin
9. Initialize ChargeRouter with ChargeTransaction, RevenueTracker, Bridge wallet, and admin

---

## Non-Canonical Operational Tools

Mock oracles, SSE dashboards, and live runners are validation helpers, not contract authority.

- The canonical scope of this document is limited to contract data models, validation rules, call order, and deployment order.
- Tool endpoints, UI structure, and server-side flows may evolve independently.
- For active tooling behavior, consult the current scripts, tools, and tests in the repository.

---

## Integration Test Checklist

### ChargeTransaction

- [ ] Valid SE signature succeeds
- [ ] Invalid SE signature reverts
- [ ] Unknown charger reverts
- [ ] Duplicate session reverts
- [ ] Unknown station reverts
- [ ] `getSession()` returns the correct stored data
- [ ] `getTokenIdBySessionId()` is correct
- [ ] Unauthorized caller fails `onlyBridge`
- [ ] Soulbound transfer attempts revert
- [ ] `tokenURI()` returns the expected value
- [ ] Upgrade authorization is enforced

### RevenueTracker

- [ ] Revenue sums are correct after many sessions
- [ ] Region claim settles all eligible pending revenue
- [ ] Re-claim with nothing pending reverts
- [ ] Event totals match internal accounting
- [ ] `getRegionRevenue()` matches StationRegistry grouping
- [ ] Zero-amount record reverts
- [ ] Unknown station reverts
- [ ] Upgrade authorization is enforced

### ChargeRouter

- [ ] `processCharge()` succeeds when both downstream calls succeed
- [ ] If mint fails, revenue recording also reverts
- [ ] If revenue recording fails, mint also reverts
- [ ] Unauthorized caller fails `onlyBridge`
- [ ] `ChargeProcessed` event emits correctly

### Cross-contract integrity

- [ ] A single `processCharge()` call updates both ChargeTransaction and RevenueTracker
- [ ] High-volume processing preserves consistency across both contracts

---

## References

| Document | Path |
|:---|:---|
| Implementation Roadmap | [implementation-roadmap.md](implementation-roadmap.md) |
| Phase 1 Spec | [phase1-infra-spec.md](phase1-infra-spec.md) |
| Phase 3 Spec | [phase3-sto-spec.md](phase3-sto-spec.md) |
| Interface Spec | [../../docs/strikon-interface-spec.md](../../docs/strikon-interface-spec.md) |

---

*End of Document*
