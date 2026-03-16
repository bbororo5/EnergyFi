# EnergyFi ERC Standards Analysis

## Purpose

This document is the index for ERC standards that are **actually reflected in the current contract codebase** under `contracts/contracts/`.

The inclusion rule is strict:

- the contract inherits or directly uses the standard implementation
- the deployment or test path exercises that standard behavior
- the standard affects the current code, not just a future design discussion

This document therefore describes the **current code state**, not the final production policy for every future EnergyFi deployment path.

---

## 1. Standards Currently Applied

| Standard | Status | Main application points | Detail |
|:---|:---|:---|:---|
| ERC-20 | applied | `RegionSTO` prototype | [erc-20.md](erc-20.md) |
| ERC-721 | applied | `ChargeTransaction` | [erc-721.md](erc-721.md) |
| ERC-165 | applied | `ChargeTransaction` and upgradeable contracts inheriting `AccessControlUpgradeable` | [erc-165.md](erc-165.md) |
| ERC-1822 (UUPS) | applied | core upgradeable contracts | [erc-1822-uups.md](erc-1822-uups.md) |
| ERC-1967 | applied | proxy deployment layer via `EnergyFiProxy` | [erc-1967.md](erc-1967.md) |

---

## 2. Why These Five Count as "Applied"

### 2.1 Token standards

- `RegionSTO` inherits `ERC20Upgradeable`
- `ChargeTransaction` inherits `ERC721Upgradeable`

### 2.2 Interface detection

- `ChargeTransaction` explicitly overrides `supportsInterface()`
- contracts inheriting `AccessControlUpgradeable` expose ERC-165-based interface detection

### 2.3 Upgrade and proxy standards

- major upgradeable contracts inherit `UUPSUpgradeable`
- proxy deployment uses `EnergyFiProxy`, a thin wrapper around OpenZeppelin `ERC1967Proxy`
- tests and scripts exercise upgrade and proxy deployment behavior

---

## 3. Important Qualification About `RegionSTO`

The repository currently contains an ERC-20-based `RegionSTO` implementation. However:

- top-level policy documents still say the final issuance path is not fixed
- the final STO token standard is still path-dependent
- the ERC-20 implementation should therefore be read as the current code prototype, not as the final business commitment

That distinction matters for audit preparation and document consistency.

---

## 4. Commonly Mentioned but Not Currently Applied

| Standard | Current status | Why it is not counted as applied |
|:---|:---|:---|
| ERC-3643 / T-REX | not applied | still reference-only until the issuance path and compliance surface are finalized |
| ERC-2222 | not applied | dividend execution belongs to the securities-firm side |
| ERC-1643 | not applied | document-management workflows also belong outside EnergyFi's current contract scope |
| ERC-5192 | not applied | `ChargeTransaction` behaves like a Soulbound token but does not expose the ERC-5192 `locked()` interface |

---

## 5. Practical Reading Guide

### 5.1 ERC-20 and ERC-721 are foundation standards, not consumer-UX commitments

- `RegionSTO` reuses ERC-20 semantics for balances and supply, but not for free transferability
- `ChargeTransaction` reuses ERC-721 semantics for uniqueness, but not for collectible NFT UX

### 5.2 ERC-1822 and ERC-1967 must be read together

- ERC-1822 explains upgrade authorization and compatibility checks
- ERC-1967 explains the proxy storage-slot convention

In practice, EnergyFi uses the modern OpenZeppelin combination:

```text
UUPSUpgradeable + ERC1967Proxy
```

---

## 6. Reading Order

1. [erc-20.md](erc-20.md)
2. [erc-721.md](erc-721.md)
3. [erc-165.md](erc-165.md)
4. [erc-1822-uups.md](erc-1822-uups.md)
5. [erc-1967.md](erc-1967.md)

---

## 7. Notes

- RIP-7212 matters to EnergyFi, but it is not an ERC standard. It is an EVM precompile requirement for P-256 verification.
- `AccessControlUpgradeable`, `PausableUpgradeable`, and `Initializable` are important implementation building blocks, but they are not ERC-numbered standards and are therefore outside this document set.

---

*End of Document*
