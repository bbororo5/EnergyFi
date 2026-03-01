# EnergyFi — Smart Contract Specification

## 1. Overview

| Property | Value |
|:---|:---|
| Language | Solidity ^0.8.20 |
| Framework | Hardhat 3.1.7 (ESM-first) |
| Library | OpenZeppelin Contracts ^5.3.0 |
| Chain | Avalanche L1 Private Chain (zero-gas, BFT consensus) |

The architecture consists of **9 smart contracts** organized into **4 functional categories**, plus a **RegionSTOFactory** for deploying per-region STO token instances. Each contract follows a single-responsibility principle, ensuring independent upgradeability and clear interface boundaries.

**STO Model**: Tokens are issued **per administrative region** (17 regions in South Korea, ISO 3166-2:KR), not per station. Station is the operational unit; region is the investment unit. Token supply is dynamic (mintable as region grows).

All contracts are deployed on a single Avalanche L1 private chain:
- **`contracts/l1/`** — All smart contracts

> **Note:** The previous `contracts/c-chain/` directory (containing EnergyToken, EnergyOracle, RevenueVault) has been removed. Those were hackathon-era scaffolds. The current architecture is defined below.

## 2. Category A: Physical Infrastructure Layer

Manages the physical topology of charging infrastructure and serves as the root reference for all other contracts.

### 2.1 StationRegistry

**Purpose**: Manages the tree structure of CPO -> Station -> Charger relationships.

| Item | Detail |
|:---|:---|
| **Category** | A: Infrastructure |
| **Type** | Registry |
| **Token Std** | N/A |
| **Mutable** | Yes |
| **Phase** | June 2026 |
| **Primary User** | CPO / Platform |

**Why needed:** Charging stations are the fundamental operational unit. STO tokens are aggregated per region, revenue is tracked per station, and investors view performance per region. A charger is merely a data source; the station is the entity that matters operationally. Without this registry, every other contract would need to independently maintain ownership and hierarchy information.

**Key Functions:**
```
registerStation(stationId, location, cpoAddress)       — onlyAdmin
registerCharger(chargerId, chargerType, parentStation)  — onlyAdmin
addChargerToStation(stationId, chargerId)               — onlyAdmin
removeChargerFromStation(stationId, chargerId)           — onlyAdmin
updateCPO(stationId, newCpoAddress)                      — onlyAdmin
getStationsByRegion(regionId)                            — view
getChargersByStation(stationId)                          — view
```

**Referenced by:** ChargeTransaction, STOPortfolio, ReputationRegistry.

## 3. Category B: Charging Data & Carbon Reduction Layer

Records charging transactions and applies the Verra VCS VM0038 methodology to calculate carbon reductions. This layer produces the core MRV (Measurement, Reporting, Verification) evidence for VCU issuance. Data recording begins at charger launch in June 2026.

### 3.1 ChargeTransaction

**Purpose**: Issues an ERC-721 token for every charging session, recording the raw data signed by the company's specified TPM 2.0 SE chip.

| Item | Detail |
|:---|:---|
| **Category** | B: Carbon |
| **Type** | Token (per session) |
| **Token Std** | ERC-721 |
| **Mutable** | No |
| **Phase** | June 2026 |
| **Primary User** | Charger HW (SE) |

**Why needed:** This is the foundational data source for the entire platform. Every downstream calculation (carbon reduction, revenue, portfolio performance) derives from these records. The SE signature ensures hardware-level data integrity, making this the Root of Trust anchor on-chain.

**Key Fields:**
```
struct ChargeSession {
    bytes32 chargerId;          // Charger identifier
    uint8 chargerType;          // L1, L2, or DCFC
    uint256 energyKwh;          // Energy dispensed (scaled)
    uint256 startTimestamp;     // Session start
    uint256 endTimestamp;       // Session end
    uint8 vehicleCategory;     // Vehicle type
    bytes32 gridRegionCode;    // Grid region for EFkw lookup
    bytes32 cpoId;             // CPO identifier
    bytes seSignature;         // TPM 2.0 SE chip signature
}
```

**VM0038 relevance:** Captures EC (Electricity Consumed) parameter required by VM0038 Equation 4.

### 3.2 CarbonReduction

**Purpose**: Applies VM0038 emission reduction formula to each ChargeTransaction and issues a carbon reduction record token.

| Item | Detail |
|:---|:---|
| **Category** | B: Carbon |
| **Type** | Token (per session) |
| **Token Std** | ERC-721 |
| **Mutable** | **Immutable** (non-upgradeable) |
| **Phase** | June 2026 |
| **Primary User** | Platform |

**Core Formula:**
```
Net Reduction = Baseline Emissions (ICE equivalent) - Project Emissions (grid electricity for EV)
```
Leakage is set to zero per VM0038/AMS-III.C.

**Key Fields:**
```
struct ReductionRecord {
    uint256 chargeTransactionId;  // Reference to ChargeTransaction token
    uint256 baselineEmissions;    // gCO2 (ICE vehicle equivalent)
    uint256 projectEmissions;     // gCO2 (grid electricity)
    uint256 netReduction;         // gCO2
    uint256 appliedEFkw;          // Grid emission factor used
    uint256 appliedEFfuel;        // Baseline fuel emission factor
    uint256 appliedAFEC;          // Average fuel economy
    uint256 evEfficiency;         // EV efficiency (km/kWh)
}
```

**Critical design:** Deployed as an immutable (non-upgradeable) contract. If the methodology is revised, a new version contract is deployed separately with a clear timestamp boundary.

### 3.3 ParameterRegistry

**Purpose**: Stores and version-controls all emission factors and coefficients used by CarbonReduction.

| Item | Detail |
|:---|:---|
| **Category** | B: Carbon |
| **Type** | Registry |
| **Token Std** | N/A |
| **Mutable** | Yes (versioned) |
| **Phase** | June 2026 |
| **Primary User** | Platform Admin |

**Why needed:** VM0038 requires specific parameters that change at defined intervals. VVB auditors must verify which parameter values were in effect for any given time period.

**Managed Parameters:**
| Parameter | Update Cycle | Description |
|:---|:---|:---|
| EFkw | Annual | Grid emission factor (tCO2/kWh) |
| EFfuel | Baseline | Baseline fuel emission factor (tCO2/L) |
| AFEC | Every 5 years | Average fuel economy (km/L) |
| DCFC efficiency | Fixed | 0.923 |
| EV efficiency | As needed | km/kWh |

**Key Functions:**
```
setParameter(bytes32 key, uint256 value, uint256 effectiveFrom) — onlyAdmin
getParameter(bytes32 key, uint256 timestamp)                     — view
getParameterHistory(bytes32 key)                                  — view
```

## 4. Category C: Carbon Credit Pipeline Layer

Manages the interface between on-chain carbon reduction data and the off-chain Verra VCS verification process.

### 4.1 CarbonBatch

**Purpose**: Groups carbon reduction records into verification batches and locks them to prevent double-counting.

| Item | Detail |
|:---|:---|
| **Category** | C: VCM |
| **Type** | Batch Manager |
| **Token Std** | N/A |
| **Mutable** | Lock only |
| **Phase** | 2027+ |
| **Primary User** | Platform / VVB |

**Why needed:** VVB verification occurs periodically (typically annually). When a batch of records is submitted for verification, those records must be permanently excluded from future batches. Without this, the same carbon reduction could be claimed in multiple verification cycles (double-counting).

**Key Functions:**
```
createBatch(uint256 timeStart, uint256 timeEnd)              — onlyAdmin
addToBatch(uint256 batchId, uint256[] reductionIds)          — onlyAdmin
lockBatch(uint256 batchId)                                    — onlyAdmin (irreversible)
getBatchStatus(uint256 batchId)                               — view (open/locked/verified)
getReductionBatch(uint256 reductionId)                        — view
```

### 4.2 VCUReference

**Purpose**: Records Verra VCU issuance results on-chain, linking them back to the corresponding CarbonBatch.

| Item | Detail |
|:---|:---|
| **Category** | C: VCM |
| **Type** | Record |
| **Token Std** | N/A |
| **Mutable** | Append only |
| **Phase** | 2027+ |
| **Primary User** | Platform |

**Why needed:** After VVB verification and Verra VCU issuance, the results exist only in the Verra registry (off-chain). VCUReference bridges this gap by recording the official VCU issuance on-chain, enabling end-to-end traceability: ChargeTransaction -> CarbonReduction -> CarbonBatch -> VCUReference.

**Key Fields:**
```
struct VCURecord {
    uint256 batchId;            // Reference to CarbonBatch
    uint256 vcuQuantity;        // Number of VCUs issued
    string verraRegistryNumber; // Official Verra registry ID
    uint256 issuanceDate;       // Date of VCU issuance
    bytes32 verificationHash;   // Hash of verification report
}
```

## 5. Category D: Investment & Operations Layer

Supports STO investment transparency and CPO operational quality assessment. This layer becomes fully operational when the Electronic Securities Act takes effect in January 2027, but its data infrastructure begins accumulating from the June 2026 charger launch.

### 5.1 ReputationRegistry

**Purpose**: Records CPO operational quality scores (uptime, failure frequency, mean repair time).

| Item | Detail |
|:---|:---|
| **Category** | D: Investment |
| **Type** | Registry |
| **Token Std** | N/A |
| **Mutable** | Yes (oracle pattern) |
| **Phase** | 2026 H2 |
| **Primary User** | CPO / Investor |

**Why needed:** STO investors need to assess not just financial performance but operational quality of stations within their invested region. Reputation scores are computed off-chain (oracle pattern) and recorded on-chain. Inspired by ERC-8004.

**Key Functions:**
```
updateScore(bytes32 cpoId, bytes32 stationId, uint256 uptimeScore, uint256 failureScore, uint256 repairTimeScore) — onlyOracle
getStationReputation(bytes32 stationId)   — view
getCPOReputation(bytes32 cpoId)           — view
getRegionReputation(bytes32 regionId)     — view (aggregated)
```

### 5.2 STOPortfolio

**Purpose**: Maps investor wallet addresses to their region holdings and provides aggregated performance queries.

| Item | Detail |
|:---|:---|
| **Category** | D: Investment |
| **Type** | Portfolio Manager |
| **Token Std** | N/A |
| **Mutable** | Yes |
| **Phase** | 2027 Jan |
| **Primary User** | Investor / Securities Firm |

**Why needed:** As the business scales, regional investment structures become complex: ownership transfers, multi-investor regions, station additions/removals, CPO changes. STOPortfolio provides a clean interface between the physical infrastructure data (StationRegistry, ChargeTransaction) and the financial layer (RegionSTO Token, securities firm). The securities firm references this contract for dividend calculations and investor reporting.

**Key Functions:**
```
getPortfolio(address investor)                           — view
getRegionPerformance(bytes32 regionId)                   — view
getStationPerformance(bytes32 stationId)                 — view
getRegionRevenue(bytes32 regionId, uint256 period)       — view
getRegionCarbonReductions(bytes32 regionId, uint256 period) — view
```

### 5.3 RegionSTO (STO Token)

**Purpose**: ERC-3643 security token representing fractional ownership of regional charging infrastructure.

| Item | Detail |
|:---|:---|
| **Category** | D: Investment |
| **Type** | Token (per region) |
| **Token Std** | **ERC-3643** (T-REX) |
| **Mutable** | Configurable |
| **Phase** | 2027 Jan |
| **Primary User** | Securities Firm |

**Why needed:** Tokenizes regional charging infrastructure for regulated securities trading. The company issues tokens; the securities firm manages all distribution under the Electronic Securities Act (effective January 2027). Token supply is **dynamic (mintable)** as regions grow with new station additions.

**ERC-3643 compliance:** Implements the ERC-3643 (T-REX) standard for regulated security tokens, providing permissioned transfers (on-chain compliance verification), forced transfer and token freezing (for regulatory actions), and wallet recovery (for lost private keys). ERC-20 backward compatible.

**Issuer-Securities Firm role separation:**
- **Issuer (Company):** Token minting, on-chain revenue data recording, infrastructure data management
- **Securities Firm:** KYC/AML, investor eligibility, token distribution, dividend calculation/execution, document management
- **Excluded standards:** ERC-2222 (dividends handled by securities firm off-chain), ERC-1643 (document management handled by securities firm)

**ERC-3643 Sub-Contracts (interfaces defined in Phase 1, implemented in Phase 2~3):**
- `IIdentityRegistry` — Investor wallet ↔ on-chain identity mapping (operated by securities firm)
- `ICompliance` — Modular transfer rules: jurisdiction restrictions, max holders, lockup periods (configured by securities firm)
- `ITrustedIssuersRegistry` — Trusted KYC claim issuers (securities firm addresses)
- `IClaimTopicsRegistry` — Required claim types for investor eligibility

**STO Model:**
- **17 regions** corresponding to South Korea's administrative divisions (ISO 3166-2:KR)
- Token price: 500 KRW per token
- Token symbol format: `ELEC-SEOUL`, `ELEC-BUSAN`, `ELEC-GYEONGGI`, etc.
- Supply: Mintable as region's charging infrastructure grows
- Routing: regionId-based (not stationId-based)

**Key Functions:**
```
mint(address to, uint256 amount)          — onlyAgent
burn(address from, uint256 amount)        — onlyAgent
forcedTransfer(address from, address to, uint256 amount, bytes data) — onlyAgent
freezePartialTokens(address addr, uint256 amount)  — onlyAgent
unfreezePartialTokens(address addr, uint256 amount) — onlyAgent
recoveryAddress(address lostWallet, address newWallet, address investorOnchainID) — onlyAgent
pause() / unpause()                       — onlyAgent
regionId()                                — view (returns ISO 3166-2:KR code)
```

**Inherits:** ERC-3643 Token (IToken), which extends `ERC20`, `Ownable`, `Pausable`

## 6. RegionSTOFactory

**Purpose**: Deploys RegionSTO instances for each administrative region.

| Item | Detail |
|:---|:---|
| **Type** | Factory |
| **Phase** | 2027 Jan |
| **Primary User** | Platform Admin |

**Key Functions:**
```
deployRegionSTO(bytes32 regionId, string name, string symbol) — onlyAdmin
getRegionSTO(bytes32 regionId)                                 — view (returns contract address)
getAllRegions()                                                 — view
```

**Regions (ISO 3166-2:KR):**
Seoul, Busan, Daegu, Incheon, Gwangju, Daejeon, Ulsan, Sejong, Gyeonggi, Chungbuk, Chungnam, Jeonbuk, Jeonnam, Gyeongbuk, Gyeongnam, Gangwon, Jeju

## 7. Contract Summary

| # | Contract | Category | Type | Token Std | Mutable | Phase | Primary User |
|:---|:---|:---|:---|:---|:---|:---|:---|
| 1 | **StationRegistry** | A: Infra | Registry | N/A | Yes | June 2026 | CPO / Platform |
| 2 | **ChargeTransaction** | B: Carbon | Token (per session) | ERC-721 | No | June 2026 | Charger HW (SE) |
| 3 | **CarbonReduction** | B: Carbon | Token (per session) | ERC-721 | Immutable | June 2026 | Platform |
| 4 | **ParameterRegistry** | B: Carbon | Registry | N/A | Yes (versioned) | June 2026 | Platform Admin |
| 5 | **CarbonBatch** | C: VCM | Batch Manager | N/A | Lock only | 2027+ | Platform / VVB |
| 6 | **VCUReference** | C: VCM | Record | N/A | Append only | 2027+ | Platform |
| 7 | **ReputationRegistry** | D: Investment | Registry | N/A | Yes (oracle) | 2026 H2 | CPO / Investor |
| 8 | **STOPortfolio** | D: Investment | Portfolio Manager | N/A | Yes | 2027 Jan | Investor / Firm |
| 9 | **RegionSTO** | D: Investment | Token (per region) | **ERC-3643** | Configurable | 2027 Jan | Securities Firm |
| -- | **RegionSTOFactory** | D: Investment | Factory | N/A | Yes | 2027 Jan | Platform Admin |

## 8. Existing L1 Contracts

The following contracts exist in `contracts/l1/` as early infrastructure scaffolds:

| Contract | Role | Status |
|:---|:---|:---|
| **AssetLogger.sol** | Immutable logging of energy asset events | Deployed (scaffold) |
| **DeviceRegistry.sol** | RBAC for IoT gateways (AccessControl-based) | Deployed (scaffold) |

These will be integrated into the full 9-contract architecture as development progresses.

## 9. Phase Roadmap

| Phase | Contracts | Timeline |
|:---|:---|:---|
| **Phase 1 (System Build)** | StationRegistry, ChargeTransaction, CarbonReduction, ParameterRegistry | Now ~ May 2026 |
| **Phase 2 (Charger Launch)** | + ReputationRegistry, STOPortfolio | June 2026 ~ |
| **Phase 3 (STO Launch)** | + RegionSTOFactory, RegionSTO, CarbonBatch, VCUReference | January 2027 ~ |
| **Phase 4 (Scale)** | Cross-chain bridge (AWM), multi-investor region structures | 2027 H2 ~ |

## 10. Deployment

See [deployment-guide.md](../infra/deployment-guide.md) for deployment instructions.
