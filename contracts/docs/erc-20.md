# ERC-20 Application Note

## 0. Summary

- Applied contract: `RegionSTO`
- Base implementation: OpenZeppelin `ERC20Upgradeable`
- Current role: fungible balance and supply model for the repository's region-token prototype
- Important qualification: this explains the **current implementation**, not the final production STO standard

## 1. Purpose and Background

ERC-20 emerged to standardize how Ethereum systems handle fungible tokens.

It defines a common surface for:

- total supply
- account balances
- transfers
- approvals and delegated transfers
- transfer and approval events

Without that common surface, wallets, exchanges, and custody systems would need token-specific integrations for every project.

## 2. Why It Matters for EnergyFi

At the code level, RegionSTO needs a standard way to express:

- per-region token supply
- investor balances
- mint and burn accounting
- externally readable supply data for audits or downstream integrations

That makes ERC-20 a reasonable base layer for the current `RegionSTO` prototype.

At the same time, EnergyFi policy explicitly limits scope to issuance-side infrastructure. So ERC-20 is being used here as a **balance and supply model**, not as a promise of open market transferability.

## 3. Standard Content

The core ERC-20 surface includes:

- `totalSupply()`
- `balanceOf(address)`
- `transfer(address,uint256)`
- `allowance(address,address)`
- `approve(address,uint256)`
- `transferFrom(address,address,uint256)`
- `Transfer`
- `Approval`

Common optional metadata includes:

- `name()`
- `symbol()`
- `decimals()`

## 4. Where EnergyFi Applies It

Primary files:

- `contracts/contracts/sto/RegionSTO.sol`
- `contracts/contracts/interfaces/sto/IRegionSTO.sol`
- `contracts/contracts/sto/RegionSTOFactory.sol`

Representative tests:

- `contracts/test/unit/RegionSTO.test.ts`
- `contracts/test/integration/sto.test.ts`

## 5. EnergyFi-Specific Interpretation

### 5.1 ERC-20 base, restricted behavior

The current `RegionSTO` is not a normal free-transfer ERC-20.

Key differences documented in the current implementation:

- `decimals()` is fixed at `0`
- approvals are disabled
- ordinary user transfer paths are blocked
- admin-controlled issuance and administrative movement remain possible

That means the contract behaves more like an issuance ledger than a consumer token.

### 5.2 Tranche logic is outside ERC-20 itself

ERC-20 does not describe why tokens were issued. EnergyFi adds tranche-level issuance semantics so the issuance event can preserve:

- tranche identity
- issued amount
- related station set
- issuance time

That is EnergyFi business logic layered on top of the ERC-20 base.

## 6. Cautions

- external systems that assume normal ERC-20 approval and transfer behavior may fail
- the final STO token surface may change once the issuance path is finalized
- this document should not be read as a commitment to ERC-20 for the final regulated deployment

## 7. Practical Takeaway

In EnergyFi, ERC-20 currently means:

- fungible quantity representation
- auditable balance and supply tracking
- a prototype issuance surface, not a final distribution design

## 8. References

- Standard: <https://eips.ethereum.org/EIPS/eip-20>
- Phase 3 spec: [phase3-sto-spec.md](phase3-sto-spec.md)

---

*End of Document*
