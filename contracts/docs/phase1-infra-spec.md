# Phase 1: Infrastructure Smart Contract Spec

## EnergyFi — DeviceRegistry + StationRegistry Implementation Guide

2026.03.03 | Ver 1.1

---

## Objective

Phase 1 establishes the on-chain root of trust for chargers and the station/charger hierarchy.

- Enroll TPM 2.0 SE chip public keys on-chain
- Establish the station → charger structure on-chain
- Fix the region mapping that later drives Phase 2 revenue attribution and Phase 3 STO grouping
- Keep all third-party CPO operations off-chain inside STRIKON

**Timeline**: now through 2026.04

---

## Contracts

### DeviceRegistry (implemented)

**Purpose**: bind each TPM 2.0 SE chip public key (P-256, 64 bytes) to a `chargerId`.
Phase 2 `ChargeTransaction.mint()` uses it as the root of trust for verifying every SE signature.

**Current implementation**: `contracts/contracts/infra/DeviceRegistry.sol`

#### ChipRecord struct

```solidity
enum SignatureAlgorithm { SECP256K1, P256_SECP256R1 }

struct ChipRecord {
    bytes     publicKey;       // 64 bytes: x || y (uncompressed, prefix removed)
    bytes32   publicKeyHash;   // keccak256(publicKey) for reverse lookup
    SignatureAlgorithm algorithm;
    uint256   enrolledAt;
    bool      active;
}
```

#### Key functions

```solidity
// Admin-only
enrollChip(bytes32 chargerId, bytes calldata publicKey, SignatureAlgorithm algorithm)
revokeChip(bytes32 chargerId)

// View
isActiveChip(bytes32 chargerId) returns (bool)
verifySignature(bytes32 chargerId, bytes32 msgHash, bytes calldata sig) returns (bool)
getChipRecord(bytes32 chargerId) returns (ChipRecord memory)
getChargerByPubkey(bytes32 pubkeyHash) returns (bytes32 chargerId)
```

#### SE signature message format

```text
msgHash = keccak256(abi.encodePacked(chargerId, energyKwh, startTimestamp, endTimestamp))
```

Phase 2 reconstructs this exact hash inside `ChargeTransaction`.

#### External dependency

- **RIP-7212 precompile** at `address(0x100)` is required for P-256 verification.
- It must be enabled in `l1-config/genesis.json`.

---

### StationRegistry (new design)

**Purpose**: maintain the station → charger hierarchy.

- Every on-chain station is EnergyFi-owned
- Every on-chain station must have a `regionId`
- Third-party CPO stations are not registered on-chain
- Region data becomes the source of truth for revenue attribution and later STO grouping

#### Revenue attribution model

```text
On-chain stations (all EnergyFi-owned)
  -> 100% of distributableKrw flows to the region STO investor pool
  -> regionId is mandatory
  -> eligible for Phase 3 STO grouping

Third-party CPO stations
  -> not registered on-chain
  -> settled off-chain in STRIKON only
```

#### Structs

```solidity
struct Station {
    bytes32 stationId;
    bytes4  regionId;   // ASCII bytes4, e.g. "KR11"
    string  location;
    bool    active;
}

struct Charger {
    bytes32 chargerId;
    bytes32 stationId;
    uint8   chargerType; // 0: L1, 1: L2, 2: DCFC
    bool    active;
}
```

> `OwnerType` and `CPORecord` are intentionally removed. On-chain stations are EnergyFi-owned only.

#### regionId encoding rule

```text
"KR-11" -> remove dash -> "KR11" -> ASCII bytes4
Examples:
  "KR11" -> 0x4B523131
  "KR26" -> 0x4B523236
```

Bridge logic, admin tooling, and tests must use the same encoding rule.

#### Key functions

```solidity
// Station management
registerStation(bytes32 stationId, bytes4 regionId, string calldata location)
deactivateStation(bytes32 stationId)
getStation(bytes32 stationId) returns (Station memory)

// Charger management
registerCharger(bytes32 chargerId, bytes32 stationId, uint8 chargerType)
deactivateCharger(bytes32 chargerId)
getCharger(bytes32 chargerId) returns (Charger memory)

// Views
getStationsByRegion(bytes4 regionId) returns (bytes32[] memory)
getChargersByStation(bytes32 stationId) returns (bytes32[] memory)
isRegistered(bytes32 stationId) returns (bool)
```

#### Events

```solidity
event StationRegistered(bytes32 indexed stationId, bytes4 regionId);
event ChargerRegistered(bytes32 indexed chargerId, bytes32 indexed stationId, uint8 chargerType);
event StationDeactivated(bytes32 indexed stationId);
```

#### Deployment order

1. Deploy `DeviceRegistry`
2. Deploy `StationRegistry`
3. Register stations with mandatory `regionId`
4. Register chargers
5. Enroll SE chips in `DeviceRegistry`
6. Pass the `DeviceRegistry` address into Phase 2 deployment

---

## Non-Canonical Operational Tools

Local dashboards and registration automation scripts were useful during Phase 1 implementation, but they are not part of the canonical spec.

- This document governs only on-chain data models, permissions, events, and deployment order.
- Web dashboards, Express routes, and bulk test data loaders are implementation-time helpers and may change independently.
- When operational tooling is needed, check the current scripts and tests in the repository instead of treating tooling behavior as contract authority.

---

## Integration Test Checklist

### DeviceRegistry

- [ ] `isActiveChip()` returns `true` after enrollment
- [ ] `verifySignature()` returns `true` for signatures generated from the enrolled public key
- [ ] `verifySignature()` returns `false` for unknown `chargerId`
- [ ] `verifySignature()` returns `false` after `revokeChip()`
- [ ] `getChargerByPubkey()` reverse lookup is correct
- [ ] `enrollChip()` reverts for non-admin callers

### StationRegistry

- [ ] `getStationsByRegion()` is correct after station registration
- [ ] `getChargersByStation()` is correct after charger registration
- [ ] `isRegistered()` reflects station state correctly
- [ ] `registerStation()` reverts for unauthorized callers
- [ ] `registerCharger()` reverts for inactive or invalid station state

### DeviceRegistry ↔ StationRegistry linkage

- [ ] Registered charger IDs match across both registries
- [ ] Optional warning logic for unenrolled charger IDs behaves as expected if present in tooling

---

## References

| Document | Path |
|:---|:---|
| Implementation Roadmap | [implementation-roadmap.md](implementation-roadmap.md) |
| Phase 2 Spec | [phase2-transaction-spec.md](phase2-transaction-spec.md) |

---

*End of Document*
