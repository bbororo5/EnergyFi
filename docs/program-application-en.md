# EnergyFi

**Hardware Root of Trust EV Charging RWA Platform on Avalanche L1**

---

## 1. What do you plan to work on during this program?

EnergyFi will build an on-chain trust pipeline on Avalanche L1 that redefines national public EV charging infrastructure as both 'revenue-generating Micro-Real Estate' and 'high-value carbon credit-producing assets.'

Our core objective is to fundamentally restore trust in deteriorating public infrastructure by connecting tamper-proof security hardware directly to the blockchain. During the program, we will integrate and deploy the following three core trust layers:

- **Hardware Root of Trust Pipeline**: Our proprietary embedded system (ELECTRA), developed under a business agreement with Qt, uses TPM 2.0 security chips to cryptographically sign physical power data (kWh) and occupancy data, transmitting them directly on-chain. This creates an 'incorruptible data ingress' that no administrator or external software can manipulate.

- **Spatial Quality Index (Spatial Asset Reputation Engine)**: We measure each region's operational trust (charger availability rate, maintenance resolution rate, settlement continuity), revenue rhythm (session volume, revenue stability, peak time patterns), and site character (residential, workplace, commercial, and mixed ratios) to record asset profiles as on-chain reputation. In v2, we plan to expand into behavioral metrics including asset turnover rate, loyal user proportion, and commercial synergy to further quantify citizen convenience and qualitative asset value. ([Roadmap: #4](https://github.com/Seon-ung/EnergyFi/issues/4))

- **dMRV Carbon Credit Pipeline Design**: We are completing the architecture for a hardware-signed dMRV (digital Measurement, Reporting, and Verification) pipeline to prepare the highest-tier tamper-proof carbon data infrastructure. On-chain implementation will commence upon finalization of the VVB partnership. ([Roadmap: #5](https://github.com/Seon-ung/EnergyFi/issues/5))

Given the transitional nature of Korea's STO legislation, we adopt a scalable ERC-20-based issuance architecture rather than complex distribution standards, building a rich Event system for synchronization with the Korea Securities Depository (KSD) total-supply management nodes. Dividend calculation and execution are handled by our securities firm partner, while EnergyFi provides hardware-attested revenue proof data.

---

## 2. What are your achievements so far?

- **Hardware-Level Data Sovereignty**: By combining our proprietary embedded system (ELECTRA), developed under a business agreement with Qt, with TPM 2.0 chips, we have secured technology that guarantees the source integrity of public data. Hardware development is over 80% complete, with mass production scheduled for June 2026. This is not merely hardware — it is the 'root of trust' that guarantees data integrity at the hardware level.

- **Unique Spatial Value Model — Implemented**: Beyond simply recording charging volumes, we have completed the ReputationRegistry smart contract that records regional operational trust, revenue rhythm, and site character as on-chain reputation. This serves as the core basis for achieving the highest credibility tier in global carbon markets.

- **National Standard Positioning & Partnerships**: We secured an LOI agreement with TTA (Telecommunications Technology Association), under the National Intelligence Service, for establishing RWA security standards, positioning our hardware-based trust model as a new data standard for South Korea's public infrastructure.

- **Financial Sector Collaboration**: Through discussions with major financial institutions including Shinhan Investment Corp., we plan to advance real-world RWA tokenization and dividend structures. A verbal commitment has been made to establish a practical foundation for private capital contributing to public infrastructure expansion through an MOU in the first half of 2026.

---

## 3. What problem are you addressing?

The current EV charging infrastructure market faces a systemic crisis of **'data trust deficit'** and **'capital gridlock.'**

First, **the collapse of trust in public goods.** Charging data managed on manipulable centralized servers distorts the actual number of usable chargers and revenue figures. This manifests as a real threat of 'charging inability' for citizens who purchased EVs trusting the infrastructure, causing society-wide infrastructure distrust.

Second, **the undervaluation of spatial assets.** Despite EV chargers being 'micro real estate' embedded in citizens' daily lives (homes, offices, malls), they are currently treated as mere electric vending machines. Qualitative value — site quality, operational stability, and revenue patterns — remains unquantified, preventing assets from being properly valued and blocking the entry of institutional capital into this non-standard asset class.

Third, **carbon market inefficiency.** Manual measurement-based carbon credit verification is expensive and unreliable, carrying 'greenwashing' risk. The absence of a 100% tamper-proof data pipeline causes revenue opportunities in the high-value carbon market — growing at over 30% annually — to evaporate.

---

## 4. Who experiences this problem?

- **EV Users Whose Mobility Rights Are Threatened (Individual Citizens)**: The greatest victims are individual citizens. Opaque revenue structures leave 'zombie chargers' unmaintained, restricting freedom of movement. Users cannot trust app data and wander searching for functional stations, becoming 'infrastructure refugees.'

- **A Society That Invests Tax Revenue Without Seeing Results (Government)**: Governments invest trillions of won annually in subsidies, yet low-quality hardware and poor management cause market stagnation. Without transparent monitoring tools that can be trusted without audits, national resources are being wasted.

- **Investors Craving Ultra-High-Quality RWA (Investors)**: Massive capital eager to deploy ESG funds exists, but manipulable reports and operational risk prevent market entry. These investors want 'trustworthy real assets' that combine hardware-attested high-grade carbon revenue with clear real estate-like value.

---

## 5. How is the problem currently solved (if at all)?

- **Limitation 1: Government Subsidies Fixated on 'Installation Volume'**: Current policy concentrates subsidies solely on installation (CAPEX). This creates a moral hazard where operators install cheap equipment to capture subsidies while neglecting post-installation operations (OPEX). Government-driven forced growth has reached a 'pouring water into a bottomless bucket' situation.

- **Limitation 2: The Deception of Software (SaaS) Dashboards**: Competitors offer cloud management systems as solutions. However, a structure where asset owners seeking capital can intervene in central databases cannot pass the financial sector's rigorous due diligence standards. Institutional capital does not move on data where stakeholders can edit their own scorecards.

- **Limitation 3: Low Value of Manual MRV-Based Carbon Credits**: Current post-hoc verification methods suffer from significant time lag and low reliability, receiving the lowest tier classification. This relegates carbon credits to mere byproducts and self-blocks derivative revenue models that could grow exponentially with infrastructure expansion.

---

## 6. What is your proposed solution?

EnergyFi transforms public infrastructure into the world's highest trust-tier RWA through a **'Hardware Root of Trust that eliminates human intervention'** from data generation to management.

- **Transparent Infrastructure Ledger on Avalanche L1**: We issue regional RWA backed by 'ultra-trusted data' generated by hardware. Investors can monitor tamper-proof revenue data and spatial profiles in real-time while contributing to high-quality infrastructure expansion that guarantees citizens' mobility rights.

- **Micro Real Estate Reputation System**: We record on-chain reputation from hardware-measured **operational trust (availability, maintenance, settlement continuity)**, **revenue rhythm (session volume, stability, peak patterns)**, and **site character (residential, workplace, commercial, and mixed ratios)**. In v2, we will add behavioral metrics including turnover rate, loyal user proportion, and commercial synergy to evolve chargers into 'digital real estate' with precisely predictable revenue, pioneering entry paths for institutional capital. ([Roadmap: #4](https://github.com/Seon-ung/EnergyFi/issues/4))

- **Exponential Revenue Engine (dMRV Carbon Pipeline)**: Hardware-signed dMRV data achieves the highest trust tier under global standards. Architecture design is complete, and on-chain implementation will commence upon VVB partnership finalization. As infrastructure scales, it generates exponential carbon revenue at zero marginal cost, traded at premiums far exceeding standard credits, ensuring self-sustaining infrastructure maintenance (OPEX). ([Roadmap: #5](https://github.com/Seon-ung/EnergyFi/issues/5))

---

## 7. What triggers an on-chain transaction in your project?

All transactions in our ecosystem are automatically triggered by rigorously verified physical system events — not manual human input — serving as real-time indicators of public infrastructure value.

- **Upon Hardware-Signed Session Completion**: Power (kWh) and spatial occupancy data signed by the TPM 2.0 chip are recorded in ChargeTransaction, serving as the basis for revenue and spatial reputation.

- **Upon Micro Real Estate Reputation Update**: Aggregated operational trust, revenue rhythm, and site character data based on hardware signals are recorded in the ReputationRegistry on weekly/monthly cycles, refreshing regional asset profiles.

- **Upon dMRV Carbon Data Commit**: Tamper-proof hardware-signed carbon reduction data flows through the pipeline to on-chain records. This contributes to asset value at higher multiples than standard revenue. (Activates upon VVB partnership finalization)

- **Upon Revenue Attestation and Settlement Recording**: Hardware-sourced revenue data is aggregated and settled per region through RevenueTracker, providing dividend basis data to the securities firm partner via `RegionSettlementFinalized` events.

- **Upon STO Token Issuance (Tranche)**: Regional STO tranche issuances triggered by new station additions are recorded through the RegionSTO contract, generating KSD synchronization events.
