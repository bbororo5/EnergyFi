# ERC-1822 (UUPS) Application Note

## 0. Summary

- Applied pattern: OpenZeppelin `UUPSUpgradeable`
- Applied across major upgradeable contracts in the current repository
- Current role: standardize upgrade authorization and compatibility checks

Representative contracts:

- `DeviceRegistry`
- `StationRegistry`
- `ChargeTransaction`
- `RevenueTracker`
- `ChargeRouter`
- `ReputationRegistry`
- `RegionSTO`
- `RegionSTOFactory`

## 1. Purpose and Background

ERC-1822 defines the UUPS-style upgrade pattern.

The key idea is that:

- the proxy stays relatively simple
- the implementation contract owns upgrade authorization logic
- the implementation exposes compatibility information through `proxiableUUID()`

This reduces proxy-manager complexity compared with older proxy patterns that concentrated more upgrade logic in the proxy layer itself.

## 2. Why It Matters for EnergyFi

EnergyFi has multiple contracts whose policy surface may evolve:

- registry rules
- charging-record structure
- revenue aggregation behavior
- issuance-side prototype surfaces

UUPS provides a consistent upgrade framework while keeping upgrade authorization inside each implementation's role model.

## 3. Standard Content

ERC-1822 centers on:

- `proxiableUUID()`
- implementation-side upgrade authorization
- compatibility checks before upgrading to a new implementation

Its main safety goal is to reduce the risk of upgrading a proxy to an incompatible implementation.

## 4. Where EnergyFi Applies It

EnergyFi's upgradeable contracts inherit `UUPSUpgradeable` and override `_authorizeUpgrade(address)`.

Common expectations in the current codebase:

- upgrades are admin-gated
- upgrade tests verify unauthorized callers revert
- proxy deployment and upgrade flow are exercised in repository scripts and tests

## 5. EnergyFi-Specific Interpretation

### 5.1 Authorization belongs to the implementation role model

The important operational rule is not "who is the proxy admin?" but rather:

- who can pass `_authorizeUpgrade()`

In EnergyFi, that authorization is expected to follow contract-level admin roles.

### 5.2 UUPS is paired with ERC-1967

In practice, EnergyFi uses:

```text
UUPSUpgradeable + ERC1967Proxy
```

So ERC-1822 should be read together with ERC-1967:

- ERC-1822 covers upgrade procedure and compatibility
- ERC-1967 covers proxy storage-slot conventions

## 6. Cautions

- upgradeability does not remove the need for storage-layout discipline
- changes that affect balances, revenue, or Bridge trust boundaries still require high scrutiny
- a weak `_authorizeUpgrade()` implementation weakens the entire system

## 7. Practical Takeaway

In EnergyFi, ERC-1822 is the standard that keeps major contracts upgradeable in a controlled and reviewable way. It supports long-lived operations, but it also raises the importance of upgrade governance.

## 8. References

- Standard: <https://eips.ethereum.org/EIPS/eip-1822>
- Proxy-slot standard: [erc-1967.md](erc-1967.md)

---

*End of Document*
