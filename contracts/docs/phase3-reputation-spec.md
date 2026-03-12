# Phase 3: Reputation Snapshot Spec

## EnergyFi — Explore용 Region Reputation Interface

2026.03.09 | Ver 1.0

---

## 1. 목적

이번 스펙의 목적은 `Explore` 탭 재설계를 위한 `ReputationRegistry`의 **인터페이스와 핵심 동작 규격**을 고정하는 것이다.

핵심 원칙:
- `Home`은 상태 파악 데스크다.
- `Analytics`는 증거와 해석 탭이다.
- `Explore`는 지역별 매력을 읽는 `story browser`다.

따라서 `Explore`는 랭킹/점수 탭이 아니며, 온체인에는 사용자-facing 스토리 문장을 저장하지 않는다.  
온체인에는 스토리를 만들 수 있는 `region-level derived metrics` 만 저장한다.

---

## 2. v1 범위

### 포함

- 지역 단위 (`bytes4 regionId`) reputation snapshot
- 주간/월간 cadence를 모두 수용하는 period 모델
- `운영 신뢰도 + 수익 리듬 + 입지 성격` 3축 파생 지표
- STRIKON bridge/oracle이 업서트하는 publish 구조

### 제외

- station-level reputation snapshot
- 점수/등급/랭킹 산출 결과 저장
- 사용자-facing narrative 저장
- 정책 지원금/행정 드라이브 데이터
- 프론트 구현 및 Story chip 렌더링

---

## 3. 정보 구조와 탭 역할

| 탭 | 역할 | 질문 |
|:---|:---|:---|
| `Home` | 상태 파악 | 지금 무슨 일이 벌어지고 있나 |
| `Explore` | 지역 매력 탐색 | 각 지역은 어떤 성격과 매력을 가지는가 |
| `Analytics` | 근거 해석 | 이 상태를 왜 이렇게 읽어야 하나 |

`Explore`는 비교를 위한 위계 설정이 아니라, 각 지역의 다양한 성격을 공정하게 드러내는 화면이다.

---

## 4. 온체인 Snapshot 모델

인터페이스 파일: [`contracts/contracts/interfaces/ops/IReputationRegistry.sol`](../contracts/interfaces/ops/IReputationRegistry.sol)  
구현 파일: [`contracts/contracts/ops/ReputationRegistry.sol`](../contracts/ops/ReputationRegistry.sol)

### 4.1 단위

- v1은 `region-only snapshot`
- region key는 기존과 동일하게 `bytes4 regionId`

### 4.2 기간 모델

```solidity
enum PeriodGranularity { UNKNOWN, WEEKLY, MONTHLY }
```

`periodId` 규칙:
- `WEEKLY`  -> `YYYYWW` (ISO-8601 week number, `Asia/Seoul` 기준)
- `MONTHLY` -> `YYYYMM` (`Asia/Seoul` 기준)

예시:
- `202610` = 2026년 10주차
- `202603` = 2026년 3월

`UNKNOWN` 은 sentinel 값이며 publish 대상 snapshot에는 사용할 수 없다.

### 4.3 기록 방식

- 같은 `(regionId, granularity, periodId)` key는 `upsert` 가능
- 재계산이나 주기 변경에 대비해 overwrite semantics 허용
- 최신 publish 시각은 `updatedAt` 으로 기록
- `getLatestRegionSnapshot()` 의 latest 기준은 `updatedAt` 이 아니라 `가장 큰 periodId`
- `getRegionSnapshotPeriods()` 는 중복 없이 `오름차순(과거 → 최신)` 으로 정렬된 period 목록을 반환해야 한다

### 4.4 Snapshot Invariants

- `granularity != UNKNOWN`
- `WEEKLY` 는 `YYYYWW` 형식이며 week는 ISO week 범위를 따라야 한다
- `MONTHLY` 는 `YYYYMM` 형식이며 month는 `01..12`
- 모든 `bps` 필드는 `0..10_000`
- `SiteMetrics`
  - 네 개 ratio가 모두 `0` 이면 `primaryType = UNKNOWN`
  - 하나라도 0이 아니면 네 개 ratio 합은 정확히 `10_000`
  - 대표 버킷이 하나면 `primaryType` 은 그 버킷이어야 함
  - 최댓값 tie면 `primaryType = MIXED`
- `RhythmMetrics`
  - `peakStartHour`, `peakEndHour` 는 `0..23`
  - 시간 구간은 `Asia/Seoul` 기준 반열린 구간 `[start, end)`
  - `start > end` 는 자정을 넘기는 overnight window 의미
  - publish된 snapshot에서 `start == end` 는 허용하지 않음

---

## 5. Metric 축 정의

### 5.1 운영 신뢰도 (`TrustMetrics`)

Explore에서 “이 지역은 운영이 안정적인가”를 읽기 위한 축.

| 필드 | 의미 | 단위 |
|:---|:---|:---|
| `activeChargerRatioBps` | 활성 충전기 비율 | bps |
| `maintenanceResolutionRateBps` | 유지보수 처리율 | bps |
| `settlementContinuityBps` | 최근 정산 연속성 | bps |

### 5.2 수익 리듬 (`RhythmMetrics`)

고수익 경쟁이 아니라 “이 지역은 어떤 리듬으로 움직이는가”를 읽기 위한 축.

| 필드 | 의미 | 단위 |
|:---|:---|:---|
| `sessionVolume` | 기간 내 세션 발생량 | count |
| `revenueStabilityBps` | 수익 안정성 | bps |
| `peakStartHour` | 주요 이용 시작 시간 | 0-23 |
| `peakEndHour` | 주요 이용 종료 시간 | 0-23 |

### 5.3 입지 성격 (`SiteMetrics`)

지역의 생활권/업무권/상업권 성격을 읽기 위한 축.

```solidity
enum SiteType { UNKNOWN, RESIDENTIAL, WORKPLACE, PUBLIC_COMMERCIAL, MIXED }
```

| 필드 | 의미 | 단위 |
|:---|:---|:---|
| `primaryType` | 대표 입지 유형 | enum |
| `residentialBps` | 주거 중심 비중 | bps |
| `workplaceBps` | 업무 중심 비중 | bps |
| `publicCommercialBps` | 공공/상업 중심 비중 | bps |
| `mixedBps` | 복합형 비중 | bps |

> v1 taxonomy는 `Residential / Workplace / Public-Commercial / Mixed` 로 고정한다.

### 5.4 Basis Points 규칙

비율 필드는 모두 `bps` 를 사용한다.

- `10_000 = 100%`
- `5_250 = 52.5%`

이 규칙은 `TrustMetrics`, `RhythmMetrics.revenueStabilityBps`, `SiteMetrics` 전체에 공통 적용한다.

### 5.5 Metric Version의 의미

`metricVersion` 은 정확한 산출 공식을 버전 관리하기 위한 필드다.

고정되는 것은 다음뿐이다.
- 필드명
- 의미 축
- 단위
- 값의 방향성

즉:
- `maintenanceResolutionRateBps` 는 높을수록 좋다
- `revenueStabilityBps` 는 높을수록 더 안정적이다
- exact formula 자체는 운영 현실에 따라 변경될 수 있으며, 변경 시 `metricVersion` 을 올린다

---

## 6. Canonical Source Hash

`sourceHash` 는 감사성과 provenance를 위한 표준 커밋 값이다.

STRIKON publisher는 아래 canonical bundle을 해시해야 한다.

```solidity
keccak256(
    abi.encode(
        regionId,
        granularity,
        periodId,
        metricVersion,
        chargeDataRoot,
        revenueDataRoot,
        stationDataRoot,
        opsDataRoot
    )
)
```

각 root의 의미:
- `chargeDataRoot`: 세션/시간대 집계 입력의 정규화 digest
- `revenueDataRoot`: 수익/정산 집계 입력의 정규화 digest
- `stationDataRoot`: station/charger inventory 입력의 정규화 digest
- `opsDataRoot`: 유지보수 및 site classification 입력의 정규화 digest

사용하지 않은 source domain은 `bytes32(0)` 을 사용한다.

---

## 7. Source Mapping

Reputation snapshot은 단일 계약에서 직접 추론되지 않는다.  
STRIKON bridge/oracle이 기존 온체인 데이터와 운영 데이터를 조합해 계산 후 게시한다.

| Source | 역할 | Reputation 연계 |
|:---|:---|:---|
| [`IChargeTransaction`](../contracts/interfaces/core/IChargeTransaction.sol) | 세션 수, 시작/종료 시각, charger/station/region context | `sessionVolume`, `peakStartHour`, `peakEndHour` 계산의 기본 재료 |
| [`IRevenueTracker`](../contracts/interfaces/finance/IRevenueTracker.sol) | 지역 수익, 월별 기록, 정산 확정 이력 | `revenueStabilityBps`, `settlementContinuityBps` 계산의 기본 재료 |
| [`IStationRegistry`](../contracts/interfaces/infra/IStationRegistry.sol) | 지역별 station/charger inventory, active 상태 | `activeChargerRatioBps`, region site composition 집계의 기본 재료 |
| [`IDeviceRegistry`](../contracts/interfaces/infra/IDeviceRegistry.sol) | SE chip active/verification trust boundary | v1 top-line metric에는 직접 노출하지 않지만, trust-chain integrity와 future v2 trust metrics의 참조 기준 |
| STRIKON 운영 데이터 | 유지보수 처리, site classification | `maintenanceResolutionRateBps`, `primaryType`, `siteMix` 계산 입력 |

---

## 8. Writer 모델

기록 주체는 `STRIKON bridge/oracle` 이다.

- 기존 `onlyBridge` trust boundary와 같은 철학을 따른다.
- 프론트는 체인에 직접 붙어 조회만 수행한다.
- story chip 문장은 프론트가 snapshot을 읽어 조합한다.
- concrete implementation은 `UUPS + AccessControl + BridgeGuarded + Pausable` 패턴을 따른다.

즉:
- 체인 = 파생 지표 저장소
- 프론트 = narrative composer

---

## 9. Public Interface

`IReputationRegistry` 는 아래 기능만 보장한다.

### Write

- `upsertRegionSnapshot`
- `upsertRegionSnapshots`

### Read

- `getRegionSnapshot`
- `getLatestRegionSnapshot`
- `getRegionSnapshotPeriods`
- `hasRegionSnapshot`

missing data semantics:
- `getRegionSnapshot` -> absent key면 revert
- `getLatestRegionSnapshot` -> cadence 내 snapshot이 없으면 revert
- `hasRegionSnapshot` -> caller-side existence guard

### Event

- `RegionSnapshotUpserted`

### Concrete admin surface

아래 항목은 consumer interface가 아니라 구현 정책이다.

- `initialize(address admin, address bridge)`
- `pause()`
- `unpause()`
- `updateBridgeAddress(address)`
- UUPS upgrade authorization = `DEFAULT_ADMIN_ROLE`

테스트 기준 구현 검증은 아래 파일을 따른다.
- `test/unit/ReputationRegistry.admin.test.ts`
- `test/unit/ReputationRegistry.behavior.test.ts`
- `test/integration/reputation.test.ts`

---

## 10. Explore 연결 방식

프론트 Explore는 region snapshot을 읽고 지역별 `story chip 3개`를 만든다.

예시 방향:
- 운영 신뢰도 chip
- 수익 리듬 chip
- 입지 성격 chip

중요:
- 점수 표시 없음
- 랭킹 없음
- Hot / Trending / Undervalued 같은 위계 서사 없음

---

## 11. v2 Deferred

아래 항목은 유효하지만 v1 범위에서 제외한다.

- 지자체 지원금
- 정책 순풍/행정 드라이브
- station-level reputation
- 명시적 score / banding
- 정책성 외생 변수 확장

이 항목들은 추후 `policy extension` 또는 `advanced reputation` 스펙으로 분리한다.
