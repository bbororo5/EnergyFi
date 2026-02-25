# Avalanche Build Games — Q&A Draft (v3)

> 아래 7개 답변은 해커톤 플랫폼에 플레인 텍스트로 붙여넣기 가능한 형태입니다.
> 마크다운 서식 없이, 문단 구분만으로 구조화되어 있습니다.
> 각 답변의 `---` 아래가 실제 붙여넣기용 텍스트입니다.
>
> ### v2 → v3 주요 변경
> - Bookend Signature를 Q1 첫 문단으로 이동 + "5 contracts deployed" 두 번째 문장
> - 전문용어 최소화: UUPS/BridgeGuarded/RIP-7212 등 용어를 평이한 설명으로 대체
> - 비즈니스 모델 명시: EnergyFi 직접 소유(STO) + CPO 판매(B2B) 이중 모델
> - 투자자 UX 언급: Flutter 모바일 앱, 지역별 포트폴리오 뷰
> - 3주 결과물 구체화: 라이브 데모 시나리오 명시
> - CCIP → Path A(Avalanche L1 = 발행 체인)를 기본값으로, CCIP는 플랜 B
> - 탄소크레딧 선형 논리 통합: 문제(Q3) → 검증 불가(Q5) → 해결(Q6)
> - "왜 한국, 왜 지금, 왜 Avalanche" 교차점 한 곳에 집중 (Q6)

---

## Q1: What do you plan to work on during this program?

---

EnergyFi tokenizes EV charging infrastructure revenue as a real-world asset on a dedicated Avalanche L1. What makes us different from every other RWA project is where trust begins: not with an oracle or a data feed, but with a cryptographic chip physically embedded inside each charger. This chip signs raw energy data at the moment of measurement, and our blockchain bridge signs the transaction at the moment of on-chain recording. When both signatures match, the entire data path is proven intact without trusting any intermediary. Five smart contracts implementing this pipeline are already deployed and running on our Avalanche L1 testnet.

During Build Games, we will complete the live demonstration of this trust pipeline. Our concrete deliverable is a working end-to-end demo: a charging session produces hardware-signed energy data, the settlement system triggers an on-chain transaction, and a monitoring dashboard displays the verified record alongside real-time revenue accumulation — per station and per region. Judges will be able to trace a single charging event from its hardware signature all the way to the regional revenue pool that backs a security token.

We will also begin implementing the carbon reduction pipeline, applying the internationally recognized Verra VCS methodology directly to on-chain charging data to create an auditable basis for carbon credit issuance. The calculation contract is deployed without upgrade capability so that independent auditors can verify the code matches the expected formula.

Three characteristics define EnergyFi. Hardware-level data integrity eliminates the oracle trust problem at its root. Per-region tokenization maps South Korea's 17 provinces into individually investable charging infrastructure portfolios. And our Avalanche L1 is designed as the securities issuance chain itself — not merely a deployment target, but the infrastructure where Korea's securities depository can participate as a validator node.

---

## Q2: What are your achievements so far?

---

Five smart contracts are deployed and operational on our dedicated Avalanche L1 testnet. DeviceRegistry stores the public keys of hardware security chips, enabling on-chain verification of every charging session's origin. StationRegistry maps the full infrastructure hierarchy — regions, operators, stations, chargers — with ownership classification that determines how revenue flows. ChargeTransaction creates a non-transferable token for each settled session after verifying the hardware signature. RevenueTracker accumulates revenue per station, automatically distinguishing operator-owned from EnergyFi-owned income. ChargeRouter guarantees that session recording and revenue tracking always execute together as a single atomic operation, making partial or inconsistent records impossible.

All contracts use upgradeable proxy architecture, role-based access control, emergency pause capability, and a dedicated bridge access layer — enterprise-grade infrastructure uncommon at the hackathon stage. A test suite of 47 passing tests covers signature verification, access control, ownership logic, and regional queries. The full architecture of 12 contracts plus a factory is specified across 4 phases with complete interface definitions and dependency graphs.

On the business side, our proprietary EV charger with embedded system is over 80 percent complete, targeting a June 2026 production launch. The hardware security chip has been selected and specified for manufacturers, enabling cryptographically signed data from day one. Our platform software for charging operators handles data aggregation and payment settlement.

Partnership milestones include an advanced Qt Korea license agreement, a Letter of Intent with TTA (Korea's national ICT testing authority) to co-develop RWA security standards, and a confirmed March 2026 MOU meeting with Shinhan Bank regarding the securities tokenization partnership with their affiliated securities firm.

---

## Q3: What problem are you addressing?

---

South Korea is one of the world's fastest-growing EV markets, and apartment complexes are the primary location for residential charging infrastructure. These chargers generate steady, recurring revenue from energy delivery, but the millions of apartment residents who live alongside this infrastructure have no way to invest in or benefit from it. All revenue flows to the operator, and the physical asset — despite producing measurable income — remains invisible to capital markets.

The barrier is data trust. Charging sessions, energy throughput, revenue figures, and equipment condition are all locked inside centralized systems that cannot be independently verified. Without trustworthy data, no investor can make an informed decision about an asset whose performance is self-reported and unauditable. As long as physical energy measurement cannot be cryptographically proven, tokenization of this asset class is impossible.

This same verification gap blocks operators from accessing carbon credit markets. International carbon standards require independently verifiable energy data, but operators have no mechanism to prove their measurements to a third-party auditor. The data trust problem does not just prevent investment — it prevents environmental revenue as well.

---

## Q4: Who experiences this problem?

---

The most directly affected group is apartment residents across South Korea. With over 11 million apartment units and rapidly expanding EV adoption, millions of people see charging stations operating in their buildings daily. These stations generate consistent revenue, yet residents have no investment vehicle to participate in it. EnergyFi's per-region security tokens are designed for this demographic, enabling fractional ownership of local charging infrastructure revenue through a mobile application.

Charging station operators face a parallel problem. They own and maintain physical assets but are limited to per-kWh fees as their sole revenue source. Without verified performance data, they cannot attract outside investment or qualify for carbon credit programs. The result is asset-rich operators who remain cash-constrained, unable to unlock the full value of the infrastructure they operate.

EV drivers feel the downstream effects. When operators cannot sustain their business, charger maintenance deteriorates, uptime drops, and the public charging network that millions of drivers depend on becomes unreliable. The economic failure of the charging business model directly undermines the physical infrastructure that a growing EV population relies on.

---

## Q5: How is the problem currently solved (if at all)?

---

Two approaches currently attempt to address the economics of EV charging, and neither creates new revenue from existing assets.

Government subsidies directly support operator costs through financial aid. This keeps some operators solvent in the short term but cannot scale with the pace of infrastructure expansion. Subsidies treat the cash flow symptom without changing the underlying revenue model.

Charging management software based on the OCPP protocol helps operators reduce costs through better monitoring and efficiency. However, these tools optimize existing operations — they do not make the physical asset investable or open new income streams from the data these chargers already produce.

Both approaches ignore the core obstacle: the data itself is not trustworthy enough to support financial products. Most blockchain projects that tokenize real-world assets rely on software-based data feeds to bring information on-chain. These feeds require trusting the entity that reports the data. For physical energy measurement, this is fundamentally insufficient. The integrity of the data must be established at the physical measurement point, not at the reporting point. Without hardware-level cryptographic attestation, any tokenization of charging infrastructure is built on unverifiable claims.

---

## Q6: What is your proposed solution?

---

EnergyFi is built as a three-layer system. At the hardware layer, a security chip inside each charger signs raw energy data using cryptographic keys that cannot be extracted from the chip. At the platform layer, middleware aggregates charging data and handles payment settlement. At the blockchain layer, a dedicated Avalanche L1 records verified sessions and accumulates revenue, forming the foundation for securities tokenization. Five of the twelve planned smart contracts are already deployed and operational on testnet.

The core innovation is what we call the dual-signature trust model. The hardware chip signs data at the point of physical measurement. The blockchain bridge signs the transaction at the point of on-chain recording. When both signatures are verified and the underlying data matches, the entire path from charger to chain is proven intact without trusting any single intermediary. This is not a future feature — it is active from day one. Our charger hardware and platform launch simultaneously, so every charging session carries a real hardware signature from the first transaction. Most RWA projects rely on oracle feeds or manual attestations to bring real-world data on-chain. EnergyFi eliminates this trust gap at the hardware level.

EnergyFi operates a dual business model. We install and own EV chargers in apartment complexes, and the revenue from these stations flows into a regional investment pool that will be tokenized as security tokens. We also sell our charger hardware and platform software to third-party operators, who benefit from verified on-chain data for attracting investment and qualifying for carbon credits. Both business lines run on the same on-chain data pipeline, and each station's ownership type determines how its revenue is routed.

When a charging payment is settled, a single smart contract call atomically records the session and updates the revenue ledger. If either operation fails, nothing is recorded — there is no possibility of inconsistent data. Revenue from EnergyFi-owned stations accumulates into pools organized by South Korea's 17 provinces. Each province becomes a separately investable unit, backed by transparent on-chain data: sessions completed, energy delivered, and revenue earned.

Our Avalanche L1 is designed as the securities issuance chain. Korea's securities depository, KSD, does not operate a single blockchain — instead, it participates as a node on each issuer's distributed ledger. This means our L1 can host the security tokens directly, with KSD joining as a validator node, following the same model already used by Shinhan Securities and Mirae Asset in production. If future regulation requires issuance on a different network, we have a cross-chain contingency using Chainlink CCIP that can transmit cryptographic revenue proofs to alternative chains — a pattern validated by DTCC with Avalanche and Hyperledger Besu in 2025. The token standard will be determined after Korea's Electronic Securities Act Presidential Decree finalizes requirements in January 2027. We view this regulatory patience as a strength: designing around unfinalized rules would create unnecessary technical debt.

The same verified charging data opens a second revenue stream through carbon credits. Operators today cannot access carbon markets because they lack independently verifiable energy data. Our contracts apply the internationally recognized Verra VCS VM0038 methodology directly to on-chain session records, calculating net carbon reduction per charging event. The calculation contract is deployed without upgrade capability so that independent auditors can verify the deployed code matches the expected formula — creating a fully auditable pathway from physical measurement to verified carbon credits.

Investors will access their regional portfolios through a mobile application where they can view real-time revenue accumulation, charging activity in their region, and their token holdings. The interface reads directly from on-chain data, providing the same transparency to a retail investor that the underlying smart contracts provide to an auditor.

Why Korea, why now, why Avalanche — these three questions converge at this moment. Korea's Electronic Securities Act takes effect in January 2027, creating the legal framework for tokenized securities for the first time. The country's EV adoption is accelerating faster than charging infrastructure can keep up, creating urgent demand for new investment models. And Avalanche's L1 architecture is the only production-grade platform that offers dedicated chain sovereignty, custom validator sets for regulatory node participation, zero-gas configuration for IoT-scale data throughput, and native support for the cryptographic precompiles our hardware security chips require. EnergyFi is not a blockchain project that happens to involve EV charging — it is an EV charging infrastructure company that chose Avalanche because no other chain architecture fits the regulatory and technical requirements.

---

## Q7: What triggers an on-chain transaction in your project?

---

The primary trigger is a completed charging payment. When the platform settles a session and confirms payment, the blockchain bridge submits a single transaction to our Avalanche L1. This transaction atomically performs two operations: it records the charging session as a verified, non-transferable token after checking the hardware chip's cryptographic signature, and it updates the revenue ledger for that station. Only fully settled payments reach the chain, ensuring data purity for all downstream financial and environmental calculations.

Infrastructure registration events also create on-chain transactions. Before a charger can participate in the network, its hardware chip's public key must be enrolled in the on-chain device registry — a one-time operation that establishes the device's cryptographic identity for all future verification. Operator registration, station registration, and charger onboarding establish the infrastructure hierarchy and ownership classification that determines how revenue flows.

Future phases introduce additional triggers with clear timelines. After Korea's Electronic Securities Act takes effect in January 2027, periodic revenue attestation transactions will summarize regional earnings for security token distribution — either directly on our L1 or via cross-chain messaging to the designated issuance chain. When the carbon credit pipeline activates, calculation transactions will apply the Verra methodology to accumulated charging data, and verification batches will align with international audit cycles.

Administrative operations include contract upgrades restricted to administrator roles, emergency pause capability for incident response, and bridge address rotation for key management. In production, all administrative operations will require multi-signature approval.

---

*End of Document*
