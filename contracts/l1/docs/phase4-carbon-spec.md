# Phase 4: 탄소배출권 스마트 컨트랙트 스펙

## EnergyFi — ParameterRegistry + CarbonReduction + CarbonBatch + VCUReference 구현 가이드

2026.03.03 | Ver 1.0

---

## 목표

Verra VCS VM0038 방법론을 기반으로 EV 충전 세션당 탄소 감축량을 계산하고 온체인에 영구 기록한다. VVB(Validation and Verification Body) 검증 주기에 맞춰 배치를 관리하고, Verra VCU 발행 결과를 온체인에 연결한다.

**타임라인**: VVB 검증 개시 시점 (2027 이후)

**전제 조건**: Phase 2 ChargeTransaction 레코드 충분히 축적 (최소 1년 데이터)

---

## VM0038 방법론 개요

```
Net Reduction = Baseline Emissions − Project Emissions

Baseline = EC × (1/AFEC) × EFfuel
  EC      = 충전 에너지 (kWh) = ChargeTransaction.energyKwh / 100
  AFEC    = 평균 연비 (km/L) — ParameterRegistry에서 조회
  EFfuel  = 연료 배출계수 (tCO2/L) — ParameterRegistry에서 조회

Project = EC × EFkw × (chargerType == DCFC ? 1/DCFC_EFF : 1)
  EFkw      = 전력망 배출계수 (tCO2/kWh) — ParameterRegistry에서 조회
  DCFC_EFF  = 0.923 (고정) — ParameterRegistry에서 조회

Leakage = 0 (VM0038/AMS-III.C 기준)
```

---

## 컨트랙트

### ParameterRegistry

**목적**: VM0038 수식에 사용되는 파라미터를 버전 관리하여 저장. VVB 감사 시 특정 시점의 파라미터 값을 재현할 수 있어야 한다.

#### 관리 파라미터

| 파라미터 | 키 (bytes32) | 업데이트 주기 | 설명 |
|---------|-------------|-------------|------|
| EFkw | `keccak256("EFkw")` | 연간 | 전력망 배출계수 (tCO2/kWh, ×10^6 스케일) |
| EFfuel | `keccak256("EFfuel")` | 기준연도 | 연료 배출계수 (tCO2/L, ×10^6 스케일) |
| AFEC | `keccak256("AFEC")` | 5년 | 평균 연비 (km/L, ×100 스케일) |
| DCFC_EFF | `keccak256("DCFC_EFF")` | 고정 | 0.923 → 923 (×1000 스케일) |
| EV_EFF | `keccak256("EV_EFF")` | 수시 | EV 효율 (km/kWh, ×100 스케일) |

#### Storage

```solidity
struct ParameterEntry {
    uint256 value;
    uint256 effectiveFrom;   // block.timestamp
    uint256 setAt;           // block.timestamp (기록 시점)
    address setBy;           // Admin 주소
}

mapping(bytes32 key => ParameterEntry[]) public parameterHistory;
```

#### Key Functions

```solidity
// Admin 전용
function setParameter(bytes32 key, uint256 value, uint256 effectiveFrom)
    external onlyAdmin
// effectiveFrom이 과거면 revert (소급 수정 불가)
// effectiveFrom이 미래면 예약 적용

// View
function getParameter(bytes32 key, uint256 timestamp)
    external view returns (uint256)
// timestamp 시점에 유효했던 파라미터 값 반환
// (이진 탐색으로 effectiveFrom <= timestamp 중 가장 최신 항목 반환)

function getParameterHistory(bytes32 key)
    external view returns (ParameterEntry[] memory)

function getCurrentParameter(bytes32 key)
    external view returns (uint256)
// = getParameter(key, block.timestamp)
```

#### 이벤트

```solidity
event ParameterSet(
    bytes32 indexed key,
    uint256         value,
    uint256         effectiveFrom,
    address         setBy
);
```

**설계 핵심**: VVB 감사 시 "특정 충전 세션에 어떤 파라미터가 적용되었는가?"를 검증 가능. `getParameter(key, session.startTimestamp)` 호출로 해당 시점의 파라미터를 재현.

---

### CarbonReduction (Immutable ERC-721)

**목적**: ChargeTransaction 1:1 대응하여 VM0038 탄소 감축량을 계산하고 ERC-721 토큰으로 기록.

**중요 설계**: **비업그레이드 배포** (프록시 패턴 적용 금지). 방법론 개정 시 새 버전 컨트랙트를 별도 배포하고 타임스탬프 경계로 구분. VVB가 배포된 바이트코드를 검증하여 수식 일관성을 확인.

#### ReductionRecord struct

```solidity
struct ReductionRecord {
    uint256 chargeTransactionId;  // ChargeTransaction ERC-721 tokenId (1:1 참조)
    uint256 energyKwh;            // 원본 에너지 (스케일 유지, ChargeSession.energyKwh)
    uint256 baselineEmissions;    // gCO2 (ICE 동등 배출)
    uint256 projectEmissions;     // gCO2 (전력망 배출)
    uint256 netReduction;         // gCO2 (순 감축)
    uint256 appliedEFkw;          // 적용된 EFkw (스냅샷)
    uint256 appliedEFfuel;        // 적용된 EFfuel (스냅샷)
    uint256 appliedAFEC;          // 적용된 AFEC (스냅샷)
    uint256 appliedDCFC_EFF;      // 적용된 DCFC_EFF (스냅샷)
    uint256 calculatedAt;         // block.timestamp (계산 시점)
}
```

#### Key Functions

```solidity
// Admin 전용 (배치 처리)
function calculateAndMint(uint256 chargeTransactionId)
    external onlyAdmin returns (uint256 reductionTokenId)
// 1. ChargeTransaction.getSession(chargeTransactionId) 조회
// 2. ParameterRegistry에서 session.startTimestamp 시점 파라미터 조회
// 3. VM0038 수식 적용 → ReductionRecord 계산
// 4. ERC-721 mint

function calculateAndMintBatch(uint256[] calldata chargeTransactionIds)
    external onlyAdmin returns (uint256[] memory reductionTokenIds)
// 가스 효율을 위한 배치 처리

// View
function getReduction(uint256 tokenId)
    external view returns (ReductionRecord memory)

function getReductionByChargeTransaction(uint256 chargeTransactionId)
    external view returns (uint256 reductionTokenId)
// chargeTransactionId → reductionTokenId 역방향 조회
```

#### 이벤트

```solidity
event CarbonReductionMinted(
    uint256 indexed reductionTokenId,
    uint256 indexed chargeTransactionId,
    uint256         netReduction,
    uint256         calculatedAt
);
```

---

### CarbonBatch

**목적**: VVB 검증 주기(통상 연간)에 맞춰 CarbonReduction 레코드를 배치로 묶고 잠금. 이중 계산(double-counting) 방지.

#### 상태 전이

```
OPEN → LOCKED → VERIFIED  (단방향, 비가역)
```

#### BatchRecord struct

```solidity
enum BatchStatus { OPEN, LOCKED, VERIFIED }

struct BatchRecord {
    uint256     batchId;
    uint256     timeStart;       // 배치 포함 기간 시작
    uint256     timeEnd;         // 배치 포함 기간 종료
    BatchStatus status;
    uint256     createdAt;
    uint256     lockedAt;
    uint256     verifiedAt;
    uint256[]   reductionIds;    // 포함된 CarbonReduction tokenId 목록
}
```

#### Key Functions

```solidity
// Admin 전용
function createBatch(uint256 timeStart, uint256 timeEnd)
    external onlyAdmin returns (uint256 batchId)

function addToBatch(uint256 batchId, uint256[] calldata reductionIds)
    external onlyAdmin
// 검증: batch가 OPEN 상태이어야 함
// 검증: reductionId가 다른 배치에 포함되지 않았어야 함

function lockBatch(uint256 batchId)
    external onlyAdmin
// 상태: OPEN → LOCKED (비가역)
// 이후 addToBatch() 불가

function markVerified(uint256 batchId)
    external onlyAdmin
// 상태: LOCKED → VERIFIED (비가역)
// VVB 검증 완료 후 호출

// View
function getBatch(uint256 batchId) external view returns (BatchRecord memory)
function getBatchStatus(uint256 batchId) external view returns (BatchStatus)
function getReductionBatch(uint256 reductionId) external view returns (uint256 batchId)
// reductionId가 어느 배치에 속하는지 역방향 조회
```

#### 이벤트

```solidity
event BatchCreated(uint256 indexed batchId, uint256 timeStart, uint256 timeEnd);
event BatchLocked(uint256 indexed batchId, uint256 reductionCount);
event BatchVerified(uint256 indexed batchId, uint256 verifiedAt);
```

---

### VCUReference (Append-only)

**목적**: Verra VCU 발행 결과를 온체인에 기록. CarbonBatch와 1:1 연결하여 온체인 → Verra 레지스트리 완전 추적 가능성(end-to-end traceability) 확보.

**중요 설계**: Append-only. 한번 기록된 VCURecord는 수정/삭제 불가.

#### VCURecord struct

```solidity
struct VCURecord {
    uint256 batchId;              // 참조 CarbonBatch ID
    uint256 vcuQuantity;          // 발행된 VCU 수량 (tCO2 단위)
    string  verraRegistryNumber;  // Verra 공식 레지스트리 번호
    uint256 issuanceDate;         // VCU 발행일 (Verra 기준, Unix timestamp)
    bytes32 verificationHash;     // 검증 보고서 해시 (SHA-256)
}
```

#### Key Functions

```solidity
// Admin 전용 (Append-only)
function recordVCU(
    uint256 batchId,
    uint256 vcuQuantity,
    string calldata verraRegistryNumber,
    uint256 issuanceDate,
    bytes32 verificationHash
) external onlyAdmin returns (uint256 vcuRecordId)
// 검증: batch가 VERIFIED 상태이어야 함
// 검증: batchId에 이미 VCURecord가 없어야 함 (1:1 원칙)

// View
function getVCURecord(uint256 vcuRecordId) external view returns (VCURecord memory)
function getVCUByBatch(uint256 batchId) external view returns (uint256 vcuRecordId)
function getTotalVCUMinted() external view returns (uint256)
```

#### 이벤트

```solidity
event VCUIssued(
    uint256 indexed vcuRecordId,
    uint256 indexed batchId,
    uint256         vcuQuantity,
    string          verraRegistryNumber,
    uint256         issuanceDate
);
```

#### 추적 경로 (End-to-End Traceability)

```
ChargeTransaction (ERC-721, tokenId: 12345)
  └─→ CarbonReduction (ERC-721, tokenId: 6789)
        └─→ CarbonBatch (batchId: 42, status: VERIFIED)
              └─→ VCUReference (vcuRecordId: 1, verraRegistryNumber: "VCS-2027-001")
                    └─→ Verra VCS Registry (공개 레지스트리)
```

---

## Mock Oracle 서버

**파일**: `contracts/l1/scripts/oracle/phase4-oracle.ts`

```typescript
async function calculateAndMintReductions(startId: number, endId: number) {
  // ChargeTransaction tokenId 범위로 CarbonReduction 일괄 생성
  const ids = Array.from({ length: endId - startId + 1 }, (_, i) => startId + i);
  const tx = await carbonReduction.calculateAndMintBatch(ids);
  await tx.wait();
  console.log(`✅ ${ids.length}건 CarbonReduction mint 완료`);
}

async function createAndLockBatch(startDate: Date, endDate: Date) {
  // 기간 배치 생성 및 잠금
  const batchId = await carbonBatch.createBatch(
    Math.floor(startDate.getTime() / 1000),
    Math.floor(endDate.getTime() / 1000)
  );

  // 해당 기간의 CarbonReduction ID 조회 후 배치에 추가
  const reductionIds = await getReductionIdsForPeriod(startDate, endDate);
  await carbonBatch.addToBatch(batchId, reductionIds);

  // 배치 잠금 (VVB 제출 준비)
  await carbonBatch.lockBatch(batchId);
  console.log(`✅ 배치 #${batchId} 잠금 완료 (${reductionIds.length}건)`);
}

async function recordTestVCU(batchId: number, quantity: number) {
  // 테스트 VCU 발행 기록
  await carbonBatch.markVerified(batchId);
  const vcuId = await vcuReference.recordVCU(
    batchId,
    quantity,
    `VCS-TEST-${batchId}`,
    Math.floor(Date.now() / 1000),
    ethers.keccak256(ethers.toUtf8Bytes(`verification-report-${batchId}`))
  );
  console.log(`✅ VCU #${vcuId} 기록 완료 (배치 #${batchId}, ${quantity} tCO2)`);
}

// VVB 감사 시뮬레이션
async function simulateVVBAudit(chargeTransactionId: number) {
  // 특정 충전 세션의 탄소 감축 계산 재현 (VVB 감사 절차)
  const session = await chargeTransaction.getSession(chargeTransactionId);
  const reduction = await carbonReduction.getReductionByChargeTransaction(chargeTransactionId);
  const record = await carbonReduction.getReduction(reduction);

  console.log("=== VVB 감사 시뮬레이션 ===");
  console.log(`충전 세션: ${chargeTransactionId}`);
  console.log(`에너지: ${Number(session.energyKwh) / 100} kWh`);
  console.log(`적용 EFkw (시점: ${new Date(Number(session.startTimestamp) * 1000).toISOString()}):`);
  console.log(`  ${await parameterRegistry.getParameter(EFkw_KEY, session.startTimestamp)}`);
  console.log(`계산된 순 감축량: ${Number(record.netReduction)} gCO2`);
}
```

---

## 대시보드 화면

### 화면 1: 탄소 감축 현황

```
┌─────────────────────────────────────────────────────────────────┐
│  탄소 감축 현황 (누적)                                           │
│                                                                 │
│  처리된 충전 세션:     125,430건                                │
│  탄소 감축 레코드:     125,430건                                │
│  총 순 감축량:         1,892.4 tCO2                            │
│                                                                 │
│  배치 현황:                                                     │
│  OPEN: 1개 (6,234건)                                           │
│  LOCKED: 2개 (검증 대기)                                        │
│  VERIFIED: 3개 (검증 완료)                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 화면 2: 배치 관리

```
┌─────────────────────────────────────────────────────────────────┐
│  배치 목록                                                      │
│                                                                 │
│  #  기간              레코드 수  상태      VCU                 │
│  1  2026.06~12       42,100건  VERIFIED  VCS-2027-001 (420t)  │
│  2  2027.01~06       45,230건  VERIFIED  VCS-2027-002 (452t)  │
│  3  2027.07~12       38,096건  VERIFIED  VCS-2028-001 (381t)  │
│  4  2028.01~         6,234건   OPEN      —                    │
└─────────────────────────────────────────────────────────────────┘
```

### 화면 3: VVB 검증 이력

```
┌─────────────────────────────────────────────────────────────────┐
│  VCU 발행 이력                                                  │
│                                                                 │
│  VCU ID  배치  수량(tCO2)  Verra 번호          발행일          │
│  001     #1   420         VCS-2027-001        2027.03.15       │
│  002     #2   452         VCS-2027-002        2027.09.20       │
│  003     #3   381         VCS-2028-001        2028.03.10       │
│                                                                 │
│  총 발행: 1,253 VCU                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 통합 테스트 체크리스트

### ParameterRegistry

- [ ] 파라미터 설정 후 `getCurrentParameter()` 확인
- [ ] `getParameter(key, timestamp)` 시점별 조회 정확성 확인 (VVB 감사 시뮬레이션)
- [ ] `effectiveFrom` 과거 시점 설정 시 revert 확인 (소급 수정 방지)
- [ ] Admin 아닌 주소의 `setParameter()` → revert 확인

### CarbonReduction

- [ ] `calculateAndMint(chargeTransactionId)` known input → expected output 검증
  - 예: energyKwh=678(6.78 kWh), EFkw=0.000459, chargerType=L2
  - baseline 계산값 확인
  - project 계산값 확인
  - netReduction 확인
- [ ] 배치 처리 `calculateAndMintBatch()` 100건 성능 확인
- [ ] 동일 chargeTransactionId 중복 mint 시 revert 확인
- [ ] `getReductionByChargeTransaction()` 역방향 조회 확인
- [ ] Admin 아닌 주소의 `calculateAndMint()` → revert 확인

### CarbonBatch

- [ ] 배치 생성 → `getBatchStatus()` OPEN 확인
- [ ] `addToBatch()` 성공 후 `getBatch().reductionIds` 확인
- [ ] `lockBatch()` 후 `addToBatch()` → revert 확인 (비가역성)
- [ ] 동일 reductionId를 두 배치에 추가 시도 → revert 확인 (이중 계산 방지)
- [ ] `getReductionBatch(reductionId)` 역방향 조회 확인
- [ ] `lockBatch()` 후 `getBatchStatus()` LOCKED 확인
- [ ] `markVerified()` 후 `getBatchStatus()` VERIFIED 확인

### VCUReference

- [ ] VERIFIED 상태 배치에만 `recordVCU()` 가능 확인
- [ ] LOCKED/OPEN 상태 배치에 `recordVCU()` → revert 확인
- [ ] 동일 배치 중복 VCU 기록 → revert 확인 (1:1 원칙)
- [ ] `getVCUByBatch(batchId)` 역방향 조회 확인
- [ ] `getTotalVCUMinted()` 누적 수량 확인

### 통합 흐름 (End-to-End)

- [ ] ChargeTransaction → CarbonReduction → CarbonBatch → VCUReference 완전 추적 확인
- [ ] VVB 감사 시뮬레이션: chargeTransactionId로 VCU 발행 번호까지 추적 가능 확인

---

## 참조 문서

| 문서 | 경로 |
|:--|:--|
| Implementation Roadmap | [implementation-roadmap.md](implementation-roadmap.md) |
| Phase 2 스펙 | [phase2-transaction-spec.md](phase2-transaction-spec.md) |
| Verra VCS VM0038 | https://verra.org/methodologies/vm0038-methodology-for-electric-vehicle-charging-systems/ |

---

*End of Document*
