# Phase 1: 충전 인프라 스마트 컨트랙트 스펙

## EnergyFi — DeviceRegistry + StationRegistry 구현 가이드

2026.03.03 | Ver 1.1

---

## 목표

충전기 SE 칩 공개키 등록, 충전소·충전기 계층 구조 온체인 확립. 모든 온체인 충전소는 EnergyFi 소유이며, Phase 2 수익 귀속의 기반 데이터를 구축한다. 제3자 CPO는 STRIKON 소프트웨어만 사용하며 온체인에 등록되지 않는다.

**타임라인**: Now ~ 2026.04

---

## 컨트랙트

### DeviceRegistry (구현 완료)

**목적**: TPM 2.0 SE 칩 공개키(P-256, 64 bytes)를 chargerId에 바인딩. Phase 2 ChargeTransaction.mint()에서 모든 SE 서명을 검증하는 Root of Trust.

**현재 구현 상태**: `contracts/contracts/DeviceRegistry.sol` 배포 완료.

#### ChipRecord struct

```solidity
enum SignatureAlgorithm { SECP256K1, P256_SECP256R1 }

struct ChipRecord {
    bytes     publicKey;       // 64 bytes: uncompressed key (x || y)
    bytes32   publicKeyHash;   // keccak256(publicKey) — reverse lookup용
    SignatureAlgorithm algorithm;
    uint256   enrolledAt;      // block.timestamp at enrollment
    bool      active;
}
```

#### Key Functions

```solidity
// Admin 전용
enrollChip(bytes32 chargerId, bytes calldata publicKey, SignatureAlgorithm algorithm)
  — onlyRole(ADMIN_ROLE)
  // 효과: ChipRecord 저장, 충전기 출하 전에 호출

revokeChip(bytes32 chargerId)
  — onlyRole(ADMIN_ROLE)
  // 효과: active = false. 이후 verifySignature() 호출 시 revert.

// View 함수
isActiveChip(bytes32 chargerId) → bool
verifySignature(bytes32 chargerId, bytes32 msgHash, bytes calldata sig) → bool
  // P-256: RIP-7212 precompile(0x100) 사용
  // secp256k1: ecrecover() fallback
getChipRecord(bytes32 chargerId) → ChipRecord memory
getChargerByPubkey(bytes32 pubkeyHash) → bytes32 chargerId  // reverse lookup
```

#### SE 칩 서명 메시지 형식

```
msgHash = keccak256(abi.encodePacked(chargerId, energyKwh, startTimestamp, endTimestamp))
```

Phase 2 ChargeTransaction이 동일 형식으로 msgHash를 재구성하여 검증한다.

#### 외부 의존성

- **RIP-7212 precompile** (`address(0x100)`): P-256 서명 검증에 필요. `l1-config/genesis.json` 활성화 필요 (별도 승인 필요 — CLAUDE.md §5 §4).

---

### StationRegistry (신규 설계)

**목적**: Station → Charger 계층 구조 관리. 모든 온체인 충전소는 EnergyFi 소유이며, regionId를 통해 Phase 2 수익 귀속 및 Phase 3 STO 지역 매핑의 근거 데이터를 제공한다. 제3자 CPO는 STRIKON 플랫폼에서 오프체인으로만 관리된다.

#### 수익 귀속 모델

```
온체인 충전소 (모두 EnergyFi 소유):
  → distributableKrw 100% → 해당 지역 STO 투자자 풀
  → regionId: 필수. STO 수익 풀 결정 기준.
  → Phase 3 STO 발행 대상

CPO 소유 충전소:
  → 온체인에 등록되지 않음
  → STRIKON 오프체인에서 별도 정산
```

#### Structs

```solidity
struct Station {
    bytes32   stationId;
    bytes4    regionId;   // ISO 3166-2:KR bytes4 인코딩 (예: 0x4B523131 = "KR11" = 서울)
                         // 필수 (bytes4(0) 허용 안 됨) — STO 수익 풀 결정 기준
    string    location;      // 주소 또는 좌표
    bool      active;
}

struct Charger {
    bytes32 chargerId;
    bytes32 stationId;
    uint8   chargerType;     // 0: L1, 1: L2, 2: DCFC
    bool    active;
}
```

> **참고**: `OwnerType` enum과 `CPORecord` struct는 제거됨. 모든 온체인 충전소는 EnergyFi 소유. CPO는 STRIKON 오프체인에서만 관리.

#### regionId 인코딩 규칙

```
ISO 3166-2:KR 코드("KR-11") → 대시 제거 → "KR11" → ASCII bytes4
예: "KR11" → 0x4B523131, "KR26" → 0x4B523236
Bridge, 관리 도구, 테스트 스크립트 모두 동일 규칙 적용.
```

#### Key Functions

```solidity
// Station 관리 (onlyAdmin)
registerStation(
    bytes32   stationId,
    bytes4    regionId,      // 필수 (STO 수익 풀 + 탄소 EFkw)
    string calldata location
)
  // require: regionId != bytes4(0), "RegionRequired"
deactivateStation(bytes32 stationId)
  // require: 소속 active 충전기 없음 ("HasActiveChargers")
  // 효과: Station.active = false
getStation(bytes32 stationId) → Station memory

// Charger 관리 (onlyAdmin)
registerCharger(bytes32 chargerId, bytes32 stationId, uint8 chargerType)
  // require: chargerType <= 2 ("InvalidChargerType")
  //   0: L1, 1: L2, 2: DCFC
deactivateCharger(bytes32 chargerId)
getCharger(bytes32 chargerId) → Charger memory

// 조회 (view)
getStationsByRegion(bytes4 regionId) → bytes32[] stationIds
  // Phase 3 STOPortfolio / RevenueTracker.getRegionRevenue()에서 사용
getChargersByStation(bytes32 stationId) → bytes32[] chargerIds
isRegistered(bytes32 stationId) → bool
```

#### 이벤트

```solidity
event StationRegistered(bytes32 indexed stationId, bytes4 regionId);
event ChargerRegistered(bytes32 indexed chargerId, bytes32 indexed stationId, uint8 chargerType);
event StationDeactivated(bytes32 indexed stationId);
```

#### 배포 순서

1. DeviceRegistry 배포 (선행 — Phase 2 ChargeTransaction 배포 전 주소 확보용)
2. StationRegistry 배포
3. 충전소 등록 (`registerStation` — regionId 필수)
4. 충전기 등록 (`registerCharger`)
5. DeviceRegistry에 SE 칩 등록 (`enrollChip` — 충전기 출하 전)
6. Phase 2 ChargeTransaction 배포 시 DeviceRegistry 주소 전달

---

## 웹 대시보드

### 스택

| 구성 | 기술 |
|:---|:---|
| 백엔드 | Express.js + ethers.js v6 (Node.js 24) |
| 프론트엔드 | HTML + Vanilla JS (빌드 도구 없음) |
| 컨트랙트 접근 | 서버 측 ethers.js (배포자 키는 .env에서 로드, 브라우저 노출 없음) |
| 실행 | `npm run dashboard:web:testnet` → http://localhost:3000 |

**설계 이유**: 배포자 프라이빗 키가 서버에서만 사용됨. 브라우저는 로컬 Express API를 호출할 뿐. 지갑 연결(MetaMask 등) 불필요. 개발 도구 목적에 적합한 최소 스택.

### 파일 구조

```
contracts/scripts/dashboard/
├── phase1-dashboard.ts          # 기존 CLI (유지 — CI/자동화용)
└── web/
    ├── server.ts                # Express API 서버
    ├── public/
    │   ├── index.html           # 단일 페이지 대시보드
    │   ├── app.js               # 클라이언트 JS (fetch → 로컬 API)
    │   └── style.css
    └── routes/
        ├── query.ts             # GET: 온체인 조회 (지역별/CPO별/SE칩 현황)
        └── oracle.ts            # POST: 데이터 등록 (CPO/충전소/충전기/SE칩)
```

CLI 대시보드(`phase1-dashboard.ts`)는 삭제하지 않고 유지. CI 파이프라인에서 자동 검증용.

---

## 대시보드 화면 (웹)

### 탭 1: 인프라 현황

```
┌──────────────────────────────────────────────────────────────┐
│  EnergyFi Phase 1 Dashboard                        [새로고침] │
├──────────────────┬───────────────────────────────────────────┤
│  [인프라 현황]   │ [Oracle]                                   │
├──────────────────┴───────────────────────────────────────────┤
│  지역 선택: [서울(KR11) ▼]        SE 칩 현황                 │
│                                   등록 완료: 12대 ✅          │
│  충전소 목록 (서울, 총 3개)        미등록:    3대 ⚠️           │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ 충전소       지역    L2  DCFC  상태                   │     │
│  │ STATION-001  서울     2    1    ✅                    │     │
│  │ STATION-003  서울     2    2    ✅                    │     │
│  │ STATION-004  서울     1    0    ✅                    │     │
│  └─────────────────────────────────────────────────────┘     │
│  전체 충전소: 3개 (모두 STO 수익 대상)                        │
└──────────────────────────────────────────────────────────────┘
```

데이터 소스:
- `StationRegistry.getStationsByRegion(regionId)`
- `StationRegistry.getChargersByStation(stationId)`
- `DeviceRegistry.isActiveChip(chargerId)` (SE 칩 현황)

### 탭 2: Oracle Action Panel

```
┌──────────────────────────────────────────────────────────────┐
│  EnergyFi Phase 1 Dashboard                        [새로고침] │
├──────────────────┬───────────────────────────────────────────┤
│  [인프라 현황]   │ [Oracle]                                   │
│                  └───────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌─────────────────────────────┐   │
│  │ 충전소 등록          │  │ 충전기 등록                  │   │
│  │ ID:    [STATION-001] │  │ ID:    [CHARGER-001        ] │   │
│  │ 지역:  [서울(KR11)▼] │  │ 충전소:[STATION-001        ] │   │
│  │ 주소:  [강남구...  ] │  │ 타입:  [DCFC ▼]             │   │
│  │           [등록]     │  │           [등록]              │   │
│  └──────────────────────┘  └─────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────┐  ┌─────────────────────────────┐   │
│  │ SE 칩 등록           │  │                              │   │
│  │ 충전기: [CHARGER-001]│  │                              │   │
│  │ [등록 (키쌍 자동생성)]│  │                              │   │
│  └──────────────────────┘  └─────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  [전체 테스트 데이터 등록 (충전소×5, 충전기×15, SE칩×12)]     │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  로그                                                        │
│  ✅ STATION-003 (서울) 등록 완료                              │
│  ✅ CHARGER-001 (STATION-001) 등록 완료                       │
│  ⚠️ CHARGER-013~015 SE 칩 미등록 (Phase 2 테스트 목적)        │
└──────────────────────────────────────────────────────────────┘
```

버튼별 컨트랙트 호출:

| 버튼 | 호출 함수 | 서버 엔드포인트 |
|:---|:---|:---|
| 충전소 등록 | `StationRegistry.registerStation()` | `POST /oracle/station` |
| 충전기 등록 | `StationRegistry.registerCharger()` | `POST /oracle/charger` |
| SE 칩 등록 | `DeviceRegistry.enrollChip()` | `POST /oracle/chip` |
| 전체 등록 | 1~3 순차 실행 | `POST /oracle/all` |

---

## 통합 테스트 체크리스트

### DeviceRegistry

- [ ] SE 칩 등록 후 `isActiveChip()` true 반환 확인
- [ ] 등록된 공개키로 생성된 서명의 `verifySignature()` true 반환 확인
- [ ] 등록되지 않은 chargerId의 `verifySignature()` → false 반환 확인 (revert 아님 — ChargeTransaction이 반환값 체크 후 revert)
- [ ] `revokeChip()` 후 `verifySignature()` → false 반환 확인 (revert 아님)
- [ ] `getChargerByPubkey()` reverse lookup 정확성 확인
- [ ] ADMIN_ROLE 없는 주소의 `enrollChip()` → revert 확인

### StationRegistry

- [ ] 충전소 등록 후 `getStationsByRegion()` 검증
- [ ] 충전기 등록 후 `getChargersByStation()` 조회 확인
- [ ] `isRegistered()` 정확성 확인
- [ ] 권한 없는 주소의 `registerStation()` → revert 확인
- [ ] 비활성화된 충전소의 `registerCharger()` → revert 확인 (또는 warn)

### DeviceRegistry ↔ StationRegistry 연동

- [ ] StationRegistry에 등록된 chargerId와 DeviceRegistry 등록 chargerId 일치 확인
- [ ] 미등록 chargerId로 DeviceRegistry.enrollChip() 시도 시 경고 로직 확인 (선택)

---

## 테스트 커버리지 매핑

### Oracle Action → 체크리스트 매핑

| Oracle 버튼/기능 | 커버하는 체크리스트 항목 |
|:---|:---|
| 충전소 등록 | StationRegistry: `registerStation`, `getStationsByRegion()` 조회 |
| 충전소 등록 (regionId 없음) | StationRegistry: `RegionRequired` revert 확인 |
| 충전기 등록 | StationRegistry: `registerCharger`, `getChargersByStation()` 조회 |
| 충전기 등록 (비활성 충전소) | StationRegistry: `StationNotActive` revert 확인 |
| SE 칩 등록 | DeviceRegistry: `enrollChip`, `isActiveChip()` true 확인 |
| 전체 등록 | 위 전체 + `isRegistered()` 확인 |

### 대시보드 View → 체크리스트 매핑

| View 함수 | 대시보드 위치 |
|:---|:---|
| `StationRegistry.getStationsByRegion()` | 탭1 — 지역별 충전소 목록 |
| `StationRegistry.getChargersByStation()` | 탭1 — 충전기 타입별 카운트 |
| `DeviceRegistry.isActiveChip()` | 탭1 — SE 칩 등록/미등록 구분 |

---

## 참조 문서

| 문서 | 경로 |
|:--|:--|
| Implementation Roadmap | [implementation-roadmap.md](implementation-roadmap.md) |
| Phase 2 스펙 | [phase2-transaction-spec.md](phase2-transaction-spec.md) |

---

*End of Document*
