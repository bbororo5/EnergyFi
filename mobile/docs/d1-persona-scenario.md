# D1: Persona & Scenario

> **Project**: EnergyFi — EV Charging Infrastructure Revenue STO Investor dApp
> **Version**: v1.0
> **Date**: 2026-03-08
> **Process**: D1 (Persona & Scenario) → D2 (Journey Map) → D3 (IA) → D4 (Wireframe & Flow) → D5 (UI Spec) → D6 (Build + Heuristic Validation)

> **Scope**: This app is a **read-only data transparency tool**. No token purchase, sale, transfer, or dividend claim occurs within the app. All financial transactions are handled by external licensed securities firms.

---

## 1. Research Foundation

This persona is built on verified data only. Each claim is tagged with its evidence tier.

### 1.1 Evidence Tiers

| Tier | Definition | Examples |
|:--|:--|:--|
| **T1** | Government census/registry, full-population | 통계청, 국토교통부, KSD |
| **T2** | Government research institute, large sample (n≥5,000) | KDI, AURI, 가계금융복지조사 |
| **T3** | Peer-reviewed academic paper | KCI, MDPI, ScienceDirect |
| **T4** | Industry survey (n≥400), institutional report | Chabot, Roland Berger, KIRI |
| **REF** | Reference only — not used for decisions | News articles, blog posts, projections |

### 1.2 Verified Facts

#### Market Context

| Fact | Value | Tier | Source |
|:--|:--|:--|:--|
| Registered EVs in Korea | 684,000 (end-2024) | T1 | 국토교통부 자동차등록현황 |
| New EV registrations (2024) | 147,000 | T1 | 국토교통부 |
| Eco-friendly vehicle share | >10% of total registrations (first time) | T1 | 국토교통부 |
| EV buyer age: 40s share | 35.1% (largest segment) | T1 | 국토교통부 via 전자신문 |
| EV buyer age: 30s share | 26.6% | T1 | 국토교통부 via 전자신문 |
| EV buyer age: 30-40s combined | 61.7% | T1 | 국토교통부 via 전자신문 |
| EV buyer gender: male | 72.4% | T4 | Reportera |
| Apartment dwelling rate (national) | 53.9% | T1 | 2024 인구주택총조사 |
| Apartment dwelling rate (Gyeonggi) | 87.2% (2+ person households) | T1 | 2024 인구주택총조사 |
| Capital region household share | 49.7% (11.3M households) | T1 | 통계청 |

#### Investment Behavior

| Fact | Value | Tier | Source |
|:--|:--|:--|:--|
| Individual stock holders | 14.1M (32% of adults) | T1 | KSD (2024.12) |
| Total cash dividends (2024) | KRW 32.29T (+9.6% YoY) | T1 | KSD |
| Individual dividend receipts | KRW 9.09T (28.1% of total) | T1 | KSD |
| Dividend recipients: 50-60s share | 58.1% of all individual dividends | T1 | KSD |
| Trend: 20-40s investors | Sharp decline since 2022 | T1 | KSD |
| Trend: 50+ investors | Increasing | T1 | KSD |
| Household avg income (2024) | KRW 74.27M | T2 | 가계금융복지조사 (n=20,000) |
| Household disposable income | KRW 60.32M | T2 | 가계금융복지조사 |
| Financial assets share | 24.2% of total household assets | T2 | 가계금융복지조사 |
| Real assets share (real estate) | 75.2% of total household assets | T2 | 가계금융복지조사 |
| Surplus fund allocation | 53.3% → savings/investment, 22.7% → real estate | T2 | 가계금융복지조사 |
| REIT investors | 90K (2020) → 410K (2023), 4.6x growth | T2 | 한국리츠협회 |
| Listed REIT avg dividend yield | 7.5% | T2 | 한국리츠협회 |
| Monthly dividend ETF AUM | KRW 23.7T (112 products, May 2025) | T2 | KIRI 보험연구원 |

#### Charging Infrastructure

| Fact | Value | Tier | Source |
|:--|:--|:--|:--|
| Total chargers installed | ~394,000 | T1 | ChargeInfo (한국가스안전공사) |
| Fast charger utilization | 49.1% (Seoul) | T3 | Kim 2024, KCI 논문 |
| Slow charger utilization | 24.6% (Seoul) | T3 | Kim 2024, KCI 논문 |
| Fast charger sessions/day | 2.3 sessions, 47.2 min each | T3 | Kim 2024, KCI 논문 |
| Residential slow chargers | Heavily used overnight | T3 | ResearchGate 2024 |
| EV charging infra elasticity | 1.24 (10% more chargers → 12.4% more EVs) | T2 | KDI 연구보고서 |
| Mandatory install (new apt) | 5% → 10% of parking (2025~) | T2 | AURI Brief 289 |
| Mandatory install (existing apt) | 2% of parking (grace ended Jan 2025) | T2 | AURI Brief 289 |
| CPO profitability | Almost all fast-CPOs unprofitable (2024) | T4 | Corporate disclosures via Electimes |

#### Trust & Barriers

| Fact | Value | Tier | Source |
|:--|:--|:--|:--|
| EV purchase barrier #1 | Charging infra shortage (45.3%) | T4 | Chabot survey (n=450) |
| EV purchase barrier #2 | Fire/safety concerns (34.9%) | T4 | Chabot survey |
| Battery safety concern (Korea) | 50% of respondents | T4 | Deloitte Global Auto Study 2026 (28,000+, 27 countries) |
| **EV charging infra investment willingness** | **59.0% had NO intention to invest** | **T3** | **MDPI Sustainability 2023 (peer-reviewed)** |
| Crypto investors in Korea | 16.29M (Feb 2025) | T1 | 금융정보분석원(FIU) |
| STO legislation effective date | January 2027 | T1 | 전자증권법 국회 통과 (2026.01) |

### 1.3 Known Unknowns (Gaps That Cannot Be Filled Without Primary Research)

| Gap | Why It Matters | Resolution Path |
|:--|:--|:--|
| EV ownership × apartment × investor cross-tabulation | Core persona intersection is unverified | MDIS microdata access or custom survey |
| EV buyer household income | Investment capacity estimation | Custom survey at D6 |
| STO vs. crypto distinction in consumer perception | UI terminology decisions | Usability test at D6 |
| Actual demand for charging infrastructure investment | Value proposition validation | A/B test or survey at D6 |
| Chargein (차지인) product details and traction | Competitive positioning | Business strategy analysis (out of D1 scope) |

### 1.4 Counter-Evidence: Facts That Challenge Our Assumptions

These findings **must** be addressed in persona design, not ignored.

| Finding | Implication |
|:--|:--|
| **59% have no intention to invest in EV charging infra** (T3) | The "invest in your apartment's charger" pitch may face majority resistance. Persona must include realistic skepticism. |
| **Dividend-receiving investors are 58.1% in their 50-60s** (T1) | Our target 30-40s may not be dividend-oriented. Their investment behavior skews toward growth/speculation. |
| **20-40s investors declining since 2022** (T1) | Younger investors are leaving domestic equities for overseas stocks, not seeking new domestic alternatives. |
| **Almost all fast-CPOs are unprofitable** (T4) | Revenue distribution promise must address profitability timeline honestly. |
| **Korean households: 75.2% assets in real estate** (T2) | Target users have limited financial assets for new investments; most wealth is illiquid. |

---

## 2. Primary Persona: "Seongjun Park"

> **Design Note**: This persona synthesizes T1-T3 verified data. Inferred attributes are explicitly marked [INFERRED].

### 2.1 Demographic Profile

| Attribute | Value | Evidence |
|:--|:--|:--|
| **Age** | 39 | T1: 40s = 35.1% of EV buyers (largest); T1: 40s = 23% of stock holders (largest) |
| **Gender** | Male | T1: 72.4% of EV buyers are male |
| **Residence** | Gyeonggi-do new town apartment, owned | T1: Gyeonggi apt rate 87.2%; T2: homeownership 61.4% |
| **Household** | Married, one child | T3: Larger households less likely to adopt BEV — single-child aligns with EV ownership |
| **Vehicle** | Hyundai IONIQ 5 | T1: Hyundai #3 brand (25.2%), IONIQ 5 = top domestic model |
| **Occupation** | Mid-level corporate employee | [INFERRED] from household income data |
| **Household income** | ~KRW 75M/year | T2: National avg KRW 74.27M (가계금융복지조사, n=20,000) |
| **Disposable income** | ~KRW 60M/year | T2: National avg KRW 60.32M |
| **Financial assets** | ~KRW 130M (24% of total) | T2: Avg KRW 136.9M, 24.2% of household assets |
| **Real estate** | ~KRW 400M+ (apartment) | T2: Avg real assets KRW 429.88M, 75.2% of total |
| **Debt** | ~KRW 95M (mortgage) | T2: Avg household debt KRW 95.34M |

### 2.2 Financial Behavior (Verified)

| Behavior | Evidence |
|:--|:--|
| Uses mobile investment app | T1: 14.1M individual stock holders (32% of adults) |
| Surplus funds → savings/investment (53.3%) | T2: 가계금융복지조사 |
| Most wealth locked in apartment | T2: 75.2% of assets = real estate |
| Limited liquid capital for new investment | T2: Financial assets = 24.2% of total |
| Likely holds domestic stocks + exploring overseas | T1: KSD trend — 40s shifting to overseas stocks |
| [INFERRED] Monthly investable amount: KRW 1-3M | Derived from disposable income minus living expenses |

### 2.3 Relationship to EV Charging

| Attribute | Evidence |
|:--|:--|
| Charges at apartment complex slow charger | T3: Residential slow chargers heavily used overnight |
| Experiences charging space conflicts | T2: AURI Brief 289 — ICE vs. EV resident disputes |
| Sees "충전 전쟁" firsthand | T2: Seoul charging obstruction complaints +49% YoY |
| Understands charging costs well | T3: Fast 47.2 min/session, slow 251.5 min/session |
| Has experienced charger malfunction/unavailability | T4: Charging infra shortage = #1 EV complaint (45.3%) |

### 2.4 Motivations — Why He Might Be Interested

| Motivation | Evidence | Strength |
|:--|:--|:--|
| "I see these chargers generating revenue daily" | Direct observation from apartment life | **Strong** (experiential) |
| "I want predictable cash flow from investments" | T2: REIT investors 4.6x growth; T2: monthly dividend ETF growth | **Medium** (behavioral proxy, but category gap exists) |
| "The government is making this legal and regulated" | T1: 전자증권법 passed, Jan 2027 effective | **Strong** (regulatory tailwind) |
| "I want to diversify beyond stocks and real estate" | T2: 53.3% surplus → savings/investment | **Weak** (intent exists but no infra-specific evidence) |

### 2.5 Anxieties — Why He Might NOT Be Interested

| Anxiety | Evidence | Strength |
|:--|:--|:--|
| **"Do charging stations even make money?"** | T4: Almost all fast-CPOs unprofitable | **Critical** — must address in UI |
| **"I don't want to invest in something I don't understand"** | T3: 59% no intention to invest in charging infra (V2G study) | **Critical** — majority resistance |
| **"Is this just another crypto scam?"** | T1: 16.29M crypto investors but Terra/Luna destroyed trust | **High** — trust barrier |
| "What if I can't sell my tokens?" | Structural: STO liquidity is uncertain until 2027+ | **High** — liquidity concern |
| "Most of my money is in my apartment mortgage" | T2: 75.2% assets in real estate, KRW 95M avg debt | **Medium** — limited capital |
| "Younger investors are leaving domestic markets" | T1: KSD 20-40s investor decline trend | **Medium** — zeitgeist misalignment |

### 2.6 Technology Profile

| Attribute | Evidence |
|:--|:--|
| Smartphone: iPhone or Galaxy flagship | [INFERRED] from income bracket |
| Primary financial apps: Toss, banking apps | T4: Toss MAU 3.84M, dominant in 30-40s |
| Blockchain/crypto experience: None to minimal | Design decision: app assumes zero blockchain knowledge |
| App usage pattern: short sessions during commute | [INFERRED] — standard mobile finance behavior |
| Trust signals: regulated, government-backed, institutional partners | T2: FSS consumer protection framework; T1: FSC STO regulation |

### 2.7 Core Persona Statement

> **Seongjun charges his IONIQ 5 at his apartment's slow charger every night. He watches the charger's LED blinking and wonders: "Someone is making money from this — why can't I?" He's willing to invest KRW 1-3M per month in something regulated and transparent, but he will NOT touch anything that smells like crypto or sounds too good to be true. His biggest question is not "how much will I earn?" but "is this real?"**

---

## 3. Secondary Persona: "Yuna Choi"

### 3.1 Demographic Profile

| Attribute | Value | Evidence |
|:--|:--|:--|
| **Age** | 31 | T1: 30s = 26.6% of EV buyers; T1: 20-30s = 54.4% of Toss users |
| **Gender** | Female | Counter-balance: 27.6% of EV buyers, growing segment |
| **Residence** | Seoul apartment, jeonse (전세) | T1: Seoul apt rate 64.7%; T2: homeownership for newlyweds 43.9% (low) |
| **Household** | Single or DINK | T3: Smaller households more EV-inclined |
| **Vehicle** | Does not own EV yet | [INFERRED] — represents prospective segment |
| **Household income** | ~KRW 50-60M/year | [INFERRED] from age-income curve |
| **Financial assets** | Lower than Primary persona | T2: Wealth polarization — younger quintiles have less |

### 3.2 Key Differentiators from Primary Persona

| Dimension | Seongjun (Primary) | Yuna (Secondary) |
|:--|:--|:--|
| EV ownership | Owns IONIQ 5 | Does not own EV |
| Charging pain | Experiences directly | Observes in apartment complex |
| Investment motivation | Diversify + cash flow | Fractional ownership of real assets |
| Risk tolerance | Moderate (mortgage holder) | Higher (fewer obligations) |
| Blockchain perception | "Is this a scam?" | "Is this the next thing?" |
| Primary app | Banking + Toss Securities | Toss + Kakao Pay |
| Investment style | Domestic stocks, starting overseas | Overseas stocks, thematic ETFs |
| Relevant precedent | REIT investor profile | 조각투자 (fractional investment) user profile |

### 3.3 Core Persona Statement

> **Yuna doesn't own an EV yet, but she lives in an apartment where 3 new chargers were installed last year — and the parking war that followed. She invests in US stocks via Toss and has tried MusicCow. She's attracted to the idea of "owning a piece of infrastructure" but will only engage if the UI is as simple as Toss and the numbers are transparent. She's not afraid of new things, but she IS afraid of losing money on something illiquid.**

---

## 4. Scenario Map

### 4.1 Primary Scenario: "Seongjun's First Encounter"

```
Context: Seongjun sees a news article about EnergyFi's STO launch
         (securities firm announcement, not crypto exchange)

Step 1: Reads about "EV 충전소 수익 투자" — regulated, government-approved
Step 2: Downloads app from App Store (not a "Web3 wallet")
Step 3: Opens app → sees familiar financial app UI (Toss-like)
Step 4: Browses "탐색" tab → finds his region (Gyeonggi-do)
Step 5: Sees real revenue data from chargers he recognizes
        → "내 아파트 단지 근처 충전소가 월 150만원?"
Step 6: Taps for detail → sees hardware verification badge
        → "데이터가 TPM 칩으로 검증됐다고?"
Step 7: Checks historical revenue chart → sees seasonality
Step 8: Opens "더보기" tab → reads "수익 구조 안내"
        → Learns about CPO profitability challenges (honest disclosure)
Step 9: DOES NOT purchase within app
        → Sees "증권사에서 청약하기" information (external)
Step 10: Returns daily to check revenue data before making decision
```

### 4.2 Secondary Scenario: "Yuna's Exploration"

```
Context: Yuna hears about EnergyFi from a friend who invested

Step 1: Downloads app out of curiosity
Step 2: Skips login → browses as guest (no wallet needed)
Step 3: Opens "탐색" tab → browses all regions
Step 4: Compares regions by revenue, station count, growth rate
Step 5: Finds a region with high revenue → taps for detail
Step 6: Sees revenue per station, utilization rate, trend
Step 7: Notices "하드웨어 검증" badge → taps to learn more
        → Understands SE chip verification concept (simplified)
Step 8: Shares screenshot to KakaoTalk group chat
Step 9: Returns occasionally to monitor before STO launch
```

### 4.3 Anti-Scenario: What the App Must NOT Do

| Anti-pattern | Why | Evidence |
|:--|:--|:--|
| Show wallet address or blockchain explorer link | Triggers "crypto" association | Design decision: zero blockchain terminology |
| Use "토큰", "블록체인", "지갑", "가스" in UI | Alienates 100% of target | T4: Blockchain experience = none |
| Display unrealistic revenue projections | Destroys trust immediately | T4: CPO profitability data — honesty required |
| Include "Buy" or "Invest" CTA button | Regulatory violation — securities firm domain | CLAUDE.md §2.5, §2.6 |
| Require MetaMask or any Web3 wallet | Blocks 100% of target audience | T3: Apartment-dwelling mainstream consumers |
| Compare returns to savings or deposits | Regulatory risk — STO is not a deposit product | Implied by Capital Markets Act |

---

## 5. Design Implications for Subsequent Documents

### For D2 (Journey Map)

- Journey starts from **news/word-of-mouth**, not from app store browsing
- The "trust building" phase is longer than typical fintech — users will monitor for weeks/months before investing via securities firm
- App's job is to **reduce anxiety**, not to **excite**

### For D3 (Information Architecture)

- Primary navigation based on persona questions: "내 투자는?" (Portfolio) / "어디에 투자할까?" (Explore) / "이건 뭐지?" (More)
- Revenue data must be the hero element, not token price
- Hardware verification badge must be ambient (always visible, never intrusive)

### For D4 (Wireframe & Flow)

- No wallet connection flow
- No transaction signing flow
- Login should be email/phone (abstracted wallet)
- Guest browsing must be fully functional (Yuna's scenario)

### For D5 (UI Spec)

- Visual language: professional finance (Toss/banking), NOT crypto/Web3
- Color: muted, trust-oriented. Green = verified, not "bullish"
- Typography: system font, large numbers
- No dark mode as primary (financial trust association)

### For D6 (Build + Validation)

Priority validation questions during usability testing:
1. **Do users understand "EV charging revenue investment" without blockchain context?**
2. **Does the hardware verification badge increase or decrease trust?**
3. **Do users perceive CPO profitability disclosure as honest or alarming?**
4. **Would users return to the app regularly to check data?**

---

## 6. Appendix: Removed Data (Noise)

The following data points were collected during research but excluded from persona decisions due to insufficient reliability.

| Data Point | Original Source | Removal Reason |
|:--|:--|:--|
| "62.9% invest ≤5M KRW" | Finetree100 blog | Unverifiable: no methodology, sample size, or primary source |
| "Car price = 50% of salary" income estimation | Finance blogs (Getcha, GQ Korea) | Folk wisdom, no academic basis; lease/loan/subsidy distortions |
| "94% distrust blockchain" | Consensys/YouGov 2023 | 3 years old; Korean sample size undisclosed; contradicted by 16.29M crypto investors |
| STO market = KRW 367T by 2030 | PwC/BCG | Methodology undisclosed; consulting report optimism bias |
| "Chargein is a direct competitor" | eDaily single article | Insufficient for competitive analysis; product/traction unknown |
| Monthly dividend ETF → STO demand | Logical inference | Category error: ETF (liquid, regulated, simple) vs STO (illiquid, new, complex) |

---

## 7. Source Registry

All sources used in this document, organized by tier.

### T1: Government Census/Registry (Full Population)
- 국토교통부 자동차등록현황 (2024.12) — [stat.molit.go.kr](https://stat.molit.go.kr/portal/cate/statMetaView.do?hRsId=58)
- 2024 인구주택총조사 — [korea.kr](https://www.korea.kr/news/policyNewsView.do?newsId=156721680)
- 한국예탁결제원 KSD 배당 통계 (2024) — [ebn.co.kr](https://www.ebn.co.kr/news/articleView.html?idxno=1665292)
- 금융정보분석원 FIU 암호화폐 투자자 수 — [koreaherald.com](https://www.koreaherald.com/article/10453451)
- 전자증권법 국회 통과 — [venturesquare.net](https://www.venturesquare.net/1033323)

### T2: Research Institute (Large Sample)
- 가계금융복지조사 2025 (통계청+한국은행+금감원, n=20,000) — [bok.or.kr](https://www.bok.or.kr/portal/bbs/B0000501/view.do?menuNo=201264&nttId=10094917)
- KDI "친환경차 보급정책 연구" (250개 시군구 패널) — [kdi.re.kr](https://www.kdi.re.kr/research/reportView?pub_no=18394)
- AURI Brief 289 (건축공간연구원, 2024.12) — [auri.re.kr](https://www.auri.re.kr/publication/view.es?mid=a10313000000&publication_type=brief&publication_id=2116)
- KIRI 보험연구원 "월배당 ETF 성장" (2025) — [kiri.or.kr](http://www.kiri.or.kr/report/downloadFile.do?docId=777139)
- 한국리츠협회 통계 — [kareit.or.kr](https://www.kareit.or.kr/reference/page1.php)
- 주거실태조사 2024 (국토연구원, n=61,000) — [krihs.re.kr](https://www.krihs.re.kr)

### T3: Peer-Reviewed Academic
- Kim 2024, "전기자동차 충전시설 이용현황 분석", KCI — [kci.go.kr](https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART003132252)
- MDPI Sustainability 2023, "Households' WTP for V2G Charging Stations in South Korea" — [mdpi.com](https://www.mdpi.com/2071-1050/15/15/11563)
- MDPI Sustainability 2019, "Key Drivers of EV Adoption in Korea" — [mdpi.com](https://www.mdpi.com/2071-1050/11/23/6854)
- Energy Policy 2022, "Economics of charging infrastructure for EVs in Korea" — [sciencedirect.com](https://www.sciencedirect.com/science/article/abs/pii/S0301421522001008)
- ResearchGate 2024, "Data-driven Insights into SK National EV Charging Utilization" — [researchgate.net](https://www.researchgate.net/publication/386586920)

### T4: Industry Survey / Institutional Report
- Chabot Mobility "2026 EV/FSD 소비자 인식 조사" (n=450) — [etoday.co.kr](https://www.etoday.co.kr/news/view/2555271)
- Deloitte "2026 Global Automotive Consumer Study" (28,000+, 27 countries) — [deloitte.com](https://www.deloitte.com/us/en/insights/industry/retail-distribution/global-automotive-consumer-study.html)
- Roland Berger "EV Charging Index South Korea 2024" — [rolandberger.com](https://www.rolandberger.com/en/Insights/Publications/EV-Charging-Index-Expert-insight-from-South-Korea-2024.html)
- CPO financials (corporate disclosures via Electimes) — [electimes.com](https://www.electimes.com/news/articleView.html?idxno=354538)

---

*End of Document*
