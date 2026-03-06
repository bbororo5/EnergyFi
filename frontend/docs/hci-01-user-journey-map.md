# Doc 1: User Journey Map

> **Project**: EnergyFi — EV Charging Infrastructure Revenue STO Investor dApp
> **Version**: v2.0
> **Date**: 2026-03-06
> **Dependency**: Doc 4 (Persona) → **This Document** → Doc 2 (IA) → Doc 3 (State Machine)

> **Design Assumption**: The hackathon prototype assumes **Path A** (tokens issued on EnergyFi L1).
> The production issuance path (Path A / B / CCIP) will be determined after the Presidential Decree
> is finalized and a securities firm partnership is established. The "My Portfolio" tab's data source
> may change depending on the chosen path.

---

## 1. Journey Context

| Item | Definition |
|:--|:--|
| **Actor** | Primary persona "Jihyun Kim" (see Doc 4) |
| **Scope** | First STO awareness → 6-month mature investor |
| **Key Constraint** | Financial transactions (purchase, dividend claim) do NOT occur within the dApp. Handled by external securities firm platforms. |
| **dApp Role** | Data transparency tool for investment decisions + portfolio monitoring |
| **Regulatory Context** | Classified as Investment Contract Securities. CPOs cannot build exchanges. Only licensed securities firms can distribute. |

---

## 2. Journey Overview: 5 Phases

```
Timeline ────────────────────────────────────────────────────────────────────►

Phase 1         Phase 2          Phase 3          Phase 4          Phase 5
Discovery       Due Diligence    Purchase         Post-Purchase    Ongoing
& Research                       Decision         Onboarding       Monitoring
(1~2 weeks)     (3~7 days)      (1~3 days)       (same day)       (6 months+)

[Securities/    [Securities     [Securities      [dApp]           [dApp]
 News]           + dApp]         Firm]
```

### Emotional Curve

```
Trust
  High ┤                                                    ████████████
       │                                               █████
       │                                          █████
  Med  ┤    ████                              ████
       │████    ████                      ████
       │            ████             █████
  Low  ┤                █████████████
       └──────────────────────────────────────────────────────────────►
        Phase 1      Phase 2       Phase 3      Phase 4     Phase 5

        Curiosity →  Anxiety       → Resolve  → Relief     → Stable Trust
                    ("Is it real?")
```

**Key Insight**: A trust "valley" occurs in Phase 2 — the investor questions whether the data is genuine. **The dApp's A+B trust delivery fills this valley. This is the core UX objective.**

---

## 3. Phase 1: Discovery & Research (1~2 weeks)

### 3.1 Context

Jihyun first learns about the existence of EV charging infrastructure STO products.

### 3.2 Touchpoints & Actions

| Touchpoint | Action | Platform |
|:--|:--|:--|
| Securities app recommendation | Discovers "New STO Product: EV Charging Infrastructure Revenue" banner | Securities firm app |
| Financial news / YouTube | Watches "Invest in EV Charging Stations via STO" article | Financial media |
| Apartment resident chat group | "You can invest in our apartment's charging station" shared | Messenger |
| Search | Searches "EV charging STO", "EnergyFi investment" | Google, Naver |

### 3.3 Emotions & Thinking

- **Emotion**: Curiosity, mild interest
- **Thinking**: "Investing in charging infrastructure... like REITs?"
- **Anxiety**: "They said blockchain? It's not one of those crypto things, right?"

### 3.4 Pain Points

- Difficult to clearly understand what STO means
- Preconception about "blockchain" (speculation, volatility)
- Securities firm product descriptions are too technical

### 3.5 dApp Role

**The dApp is NOT used in this phase.** The investor learns through securities firms and media.

However, the dApp's landing page (web) may appear in search results:
- **Ideal data**: EnergyFi service intro, 17-region infrastructure summary, "Hardware Verified" differentiator
- **Contract mapping**: Not needed (marketing content)

---

## 4. Phase 2: Due Diligence (3~7 days)

### 4.1 Context

Jihyun has developed investment intent and is conducting detailed research. **The dApp enters the picture here — this is the critical phase.**

### 4.2 Touchpoints & Actions

| Touchpoint | Action | Platform | dApp Screen |
|:--|:--|:--|:--|
| Securities firm product detail | Reads STO product description, expected returns, underlying assets | Securities firm app | — |
| **dApp region explore** | Checks station counts and revenue data across 17 regions | **EnergyFi dApp** | Tab 2: Explore |
| **dApp station detail** | Checks individual station specs, location, active status | **EnergyFi dApp** | Region > Station detail |
| **dApp revenue chart** | Evaluates growth via monthly revenue trend chart | **EnergyFi dApp** | Region > Revenue chart |
| **dApp SE signature check** | Verifies "is this data real?" via hardware signature | **EnergyFi dApp** | L3 drill-down |
| On-site verification | Checks physical EnergyFi charger in apartment parking | Offline | — |
| Peer opinion | "Do you know about this? What do you think?" | In-person / chat | — |

### 4.3 Emotions & Thinking

- **Emotion**: Anxiety → gradual reassurance ("Oh, the data is transparently available")
- **Thinking**: "42 stations actually operating. Monthly revenue is steady."
- **Turning point**: Moment of verifying SE signature → "The charger itself signed the data. Can't fake that."

### 4.4 Pain Points

| Pain Point | Severity | dApp Response |
|:--|:--|:--|
| "Is this revenue data fake, made up by the company?" | **High** | A+B trust: Ambient Trust badges + SE signature drill-down |
| "I want to compare regions at a glance" | Medium | Region list sorting/filtering (by revenue, station count) |
| "I can't tell the exact return rate" | Medium | Monthly chart + MoM change display |
| "Expected returns are uncertain" | Low | Show only past actual data, no predictions (regulatory compliance) |

### 4.5 Moment of Truth #1

> **"Can I trust this revenue data?"**

The dApp's answer:
1. **L1 (immediate)**: "✓ Hardware Verified" badge next to every revenue number
2. **L2 (on tap)**: "42 stations, 3,420 sessions, +12% MoM"
3. **L3 (drill-down)**: Individual session SE signature, Bookend verification visualization

### 4.6 Data Requirements

| Ideal Data (Top-Down) | Current Contract | Gap |
|:--|:--|:--|
| Station count + charger count per region | `StationRegistry.getStationsByRegion()` + `getChargersByStation()` | None |
| Regional cumulative revenue | `RevenueTracker.getRegionRevenue()` | None |
| Monthly revenue trend | `RevenueTracker.getMonthlyHistory()` (per station) | No regional monthly aggregate → frontend sums per-station (G1) |
| Station location / active status | `StationRegistry.getStation()` | None |
| SE signature verification | `ChargeTransaction.getSession()` + `DeviceRegistry.getChipRecord()` | Frontend must compute P-256 verification |
| Expected return rate | — | **Not provided** (regulatory: investment contract securities cannot publish return forecasts) |
| Social proof (issuance scale) | `RegionSTO.getTrancheCount()` + `totalSupply()` | None — tranche count + total units available |

---

## 5. Phase 3: Purchase Decision (1~3 days)

### 5.1 Context

Jihyun has completed research and decides to invest.

### 5.2 Touchpoints & Actions

| Touchpoint | Action | Platform |
|:--|:--|:--|
| Securities firm product page | Navigates to STO purchase page | Securities firm app |
| Securities firm KYC | Identity verification, investor suitability assessment | Securities firm app |
| Securities firm purchase | Selects number of units, pays (bank transfer) | Securities firm app |
| Purchase confirmation | Investment complete notification | Securities firm app |

### 5.3 Emotions & Thinking

- **Emotion**: Resolve, slight tension ("Big money, but should be fine")
- **Thinking**: "500 units in Seoul, 200 in Gyeonggi — diversify"
- **Relief**: After purchase completion — "Finally invested. Now let's watch."

### 5.4 dApp Role

**The dApp does not participate in this phase.** All purchase activity occurs on the securities firm platform. There is no "Invest" button or purchase CTA in the dApp — the dApp is a pure data transparency tool.

The investor finds the securities firm's product page independently (through the securities firm's own app, web search, etc.).

---

## 6. Phase 4: Post-Purchase Onboarding (same day)

### 6.1 Context

Jihyun has completed investment on the securities firm and returns to the dApp to check her holdings.

### 6.2 Touchpoints & Actions

| Touchpoint | Action | Platform | dApp Screen |
|:--|:--|:--|:--|
| dApp re-entry | Opens app → Portfolio tab auto-entry | **dApp** | Tab 1: My Portfolio |
| Token detection | "Seoul 500 units, Gyeonggi 200 units" auto-displayed | **dApp** | Portfolio overview |
| First revenue check | "This month revenue: ₩0 (no settlement since purchase date)" | **dApp** | Regional detail |

### 6.3 Emotions & Thinking

- **Emotion**: Relief, anticipation ("My investment shows up immediately!")
- **Thinking**: "Revenue is ₩0 for now, but it'll accumulate starting next month"
- **Satisfaction**: Immediate portfolio reflection after purchase

### 6.4 Moment of Truth #2

> **"Is my investment properly reflected?"**

Post-purchase, the dApp must show holdings **immediately**. If delayed:
- "Was this a scam?" — anxiety spike
- Calls securities firm to verify → trust collapse

**Technical challenge**: Time gap between securities firm token issuance → EnergyFi L1 reflection. Custodial wallet address mapping is critical.

### 6.5 Data Requirements

| Ideal Data | Current Contract | Gap |
|:--|:--|:--|
| Regional holdings per investor | `RegionSTO.balanceOf(address)` | None (contract exists) |
| Investment start date | — | Can estimate from token transfer event timestamp |
| Share percentage | `balanceOf / totalSupply` | Frontend calculation |

---

## 7. Phase 5: Ongoing Monitoring (6 months+)

### 7.1 Context

Jihyun periodically checks her investment status. **The dApp's primary usage phase.**

### 7.2 Usage Patterns

| Pattern | Frequency | Duration | Key Screens |
|:--|:--|:--|:--|
| **Morning commute check** | Daily | 30 sec | Portfolio overview (L1) |
| **Monthly review** | Monthly | 5 min | Regional detail + revenue chart (L2) |
| **Settlement check** | Monthly | 1 min | Settlement report (L2→L3) |
| **Additional investment research** | Quarterly | 10 min | Explore regions + compare |
| **Recommend to friend** | Occasional | 3 min | Explore + SE signature demo |

### 7.3 Touchpoints & Actions

| Touchpoint | Action | dApp Screen |
|:--|:--|:--|
| Portfolio overview | Check total holdings + this month's revenue | Tab 1 main |
| Regional revenue detail | Seoul vs Gyeonggi revenue comparison, monthly trends | Portfolio > [Region] |
| Settlement report | "March settlement complete: ₩13,570,000 finalized" | Portfolio > Settlement report |
| Charging session browse | Check real-time charging data (curiosity) | Explore > Station > Sessions |
| Region comparison | Compare revenue when considering additional investment | Tab 2 Explore |
| Push notification (production) | "Seoul April settlement complete" | Notification → Portfolio |

### 7.4 Emotions & Thinking

- **Steady state emotion**: Stable trust, mild satisfaction
- **Thinking**: "Revenue accumulating again this month. Maybe add Gyeonggi?"
- **Trust reinforcement**: Monthly settlement reports stacking up → "Records every single month"

### 7.5 Moment of Truth #3

> **"Is revenue growing steadily month over month?"**

Monthly revenue chart trending upward → additional investment decision
Revenue declining → desire to understand why → check station status → regional detail

### 7.6 Data Requirements

| Ideal Data | Current Contract | Gap |
|:--|:--|:--|
| My regional monthly revenue | `RevenueTracker.getMonthlyHistory()` sum | Per-station only → frontend sum (G1) |
| Month-over-month change | — | Frontend calculation (G2) |
| Settlement report | `RevenueTracker.getRegionAttestation()` | None (full mapping) |
| Station utilization rate | — | **Deferred** → future reputation contract |
| My share of revenue | `balanceOf / totalSupply` | Frontend calculation (share % only, not amount — dividend calc is securities firm domain) |
| Notifications (settlement, new issuance) | — | **None** → event monitoring + push service (production, G7) |

---

## 8. Gap Analysis Summary: Ideal UX vs Current Contracts

| # | Ideal Data | Current State | Resolution | Priority |
|:--|:--|:--|:--|:--|
| G1 | Regional monthly revenue sum | Per-station only | Frontend sums per-station data, or add regional aggregate function to contract | High |
| G2 | Month-over-month change rate | Not available | Frontend calculation (previous month - current month) | High |
| G3 | Social proof (issuance scale) | `totalSupply()` + `getTrancheCount()` available | Display tranche count + total units. No contract change needed | Medium |
| G4 | Station utilization rate | active/inactive only | **Deferred** — will be addressed when reputation contract is added | Deferred |
| G5 | My revenue share | No dividend function (securities firm domain) | Display share % only (`balanceOf/totalSupply`). Never calculate amount | Medium |
| G6 | ~~Investment amount (KRW)~~ | ~~Not available~~ | **Removed** — securities firm domain. Outside dApp scope | N/A |
| G7 | Settlement completion notification | Not available | `RegionSettlementFinalized` event monitoring + push | Production |

---

## 9. Entry Path Analysis

### 9.1 How Users Discover EnergyFi

There is **no technical connection** (deep link, webview, API) between securities firms and EnergyFi. The securities firm serves only as an **awareness channel** — users independently discover and navigate to EnergyFi.

```
Securities firm app
  ├─ STO product listing → User sees "EV Charging Infrastructure STO"
  └─ Product description may mention "EnergyFi" as the data platform
        │
        │ (No link. User acts independently.)
        ▼
User searches independently
  ├─ Google / Naver: "EnergyFi", "EV charging STO data"
  ├─ App store: "EnergyFi"
  ├─ Friend recommendation: "Check out this app"
  └─ Financial news article link
        │
        ▼
EnergyFi web app (or native app)
  └─ User starts at Welcome screen or Explore tab
```

### 9.2 Entry Path Distribution (Estimated)

| Path | Estimated Share | First Screen |
|:--|:--|:--|
| Search engine (post-securities firm awareness) | 40% | Landing page → Welcome |
| Direct URL / bookmark | 25% | Welcome or Portfolio |
| Friend / social sharing | 20% | Shared region link → Explore > Region detail |
| Financial news article | 10% | Landing page → Welcome |
| App store | 5% | Welcome (native only) |

### 9.3 Implication for Design

- **No return path from securities firm**: Unlike typical e-commerce "deep link back" patterns, users manually re-open EnergyFi after purchasing on the securities firm. The dApp should detect new holdings on app re-entry (Phase 4 onboarding).
- **Landing page is critical**: Since most users arrive via search, the web landing page must clearly communicate the value proposition without blockchain jargon.
- **Shareable region links**: Users who recommend to friends should be able to share a direct URL to a specific region's data page.

---

## 10. Journey Summary Table

| Phase | Duration | Emotion | Primary Platform | dApp Used | Key Screens | Key Data |
|:--|:--|:--|:--|:--|:--|:--|
| 1. Discovery | 1~2 weeks | Curiosity | Securities, news | ❌ | — | — |
| 2. Due Diligence | 3~7 days | Anxiety → Relief | Securities + **dApp** | ✅ | Explore, revenue chart, SE verification | getRegionRevenue, getSession |
| 3. Purchase | 1~3 days | Resolve | Securities firm | ❌ | — | — |
| 4. Onboarding | Same day | Relief | **dApp** | ✅ | Portfolio overview | balanceOf, totalSupply |
| 5. Monitoring | 6 months+ | Stable trust | **dApp** | ✅ | Portfolio, revenue history, settlement | getMonthlyHistory, getRegionAttestation |

---

## 11. Hackathon Scope

| Phase | Hackathon Support | Notes |
|:--|:--|:--|
| Phase 1: Discovery | None | External — marketing, not dApp |
| Phase 2: Due Diligence | **Full** | Core demo: Explore tab + L3 SE signature verification |
| Phase 3: Purchase | None | External — securities firm |
| Phase 4: Onboarding | **Partial** | Pre-authenticated with mock on-chain token holdings |
| Phase 5: Monitoring | **Full** | Core demo: Portfolio tab + revenue tracking |

---

*End of Document*
