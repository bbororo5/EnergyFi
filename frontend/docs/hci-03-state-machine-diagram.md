# Doc 3: State Machine Diagram

> **Project**: EnergyFi — EV Charging Infrastructure Revenue STO Investor dApp
> **Version**: v2.0
> **Date**: 2026-03-06
> **Dependency**: Doc 4 (Persona) → Doc 1 (Journey Map) → Doc 2 (IA) → **This Document**

> **Design Assumption**: The hackathon prototype assumes **Path A** (tokens issued on EnergyFi L1).
> The production issuance path (Path A / B / CCIP) will be determined after the Presidential Decree
> is finalized and a securities firm partnership is established. The "My Portfolio" tab's data source
> may change depending on the chosen path.

---

## 1. State Machine Overview

EnergyFi dApp is a **read-only transparency tool**, making its state machine fundamentally different from typical Web3 dApps.

**What does NOT exist**:
- ❌ Connect Wallet flow
- ❌ Transaction signing / confirmation screens
- ❌ Gas estimation / insufficient gas errors
- ❌ Token swap / transfer / approve states
- ❌ External platform handoff states (no deep links, no purchase CTA)

**What DOES exist**:
- ✅ Authentication (email/phone login, wallet fully abstracted)
- ✅ Data loading / caching / polling (core state machine)
- ✅ Ambient Trust state (verification badge display / update)

### 2 Independent State Machines

| State Machine | Role | Trigger |
|:--|:--|:--|
| **A: Authentication** | User session management | Login, logout, session expiry |
| **B: Data Loading** | Per-screen on-chain data query | Screen mount, pull-to-refresh, polling timer |

> **Note**: State Machine C (Navigation Context) from v1.0 has been **removed**. The dApp has no external handoff flow — navigation is purely internal (public vs authenticated browsing is handled by State Machine A's auth state).

---

## 2. State Machine A: Authentication

```
                    ┌─────────────┐
                    │   INITIAL   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
              ┌─────│  Login Screen │
              │     └──────┬──────┘
              │            │ Email / Google / Apple selected
              │     ┌──────▼──────┐
              │     │ Authenticating│──── OTP sent / social auth in progress
              │     └──────┬──────┘
              │            │
              │     ┌──────┴──────┐
              │     │             │
              │  Success ▼     Failure ▼
              │  ┌────────┐   ┌──────────┐
              │  │Authed   │   │Auth Error │
              │  └───┬────┘   └───┬──────┘
              │      │            │ Retry
              │      │            └──────► Login Screen
              │      │
              │      │ Session expired (token TTL)
              │      │
              │  ┌───▼──────────┐
              │  │Session Expired│
              │  └───┬──────────┘
              │      │ Auto re-auth attempt
              │      │
              │  ┌───┴───────┐
              │  │           │
              │  Success    Failure
              │  │           │
              │  ▼           ▼
              │ Authed    Login Screen
              │
              │ Logout
              └──────────────────► INITIAL
```

### State Definitions

| State | Description | Allowed Tabs |
|:--|:--|:--|
| **INITIAL** | App first launch. Checking stored session token | — |
| **Login Screen** | Not authenticated | Tab 2 (Explore) OK, Tab 1 (Portfolio) blocked |
| **Authenticating** | OTP sent or social auth in progress | Loading overlay |
| **Authed** | Valid session. Custodial wallet address available | All tabs |
| **Auth Error** | Login failed (network, wrong OTP) | Retry prompt |
| **Session Expired** | Token expired. Background renewal attempt | Current screen maintained + inline alert |

### UI Feedback

| Transition | User Experience |
|:--|:--|
| INITIAL → Authed | Automatic (stored session valid → immediate main screen) |
| Login Screen → Authenticating | "Signing in..." loading indicator |
| Authenticating → Auth Error | "Sign-in failed. Please try again." inline message |
| Authed → Session Expired | Current screen maintained + top banner "Session expired. Please sign in again." |

### Key Design Principles

1. **No wallet state**: No wallet connect/disconnect/chain switch states. Custodial wallet is auto-managed by backend.
2. **Explore without auth**: Tab 2 (Explore) is public data — accessible without login. Users can view regional data immediately.
3. **Data preserved on session expiry**: Screen data is NOT cleared on session expiry. Inline re-auth request overlays existing content.

### Public → Authenticated Transition

When an unauthenticated user taps Tab 1 (My Portfolio):

```
Tab 1 "My Portfolio" tap
    │
    ▼
[Gate Screen]
  "Sign in to view your
   investment portfolio"

  [Sign In]  [Continue Exploring]
```

- Sign In → State Machine A login screen
- Continue Exploring → Stay on Tab 2

---

## 3. State Machine B: Data Loading (per screen)

This is the **core state machine** of a read-only dApp. Applied identically to all data screens.

```
┌────────┐
│  IDLE  │ ← Screen not yet mounted
└───┬────┘
    │ Screen mount / pull-to-refresh / polling timer
    │
┌───▼─────┐
│ LOADING │ ← RPC call in progress (skeleton UI)
└───┬─────┘
    │
    ├─── Success ──────────────────────────┐
    │                                       │
    │                              ┌────────▼────┐
    │                              │   SUCCESS    │ ← Data displayed + cache saved
    │                              │              │   Ambient Trust badge active
    │                              └────────┬────┘
    │                                       │
    │                                       │ Cache TTL expired
    │                                       │
    │                              ┌────────▼────┐
    │                              │    STALE     │ ← Data still displayed
    │                              │              │   Background refresh started
    │                              └────────┬────┘
    │                                       │
    │                              ┌────────┴────┐
    │                              │             │
    │                           Success        Failure
    │                              │             │
    │                              ▼             ▼
    │                           SUCCESS       STALE (maintained)
    │                                         "Data from N min ago"
    │
    └─── Failure ──────────────────────────┐
                                            │
                                   ┌────────▼────┐
                                   │    ERROR     │
                                   └────────┬────┘
                                            │
                                   ┌────────┴────┐
                                   │             │
                                 Retry       Has cache
                                   │             │
                                   ▼             ▼
                                LOADING    ERROR + cached data shown
                                           "Last checked: N min ago"
```

### State Definitions

| State | UI Expression | Ambient Trust |
|:--|:--|:--|
| **IDLE** | Empty screen | — |
| **LOADING** | Skeleton (shimmer) UI | — |
| **SUCCESS** | Data displayed, charts rendered | "✓ Hardware Verified · Just updated" |
| **STALE** | Previous data maintained + subtle refresh indicator | "✓ Hardware Verified · Updating..." |
| **ERROR** | Error message + retry button. If cache exists, show cached data | "✓ Hardware Verified · 5m ago" |

### Contract-Level Loading Strategy

| Contract Function | Est. Response | Cache TTL | Polling | Immutable |
|:--|:--|:--|:--|:--|
| `RegionSTOFactory.getAllRegionIds()` | <100ms | 1 hour | None | Quasi-immutable (only on new region deploy) |
| `RegionSTOFactory.getRegionToken(regionId)` | <100ms | 1 hour | None | Immutable |
| `StationRegistry.getStationsByRegion(regionId)` | <200ms | 10 min | None | Changes on new station registration |
| `StationRegistry.getStation(stationId)` | <100ms | 10 min | None | Changes on deactivation |
| `RevenueTracker.getRegionRevenue(regionId)` | <200ms | 30 sec | 60 sec | Changes on every invoice.paid |
| `RevenueTracker.getMonthlyHistory(stationId)` | <300ms | 5 min | None | Intra-month changes, stable after month end |
| `RevenueTracker.getRegionAttestation(regionId, period)` | <100ms | **Immutable** | None | **Immutable after finalize** |
| `RegionSTO.balanceOf(address)` | <100ms | 5 min | None | Changes only on admin transfer |
| `RegionSTO.totalSupply()` | <100ms | 30 min | None | Changes only on issueTranche |
| `RegionSTO.getTrancheCount()` | <100ms | 30 min | None | Append-only |
| `RegionSTO.getTranche(trancheId)` | <100ms | **Immutable** | None | **Append-only, immutable** |
| `ChargeTransaction.getSession(tokenId)` | <100ms | **Immutable** | None | **Soulbound, immutable** |
| `ChargeTransaction.totalSessions()` | <100ms | 30 sec | 60 sec | Changes on every mint |
| `DeviceRegistry.getChipRecord(chargerId)` | <100ms | 1 hour | None | Changes only on deactivation |

### Parallel Loading Pattern

When a screen calls multiple contract functions simultaneously, each function has an independent State Machine B instance. UI renders **progressively**:

```
Portfolio Overview screen:
  ├─ balanceOf() ──── [LOADING] ──► [SUCCESS] ──► "500 units" displayed
  ├─ getRegionRevenue() ── [LOADING] ──► [SUCCESS] ──► "₩13,570,000" displayed
  ├─ totalSupply() ──── [LOADING] ──► [SUCCESS] ──► "50,000 units" displayed
  └─ getTrancheCount() ── [LOADING] ──► [SUCCESS] ──► "Round 3" displayed

  → Each function resolves independently
  → First-arrived data renders first
  → Remaining slots stay in skeleton state
```

---

## 4. Error State Taxonomy & UI Feedback

### 4.1 Error Classification

| Error Code | Cause | Severity | Frequency |
|:--|:--|:--|:--|
| **RPC_TIMEOUT** | L1 node not responding | High | Rare |
| **RPC_ERROR** | Contract revert (invalid params) | High | Very rare |
| **NETWORK_OFFLINE** | Device internet disconnected | Medium | During commute |
| **AUTH_EXPIRED** | Session token expired | Low | Periodic |
| **NO_HOLDINGS** | User has no tokens | — (not an error) | New users |

### 4.2 Error UI Feedback

#### RPC_TIMEOUT / RPC_ERROR

```
┌────────────────────────────┐
│                            │
│     ⚠️                     │
│  Unable to load data       │
│                            │
│  Please try again shortly  │
│                            │
│  ┌──────────────────────┐  │
│  │     Try Again          │  │
│  └──────────────────────┘  │
│                            │
│  (If cache available:)     │
│  Showing data from         │
│  5 minutes ago             │
│                            │
└────────────────────────────┘
```

#### NETWORK_OFFLINE

```
┌────────────────────────────────┐
│ ⚡ Check your internet          │ ← Top banner (red bg)
│    connection                   │
├────────────────────────────────┤
│                                │
│  (Cached data continues        │
│   to display)                  │
│  Last checked: 3 min ago       │
│                                │
└────────────────────────────────┘

  → Auto-dismisses on reconnect + data refresh
```

#### AUTH_EXPIRED

```
┌────────────────────────────────┐
│ 🔑 Session expired.            │ ← Top banner
│    [Sign in again]             │
├────────────────────────────────┤
│                                │
│  (Current screen data          │
│   maintained)                  │
│  (Tab 1 access triggers        │
│   login gate)                  │
│                                │
└────────────────────────────────┘
```

#### NO_HOLDINGS (empty state, not an error)

```
┌──────────────────────────────┐
│  My Portfolio                 │
│                               │
│  No investments yet           │
│                               │
│  Explore revenue data from    │
│  EV charging infrastructure   │
│  across 17 regions            │
│                               │
│  ┌──────────────────────────┐ │
│  │     Explore Regions        │ │
│  └──────────────────────────┘ │
└──────────────────────────────┘
```

---

## 5. Ambient Trust State Machine

Verification badge state transitions. Linked to State Machine B.

```
┌──────────────────────────┐
│ B = LOADING              │ → Badge hidden (skeleton)
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│ B = SUCCESS              │ → "✓ Hardware Verified · Just updated"
│   timestamp = now        │    Green checkmark
└──────────┬───────────────┘
           │ Time passes
┌──────────▼───────────────┐
│ B = SUCCESS              │ → "✓ Hardware Verified · 30s ago"
│   timestamp aging        │    Green checkmark maintained
└──────────┬───────────────┘
           │ Cache TTL expired
┌──────────▼───────────────┐
│ B = STALE                │ → "✓ Hardware Verified · Updating..."
│   background refresh     │    Checkmark + subtle spinner
└──────────┬───────────────┘
           │ Refresh failed
┌──────────▼───────────────┐
│ B = ERROR (has cache)    │ → "✓ Hardware Verified · 5m ago"
│   cached data shown      │    Checkmark maintained, timestamp yellow
└──────────────────────────┘
```

**Key Principle**: Even when data loading errors occur, the verification badge does NOT disappear. As long as cached data exists, the "Verified" state is maintained — only the timestamp indicates data freshness.

---

## 6. Composite State: Per-Screen State Combinations

How State Machines A and B combine on specific screens:

### Portfolio Overview Screen

| Condition | A (Auth) | B (Data) | Screen Display |
|:--|:--|:--|:--|
| Normal | Authed | SUCCESS (all functions) | Full portfolio + Ambient Trust |
| Partial load | Authed | balanceOf=SUCCESS, revenue=LOADING | Units shown + revenue skeleton |
| Offline | Authed | ERROR (has cache) | Cached data + offline banner |
| Session expired | Session Expired | — | Login gate |
| Not authenticated | Login Screen | — | Login gate |
| No holdings | Authed | SUCCESS (balanceOf=0) | Empty state + "Explore Regions" CTA |

### Region Explore Screen

| Condition | A (Auth) | B (Data) | Screen Display |
|:--|:--|:--|:--|
| Normal (unauthed) | Login Screen | SUCCESS | 17 region cards (public data) |
| Normal (authed) | Authed | SUCCESS | 17 region cards (same) |
| Offline | Any | ERROR (has cache) | Cached data + offline banner |
| First load | Any | LOADING | 17 skeleton cards |

---

## 7. Data Refresh Strategy

### 7.1 Hackathon (Polling-based)

```
App launch
  │
  ├─ Screen mount: Immediate RPC call
  ├─ Pull-to-refresh: Manual refresh
  └─ Polling timer:
     ├─ getRegionRevenue(): Every 60 seconds
     ├─ totalSessions(): Every 60 seconds
     └─ Others: No polling (manual refresh only)
```

### 7.2 Production (Event-based — Enhancement)

```
WebSocket subscription:
  ├─ RevenueRecorded event → Refresh regional revenue data
  ├─ RegionSettlementFinalized event → Refresh settlement report + push notification
  ├─ TrancheIssued event → Refresh issuance data + push notification
  └─ StationRegistered / StationDeactivated event → Refresh station list
```

---

## 8. State Transition Summary Table

All possible state transitions at a glance:

| Current State | Event | Next State | UI Action |
|:--|:--|:--|:--|
| A:INITIAL | Stored session valid | A:Authed | Direct to main screen |
| A:INITIAL | No stored session | A:Login Screen | Show onboarding or login |
| A:Login Screen | Login attempt | A:Authenticating | Loading indicator |
| A:Authenticating | Success | A:Authed | Enter main screen |
| A:Authenticating | Failure | A:Auth Error | Error message + retry |
| A:Authed | Token expired | A:Session Expired | Banner + re-auth attempt |
| A:Authed | Logout | A:INITIAL | Clear cache + first screen |
| B:IDLE | Screen mount | B:LOADING | Show skeleton |
| B:LOADING | RPC success | B:SUCCESS | Render data + activate badge |
| B:LOADING | RPC failure | B:ERROR | Error UI + cache fallback |
| B:SUCCESS | TTL expired | B:STALE | Background refresh |
| B:SUCCESS | Pull-to-refresh | B:LOADING | Skeleton overlay |
| B:STALE | Refresh success | B:SUCCESS | Update data |
| B:STALE | Refresh failure | B:STALE | Update timestamp only |
| B:ERROR | Retry | B:LOADING | Show skeleton |

---

*End of Document*
