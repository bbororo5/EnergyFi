# Doc 4: Target User Persona & Onboarding Strategy

> **Project**: EnergyFi — EV Charging Infrastructure Revenue STO Investor dApp
> **Version**: v2.0
> **Date**: 2026-03-06
> **Dependency**: This document is the foundation for Doc 1 (Journey Map), Doc 2 (IA), Doc 3 (State Machine).

> **Design Assumption**: The hackathon prototype assumes **Path A** (tokens issued on EnergyFi L1).
> The production issuance path (Path A / B / CCIP) will be determined after the Presidential Decree
> is finalized and a securities firm partnership is established. The "My Portfolio" tab's data source
> may change depending on the chosen path.

---

## 1. Primary Persona: "Infrastructure Investor" Jihyun Kim

### 1.1 Demographic Profile

| Attribute | Detail |
|:--|:--|
| **Name** | Jihyun Kim (fictional archetype) |
| **Age** | 38 |
| **Occupation** | Marketing team lead at mid-size company, dual-income household |
| **Residence** | Bundang apartment complex, Gyeonggi-do (EV charger installed) |
| **Household Income** | KRW 120M/year (pre-tax) |
| **Investable Assets** | KRW 30~50M/year |
| **Devices** | iPhone 15 Pro, Galaxy Tab S9, uses apps during commute |

### 1.2 Financial Behavior

| Attribute | Detail |
|:--|:--|
| **Experience** | 8 years. Diversified across domestic stocks, ETFs, REITs, term deposits |
| **Primary Apps** | Toss Securities (daily), Kiwoom (stocks), KakaoPay Securities (micro) |
| **Risk Profile** | Medium risk / medium return. Monthly portfolio check rather than "set and forget" |
| **Discovery** | Securities app recommendations, financial YouTube, apartment resident chat groups |
| **Interest** | REITs, infrastructure funds, ESG products. Prefers "investments backed by real assets" |

### 1.3 Technical Literacy

| Domain | Level | Notes |
|:--|:--|:--|
| Mobile apps | **High** | Uses 5+ financial apps daily, comfortable with biometrics and mobile payments |
| Web services | **High** | Prefers mobile over desktop, uses PC banking when needed |
| Blockchain/Crypto | **Near zero** | Has seen Bitcoin news but never used a wallet. "Blockchain = speculation" |
| Data analysis | **Moderate** | Can interpret charts and returns, no API/code knowledge |

### 1.4 Investment Motivation & Mental Model

**Motivation**: Betting on EV charging infrastructure growth driven by government policy (450M EVs by 2030 target). Long-term view: "EVs will always need charging, so charging station revenue should be stable."

**Mental Model** — perceives EV charging STO as analogous to:
- **REITs**: "Like receiving rental income without directly owning property, I receive charging revenue without owning a station"
- **Infrastructure funds**: "Like toll road revenue — recurring income from physical infrastructure"
- **Solar leasing**: "Install panels, earn income from electricity generation"

**Does NOT perceive it as**:
- ❌ DeFi yield farming
- ❌ NFT speculation
- ❌ Cryptocurrency trading

### 1.5 Key Questions (Investment Decision)

| Priority | Question | dApp Response |
|:--|:--|:--|
| 1 | **"Is this revenue data real?"** | Ambient Trust (badges) + Explicit Proof (SE signature drill-down) |
| 2 | **"What's the expected return?"** | Regional monthly revenue trend charts, month-over-month change |
| 3 | **"Can I get my money back?"** | Securities firm handles secondary market (outside dApp) |
| 4 | **"What if the company fails?"** | FSS audit history, securities firm partnership info |
| 5 | **"Are others investing too?"** | Tranche count + total issued units (`getTrancheCount()` + `totalSupply()`) |

### 1.6 Daily dApp Usage Scenarios

**Scenario A: Morning commute check (daily, 30 seconds)**
- Open app on subway → Portfolio overview → "KRW 320,000 added yesterday" → Close app
- Emotion: Light satisfaction ("still running well")

**Scenario B: Monthly portfolio review (monthly, 5 minutes)**
- Check regional revenue detail → Compare monthly charts → "Seoul is 12% higher than Gyeonggi"
- Consider additional investment → Switch to securities firm app
- Emotion: Analytical, comparative

**Scenario C: Recommend to friend (occasional)**
- "Let me show you this app" → Explore regions → Charging station data → "See? The hardware signed this data directly"
- Emotion: Pride, trust propagation

---

## 2. Anti-Personas: Who This App Is NOT For

| Anti-Persona | Why Excluded | Disappointed By |
|:--|:--|:--|
| **Crypto-native DeFi user** | Expects MetaMask, gas tokens, swap interface | "No wallet connect? Where's the contract address?" |
| **Day trader** | Wants short-term trading, order book, charts | "No order book? No sell button?" |
| **EV driver seeking discounts** | Wants charging price comparison, station finder | "This is an investment app, not a charging app" |
| **CPO (Charge Point Operator)** | Wants B2B fleet management | STRIKON platform is their tool, not this app |

---

## 3. Persona → Design Decision Mapping

| Persona Trait | Design Decision | Implementation |
|:--|:--|:--|
| Zero crypto experience | **Zero blockchain terminology** | UI copy never uses: smart contract, blockchain, wallet, gas, token |
| REIT mental model | **Real estate fund factsheet pattern** | Region cards = fund product cards. Revenue, history, underlying assets (stations) |
| "Is this real?" question | **A+B trust delivery** | Ambient Trust badges on all data + Explicit Proof drill-down on tap |
| Familiar with Korean finance apps | **Financial app design patterns** | Number formatting, gain/loss colors (locale-dependent), chart style |
| Commute usage | **30-second check optimization** | Portfolio tab shows key numbers immediately. Above-the-fold, no scroll |
| Monthly deep review | **Progressive Disclosure** | L1 (summary) → L2 (detail) → L3 (verification) |
| Mobile-first | **Mobile-first, web-compatible** | Touch-optimized interactions, responsive web layout |
| Biometric-savvy | **Biometric app lock** (production) | Face ID / fingerprint → app entry |

---

## 4. Onboarding Flow

### 4.1 Design Principles

1. **Hide blockchain, reveal value**: Communicate "tamper-proof revenue records" as the value — never the mechanism
2. **Reach core screen within 3 minutes**: Onboarding → Portfolio or Explore in max 3 minutes
3. **Skippable education**: All carousels and tours can be skipped
4. **Branch by holdings**: Existing token holders go straight to portfolio

### 4.2 Screen Details

#### Screen 1: Welcome

```
┌──────────────────────────────┐
│                              │
│      [EnergyFi Logo]         │
│                              │
│   Invest in EV Charging      │
│   Infrastructure             │
│                              │
│   Monitor real revenue data  │
│   from charging stations     │
│   across 17 Korean regions   │
│                              │
│   [Korea map — 17 regions    │
│    highlight animation]      │
│                              │
│   ┌────────────────────────┐ │
│   │      Get Started         │ │
│   └────────────────────────┘ │
│                              │
│   Already have an account?   │
│   Sign in                    │
└──────────────────────────────┘
```

- **Purpose**: Deliver core value proposition in one sentence
- **Copy principle**: Uses "invest" and "revenue" — financial language. Never "blockchain", "token"
- **Visual**: 17 regions light up sequentially on Korea map → "nationwide infrastructure" impression

#### Screen 2: How It Works (3-slide carousel)

**Slide A: Infrastructure**
```
┌──────────────────────────────┐
│  [Charging station photo]     │
│                              │
│  EnergyFi charging stations  │
│  are installed in apartment  │
│  complexes nationwide        │
│                              │
│  17 regions including Seoul, │
│  Busan, Gyeonggi, and more   │
│  ●○○                        │
│                              │
│  [Skip]              [Next →]│
└──────────────────────────────┘
```

**Slide B: Revenue Recording**
```
┌──────────────────────────────┐
│  [Data flow illustration]     │
│  Charger → Auto-record → $   │
│                              │
│  Every charging session      │
│  is automatically recorded   │
│                              │
│  All records are signed by   │
│  the charger's hardware,     │
│  making them tamper-proof    │
│                              │
│  ○●○                        │
│                              │
│  [Skip]              [Next →]│
└──────────────────────────────┘
```

- **Key**: "signed by hardware" conveys SE chip trust model in everyday language
- **Never use**: "recorded on blockchain", "smart contract", "on-chain", "TPM 2.0"

**Slide C: Revenue Tracking**
```
┌──────────────────────────────┐
│  [Revenue chart mini mockup]  │
│                              │
│  Track regional revenue      │
│  in real time                │
│                              │
│  All data you need for       │
│  investment decisions is     │
│  transparently available     │
│                              │
│  ○○●                        │
│                              │
│  [Skip]        [Get Started →]│
└──────────────────────────────┘
```

#### Screen 3: Login

```
┌──────────────────────────────┐
│                              │
│  Sign In                     │
│                              │
│  ┌────────────────────────┐  │
│  │ 📧 Continue with Email    │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ 📱 Continue with Phone    │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ 🍎 Continue with Apple    │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │  Continue with Google     │  │
│  └────────────────────────┘  │
│                              │
│  By signing in, you agree to │
│  our Terms of Service and    │
│  Privacy Policy              │
└──────────────────────────────┘
```

- **Key**: No wallet creation/connection visible at any point
- Backend auto-creates custodial wallet on sign-in
- User perceives "account", never "wallet"

#### Screen 4: Portfolio Connection (conditional)

**Case A: Already holds STO tokens (entered after purchase via securities firm)**
```
┌──────────────────────────────┐
│                              │
│  🎉                          │
│  We found your investments   │
│                              │
│  ┌────────────────────────┐  │
│  │ Seoul Metropolitan       │  │
│  │ 500 units held           │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Gyeonggi Province        │  │
│  │ 200 units held           │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │   View Portfolio          │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**Case B: No tokens (entered for research)**
```
┌──────────────────────────────┐
│                              │
│  No investments yet          │
│                              │
│  Explore revenue data from   │
│  EV charging infrastructure  │
│  across 17 regions           │
│                              │
│  ┌────────────────────────┐  │
│  │   Explore Regions         │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

- **Design intent**: Holders → "My Portfolio" tab. Non-holders → "Explore" tab
- Both cases reach core value screen within 3 minutes

#### Screen 5: Quick Tour (optional, skippable)

```
┌──────────────────────────────┐
│  Quick Tour          [Skip]   │
│                              │
│  1️⃣ My Portfolio              │
│  Track your investment       │
│  returns at a glance         │
│  [Highlight: Tab 1]         │
│                              │
│  2️⃣ Explore                   │
│  Compare revenue data across │
│  17 regions                  │
│  [Highlight: Tab 2]         │
│                              │
│  3️⃣ Verify Source Data        │
│  Check the original hardware │
│  signatures on every record  │
│  [Highlight: drill-down link]│
│                              │
│  ┌────────────────────────┐  │
│  │      Get Started          │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### 4.3 Hackathon Simplified Version

Hackathon prototype: Screen 1 + Screen 3 → straight to main screen.
- Screen 2 (How It Works) and Screen 5 (Quick Tour) content absorbed into "More > Investment Guide"
- Screen 4 (Portfolio Connect) deferred to post-hackathon. Demo starts pre-authenticated with mock on-chain holdings

---

## 5. Terminology Shield

Strict terminology translation applied across the entire dApp. **Left column terms must NEVER appear in UI.**

| Technical Term | English UI | Korean UI | L3 Allowed |
|:--|:--|:--|:--|
| Blockchain | — (never expose) | — (never expose) | ✅ "Block Explorer" link only |
| On-chain | Tamper-proof record | 변조 불가능한 기록 | — |
| Smart contract | — (never expose) | — (never expose) | — |
| Wallet / Address | — (hidden) | — (hidden) | — |
| Gas fee | — (N/A) | — (N/A) | — |
| Token | Unit (investment unit) | 좌 (투자 단위) | — |
| RegionSTO | [Region] Investment Product | [지역명] 투자 상품 | — |
| Tranche | Issuance round | 발행 차수 | — |
| balanceOf() | Units held | 보유 좌수 | — |
| totalSupply() | Total issued units | 총 발행 좌수 | — |
| SE Signature | Hardware Verified | 하드웨어 인증 | ✅ "SE Signature" raw display |
| Bookend model | Dual-point verification | 양단 검증 | ✅ Technical detail |
| TPM 2.0 | Security chip | 보안 칩 | ✅ Education content |
| DeviceRegistry | Charger certification | 충전기 인증 현황 | — |
| ChargeTransaction | Charging record | 충전 기록 | — |
| RevenueTracker | Revenue status | 수익 현황 | — |
| RegionAttestation | Settlement report | 정산 확인서 | ✅ Raw data display |
| distributableKrw | Distributable revenue | 분배 가능 수익 | — |
| energyKwh | Energy charged | 충전량 | — |
| Merkle root | Data verification code | 데이터 검증 코드 | ✅ Hash display |
| Bridge wallet | — (never expose) | — (never expose) | — |
| CCIP | — (never expose) | — (never expose) | — |

> **L3 Exception Rule**: At the L3 verification level only, selected technical terms (marked ✅ above) may appear in their original form alongside user-friendly labels. This is by design — power users and hackathon judges need to see the raw cryptographic proof.

---

## 6. Progressive Disclosure: 3 Information Depth Levels

Same data exposed at 3 depths based on user interest level:

### L1: Summary (all users)

Default display on portfolio cards and region list cards.

```
┌────────────────────────────┐
│ Seoul Metropolitan           │
│ This month: ₩13,570,000     │
│ ✓ Hardware Verified          │
└────────────────────────────┘
```

- 1 number + Ambient Trust badge
- Visible immediately without scrolling

### L2: Detail (interested investors)

Entered by tapping a card.

```
Seoul Metropolitan — Investment Detail
────────────────────────────
42 stations · 156 chargers
3,420 sessions this month
Revenue ₩13,570,000 (+12% MoM)

My share: 500 units · 1.0%
Issuance: Round 3 · Total 50,000 units

[Monthly revenue chart — last 6 months]

✓ All data is hardware verified
  View source data →
```

- Station count, session count, monthly chart, tranche history, share %
- Ambient Trust microcopy + "View source" drill-down link

### L3: Verification (power users / judges)

Entered by tapping "View source data."

```
Settlement Report — Original
────────────────────────────
Region: Seoul Metropolitan (KR-11)
Period: 2026.03.01 ~ 2026.03.31
Distributable revenue: ₩13,570,000
Stations included: 42
Finalized: 2026.04.01 09:00:00

Data verification code:
0x1a2b3c4d...ef56 (Merkle Root)

Charging record sample (of 3,420)
────────────────────────────
#1 | 2026.03.31 14:32
    Charger: ELEC-GN-001-C03
    Energy: 6.78 kWh
    Revenue: ₩14,400
    Hardware signature: ✓ Verified
    [View raw signature]

[View on Block Explorer →]
```

- Raw data: RegionAttestation fields, Merkle root, SE signature bytes
- Block Explorer external link
- **Only at this level** do technical terms appear in limited scope

---

## 7. Trust Building Strategy (A+B Combination)

### 7.1 Ambient Trust: Trust Elements Embedded in Every Screen

| Element | Location | Design |
|:--|:--|:--|
| **✓ Hardware Verified** badge | Next to all revenue data | Small checkmark + light green background. Tap → L3 drill-down |
| **"Updated N sec ago"** | Bottom of data cards | Gray small text. Implies real-time data |
| **Station count** | Inside region cards | "42 stations operating" — implies physical reality |
| **FSS Audit** mark | More > About EnergyFi | Official security audit certification image |

### 7.2 Explicit Proof: Active Verification Paths

Accessible when the investor thinks "I want to verify this myself":

**Entry Point 1: Revenue data → SE signature verification**
- Region detail > Station > Charging session > "Verify hardware signature"
- Shows original data signed by the SE chip
- "This data was signed directly by the charger's security chip, meaning it has not been tampered with"

**Entry Point 2: Settlement report → Merkle Root**
- Portfolio detail > Settlement report > "Data verification code"
- Visualizes how all charging records for the period are compressed into one code

**Entry Point 3: More > Data Verification Center** (Power user)
- Platform-wide statistics + charging session explorer + Bookend visualization
- Dedicated space for hackathon judges, auditors, technical investors

### 7.3 Bookend Verification Visualization (Educational)

Helps general investors intuitively understand "dual-point verification":

```
[Charger Security Chip]       [Blockchain Record]
    Signature A ─────────?──────── Signature B

    Signature A === Signature B  →  ✅ Data Integrity Confirmed
    "The starting point and endpoint match,
     so the data was not tampered with in between"
```

- Animation: Signatures from both ends meet and show "✅ Match"
- Copy: Uses "starting point and endpoint" metaphor instead of technical terms

---

## 8. Accessibility Considerations

| Item | Standard | Implementation |
|:--|:--|:--|
| Min text size | Body 14sp, amounts 24sp | Expo fontSize constants |
| Color contrast | WCAG AA (4.5:1) | Verified in both dark/light mode |
| Gain/loss colors | Locale-dependent (see §8.1) | Arrow ↑↓ always accompanies color for colorblind users |
| Screen reader | iOS VoiceOver, Android TalkBack | aria-label on all monetary amounts |
| Touch targets | Min 44×44pt | React Native Pressable hitSlop |

### 8.1 Locale-Dependent Color Rules

| Locale | Positive (gain) | Negative (loss) | Rationale |
|:--|:--|:--|:--|
| **EN** (default) | Green + ↑ | Red + ↓ | Global financial convention |
| **KR** | Red + ↑ | Blue + ↓ | Korean financial convention |

---

## 9. Hackathon vs Production Onboarding Differences

| Item | Hackathon Prototype | Production |
|:--|:--|:--|
| Onboarding | Screen 1 + 3 (simplified) | Full 5 screens |
| Login | Email OTP or pre-authenticated | Kakao/Apple/Email/Phone |
| Wallet | Fully hidden, backend auto | Same (custodial) |
| KYC | Skipped | Securities firm KYC (external) |
| Token detection | On-chain deployed mock data (same RPC calls) | Production data |
| Notifications | Not implemented | FCM push (settlement complete, new issuance) |
| Biometric auth | Not implemented | Face ID / fingerprint lock |
| Language | EN + KR toggle | EN + KR (same) |

---

## 10. i18n Strategy

### 10.1 Supported Locales

| Locale | Code | Purpose |
|:--|:--|:--|
| English | `en` | Default. Hackathon judges (Avalanche team) |
| Korean | `ko` | Target market users |

### 10.2 i18n Scope

| Category | i18n Applied | Notes |
|:--|:--|:--|
| UI labels & navigation | ✅ | All tabs, buttons, headers |
| Terminology Shield | ✅ | EN and KR columns in §5 |
| Number formatting | ✅ | EN: `₩13,570,000` / KR: `13,570,000원` |
| Gain/loss colors | ✅ | EN: green/red / KR: red/blue |
| Date format | ✅ | EN: `Mar 31, 2026` / KR: `2026.03.31` |
| Error messages | ✅ | |
| L3 technical terms | ❌ | Always English (cryptographic terms are universal) |

### 10.3 Language Toggle

- Located on **Tab 3 (More) main screen** as `EN / KR` toggle
- Persisted in local storage
- Hackathon demo can switch languages during presentation

---

*End of Document*
