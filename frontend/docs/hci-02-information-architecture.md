# Doc 2: Information Architecture

> **Project**: EnergyFi — EV Charging Infrastructure Revenue STO Investor dApp
> **Version**: v2.0
> **Date**: 2026-03-06
> **Dependency**: Doc 4 (Persona) → Doc 1 (Journey Map) → **This Document** → Doc 3 (State Machine)

> **Design Assumption**: The hackathon prototype assumes **Path A** (tokens issued on EnergyFi L1).
> The production issuance path (Path A / B / CCIP) will be determined after the Presidential Decree
> is finalized and a securities firm partnership is established. The "My Portfolio" tab's data source
> may change depending on the chosen path.

---

## 1. IA Design Principles

| Principle | Description |
|:--|:--|
| **User-needs-based** | Structure derived from persona questions ("My investments?", "Where to invest?"), not contract functions |
| **Max depth 3** | Tab → Screen → Detail. Never deeper than 3 levels |
| **Zero blockchain terminology** | Navigation labels never use: token, contract, chain, wallet |
| **Ambient Trust embedded** | All data screens include "✓ Hardware Verified" badge by default |
| **Progressive Disclosure** | L1 (summary) → L2 (detail) → L3 (verification) — natural depth transition |
| **Pure data tool** | No purchase, trade, or transfer actions. No CTA linking to external platforms |

---

## 2. 3-Tab Structure

Replaces the legacy Flutter 4-tab design (Dashboard/Claim/Market/Settings).

| Tab | Label (EN) | Label (KR) | Icon | User Need | Journey Phase |
|:--|:--|:--|:--|:--|:--|
| **1** | **My Portfolio** | **내 투자** | Chart icon | "How are my investments doing?" | Phase 4, 5 |
| **2** | **Explore** | **탐색** | Search/globe icon | "Where should I invest? Is this real?" | Phase 2, 5 |
| **3** | **More** | **더보기** | Menu icon | "Settings, help, education" | All |

**Design Rationale**:
- **Tab 1 "My Portfolio"**: Landing point for Phase 5 daily 30-second check. Open app → immediately see your status.
- **Tab 2 "Explore"**: Phase 2 due diligence + Phase 5 additional investment research. Core space for A+B trust delivery.
- **Tab 3 "More"**: Low-frequency features (settings, education, verification center). Prevents main tab pollution.

---

## 3. Navigation Tree

```
Root (_layout.tsx — Stack)
│
├── Onboarding (pre-auth — Stack screens)
│   ├── welcome            # Screen 1: Welcome
│   ├── how-it-works       # Screen 2: How It Works (carousel)
│   ├── login              # Screen 3: Login (email/social)
│   └── portfolio-connect  # Screen 4: Portfolio Connection
│
└── (tabs) (_layout.tsx — Bottom Tabs)
    │
    ├── Tab 1: My Portfolio (/portfolio)
    │   │
    │   ├── index ─────────────── Portfolio Overview
    │   │                          L1: Total units, regional cards, this month's revenue
    │   │
    │   └── [regionId]/ ──────── Regional Investment Detail
    │       │                      L2: My units, share %, monthly revenue chart
    │       │
    │       ├── revenue ──────── Revenue History
    │       │                      L2: Monthly chart (last 12 months)
    │       │
    │       ├── tranches ─────── Issuance Round Detail
    │       │                      L2: Per-round station list, date, units
    │       │
    │       └── attestation ──── Settlement Report
    │                              L3: RegionAttestation original, Merkle Root
    │
    ├── Tab 2: Explore (/explore)
    │   │
    │   ├── index ─────────────── 17-Region List
    │   │                          L1: Region cards (stations, revenue, sort/filter)
    │   │
    │   └── [regionId]/ ──────── Region Detail
    │       │                      L2: Station count, total revenue, monthly chart
    │       │
    │       ├── stations ─────── Station List
    │       │   │                  L2: Station cards (ID, location, charger count, status)
    │       │   │
    │       │   └── [stationId]/ ── Station Detail
    │       │       │                L2: Charger specs, cumulative revenue
    │       │       │
    │       │       └── sessions ── Charging Session List
    │       │                        L2→L3: Individual sessions (energy, revenue, SE verification)
    │       │
    │       ├── revenue ──────── Regional Revenue Chart
    │       │                      L2: Monthly trend (last 12 months)
    │       │
    │       └── attestations ──── Settlement History
    │                              L2→L3: Period-based settlement report list
    │
    └── Tab 3: More (/more)
        │
        ├── index ─────────────── More Main (menu list + language toggle)
        │
        ├── guide ─────────────── Investment Guide
        │                          "What is EV charging infrastructure investment?"
        │
        ├── settings ─────────── Settings
        │                          Language (EN/KR), notifications, logout
        │
        ├── verify/ ───────────── Data Verification Center (Power user)
        │   │                      L3: Platform-wide statistics
        │   │
        │   ├── session/
        │   │   └── [tokenId] ── Session Verification
        │   │                      L3: SE signature original, verification result
        │   │
        │   └── bookend ──────── Bookend Verification Visualization
        │                          L3: Dual-point verification education animation
        │
        └── about ─────────────── About EnergyFi
                                    Company info, audit history, certifications
```

---

## 4. expo-router File Structure

```
frontend/app/
├── _layout.tsx                      # Root: Stack (onboarding + tabs)
├── welcome.tsx                      # Onboarding Screen 1
├── how-it-works.tsx                 # Onboarding Screen 2
├── login.tsx                        # Onboarding Screen 3
├── portfolio-connect.tsx            # Onboarding Screen 4
│
├── (tabs)/
│   ├── _layout.tsx                  # Bottom Tabs (3 tabs)
│   │
│   ├── portfolio/
│   │   ├── index.tsx                # Portfolio Overview
│   │   └── [regionId]/
│   │       ├── index.tsx            # Regional Investment Detail
│   │       ├── revenue.tsx          # Revenue History
│   │       ├── tranches.tsx         # Issuance Round Detail
│   │       └── attestation.tsx      # Settlement Report
│   │
│   ├── explore/
│   │   ├── index.tsx                # 17-Region List
│   │   └── [regionId]/
│   │       ├── index.tsx            # Region Detail
│   │       ├── stations.tsx         # Station List
│   │       ├── stations/[stationId]/
│   │       │   ├── index.tsx        # Station Detail
│   │       │   └── sessions.tsx     # Charging Session List
│   │       ├── revenue.tsx          # Regional Revenue Chart
│   │       └── attestations.tsx     # Settlement History
│   │
│   └── more/
│       ├── index.tsx                # More Main
│       ├── guide.tsx                # Investment Guide
│       ├── settings.tsx             # Settings (language, logout)
│       ├── verify/
│       │   ├── index.tsx            # Verification Center Main
│       │   ├── session/[tokenId].tsx # Session Verification
│       │   └── bookend.tsx          # Bookend Visualization
│       └── about.tsx                # About EnergyFi
│
└── +not-found.tsx                   # 404
```

---

## 5. Screen Details

### 5.1 Tab 1: My Portfolio

#### Portfolio Overview (`/portfolio`)

| Item | Detail |
|:--|:--|
| **Auth required** | ✅ (login required) |
| **Above-the-fold** | Total units held, this month's total revenue (large number) |
| **Regional cards** | Each held region: name, units, share %, this month's revenue, MoM change |
| **Social proof** | Tranche count + total issued units on each card |
| **Empty state** | "No investments yet" + "Explore Regions" CTA |
| **Ambient Trust** | "✓ Hardware Verified" next to each revenue number |
| **Pull-to-refresh** | ✅ |

```
┌──────────────────────────────────┐
│  My Portfolio                     │
│                                   │
│  Total: 700 units                 │
│  This month: ₩2,380,000          │
│  ✓ Hardware Verified · 30s ago    │
│                                   │
│  ┌──────────────────────────────┐ │
│  │ Seoul Metropolitan    500 u  │ │
│  │ Share: 1.0%                  │ │
│  │ This month: ₩1,850,000 +12% │ │
│  │ Round 3 · 50,000 total units │ │
│  │ ✓ Verified                   │ │
│  └──────────────────────────────┘ │
│  ┌──────────────────────────────┐ │
│  │ Gyeonggi Province     200 u  │ │
│  │ Share: 0.8%                  │ │
│  │ This month: ₩530,000  +8%   │ │
│  │ Round 2 · 25,000 total units │ │
│  │ ✓ Verified                   │ │
│  └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**Data Mapping**:

| Data | Ideal Source | Current Contract | Gap |
|:--|:--|:--|:--|
| Units held | RegionSTO.balanceOf(addr) | ✅ Available | — |
| Share % | balanceOf / totalSupply | ✅ Frontend calc | — |
| This month's revenue | Regional monthly sum | Per-station only → frontend sum | G1 |
| MoM change | Change rate | Frontend calculation | G2 |
| Tranche count | RegionSTO.getTrancheCount() | ✅ Available | — |
| Total issued units | RegionSTO.totalSupply() | ✅ Available | — |

#### Regional Investment Detail (`/portfolio/[regionId]`)

| Item | Detail |
|:--|:--|
| **Above-the-fold** | Region name, my units, total issued, share %, this month's revenue |
| **Revenue section** | This month, cumulative, monthly chart mini preview |
| **Infrastructure section** | Station count, charger count, active status |
| **Settlement section** | Latest settlement report + "View all" |
| **Issuance section** | Issuance round summary + "View detail" |

**Data Mapping**:

| Data | Contract Function |
|:--|:--|
| My units | `RegionSTO.balanceOf(addr)` |
| Total issued | `RegionSTO.totalSupply()` |
| Cumulative revenue | `RevenueTracker.getRegionRevenue(regionId)` |
| Monthly revenue | `RevenueTracker.getMonthlyHistory(stationId)` × N sum |
| Station count | `StationRegistry.getStationsByRegion(regionId).length` |
| Latest settlement | `RevenueTracker.getRegionAttestation(regionId, latestPeriod)` |
| Tranche count | `RegionSTO.getTrancheCount()` |

---

### 5.2 Tab 2: Explore

#### 17-Region List (`/explore`)

| Item | Detail |
|:--|:--|
| **Auth required** | ❌ (Public data — accessible without login) |
| **Layout** | Scrollable card list |
| **Sort options** | By revenue, station count, name |
| **Card content** | Region name, station count, this month's revenue, tranche count, total units, Ambient Trust badge |
| **Tap action** | Card tap → Region detail |

```
┌──────────────────────────────────┐
│  Explore                 [Sort ▼] │
│                                   │
│  EV Charging Infrastructure       │
│  across 17 Korean Regions         │
│                                   │
│  ┌──────────────────────────────┐ │
│  │ Seoul Metropolitan            │ │
│  │ 42 stations · 156 chargers   │ │
│  │ This month: ₩13,570,000      │ │
│  │ Round 3 · 50,000 total units │ │
│  │ ✓ Hardware Verified           │ │
│  └──────────────────────────────┘ │
│  ┌──────────────────────────────┐ │
│  │ Gyeonggi Province             │ │
│  │ 38 stations · 142 chargers   │ │
│  │ This month: ₩11,230,000      │ │
│  │ Round 2 · 25,000 total units │ │
│  │ ✓ Hardware Verified           │ │
│  └──────────────────────────────┘ │
│  ...                              │
└──────────────────────────────────┘
```

**Data Mapping**:

| Data | Contract Function |
|:--|:--|
| 17 region list | `RegionSTOFactory.getAllRegionIds()` |
| Station count per region | `StationRegistry.getStationsByRegion(regionId).length` |
| Regional revenue | `RevenueTracker.getRegionRevenue(regionId)` |
| Charger count | Per-station `getChargersByStation()` sum |
| Tranche count | `RegionSTO.getTrancheCount()` |
| Total issued | `RegionSTO.totalSupply()` |

#### Region Detail (`/explore/[regionId]`)

| Item | Detail |
|:--|:--|
| **Above-the-fold** | Region name, key metrics: station count, this month's revenue, cumulative total |
| **Revenue chart** | Monthly bar chart (last 6~12 months) |
| **Station preview** | Top 5 station cards + "View all" |
| **Settlement history** | Last 3 reports + "View all" |

```
┌──────────────────────────────────┐
│  ← Seoul Metropolitan            │
│                                   │
│  42 stations · 156 chargers      │
│  This month: ₩13,570,000 (+12%) │
│  Cumulative: ₩81,420,000        │
│  Round 3 · 50,000 total units    │
│  ✓ Hardware Verified              │
│                                   │
│  [──── Monthly Revenue ────────] │
│  |  █  █  █  ██ ██ ███          │
│  | Oct Nov Dec Jan Feb Mar       │
│                                   │
│  Stations                         │
│  ┌────────────────────────────┐  │
│  │ ELEC-GN-001 · Gangnam · 4 │  │
│  │ ELEC-SC-003 · Seocho · 3  │  │
│  │ ...                        │  │
│  │          View all →        │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

#### Charging Session List & Detail (`/explore/[regionId]/stations/[stationId]/sessions`)

Core L3 screen where SE signature verification occurs.

```
┌──────────────────────────────────┐
│  ← ELEC-GN-001 Charging Records  │
│                                   │
│  ┌────────────────────────────┐  │
│  │ Mar 31, 2026 14:32          │  │
│  │ Energy: 6.78 kWh            │  │
│  │ Revenue: ₩14,400            │  │
│  │ Vehicle: BEV                │  │
│  │ ✓ Hardware Verified         │  │
│  │                             │  │
│  │  [View raw signature →]     │  │
│  └────────────────────────────┘  │
│                                   │
│  On tapping "View raw signature": │
│  ┌────────────────────────────┐  │
│  │ Hardware Signature          │  │
│  │ Verification               │  │
│  │                             │  │
│  │ The charger's security chip │  │
│  │ directly signed this data.  │  │
│  │                             │  │
│  │ Signature: 0x3a4b...cf21   │  │
│  │ Status: ✅ Verified          │  │
│  │                             │  │
│  │ [View on Block Explorer →]  │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

### 5.3 Tab 3: More

#### More Main (`/more`)

```
┌──────────────────────────────────┐
│  More                    EN / KR  │
│                                   │
│  ┌────────────────────────────┐  │
│  │ 📖 Investment Guide          │  │
│  │     What is EV charging     │  │
│  │     infrastructure STO?     │  │
│  ├────────────────────────────┤  │
│  │ 🔍 Data Verification Center  │  │
│  │     Verify original data    │  │
│  ├────────────────────────────┤  │
│  │ ℹ️  About EnergyFi           │  │
│  │     Company info, audits    │  │
│  ├────────────────────────────┤  │
│  │ ⚙️  Settings                  │  │
│  │     Language, logout        │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

#### Data Verification Center (`/more/verify`)

Power user L3 space.

| Screen | Content |
|:--|:--|
| Verification Center Main | Platform-wide stats: total sessions, total revenue, total stations |
| Session Verification | Specific session SE signature original + P-256 verification result |
| Bookend Visualization | Dual-point verification education animation (Doc 4 §7.3) |

---

## 6. Design System

### 6.1 Ambient Trust Components

#### Verified Badge Component

```tsx
<VerifiedBadge
  label="Hardware Verified"     // EN default
  timestamp={lastUpdated}       // "30s ago"
  onPress={() => navigateToVerify(sessionId)}  // L3 drill-down
/>
```

| State | Visual |
|:--|:--|
| Verified | `✓ Hardware Verified` — green checkmark, light green background |
| Updating | `↻ Updating...` — spinning icon, gray |
| Offline cache | `✓ Hardware Verified · 5m ago` — checkmark maintained, timestamp emphasized |

#### "View Source" Drill-down Link

```
[View source data →]
```
- Placed at bottom of all L2 screens
- Tap → navigates to L3 verification screen for that data
- Style: Blue text link (no underline, with arrow)

#### Data Update Timestamp

```
Last updated: 30s ago
```
- Gray small text at bottom of every data card
- Implies real-time data to reinforce trust

### 6.2 Financial Data Display

| Rule | EN Locale | KR Locale |
|:--|:--|:--|
| **Number format** | `₩13,570,000` | `13,570,000원` |
| **Percentage** | `+12.3%` | `+12.3%` |
| **Positive (gain)** | Green text + ↑ arrow | Red text + ↑ arrow |
| **Negative (loss)** | Red text + ↓ arrow | Blue text + ↓ arrow |
| **Date format** | `Mar 31, 2026` | `2026.03.31` |
| **Units** | `500 units` | `500좌` |
| **Colorblind** | Arrow ↑↓ always accompanies color | Same |

### 6.3 Certification Marks (More > About)

| Mark | Meaning |
|:--|:--|
| "FSS Security Audit Complete" | Smart contract code audit passed |
| "Avalanche Network" | Infrastructure basis (for technically curious users) |

---

## 7. Screen Flow Diagrams

### 7.1 Core Flow: Due Diligence (Phase 2)

```
Tab 2: Explore
  ├─ Region List ──[card tap]──► Region Detail
  │                                  │
  │                    ┌─────────────┼────────────────┐
  │                    │             │                │
  │                    ▼             ▼                ▼
  │              Station List   Revenue Chart    Settlement History
  │                    │                              │
  │                    ▼                              ▼
  │              Station Detail                 Settlement Report (L3)
  │                    │
  │                    ▼
  │              Charging Sessions
  │                    │
  │                    ▼
  │              SE Signature Verification (L3)
```

### 7.2 Core Flow: Monitoring (Phase 5)

```
Tab 1: My Portfolio
  ├─ Portfolio Overview ──[region card tap]──► Regional Investment Detail
  │                                               │
  │                          ┌────────────────────┼───────────────┐
  │                          │                    │               │
  │                          ▼                    ▼               ▼
  │                     Revenue History     Issuance Rounds   Settlement Report (L3)
  │
  └─ (empty state) ──["Explore Regions" CTA]──► Tab 2: Explore
```

### 7.3 Cross-tab Navigation

| From | To | Trigger |
|:--|:--|:--|
| Tab 1 Portfolio (empty) | Tab 2 Explore | "Explore Regions" CTA |
| Tab 2 Charging session | Tab 3 Verification Center | "View source data" link |
| Tab 3 Verification Center | External Block Explorer | "View on Block Explorer" link |

---

## 8. Content Priority Matrix

| Screen | Above-the-fold (highest priority) | Scroll area | Hidden (drill-down) |
|:--|:--|:--|:--|
| Portfolio Overview | Total units, this month's total revenue | Regional card list | — |
| Regional Investment Detail | My units, share %, this month's revenue | Monthly chart, infrastructure, settlement, issuance | Settlement report original |
| 17-Region List | Top 3 region cards | Remaining 14 regions | — |
| Region Detail | Station count, revenue, MoM change | Chart, station list, settlement | SE signature verification |
| Station Detail | Charger specs, location, active status | Charging session list | SE signature original |

---

## 9. Hackathon MVP vs Enhancement

### MVP (Hackathon Web Prototype)

| Included | Excluded |
|:--|:--|
| Tab 1: Portfolio Overview + Regional Detail | Issuance Round Detail |
| Tab 2: Region List + Region Detail + Station List | Region Comparison feature |
| Tab 2: Charging Sessions + SE Signature Verification (L3) | — |
| Tab 3: More (simplified — Guide, About, Settings) | Data Verification Center (L3 in Explore is sufficient) |
| Onboarding: Screen 1 + 3 (simplified) | Screen 2, 4, 5 |

> **Note**: Screen 2 (How It Works) and Screen 5 (Quick Tour) onboarding content is absorbed into `/more/guide` (Investment Guide page).

### Enhancement

| Addition | Description |
|:--|:--|
| Data Verification Center | More > Verify (Bookend visualization included) |
| Notification Center | Settlement complete, new issuance push |
| Region Comparison | Compare 2~3 regions side by side |
| Full Revenue History | 12-month chart + filters |
| Full Onboarding | Complete 5-screen flow |
| Station utilization | When reputation contract is added |

---

## 10. Web Platform Considerations

Hackathon submission is a web link:

| Item | Mobile | Web |
|:--|:--|:--|
| Tab navigation | Bottom Tabs | Bottom Tabs maintained (mobile web feel) |
| Card layout | 1-column scroll | 2-column grid on wide screens |
| Charts | Vertical scroll | Horizontal expansion |
| Touch/click | Touch | Click + hover effects |
| i18n toggle | Tab 3 More main | Tab 3 More main (same) |

Expo `web.output: "static"` enables static web build. expo-router file-based routing maps 1:1 to web URLs.

---

*End of Document*
