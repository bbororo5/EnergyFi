# Phase 2: 충전 트랜잭션 스마트 컨트랙트 스펙

## EnergyFi — ChargeTransaction + RevenueTracker + ChargeRouter 구현 가이드

2026.03.03 | Ver 2.1

---

## 목표

STRIKON `invoice.paid` 이벤트 발생 시 충전 데이터를 온체인에 영구 기록하고, 충전소 소유자(CPO/EnergyFi)별 수익을 실시간으로 누적·추적한다.

**타임라인**: 2026.04 ~ 06

**전제 조건**: Phase 1 완료 (DeviceRegistry + StationRegistry 배포 및 SE 칩 등록)

---

## 확정 설계 결정 (10건)

Phase 2 구현을 위해 확정된 핵심 의사결정 목록. 각 항목의 상세 근거는 해당 섹션에서 설명.

| # | 항목 | 결정 | 반영 섹션 |
|:--|:--|:--|:--|
| 1 | ERC-721 토큰 수신자 | **Soulbound** (non-transferable, 컨트랙트 자체에 귀속) | ChargeTransaction §Soulbound |
| 2 | SE 서명 임시 처리 | **Mock 서명** (테스트 키로 전체 플로우 검증) | SE 서명 Mock 모드 |
| 3 | UUID → bytes32 인코딩 | **접두사 제거 + 하이픈 제거 → hex bytes32** (결정적, 역변환 가능) | UUID 인코딩 규칙 |
| 4 | Oracle/대시보드 스택 | **Phase 1 Express 서버 확장 + SSE 실시간 피드** | Mock Oracle / 대시보드 |
| 5 | period_yyyyMM 계산 | **Bridge가 오프체인 계산 후 파라미터로 전달** | RevenueTracker |
| 6 | Upgradeability | **UUPS Proxy** (OpenZeppelin UUPSUpgradeable) | 전체 컨트랙트 |
| 7 | 원자성 보장 | **ChargeRouter 컨트랙트** (mint + recordRevenue 단일 함수) | ChargeRouter |
| 8 | stationId 검증 | **Revert** (미등록 stationId → 무조건 revert) | ChargeTransaction / RevenueTracker |
| 9 | 대시보드 범위 | **7개 화면** (기존 4 + 정산 이력 + 지역 수익 + 세션 상세) | 대시보드 |
| 10 | Setup 데이터 규모 | **Phase 1 배치와 동일** (CPO 3 + 충전소 5 + 충전기 15 + SE칩 12 + 3개 지역) | Mock Oracle Setup |

---

## 컨트랙트

### ChargeTransaction (ERC-721, Soulbound, UUPS Proxy)

**목적**: 결제 완료된 충전 세션당 ERC-721 토큰 1개 발행. SE 칩 서명을 포함하여 물리적 측정값의 온체인 Root of Trust 확립.

**Soulbound 설계**: 충전 세션 기록 토큰은 양도 불가. 컨트랙트 자체(`address(this)`)가 토큰 소유자.

- `mint()` 시 `to = address(this)` — 토큰은 ChargeTransaction 컨트랙트 자체에 귀속
- `_update()` override로 mint 이후 전송 시도 차단
- `transfer()`, `transferFrom()`, `safeTransferFrom()` 호출 시 `SoulboundToken` revert
- `approve()`, `setApprovalForAll()` 정상 작동하나 전송이 불가하므로 실질적 효과 없음

```solidity
// Soulbound 구현 (OpenZeppelin ERC721 override)
function _update(address to, uint256 tokenId, address auth)
    internal override returns (address)
{
    address from = _ownerOf(tokenId);
    // mint (from == address(0))만 허용, 그 외 전송 차단
    if (from != address(0)) {
        revert SoulboundToken();
    }
    return super._update(to, tokenId, auth);
}
```

#### UUPS Proxy 패턴

- 생성자 대신 `initialize()` 함수 사용
- `_authorizeUpgrade()` override — `onlyRole(DEFAULT_ADMIN_ROLE)` 권한 검증
- OpenZeppelin `UUPSUpgradeable` + `Initializable` 상속

```solidity
function initialize(
    address _deviceRegistry,
    address _stationRegistry,
    address _bridgeAddress,
    address _admin
) external initializer {
    __ERC721_init("EnergyFi Charge Session", "EFCS");
    __AccessControl_init();
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    deviceRegistry = IDeviceRegistry(_deviceRegistry);
    stationRegistry = IStationRegistry(_stationRegistry);
    bridgeAddress = _bridgeAddress;
}

function _authorizeUpgrade(address newImplementation)
    internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
```

#### ChargeSession struct

```solidity
struct ChargeSession {
    bytes32 sessionId;         // 충전 세션 고유 ID (STRIKON UUID → bytes32)
    bytes32 chargerId;         // 충전기 ID (DeviceRegistry에 등록된 ID)
    uint8   chargerType;       // 0: L1, 1: L2, 2: DCFC
    uint256 energyKwh;         // kWh × 100 (6.780 kWh → 678)
    uint256 startTimestamp;    // Unix timestamp
    uint256 endTimestamp;      // Unix timestamp
    uint8   vehicleCategory;   // 0: UNKNOWN(현재 OCPP 1.6 환경에서 기본값)
                               // 1: BEV, 2: PHEV — OCPP 2.0.1 전환 시 활성화 예정
    bytes4  gridRegionCode;    // 탄소 EFkw 조회용 지역 코드 (ISO 3166-2:KR)
                               // CPO/EnergyFi 소유 불문 모든 세션에 기록
                               // STO 투자 지역(Station.regionId)과 동일 포맷이나 목적 상이
    bytes32 cpoId;             // CPO ID (StationRegistry에 등록된 ID)
    bytes32 stationId;         // Station ID (StationRegistry에 등록된 ID)
    uint256 distributableKrw;  // STRIKON 수수료 차감 후 배분 가능 금액(원)
    bytes   seSignature;       // TPM 2.0 SE 칩 P-256 서명
}
```

#### tokenId 채번 방식

자동 증가 카운터 사용. 연속적이고 예측 가능한 ID 부여.

```solidity
uint256 private _nextTokenId;  // initialize()에서 1로 초기화

// mint() 내부:
uint256 tokenId = _nextTokenId++;
```

#### sessionId 중복 방지

동일 sessionId로 중복 mint() 호출 시 revert. 멱등성 보장.

```solidity
mapping(bytes32 sessionId => uint256 tokenId) private _sessionToToken;

// mint() 내부:
require(_sessionToToken[session.sessionId] == 0, "DuplicateSession");
// mint 후:
_sessionToToken[session.sessionId] = tokenId;
```

#### tokenURI 전략

Soulbound 데이터 기록 목적이므로 빈 문자열 반환으로 시작. 필요 시 온체인 JSON(Base64)으로 확장 가능.

```solidity
function tokenURI(uint256 tokenId) public view override returns (string memory) {
    _requireOwned(tokenId);
    return "";  // Phase 2 초기: 빈 문자열. 필요 시 온체인 JSON 확장.
}
```

#### Key Functions

```solidity
// Bridge 전용 (실제로는 ChargeRouter를 통해 호출됨)
function mint(ChargeSession calldata session)
    external onlyBridge returns (uint256 tokenId)
// 검증:
//   1. require(_sessionToToken[session.sessionId] == 0, "DuplicateSession")
//   2. StationRegistry.isRegistered(session.stationId) 확인 → 미등록 시 revert("StationNotRegistered")
//   3. DeviceRegistry.isActiveChip(session.chargerId) 확인
//   4. DeviceRegistry.verifySignature(chargerId, msgHash, seSignature) 확인
//      msgHash = keccak256(abi.encodePacked(chargerId, energyKwh, startTimestamp, endTimestamp))
//   5. tokenId = _nextTokenId++
//   6. ERC-721 _mint(address(this), tokenId) — Soulbound
//   7. _sessions[tokenId] = session 저장
//   8. _sessionToToken[session.sessionId] = tokenId
//   9. emit ChargeSessionRecorded(...)

// View
function getSession(uint256 tokenId) external view returns (ChargeSession memory)
function getTokenIdBySessionId(bytes32 sessionId) external view returns (uint256)
function totalSessions() external view returns (uint256)  // _nextTokenId - 1
```

#### 이벤트

```solidity
event ChargeSessionRecorded(
    uint256 indexed tokenId,
    bytes32 indexed sessionId,
    bytes32 indexed chargerId,
    bytes32         stationId,
    bytes4          gridRegionCode,
    uint256         energyKwh,
    uint256         distributableKrw,
    uint256         startTimestamp,
    uint256         endTimestamp
);
```

#### 커스텀 에러

```solidity
error SoulboundToken();          // 전송 시도 시
error DuplicateSession();        // 동일 sessionId 중복 mint
error StationNotRegistered();    // StationRegistry 미등록 stationId
error CallerNotBridge();         // onlyBridge 위반
```

#### 접근 제어

```solidity
modifier onlyBridge() {
    require(msg.sender == bridgeAddress, "CallerNotBridge");
    _;
}
// bridgeAddress: ChargeRouter 컨트랙트 주소.
// 실제 AWS KMS Bridge → ChargeRouter → ChargeTransaction 경로.
```

#### 의존성

- **DeviceRegistry**: `initialize()` 시 주소 전달하여 바인딩
- **StationRegistry**: `initialize()` 시 주소 전달. stationId 유효성 검증 필수 (미등록 → revert)

---

### RevenueTracker (UUPS Proxy)

**목적**: ChargeRouter.processCharge() 내에서 mint() 직후 호출. 충전소별 수익을 누적하고 CPO/EnergyFi 지역별 집계를 제공. Phase 3 STOPortfolio의 데이터 소스.

#### UUPS Proxy 패턴

```solidity
function initialize(
    address _stationRegistry,
    address _bridgeAddress,
    address _admin
) external initializer {
    __AccessControl_init();
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    stationRegistry = IStationRegistry(_stationRegistry);
    bridgeAddress = _bridgeAddress;
}

function _authorizeUpgrade(address newImplementation)
    internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
```

#### 수익 귀속 모델

```
CPO 소유 충전소 (isEnergyFiOwned = false):
  distributableKrw → stationAccumulated[stationId]
  CPO가 오프체인 KRW 이체 후 온체인 정산 기록

EnergyFi 소유 충전소 (isEnergyFiOwned = true):
  distributableKrw → stationAccumulated[stationId]
  해당 지역 STO 투자자 풀로 귀속
  (월 1회 오프체인 KRW 이체 후 온체인 정산 기록)
```

#### Storage

```solidity
// 기본 수익 추적
mapping(bytes32 stationId => uint256) public stationAccumulated;  // 누적 수익(원)
mapping(bytes32 stationId => uint256) public stationSettled;      // 정산 완료(원)

// 월별 이력 — 배열 + 매핑 이중 구조로 조회 효율 확보
mapping(bytes32 stationId => MonthlyRevenue[]) public monthlyHistory;
mapping(bytes32 stationId => mapping(uint256 period => uint256 amount)) private _monthlyAmounts;

struct MonthlyRevenue {
    uint256 period_yyyyMM;   // 예: 202606 = 2026년 6월
    uint256 amount;          // 해당 월 distributableKrw 합계(원)
}

// 정산 이력
mapping(bytes32 stationId => SettlementRecord[]) public settlementHistory;

struct SettlementRecord {
    uint256 period_yyyyMM;
    uint256 amount;
    uint256 settledAt;       // block.timestamp
}
```

**monthlyHistory 업데이트 로직**:
- `_monthlyAmounts[stationId][period]`로 해당 월 존재 여부 확인
- 이미 존재하면 `_monthlyAmounts` 값 업데이트 + `monthlyHistory` 배열 마지막 항목 업데이트
- 새 월이면 `monthlyHistory`에 push + `_monthlyAmounts` 초기화

#### Key Functions

```solidity
// Bridge 전용 (실제로는 ChargeRouter를 통해 호출됨)
function recordRevenue(
    bytes32 stationId,
    uint256 distributableKrw,
    uint256 period_yyyyMM          // Bridge가 오프체인에서 계산하여 전달
) external onlyBridge
// 검증:
//   1. require(stationRegistry.isRegistered(stationId), "StationNotRegistered")
//   2. require(distributableKrw > 0, "ZeroAmount")
// 효과:
//   stationAccumulated[stationId] += distributableKrw
//   monthlyHistory[stationId]에 period_yyyyMM 합산
//   _monthlyAmounts[stationId][period_yyyyMM] += distributableKrw

// Admin 전용 (월정산 시) — CPO 단위 일괄 정산 완료 기록
function claim(bytes32 cpoId, uint256 period_yyyyMM)
    external onlyRole(DEFAULT_ADMIN_ROLE)
    returns (uint256 totalClaimed)
// 효과:
//   1. StationRegistry.getStationsByCPO(cpoId) → 충전소 목록 조회
//   2. 각 충전소 pending(= accumulated - settled) 자동 계산
//   3. stationSettled[sid] += pending (충전소별 정산 완료 기록)
//   4. settlementHistory[sid]에 SettlementRecord 추가
//   5. emit SettlementRecorded(sid, cpoId, pending, period_yyyyMM) per station
//   6. emit CPOClaimed(cpoId, totalClaimed, period_yyyyMM)
// require: totalClaimed > 0 ("NothingToClaim")
// require: stationIds.length > 0 ("CPOHasNoStations")

// View 함수
function getStationRevenue(bytes32 stationId)
    external view
    returns (uint256 accumulated, uint256 settled, uint256 pending)
// pending = accumulated - settled

function getStationRevenuePeriod(bytes32 stationId, uint256 period_yyyyMM)
    external view returns (uint256)
// _monthlyAmounts[stationId][period_yyyyMM] 반환

function getCPORevenue(bytes32 cpoId)
    external view
    returns (uint256 accumulated, uint256 settled, uint256 pending)
// StationRegistry.getStationsByCPO(cpoId)로 충전소 목록 조회 후 합산

function getEnergyFiRegionRevenue(bytes4 regionId)
    external view returns (uint256 pending)
// StationRegistry.getEnergyFiStationsByRegion(regionId)로 EnergyFi 소유 충전소 목록 조회
// 각 충전소의 pending 합산 반환
// Phase 3 STOPortfolio.getRegionPoolRevenue() 에서 호출

function getSettlementHistory(bytes32 stationId)
    external view returns (SettlementRecord[] memory)
```

#### 이벤트

```solidity
event RevenueRecorded(
    bytes32 indexed stationId,
    uint256         distributableKrw,
    uint256         accumulated,
    uint256         period_yyyyMM
);

event SettlementRecorded(
    bytes32 indexed stationId,
    bytes32 indexed cpoId,
    uint256         amount,
    uint256         period_yyyyMM,
    uint256         settledAt
);

event CPOClaimed(
    bytes32 indexed cpoId,
    uint256         totalAmount,
    uint256         period_yyyyMM,
    uint256         claimedAt
);
```

#### 커스텀 에러

```solidity
error StationNotRegistered();    // StationRegistry 미등록 stationId
error ZeroAmount();              // distributableKrw == 0
error NothingToClaim();          // claim() 시 pending == 0
error CPOHasNoStations();        // claim() 시 CPO 소속 충전소 없음
error CallerNotBridge();         // onlyBridge 위반
```

#### 의존성

- **StationRegistry**: `getCPORevenue()` / `getEnergyFiRegionRevenue()` 에서 충전소 목록 조회. `recordRevenue()` 시 stationId 유효성 검증.

---

### ChargeRouter (UUPS Proxy, 신규)

**목적**: `ChargeTransaction.mint()` + `RevenueTracker.recordRevenue()`를 단일 트랜잭션으로 원자적 실행. Bridge는 이 컨트랙트만 호출.

**원자성 보장**: `processCharge()` 내에서 mint 또는 recordRevenue 중 하나라도 실패하면 전체 트랜잭션이 revert되어 부분 기록이 발생하지 않음.

#### UUPS Proxy 패턴

```solidity
function initialize(
    address _chargeTransaction,
    address _revenueTracker,
    address _bridgeAddress,
    address _admin
) external initializer {
    __AccessControl_init();
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    chargeTransaction = IChargeTransaction(_chargeTransaction);
    revenueTracker = IRevenueTracker(_revenueTracker);
    bridgeAddress = _bridgeAddress;
}
```

#### Key Functions

```solidity
function processCharge(
    ChargeSession calldata session,
    uint256 period_yyyyMM
) external onlyBridge returns (uint256 tokenId) {
    // 1. 충전 세션 기록 (ERC-721 mint)
    tokenId = chargeTransaction.mint(session);

    // 2. 수익 누적 (즉시 연속 호출 — 동일 TX 내)
    revenueTracker.recordRevenue(
        session.stationId,
        session.distributableKrw,
        period_yyyyMM
    );

    emit ChargeProcessed(tokenId, session.sessionId, session.stationId, period_yyyyMM);
}
```

#### 이벤트

```solidity
event ChargeProcessed(
    uint256 indexed tokenId,
    bytes32 indexed sessionId,
    bytes32 indexed stationId,
    uint256         period_yyyyMM
);
```

#### 접근 제어 및 호출 구조

```
실제 호출 체인:
  AWS KMS Bridge 지갑 → ChargeRouter.processCharge()
                            ├─→ ChargeTransaction.mint(session)
                            └─→ RevenueTracker.recordRevenue(stationId, distributableKrw, period)

bridgeAddress 설정:
  ChargeRouter.bridgeAddress     = AWS KMS Bridge 지갑 주소
  ChargeTransaction.bridgeAddress = ChargeRouter 컨트랙트 주소
  RevenueTracker.bridgeAddress   = ChargeRouter 컨트랙트 주소
```

- Bridge는 **ChargeRouter.processCharge()** 만 호출
- ChargeRouter 주소가 ChargeTransaction/RevenueTracker의 `bridgeAddress`로 설정됨
- 실제 AWS KMS Bridge는 ChargeRouter를 호출하는 구조

---

## UUID → bytes32 인코딩 규칙

STRIKON UUID를 온체인 bytes32로 변환하는 결정적(deterministic) 규칙. 역변환 가능.

### 변환 절차

```
1. 접두사 제거 (sess_, chrg_, stn_, cpo_, inv_ 등)
2. 하이픈(-) 제거
3. hex → bytes32 (32바이트 좌측 정렬, 우측 zero-padding)
```

### 예시

```
STRIKON UUID:  "sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  → 접두사 제거: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  → 하이픈 제거: "a1b2c3d4e5f67890abcdef1234567890"
  → hex → bytes32: 0xa1b2c3d4e5f67890abcdef12345678900000000000000000000000000000000000
```

> UUID는 128비트(16바이트)이므로 bytes32(32바이트)의 상위 16바이트를 차지하고 하위 16바이트는 zero-padding.

### 변환 책임

- **Bridge가 오프체인에서 변환 수행** — 컨트랙트는 변환된 bytes32 그대로 저장
- 역변환: 상위 16바이트 추출 → hex → 하이픈 삽입 (8-4-4-4-12 포맷) → 접두사 복원
- Bridge, Oracle 스크립트, 테스트 모두 동일 규칙 적용 (구현: `scripts/dashboard/web/lib/utils.ts`)

### 오프체인 변환 유틸리티 (TypeScript)

```typescript
function uuidToBytes32(uuid: string): string {
    // 접두사 제거 (sess_, chrg_, stn_, cpo_ 등)
    const withoutPrefix = uuid.replace(/^[a-z]+_/, '');
    // 하이픈 제거
    const hex = withoutPrefix.replace(/-/g, '');
    // 0x + hex + zero-padding (총 64자)
    return '0x' + hex.padEnd(64, '0');
}

function bytes32ToUuid(bytes32: string, prefix: string = ''): string {
    // 0x 제거 후 상위 32자(16바이트) 추출
    const hex = bytes32.slice(2, 34);
    // 하이픈 삽입 (8-4-4-4-12)
    const uuid = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
    return prefix ? `${prefix}_${uuid}` : uuid;
}
```

---

## SE 서명 Mock 모드

개발/테스트 환경에서 SE 칩 서명의 전체 플로우를 검증하기 위한 Mock 방식.

### 설계 원칙

- **bypass 없음**: `DeviceRegistry.verifySignature()` 호출은 항상 수행
- Mock 키가 실제 키와 **동일 경로**를 통과 — 운영 환경과 동일한 코드 경로 검증
- 테스트넷에서 Mock 키 → 메인넷에서 실제 SE 키로 교체 시 코드 변경 없음

### Mock 서명 생성 흐름

```
1. Setup 시: P-256 테스트 키페어 12쌍 생성 (CHARGER-001~012)
2. 공개키: DeviceRegistry.enrollChip(chargerId, publicKey, P256_SECP256R1)에 등록
3. 프라이빗 키: Oracle 서버 메모리 Map에 보관 (Mock 서명 생성용)
4. Oracle 세션 생성 시:
   a. msgHash = keccak256(abi.encodePacked(chargerId, energyKwh, startTimestamp, endTimestamp))
   b. 프라이빗 키로 P-256 서명 생성 (noble-curves 라이브러리)
   c. 서명을 seSignature 필드에 포함
5. ChargeTransaction.mint() → DeviceRegistry.verifySignature() → 검증 통과
```

### 서명 생성 코드 (DeviceRegistry.test.ts 패턴 재사용)

```typescript
// @noble/curves v2: p256 is in nist.js subpath
import { p256 } from '@noble/curves/nist.js';

// Setup에서 생성한 키페어
const privateKey = p256.utils.randomSecretKey();  // v2 API
const publicKey = p256.getPublicKey(privateKey, false).slice(1); // 64 bytes (uncompressed, 접두사 제거)

// 서명 생성
function signSessionData(
    chargerId: string,
    energyKwh: bigint,
    startTimestamp: bigint,
    endTimestamp: bigint,
    privateKey: Uint8Array
): Uint8Array {
    const msgHash = ethers.keccak256(
        ethers.solidityPacked(
            ['bytes32', 'uint256', 'uint256', 'uint256'],
            [chargerId, energyKwh, startTimestamp, endTimestamp]
        )
    );
    // v2: sign() returns 64-byte compact (r||s) — DeviceRegistry._verifyP256 호환
    return p256.sign(getBytes(msgHash), privateKey);
}
```

---

## Bridge 호출 흐름 (invoice.paid 트리거)

```
STRIKON → invoice.paid 이벤트 발생
  └─→ Blockchain Bridge (AWS KMS 서명)
        └─→ ChargeRouter.processCharge(session, period_yyyyMM)
              ├─→ 1. ChargeTransaction.mint(session)
              │       ├─ require(!DuplicateSession)
              │       ├─ StationRegistry.isRegistered(stationId) 검증
              │       ├─ DeviceRegistry.verifySignature() 검증
              │       ├─ ERC-721 _mint(address(this), tokenId) — Soulbound
              │       └─ emit ChargeSessionRecorded
              └─→ 2. RevenueTracker.recordRevenue(
                        session.stationId,
                        session.distributableKrw,
                        period_yyyyMM
                      )
                      ├─ StationRegistry.isRegistered(stationId) 검증
                      ├─ require(distributableKrw > 0)
                      ├─ stationAccumulated 업데이트
                      ├─ monthlyHistory 업데이트
                      └─ emit RevenueRecorded
```

> **원자성**: ChargeRouter가 두 호출을 단일 트랜잭션으로 실행. 하나라도 실패하면 전체 revert.

### invoice.paid 페이로드 → ChargeSession struct 매핑

| invoice.paid 페이로드 | ChargeSession struct | 비고 |
|:---|:---|:---|
| `charging.energy_delivered_kwh` | `energyKwh` (uint256) | ×100 스케일링 (6.780 kWh → 678) |
| `charging.charging_started_at` | `startTimestamp` (uint256) | ISO 8601 → Unix timestamp |
| `charging.charging_stopped_at` | `endTimestamp` (uint256) | ISO 8601 → Unix timestamp |
| `charger_id` (UUID) | `chargerId` (bytes32) | UUID → bytes32 변환 (접두사 제거 + 하이픈 제거) |
| `station_id` (UUID) | `stationId` (bytes32) | UUID → bytes32 변환 |
| `region_id` (ISO 3166-2:KR) | `gridRegionCode` (bytes4) | 탄소 EFkw 조회용. STO 귀속과 무관. |
| `cpo_id` (UUID) | `cpoId` (bytes32) | UUID → bytes32 변환 |
| `session_id` (UUID) | `sessionId` (bytes32) | 멱등성 키. invoice_id와 1:1 대응. |
| `StationRegistry.getCharger(chargerId)` | `chargerType` (uint8) | Bridge가 온체인 조회. |
| (현재 항상 UNKNOWN(0)) | `vehicleCategory` (uint8) | OCPP 2.0.1 전환 시 실제 값 활성화 예정. |
| `amount.distributable_krw` | `distributableKrw` (uint256) | STRIKON 수수료 차감 후 금액 |
| `se_signature` | `seSignature` (bytes) | STRIKON invoice.paid에 추가 예정 (Bookend 필수). 현재 미제공. |
| (Bridge 오프체인 계산) | — | `period_yyyyMM` (uint256) — ChargeRouter.processCharge() 파라미터로 전달 |

> **수익 인식 기준시점**: `invoice.paid` 이벤트 처리 시각(= `block.timestamp`). `endTimestamp`(충전 종료시각)이나 `pg_paid_at`(결제 확정시각)이 아님.

> **sessionId ↔ invoiceId**: `sessionId`가 온체인 멱등성 키. `invoice_id`와 1:1 대응. 동일 `sessionId` 중복 `mint()` 시 revert(`DuplicateSession`).

> **period_yyyyMM**: Bridge가 `invoice.paid`의 `charging.charging_stopped_at` 시점을 기준으로 오프체인에서 계산 (예: 2026-06-15T14:35:00Z → 202606). 온체인에서는 이 값을 그대로 저장.

### gridRegionCode vs StationRegistry.regionId

`gridRegionCode`와 `StationRegistry.regionId`는 동일한 ISO 3166-2:KR 포맷을 사용하지만 목적이 다름:

- **`gridRegionCode`**: CPO/EnergyFi 소유 불문 모든 세션에 기록. Phase 4 탄소 EFkw(전력 배출 계수) 조회용.
- **`StationRegistry.regionId`**: EnergyFi 소유 충전소에만 의미 있음. STO 수익 풀 귀속 지역 결정.
  CPO 충전소는 `regionId = bytes4(0)` 허용.

---

## 배포 순서

Phase 1 완료 후 아래 순서로 배포:

```
1. ChargeTransaction Implementation 배포
2. ChargeTransaction Proxy 배포 (ERC1967Proxy)
3. RevenueTracker Implementation 배포
4. RevenueTracker Proxy 배포 (ERC1967Proxy)
5. ChargeRouter Implementation 배포
6. ChargeRouter Proxy 배포 (ERC1967Proxy)
7. ChargeTransaction.initialize(deviceRegistry, stationRegistry, chargeRouterProxy, admin)
8. RevenueTracker.initialize(stationRegistry, chargeRouterProxy, admin)
9. ChargeRouter.initialize(chargeTransactionProxy, revenueTrackerProxy, bridgeWallet, admin)
```

> **bridgeAddress 설정 주의**: ChargeTransaction과 RevenueTracker의 bridgeAddress = **ChargeRouter Proxy 주소**. ChargeRouter의 bridgeAddress = **AWS KMS Bridge 지갑 주소**.

---

## Mock Oracle 서버 (Express 라우터)

Phase 1 Express 서버(`scripts/dashboard/web/server.ts`)를 확장하여 Phase 2 Oracle 기능을 제공. Phase 1의 `buildOracleRouter(ctx)` 패턴을 따르되, Phase 2 컨트랙트 + P-256 서명 지원 추가.

> **구현 현황**: Phase 2 라우터(`routes/phase2-oracle.ts`, `routes/phase2-query.ts`)와 SSE(`routes/events.ts`)는 Phase 1 대시보드 고도화 시 scaffold 완료. Phase 2 컨트랙트 미배포 시 503 반환하는 graceful degradation 구현됨.

### Phase 2 Setup (`POST /oracle/phase2/setup`)

Phase 2 환경 초기화. Phase 1 데이터 존재 확인 → P-256 키 재등록 → Phase 2 컨트랙트 연결.

- Phase 1 데이터 존재 확인 (없으면 Phase 1 setup 먼저 실행 안내)
- Phase 2 컨트랙트(ChargeRouter, ChargeTransaction, RevenueTracker) 연결 확인
- SE 칩 12개(CHARGER-001~012)를 P-256으로 재등록 (Phase 1 secp256k1 → P-256 전환)
  - 기존 Phase 1 secp256k1 칩 비활성화 (`deactivateChip`)
  - P-256 키페어 생성 후 재등록 (`enrollChip(cid, publicKey, 1)`)
  - CHARGER-013~015는 의도적 SE칩 미등록 (gap 테스트용)
- P-256 프라이빗 키를 서버 메모리 Map에 보관 (세션 서명 생성용)

### Phase 2 Oracle 라우터 (`routes/phase2-oracle.ts`)

| 메뉴 | HTTP Method | Endpoint | 설명 |
|:--|:--|:--|:--|
| 1 | POST | `/oracle/phase2/session` | 모의 세션 단건 발생 |
| 2 | POST | `/oracle/phase2/session/bulk` | 모의 세션 대량 발생 (body: `{ count, stationId? }`) |
| 3 | POST | `/oracle/phase2/claim` | CPO 월정산 (body: `{ cpoId, period }`) |
| 8a | POST | `/oracle/phase2/test/bad-signature` | SE 서명 불일치 → revert 확인 |
| 8b | POST | `/oracle/phase2/test/unregistered-charger` | 미등록 chargerId → revert |
| 8c | POST | `/oracle/phase2/test/duplicate-session` | 중복 sessionId → revert |
| 8d | POST | `/oracle/phase2/test/unauthorized` | Bridge 아닌 주소 → revert |
| 8e | POST | `/oracle/phase2/test/unregistered-station` | 미등록 stationId → revert |
| 8f | POST | `/oracle/phase2/test/zero-amount` | 금액 0원 → revert |
| 9 | POST | `/oracle/phase2/test/month-boundary` | 월경계 테스트 |
| Setup | POST | `/oracle/phase2/setup` | Phase 2 환경 초기화 |

### 세션 생성 로직 상세

```typescript
async function generateSession(ctx, stationId: string): Promise<{session, period}> {
    // 1. 해당 충전소의 충전기 목록에서 랜덤 선택
    // 2. 랜덤 에너지: 5 ~ 80 kWh (×100 → 500 ~ 8000)
    // 3. 랜덤 금액: kWh × 200 ~ 400 KRW
    // 4. startTimestamp: now - 랜덤(30분~3시간)
    // 5. endTimestamp: now
    // 6. SE 서명: Setup에서 등록한 키페어의 프라이빗 키로 P-256 서명 생성
    // 7. UUID 생성 → bytes32 변환
    // 8. period_yyyyMM: endTimestamp 기준 오프체인 계산
}
```

### SE 서명 생성 로직

```typescript
// @noble/curves v2: p256 is in nist.js subpath
import { p256 } from '@noble/curves/nist.js';

// 서버 메모리 Map: chargerId(bytes32) → { publicKey, privateKey }
const chipKeyPairs: Map<string, { publicKey: Uint8Array, privateKey: Uint8Array }> = new Map();

// Setup: p256.utils.randomSecretKey() (v2 API)
const privateKey = p256.utils.randomSecretKey();
const publicKey = p256.getPublicKey(privateKey, false).slice(1); // 64 bytes

function generateMockSignature(
    chargerId: string,
    energyKwh: bigint,
    startTimestamp: bigint,
    endTimestamp: bigint
): Uint8Array {
    const keyPair = chipKeyPairs.get(chargerId);
    if (!keyPair) throw new Error(`No key pair for charger: ${chargerId}`);

    const msgHash = ethers.keccak256(
        ethers.solidityPacked(
            ['bytes32', 'uint256', 'uint256', 'uint256'],
            [chargerId, energyKwh, startTimestamp, endTimestamp]
        )
    );

    // v2: sign() returns 64-byte compact (r||s) — DeviceRegistry._verifyP256 호환
    return p256.sign(getBytes(msgHash), keyPair.privateKey);
}
```

---

## 대시보드 (6-탭, Express + SSE)

**스택**: Phase 1 Express 서버 확장. SSE(Server-Sent Events)로 실시간 온체인 이벤트 스트림 제공. 추가 의존성 없음.

> **구현 현황**: 6-탭 UI 프레임워크, SSE 브로드캐스트, Phase 2 라우터 scaffold, graceful degradation은 Phase 1 대시보드 고도화 시 완료. Phase 2 컨트랙트 배포 후 탭 3~5가 자동 활성화됨.

### 탭 구성 (6탭)

| # | 탭 이름 | 출처 | 설명 |
|:--|:--|:--|:--|
| 1 | 인프라 현황 | Phase 1 | 지역별 충전소 + CPO 목록 + SE 칩 상태 |
| 2 | Oracle Phase 1 | Phase 1 | CPO/충전소/충전기/SE칩 등록 + 전체 배치 |
| 3 | 실시간 충전 피드 | Phase 1 scaffold, **Phase 2 활성화** | SSE 기반 실시간 세션 피드 + 최근 N건 |
| 4 | 수익 현황 | Phase 1 scaffold, **Phase 2 활성화** | 충전소별·CPO별·지역별·월별 수익 통계 |
| 5 | Oracle Phase 2 | Phase 1 scaffold, **Phase 2 활성화** | 세션 생성, 정산, 실패 테스트 |
| 6 | 통합 테스트 | Phase 1 | SSE 스트리밍 검증 (23개 Phase 1 테스트) |

### SSE 구현 (`routes/events.ts`) — Phase 1에서 구현 완료

```
GET /events — SSE 스트림
  이벤트 타입:
    1. session    — ChargeTransaction.ChargeSessionRecorded 이벤트
    2. revenue    — RevenueTracker.RevenueRecorded 이벤트
    3. settlement — RevenueTracker.SettlementRecorded 이벤트
    4. claim      — RevenueTracker.CPOClaimed 이벤트
    5. connected  — 초기 연결 확인 (phase2: boolean 포함)
```

- `sseClients: Set<Response>` — 연결된 클라이언트 관리
- 서버 시작 시 온체인 이벤트 리스너 등록 (ethers v6 `contract.on()`)
- Phase 2 컨트랙트 미배포 시 이벤트 리스너 비활성화 (`setupEventListeners` 조건부)
- 이벤트 발생 → 모든 SSE 클라이언트에 broadcast
- 클라이언트 disconnect → Set에서 제거
- 브라우저 EventSource 자동 재연결 (3초 기본값)

### Phase 2 Query 라우터 (`routes/phase2-query.ts`)

| Endpoint | 설명 | 데이터 소스 |
|:--|:--|:--|
| GET `/query/phase2/sessions/recent?limit=20` | 최근 세션 목록 | ChargeSessionRecorded 이벤트 쿼리 |
| GET `/query/phase2/session/:tokenId` | 세션 상세 | `ChargeTransaction.getSession()` |
| GET `/query/phase2/station-revenue` | 전체 충전소 수익 | `RevenueTracker.getStationRevenue()` × all stations |
| GET `/query/phase2/cpo-revenue` | CPO별 수익 | `RevenueTracker.getCPORevenue()` |
| GET `/query/phase2/region-revenue` | EnergyFi 지역별 수익 | `RevenueTracker.getEnergyFiRegionRevenue()` |
| GET `/query/phase2/monthly?period=202606` | 월별 통계 | `getStationRevenuePeriod()` × all stations |
| GET `/query/phase2/settlements/:stationId` | 정산 이력 | `RevenueTracker.getSettlementHistory()` |
| GET `/query/phase2/token-info` | ERC-721 토큰 정보 | `totalSessions()`, `balanceOf()` |

### Graceful Degradation — Phase 1에서 구현 완료

Phase 2 컨트랙트가 `deployments.json`에 없으면 graceful하게 null 처리. 탭 3~5는 Phase 2 컨트랙트 미배포 시 "Phase 2 컨트랙트 미배포" placeholder 표시.

- `server.ts`: Phase 2 ABI 미발견 시 `⚠️ Phase 2 ABI 미발견` 경고만 표시, 서버 정상 기동
- `ContractCtx`: `chargeTransaction?`, `revenueTracker?`, `chargeRouter?` optional 필드
- Phase 2 라우터 미들웨어: 컨트랙트 없으면 503 반환
- 클라이언트: `updatePhase2Visibility()` 함수로 placeholder/content 전환

### 탭 3: 실시간 충전 피드

SSE 연결, 새 세션 발생 시 테이블 상단에 자동 추가 (fade-in 애니메이션). 초기 로드 시 최근 20건 표시. 세션 클릭 시 모달로 상세 표시 (기존 화면 7).

#### 화면 1: 실시간 충전 피드

```
┌─────────────────────────────────────────────────────────────────┐
│  최근 충전 세션 (실시간)                                          │
│                                                                 │
│  시간           충전소          kWh    금액(원)  소유          │
│  14:23:01  STATION-003 (서울)  45.2   13,560  EnergyFi  ✅    │
│  14:19:45  STATION-001 (서울)  22.8    6,840  CPO       ✅    │
│  14:15:30  STATION-005 (경기)  61.0   18,300  EnergyFi  ✅    │
│  14:10:12  STATION-004 (서울)  38.5   11,550  EnergyFi  ✅    │
│  14:08:55  STATION-002 (부산)  19.0    5,700  CPO       ✅    │
└─────────────────────────────────────────────────────────────────┘
```

### 탭 4: 수익 현황

기존 화면 2~6을 통합한 대시보드 형태.

#### 화면 2: 충전소별 수익 현황

```
┌─────────────────────────────────────────────────────────────────┐
│  충전소별 수익 현황                                               │
│                                                                 │
│  충전소          소유     누적(원)    정산(원)    대기(원)       │
│  STATION-001    CPO     125,400    125,400         0          │
│  STATION-002    CPO      87,600     87,600         0          │
│  STATION-003    EFI     342,000    300,000     42,000         │
│  STATION-004    EFI     198,500    150,000     48,500         │
│  STATION-005    EFI     445,200    400,000     45,200         │
└─────────────────────────────────────────────────────────────────┘
```

#### 화면 3: CPO 수익 통계

```
┌─────────────────────────────────────────────────────────────────┐
│  CPO 수익 통계                                                   │
│                                                                 │
│  삼성EV (CPO-001)   이번 달: 45,600원  전달: 125,400원          │
│  현대충전 (CPO-002)  이번 달: 32,100원  전달:  87,600원          │
└─────────────────────────────────────────────────────────────────┘
```

#### 화면 4: 월별 통계

```
┌─────────────────────────────────────────────────────────────────┐
│  기간: [2026년 6월 ▼]                                           │
│                                                                 │
│  총 세션 수:   1,248건                                           │
│  총 에너지:    34,890 kWh                                        │
│  총 수익(원):  10,467,000원                                      │
│                                                                 │
│  EnergyFi 소유: 8,523,000원 (81.4%)                             │
│  CPO 소유:      1,944,000원 (18.6%)                             │
└─────────────────────────────────────────────────────────────────┘
```

#### 화면 5: 정산 이력

```
┌─────────────────────────────────────────────────────────────────┐
│  정산 이력                                                       │
│                                                                 │
│  충전소        CPO           기간      금액(원)    정산일시       │
│  STATION-001  삼성EV(CPO-001)  202603  125,400  2026-04-01 10:00│
│  STATION-002  현대충전(CPO-002) 202603   87,600  2026-04-01 10:05│
│  STATION-003  EnergyFi        202603  342,000  2026-04-01 11:00│
│  ...                                                            │
│                                                                 │
│  데이터 소스: RevenueTracker.getSettlementHistory(stationId)     │
└─────────────────────────────────────────────────────────────────┘
```

#### 화면 6: EnergyFi 지역 수익

```
┌─────────────────────────────────────────────────────────────────┐
│  EnergyFi 지역별 수익 (STO 투자자 풀)                             │
│                                                                 │
│  지역      충전소 수    누적(원)     대기(원)                      │
│  서울(KR11)    2      540,500     90,500                        │
│  경기(KR41)    1      445,200     45,200                        │
│  전체          3      985,700    135,700                        │
│                                                                 │
│  데이터 소스: RevenueTracker.getEnergyFiRegionRevenue(regionId)  │
└─────────────────────────────────────────────────────────────────┘
```

### 탭 5: Oracle Phase 2

Phase 1 Oracle 탭(탭 2)과 동일한 형태. 세션 생성(단건/대량), 정산 처리, 실패 시나리오 테스트(6개), 월경계 테스트, Phase 2 Setup 버튼, 로그 패널(Phase 1 형태 재사용).

### 탭 6: 통합 테스트 (Phase 1 구현 완료)

SSE 스트리밍 기반 자동화 검증. Phase 1에서 23개 테스트(6 STEP) 구현. Phase 2 배포 후 Phase 2 검증 STEP 추가 예정.

#### 화면 7: 세션 상세 조회 (모달)

```
┌─────────────────────────────────────────────────────────────────┐
│  세션 상세 (Token #42)                                          │
│                                                                 │
│  Session ID:      0xa1b2c3d4e5f6...                             │
│  Charger ID:      0x9f8e7d6c5b4a...                             │
│  Station ID:      0x1a2b3c4d5e6f...                             │
│  CPO ID:          0xf1e2d3c4b5a6...                             │
│  Charger Type:    L2                                            │
│  Energy:          45.20 kWh                                     │
│  Duration:        14:23:01 ~ 15:35:22 (1h 12m)                 │
│  Grid Region:     KR11 (서울)                                   │
│  Amount:          13,560원                                      │
│  Vehicle:         UNKNOWN                                       │
│  SE Signature:    0x3045022100... (Verified ✅)                 │
│  Soulbound:       Yes (Non-transferable)                        │
│                                                                 │
│  데이터 소스: ChargeTransaction.getSession(tokenId)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 통합 테스트 체크리스트

> **통합 검증 패턴**: Phase 1에서 `routes/verify.ts`로 SSE 스트리밍 기반 23개 테스트를 실행하는 패턴이 확립됨 (탭 6: 통합 테스트). Phase 2 통합 검증도 동일 패턴으로 확장 예정 (`routes/phase2-verify.ts`). 아래 체크리스트 항목을 SSE 스트리밍 STEP으로 자동화.

### ChargeTransaction

- [ ] 유효한 SE 서명 포함 세션 mint() 성공 확인
- [ ] SE 서명 검증 실패 세션 mint() revert 확인
- [ ] 미등록 chargerId mint() revert 확인
- [ ] 동일 sessionId 중복 mint() revert 확인 (`DuplicateSession`)
- [ ] 미등록 stationId mint() revert 확인 (`StationNotRegistered`)
- [ ] `getSession(tokenId)` 저장된 값 정확성 확인
- [ ] `getTokenIdBySessionId(sessionId)` 정확성 확인
- [ ] `onlyBridge` 권한 테스트 → 다른 주소 revert 확인
- [ ] ERC-721 표준 준수 확인 (ownerOf, balanceOf)
- [ ] Soulbound 검증: `transfer()` / `transferFrom()` 호출 시 `SoulboundToken` revert 확인
- [ ] `tokenURI()` 빈 문자열 반환 확인
- [ ] `totalSessions()` 정확성 확인
- [ ] UUPS upgrade 권한 테스트 (DEFAULT_ADMIN_ROLE만 업그레이드 가능)
- [ ] UUPS upgrade 비인가 주소 시도 → revert 확인
- [ ] UUID → bytes32 인코딩 정확성 확인 (변환 후 역변환 일치)

### RevenueTracker

- [ ] 모의 세션 100건 생성 후 `stationAccumulated` 합계 정확성 검증
- [ ] CPO 소유 vs EnergyFi 소유 충전소 수익 분리 확인
- [ ] `claim(cpoId, period_yyyyMM)` 후 각 충전소 pending = 0 검증 (전액 정산 확인)
- [ ] `claim()` 재호출 시 `NothingToClaim` revert 확인
- [ ] `CPOHasNoStations` revert — 미등록 cpoId 호출 시 확인
- [ ] `SettlementRecorded` 이벤트 충전소 수만큼 emit 확인
- [ ] `CPOClaimed` 이벤트 totalAmount = 모든 충전소 pending 합산 값 확인
- [ ] `getStationRevenuePeriod()` 월별 통계 쿼리 정확성 검증
- [ ] `getCPORevenue()` StationRegistry 연동 확인
- [ ] `getEnergyFiRegionRevenue()` StationRegistry 연동 확인
- [ ] `onlyBridge` 권한 테스트 → 다른 주소 revert 확인
- [ ] `onlyAdmin` 정산 권한 테스트 → `claim()` 다른 주소 호출 시 revert 확인
- [ ] `distributableKrw = 0` → `ZeroAmount` revert 확인
- [ ] 미등록 stationId → `StationNotRegistered` revert 확인
- [ ] `period_yyyyMM` 파라미터 정확성 확인 (Bridge 전달값 그대로 저장)
- [ ] UUPS upgrade 권한 테스트 (DEFAULT_ADMIN_ROLE만 업그레이드 가능)

### ChargeRouter

- [ ] `processCharge()` 호출 시 mint + recordRevenue 모두 성공 확인
- [ ] `processCharge()` 중 mint 실패 시 recordRevenue도 revert (원자성)
- [ ] `processCharge()` 중 recordRevenue 실패 시 mint도 revert (원자성)
- [ ] `onlyBridge` 권한 테스트 → Bridge 아닌 주소 revert 확인
- [ ] `ChargeProcessed` 이벤트 emit 확인
- [ ] UUPS upgrade 권한 테스트

### ChargeTransaction ↔ RevenueTracker 연동 (ChargeRouter 경유)

- [ ] processCharge() 호출 후 ChargeTransaction에 토큰 생성 + RevenueTracker에 수익 누적 동시 확인
- [ ] 100건 대량 처리 후 양쪽 데이터 정합성 검증

### Mock Oracle 커버리지 매핑

Oracle 메뉴가 체크리스트의 모든 항목을 커버하는지 검증:

| Oracle 메뉴 | 체크리스트 항목 |
|:--|:--|
| 1-2. 모의 세션 발생 | ChargeTransaction: mint 성공, getSession, totalSessions |
| 3. CPO 월정산 | RevenueTracker: claim, SettlementRecorded, CPOClaimed |
| 4. 충전소별 수익 | RevenueTracker: getStationRevenue, getStationRevenuePeriod |
| 5. EnergyFi 지역 수익 | RevenueTracker: getEnergyFiRegionRevenue |
| 6. 세션 상세 | ChargeTransaction: getSession, getTokenIdBySessionId |
| 7. 정산 이력 | RevenueTracker: getSettlementHistory |
| 8a. SE 서명 불일치 | ChargeTransaction: SE 서명 검증 실패 revert |
| 8b. 미등록 chargerId | ChargeTransaction: 미등록 chargerId revert |
| 8c. 중복 sessionId | ChargeTransaction: DuplicateSession revert |
| 8d. 비인가 호출자 | ChargeRouter/ChargeTransaction/RevenueTracker: onlyBridge revert |
| 8e. 미등록 stationId | ChargeTransaction/RevenueTracker: StationNotRegistered revert |
| 8f. 0원 세션 | RevenueTracker: ZeroAmount revert |
| 9. 월경계 테스트 | RevenueTracker: period_yyyyMM 정확성 |
| 10. ERC-721 정보 | ChargeTransaction: Soulbound, ownerOf, balanceOf, tokenURI |

### 대시보드 커버리지 매핑

7개 화면이 ChargeTransaction과 RevenueTracker의 모든 public view 함수를 커버하는지 검증:

| View 함수 | 대시보드 탭/화면 |
|:--|:--|
| `ChargeTransaction.getSession()` | 탭 3 (실시간 피드), 세션 상세 모달 |
| `ChargeTransaction.getTokenIdBySessionId()` | 세션 상세 모달 |
| `ChargeTransaction.totalSessions()` | 탭 4 (수익 현황 - 월별 통계) |
| `RevenueTracker.getStationRevenue()` | 탭 4 (충전소별 수익) |
| `RevenueTracker.getStationRevenuePeriod()` | 탭 4 (월별 통계) |
| `RevenueTracker.getCPORevenue()` | 탭 4 (CPO 수익 통계) |
| `RevenueTracker.getEnergyFiRegionRevenue()` | 탭 4 (지역 수익) |
| `RevenueTracker.getSettlementHistory()` | 탭 4 (정산 이력) |

---

## 대시보드 파일 구조

```
scripts/dashboard/
├── phase1-dashboard.ts              # CLI-only ASCII 대시보드 (3화면)
└── web/                             # Express 웹 대시보드
    ├── server.ts                    # Express 앱 + ContractCtx 초기화
    ├── public/
    │   ├── index.html               # 6-탭 UI
    │   ├── style.css                # 다크 테마
    │   └── app.js                   # 클라이언트 JavaScript
    ├── lib/
    │   └── utils.ts                 # UUID↔bytes32, 포맷팅, period 계산
    └── routes/
        ├── query.ts                 # Phase 1 GET (지역 조회, CPO 목록)
        ├── oracle.ts                # Phase 1 POST (등록 + 배치)
        ├── phase2-query.ts          # Phase 2 GET (세션, 수익, 정산)
        ├── phase2-oracle.ts         # Phase 2 POST (세션 생성, P-256)
        ├── events.ts                # SSE 브로드캐스트
        └── verify.ts                # Phase 1 통합 검증 (23개 테스트)
```

---

## 참조 문서

| 문서 | 경로 |
|:--|:--|
| Implementation Roadmap | [implementation-roadmap.md](implementation-roadmap.md) |
| Phase 1 스펙 | [phase1-infra-spec.md](phase1-infra-spec.md) |
| Phase 3 스펙 | [phase3-sto-spec.md](phase3-sto-spec.md) |
| Interface Spec | [../../docs/strikon-interface-spec.md](../../docs/strikon-interface-spec.md) |

---

*End of Document*
