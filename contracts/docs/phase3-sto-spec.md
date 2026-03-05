# Phase 3: STO 스마트 컨트랙트 스펙

## EnergyFi — RegionSTO 발행 구조 + Revenue Attestation 인프라

2026.03.03 | Ver 3.0

---

> ⚠️ **구현 보류 (Implementation Hold)**
>
> RegionSTO 토큰의 **구체적인 Solidity 구현**은 현재 보류 상태입니다.
>
> **보류 사유**: 발행 경로가 아직 결정되지 않았습니다. 세 가지 경로가 모두 법적으로 가능하며, 대통령령 세부 요건 확정 및 KSD 체인 기술 확정 후 선택합니다.
>
> **아발란체 L1 선택은 유효합니다.** KSD는 단일 블록체인을 운영하지 않습니다. 발행인/증권사가 자체 분산원장을 운영하면 KSD가 노드로 참여하여 총량을 관리하는 구조입니다. CCIP Path에서는 EnergyFi L1의 Revenue Attestation 데이터를 KSD 지원 체인으로 크로스체인 전달합니다.

---

## 배경: KSD 토큰증권 인프라 구조

### KSD는 단일 체인을 운영하지 않는다

한국 토큰증권(STO) 제도에서 KSD(한국예탁결제원)의 역할은 **단일 블록체인 운영자**가 아니라 **노드 참여를 통한 총량관리자**다.

```
[각 발행인/증권사의 분산원장] ← KSD가 노드로 참여하여 총량 관리
```

실제 사례:
- **신한투자증권 PULSE**: 신한·SK증권·LS증권이 노드로 참여 → KSD도 노드로 참여
- **미래에셋 NFI 메인넷**: 별도 체인 운영 → KSD가 노드로 참여

→ **결론**: CCIP Path에서는 EnergyFi L1 Revenue Attestation을 KSD 지원 체인으로 전달. Path A에서는 EnergyFi L1에 KSD를 밸리데이터/옵저버 노드로 추가. 모두 법적·기술적으로 가능한 구조다.

### 법이 허용하는 구조

전자증권법 개정안에서 "일정한 요건을 갖춘 발행인은 발행인계좌관리기관이 되어 직접 토큰증권을 분산원장에 기재·관리할 수 있다"고 명시. 자기자본, 인적·물적 설비, 이해상충 방지체계 등의 요건을 충족하면 EnergyFi가 자체 L1에서 직접 토큰증권을 발행 가능.

---

## 세 가지 발행 경로 (CCIP Path / Path A / Path B)

Phase 3 토큰 설계는 아래 세 경로 중 하나로 결정된다.

| 구분 | **CCIP Path (권장)** | Path A: 직접 발행 | Path B: 위탁 발행 |
|:---|:---|:---|:---|
| **구조** | EnergyFi L1 → CCIP → KSD 지원 체인 | EnergyFi L1에 직접 발행 | 오프체인 데이터만 제공 |
| **RegionSTO 위치** | KSD 지원 체인 | EnergyFi L1 | 증권사 분산원장 |
| **발행인계좌관리기관 자격** | ❌ 불필요 | ✅ 필요 | ❌ 불필요 |
| **KSD 참여 방식** | KSD 지원 체인 내 노드 | EnergyFi L1 노드 | 기존 방식 |
| **DTCC 실증 여부** | ✅ (Avalanche + Besu + CCIP, 2025) | — | — |
| **EnergyFi 제공** | Revenue Attestation (CCIP 크로스체인) | 충전 데이터 + 수익 데이터 + 토큰 발행 | 충전 데이터 + 수익 데이터만 |
| **결정 트리거** | KSD 지원 체인 확정 + CCIP 연동 합의 | 대통령령 + 자격 확인 | 증권사 파트너십 |
| **Phase 1-2 필요성** | 필수 | 필수 | 필수 |

**CCIP Path가 권장되는 이유:**
- 발행인계좌관리기관 자격 요건 충족 불필요 (진입 장벽 최소화)
- DTCC 수준에서 이미 검증된 인프라 (신뢰도 확보)
- 체인 이전 불필요, Phase 1-2 변경 없음
- 민감한 수익 데이터를 암호화 상태로 전달 가능 (Blockchain Privacy Manager)

**어느 경로든 Phase 1-2 충전 데이터 + 수익 집계가 핵심이다.**

---

## CCIP 기반 Revenue Attestation 아키텍처

### 아키텍처 개요

```
[EnergyFi L1 (Avalanche)]          [CCIP]               [KSD 지원 체인 (Besu 등)]
─────────────────────────   ─────────────────────   ──────────────────────────────────
ChargeTransaction.mint()            Revenue                RegionSTO.issueNewTranche()
RevenueTracker.record()    →─  Attestation 메시지  ─→    KSD 노드 (총량 확인)
CCIPRevenueSender.send()           (Merkle root)           증권사 (KYC/AML, 배당 계산)
```

### CCIP 적용 근거

| 근거 | 내용 |
|:---|:---|
| **공식 체인 지원** | Chainlink CCIP는 Avalanche L1 + Hyperledger Besu 양쪽을 공식 지원 |
| **DTCC 실증** | DTCC(미국 KSD)가 Avalanche + Hyperledger Besu + CCIP 구조로 실증 완료 (2025) |
| **보안 인증** | ISO 27001 + SOC 2 인증 획득 |
| **독립 검증 레이어** | Risk Management Network: 크로스체인 메시지 독립 검증 |
| **데이터 프라이버시** | Blockchain Privacy Manager: 수익 금액 등 민감 데이터 암호화 상태로 전달 가능 |

### Revenue Attestation 메시지 구조

```solidity
// CCIP 메시지에 실릴 Revenue Attestation 데이터 구조
// (인터페이스 정의 가능. KSD 체인 측 요건 확정 후 구체화)
struct RevenueAttestation {
    bytes4   regionId;           // ISO 3166-2:KR (예: KR-11 서울)
    uint256  periodStart;        // 정산 기간 시작 (Unix timestamp)
    uint256  periodEnd;          // 정산 기간 종료 (Unix timestamp)
    uint256  distributableKrw;   // 해당 기간 지역 총 분배 가능 수익 (원)
    bytes32  merkleRoot;         // 포함된 ChargeTransaction ID의 Merkle root
    uint256  stationCount;       // 기여한 EnergyFi 소유 충전소 수
}
// KSD 체인 측: merkleRoot를 통해 EnergyFi L1 ChargeTransaction 레코드와 교차검증 가능
```

### CCIPRevenueSender — Phase 3 EnergyFi L1 신규 컨트랙트

| 역할 | 내용 |
|:---|:---|
| **데이터 소스** | RevenueTracker에서 지역별 수익 데이터 읽기 |
| **메시지 포맷** | RevenueAttestation 구조체로 포맷팅 |
| **전송** | CCIP Router를 통해 KSD 지원 체인으로 전송 |
| **호출 방식** | 차수 발행 주기에 맞춰 Bridge가 호출 (`onlyBridge` 패턴 유지) |
| **구현 시점** | KSD 지원 체인 확정 후 착수 (현재 보류) |

---

## 아발란체 L1이 적합한 이유 (Path A 기준)

| 조건 | EnergyFi L1 충족 여부 |
|:---|:---|
| KSD가 노드로 참여 가능한가 | ✅ 자체 밸리데이터 셋 구성 가능. KSD를 밸리데이터/옵저버로 추가 가능 |
| 스마트 컨트랙트 감사 도구 | ✅ EVM 호환. OpenZeppelin 등 감사 인프라 풍부 |
| 자체 밸리데이터 셋 | ✅ Avalanche L1의 핵심 특성 |
| 자체 가스 토큰·블록 파라미터 | ✅ EFI 토큰, 제로 가스 설정 |
| 컴플라이언스 모듈 격리 | ✅ 프라이빗 체인으로 외부 유입 차단 가능 |

---

## 비즈니스 제약 (경로 공통)

1. **온체인에 등록된 모든 충전소가 STO 참여 대상** (모두 EnergyFi 소유). 제3자 CPO는 STRIKON 오프체인에서만 관리되며 온체인에 없음.
2. **발행 단위**: 지역 (17개 광역자치단체, ISO 3166-2:KR).
3. **발행 방식**: 차수(Tranche) — 일정 충전소 추가 시 묶어서 일괄 발행. 실시간 mint 아님.
4. **발행인-증권사 역할 분리**: EnergyFi는 충전 데이터·수익 데이터 제공. KYC/AML·배당 계산·집행은 증권사 영역.
5. **ERC-2222(배당), ERC-1643(문서 관리) 구현 제외** — 증권사 영역.

---

## 현재 확정된 비즈니스 로직

아래는 모든 경로에서 유효한 확정 사항이다. Phase 1-2에서 이미 구현됨.

### 수익 귀속 원칙

| 충전소 | 수익 귀속 | STO 관련성 |
|:---|:---|:---|
| 온체인 충전소 (모두 EnergyFi 소유) | 해당 지역 STO 투자자 풀 100% | Phase 3 대상 |

> 제3자 CPO 소유 충전소는 온체인에 등록되지 않으며 STRIKON 오프체인에서 별도 정산.

### 지역(Region) 체계

지역은 한국 17개 광역자치단체 (ISO 3166-2:KR). STO의 투자 단위.

| 지역 | ISO 코드 | regionId (bytes4) | 예상 토큰 심볼 |
|:--|:--|:--|:--|
| 서울특별시 | KR-11 | `0x4B523131` | `ELEC-SEOUL` (미확정) |
| 부산광역시 | KR-26 | `0x4B523236` | `ELEC-BUSAN` (미확정) |
| 대구광역시 | KR-27 | `0x4B523237` | `ELEC-DAEGU` (미확정) |
| 인천광역시 | KR-28 | `0x4B523238` | `ELEC-INCHEON` (미확정) |
| 광주광역시 | KR-29 | `0x4B523239` | `ELEC-GWANGJU` (미확정) |
| 대전광역시 | KR-30 | `0x4B523330` | `ELEC-DAEJEON` (미확정) |
| 울산광역시 | KR-31 | `0x4B523331` | `ELEC-ULSAN` (미확정) |
| 세종특별자치시 | KR-50 | `0x4B523530` | `ELEC-SEJONG` (미확정) |
| 경기도 | KR-41 | `0x4B523431` | `ELEC-GYEONGGI` (미확정) |
| 강원특별자치도 | KR-42 | `0x4B523432` | `ELEC-GANGWON` (미확정) |
| 충청북도 | KR-43 | `0x4B523433` | `ELEC-CHUNGBUK` (미확정) |
| 충청남도 | KR-44 | `0x4B523434` | `ELEC-CHUNGNAM` (미확정) |
| 전북특별자치도 | KR-45 | `0x4B523435` | `ELEC-JEONBUK` (미확정) |
| 전라남도 | KR-46 | `0x4B523436` | `ELEC-JEONNAM` (미확정) |
| 경상북도 | KR-47 | `0x4B523437` | `ELEC-GYEONGBUK` (미확정) |
| 경상남도 | KR-48 | `0x4B523438` | `ELEC-GYEONGNAM` (미확정) |
| 제주특별자치도 | KR-49 | `0x4B523439` | `ELEC-JEJU` (미확정) |

> 토큰 심볼은 예시. 실제 심볼은 대통령령 + 증권사 협의 후 결정.

### 차수(Tranche) 발행 원칙

모든 경로에서 유효:
- 일정 충전소가 추가될 때마다 묶어서 일괄 발행
- 실시간 mint가 아닌 주기적 배치 발행
- 각 차수는 발행일, 토큰 수량, 포함된 충전소 목록을 기록

---

## 지금 정의 가능한 것 vs 보류

| 항목 | 상태 | 적용 경로 |
|:---|:---|:---|
| EnergyFi 소유 충전소 지역별 수익 집계 | ✅ 확정 (Phase 2 구현) | 전체 |
| regionId 체계 (ISO 3166-2:KR) | ✅ 확정 (Phase 1-2 사용 중) | 전체 |
| RevenueTracker view 함수 인터페이스 | ✅ 확정 (Phase 2 구현) | 전체 |
| 모든 온체인 충전소 EnergyFi 소유 (CPO 온체인 제거) | ✅ 확정 | 전체 |
| 차수(Tranche) 발행 원칙 | ✅ 확정 (비즈니스 결정) | 전체 |
| KSD를 EnergyFi L1 노드로 추가 (기술 가능성) | ✅ 확정 (Avalanche L1 구조) | Path A |
| **CCIP Revenue Attestation 메시지 구조 초안** | ⚠️ 초안 가능 | CCIP Path |
| **CCIPRevenueSender 컨트랙트 인터페이스** | ⚠️ 초안 가능 | CCIP Path |
| **RegionSTO 토큰 Solidity 구현** | 🚫 보류 | Path A 확정 후 |
| **ERC-3643 vs 단순 ERC-20 선택** | 🚫 보류 | KSD 기술 요건 확인 후 |
| **KSD 노드 참여 실제 협의** | 🚫 보류 | 발행인계좌관리기관 자격 확인 후 |
| **컴플라이언스 모듈 설계** | 🚫 보류 | 대통령령 + 증권사 영역 |
| **RegionSTOFactory 구현** | 🚫 보류 | 경로 확정 후 |
| **STOPortfolio 구현** | 🚫 보류 | 경로 확정 후 |
| **KSD 지원 체인 기술 스택 확정** | 🚫 보류 | KSD 협의 후 |
| **CCIP 연동 실제 구현** | 🚫 보류 | KSD 체인 확정 후 |

---

## Phase 3 재개 트리거 조건

| # | 트리거 | 현재 상태 |
|:---|:---|:---|
| 1 | **대통령령 확정** — 발행인계좌관리기관 자기자본·설비 요건 세부 확정 (Path A용) | 🔴 미확정 |
| 2 | **발행 경로 결정** — CCIP Path / Path A / Path B 중 내부 결정 | 🔴 미결정 |
| 3 | **KSD 지원 체인 확정** — CCIP Receiver를 배포할 체인 기술 확정 (CCIP Path) | 🔴 미확정 |
| 4 | **유통 시장 파트너** — KDX / NXT 컨소시엄 / 루센트블록 중 선택 | 🔴 미결정 |
| 5 | **증권사 파트너십** — KYC/AML, 배당 집행 담당 증권사 | 🔴 미수립 |

---

## 유통 시장 연동 — 장외거래소 파트너 결정 사항

RegionSTO 토큰이 유통될 장외거래소. 현재 한국에서 인가를 두고 3파전 진행 중.

| 거래소 | 주도 | 특징 |
|:---|:---|:---|
| **KDX** | 키움·교보·카카오페이증권 | 리테일 접근성 |
| **NXT 컨소시엄** | 신한·넥스트레이드 | 기관·대형 증권사 연합 |
| **루센트블록** | 스타트업 주도 | 독립 플랫폼 |

**설계 영향**: 선택된 거래소의 KSD 체인 기술 스택이 CCIP Receiver 체인 선택에 영향. 현재 상태: 🔴 미결정.

---

## STO 차수 발행 흐름 (CCIP Path 기준 — 구현 확정 후)

```
1. EnergyFi 신규 충전소 n개 설치 완료 (StationRegistry에 등록됨)

2. 정산 기간 종료 → Bridge가 CCIPRevenueSender.sendAttestation() 호출
   → RevenueTracker에서 지역별 distributableKrw 집계
   → RevenueAttestation 메시지 생성 (Merkle root 포함)

3. CCIP Router → Risk Management Network 독립 검증 → KSD 지원 체인 전달

4. KSD 체인 CCIP Receiver → 증권사가 배당 계산
   → KSD 노드가 총량 확인
   → 투자자 KYC/AML 확인 (증권사 영역)

5. RegionSTO.issueNewTranche() 호출 (KSD 체인 위, 증권사 실행)
   tranche = { periodStart, periodEnd, distributableKrw, merkleRoot, stationCount, ... }

6. 차수 발행 기록 → EnergyFi 대시보드에서 CCIP 전송 이력 확인
```

---

## Phase 2와의 관계

**RevenueTracker가 Phase 3의 실질적 기반이다.** 어느 경로든 동일하게 적용된다.

### Phase 2 view 함수 — KSD/증권사 데이터 소스 (예정)

```solidity
// 지역별 충전소 수익 집계
// → CCIP Path: CCIPRevenueSender가 읽어 RevenueAttestation.distributableKrw 소스
// → Path A: RegionSTO 차수 발행 근거 데이터
// → Path B: 증권사가 배당 계산 시 조회
function getRegionRevenue(bytes4 regionId)
    external view returns (uint256 distributableKrw);

// 충전소별 수익 조회
// → 차수에 포함된 충전소 수익 증명
// → CCIPRevenueSender의 stationCount 필드 소스
function getStationRevenue(bytes32 stationId)
    external view returns (uint256 distributableKrw, uint256 lastUpdated);

// Merkle root 구성용: 기간 내 포함된 ChargeTransaction ID 조회
// → CCIPRevenueSender의 merkleRoot 계산에 사용 (Phase 2에서 추가 필요)
function getChargeTransactionsByPeriod(bytes4 regionId, uint256 from, uint256 to)
    external view returns (bytes32[] memory sessionIds);
```

### Phase 3 준비 체크리스트

Phase 2 완료 후 Phase 3 착수 전까지 확인할 사항:

- [ ] RevenueTracker.getRegionRevenue() 정확성 검증 (6개월 이상 데이터)
- [ ] 대통령령 세부 요건 발표 → 발행인계좌관리기관 자격 충족 여부 법률 자문
- [ ] 발행 경로 내부 결정 (CCIP Path / Path A / Path B)
- [ ] CCIP Path 선택 시: KSD 지원 체인 기술 확정 + CCIP Receiver 체인 협의
- [ ] Path A 선택 시: KSD 기술팀 협의 착수 (EnergyFi L1 노드 참여)
- [ ] 유통 시장 파트너 결정 (KDX / NXT / 루센트블록)
- [ ] 증권사 파트너십 착수

---

## 대시보드 화면 (개념적 수준 — 구현 방향 미확정)

> 아래 화면은 개념적 목업이다. 실제 구현은 경로 선택 + KSD 요건에 따라 달라진다.

### 화면 1: 지역별 수익 현황 (Revenue Attestation)

```
┌─────────────────────────────────────────────────────────────────┐
│  지역: [서울 ▼]                                                 │
│                                                                 │
│  EnergyFi 소유 충전소: 5개                                      │
│  누적 수익 풀: 135,700,000원 (RevenueTracker 기준)              │
│  마지막 업데이트: 2027.01.15 14:32 KST                          │
│                                                                 │
│  [차수 발행 현황 및 토큰 정보 → 경로 확정 후 표시]               │
└─────────────────────────────────────────────────────────────────┘
```

### 화면 2: 차수 발행 이력 (CCIP Path 기준)

```
┌─────────────────────────────────────────────────────────────────┐
│  서울 STO CCIP 전송 이력                                         │
│                                                                 │
│  차수  전송일         distributableKrw   merkleRoot             │
│  1차   2027.01.15   135,700,000원       0x1a2b...              │
│  2차   2027.04.01   98,500,000원        0x3c4d...              │
│                                                                 │
│  [KSD 체인 발행 결과 → CCIP 수신 확인 후 표시]                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 참조 문서

| 문서 | 경로 | 비고 |
|:--|:--|:--|
| Implementation Roadmap | [implementation-roadmap.md](implementation-roadmap.md) | Phase별 의존성, 리스크 레지스트리 |
| Phase 2 스펙 | [phase2-transaction-spec.md](phase2-transaction-spec.md) | RevenueTracker view 함수 상세 |
| Phase 4 스펙 | [phase4-carbon-spec.md](phase4-carbon-spec.md) | 탄소배출권 파이프라인 |
| Chainlink CCIP | https://docs.chain.link/ccip | CCIP 연동 구현 시 참조 |

---

*End of Document*
