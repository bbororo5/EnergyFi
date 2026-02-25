# EnergyFi 스마트 컨트랙트 — Oracle 연동 가이드

> **대상**: STRIKON 플랫폼 개발자 (Blockchain Bridge 구현)
> **버전**: v1.0 — 2026.03
> **전제**: STRIKON `invoice.paid` 이벤트 → EnergyFi 온체인 기록 파이프라인

---

## 1. 로컬 환경 셋업

### 사전 요구사항

| 도구 | 버전 | 설치 |
|:---|:---|:---|
| Node.js | 24.x LTS | `nvm install 24 && nvm use 24` |
| npm | 11.x | Node.js 24에 포함 |
| Git | 최신 | — |

### 셋업 순서

```bash
# 1. 코드 클론
git clone <repo-url>
cd EnergyFi

# 2. .env 파일 생성 (프로젝트 루트)
cat > .env << 'EOF'
ENERGYFI_L1_LOCAL_RPC=http://127.0.0.1:8545
DEPLOYER_PRIVATE_KEY=REDACTED_TEST_PRIVATE_KEY
EOF
# ↑ 이 private key는 Hardhat 기본 Account #0 (테스트 전용, 실제 자금 없음)

# 3. 패키지 설치
cd contracts/l1
npm install

# 4. 터미널 A — 로컬 EVM 노드 실행 (계속 켜놓기)
npm run node
# → http://127.0.0.1:8545 에서 JSON-RPC 서버 실행
# → 테스트용 계정 20개 + private key 자동 출력됨 (각 10,000 ETH)
# → Account #0이 deployer (admin + bridge 역할)

# 5. 터미널 B — 컨트랙트 배포
npm run deploy:local
# → 5개 컨트랙트 프록시 배포
# → deployments.json 에 주소 저장됨
```

### 노드를 재시작하면?

로컬 노드는 메모리 기반입니다. 노드를 종료하면 모든 상태가 초기화됩니다.
→ `npm run node` 다시 실행 → `npm run deploy:local` 다시 실행

### 테스트 실행

```bash
npm run test    # 100+ 테스트 모두 통과해야 정상
```

---

## 2. 아키텍처 요약

```
STRIKON 플랫폼 (invoice.paid)
        │
        ▼
   Bridge Wallet ─── onlyBridge ───→ ChargeRouter.processCharge()
                                          │
                                ┌─────────┴─────────┐
                                ▼                     ▼
                    ChargeTransaction.mint()   RevenueTracker.recordRevenue()
                         │                           │
                    ┌────┴────┐                      │
                    ▼         ▼                      ▼
            DeviceRegistry  StationRegistry    StationRegistry
            (SE 서명 검증)    (충전소 조회)      (ownerType 조회)
```

### 5개 배포 컨트랙트

| # | 컨트랙트 | 역할 |
|:---|:---|:---|
| 1 | **DeviceRegistry** | SE 칩 공개키 등록 + 서명 검증 |
| 2 | **StationRegistry** | CPO → 충전소 → 충전기 계층 관리 |
| 3 | **ChargeTransaction** | 충전 세션을 ERC-721 Soulbound 토큰으로 기록 |
| 4 | **RevenueTracker** | 충전소별·월별 수익 누적 + CPO 정산 |
| 5 | **ChargeRouter** | **Bridge 진입점**. processCharge() 하나로 3+4 원자적 실행 |

### 핵심 규칙

- **ChargeRouter가 유일한 Bridge 진입점** — ChargeTransaction, RevenueTracker를 직접 호출하지 마세요.
- **원자성 보장** — processCharge()가 revert되면 mint()과 recordRevenue() 모두 롤백됩니다.
- **Admin과 Bridge는 별도 역할** — 배포 시 deployer가 둘 다 겸하지만, 프로덕션에서는 분리됩니다.

---

## 3. 데이터 등록 순서 (초기 셋업)

컨트랙트 배포 후, 충전 데이터를 기록하기 전에 아래 순서로 마스터 데이터를 등록해야 합니다.

```
Step 1: DeviceRegistry.enrollChip()    — SE 칩 공개키 등록
Step 2: StationRegistry.registerCPO()  — CPO(충전사업자) 등록
Step 3: StationRegistry.registerStation() — 충전소 등록 (CPO 또는 EnergyFi 소유)
Step 4: StationRegistry.registerCharger() — 충전기를 충전소에 연결
                                            (칩이 DeviceRegistry에 먼저 등록되어 있어야 함)
```

> 이 단계가 완료되면 `ChargeRouter.processCharge()` 호출이 가능해집니다.

---

## 4. 함수 레퍼런스

### 4.1 마스터 데이터 등록 (Admin 전용)

#### DeviceRegistry.enrollChip()

```solidity
function enrollChip(
    bytes32 chargerId,
    bytes calldata publicKey,       // 64 bytes (P-256 uncompressed x||y)
    SignatureAlgorithm algorithm     // 0 = P256, 1 = SECP256K1
) external onlyRole(ADMIN_ROLE)
```

| 파라미터 | 설명 |
|:---|:---|
| `chargerId` | 충전기 ID (bytes32). STRIKON의 `charger_id` UUID를 bytes32로 변환 |
| `publicKey` | SE 칩 공개키 64 bytes. TPM에서 추출한 P-256 uncompressed (04 prefix 제외) |
| `algorithm` | `0` = P-256 (프로덕션), `1` = secp256k1 (테스트 편의) |

**이벤트**: `ChipEnrolled(chargerId, pubkeyHash, algorithm)`

---

#### StationRegistry.registerCPO()

```solidity
function registerCPO(
    bytes32 cpoId,
    address walletAddress,
    string calldata name
) external onlyRole(ADMIN_ROLE)
```

---

#### StationRegistry.registerStation()

```solidity
function registerStation(
    bytes32   stationId,
    bytes32   cpoId,            // EnergyFi 소유면 bytes32(0)
    OwnerType ownerType,        // 0 = CPO, 1 = ENERGYFI
    bytes4    regionId,         // ISO 3166-2:KR, 예: bytes4("KR11")
    string calldata location
) external onlyRole(ADMIN_ROLE)
```

| ownerType | 의미 | 수익 귀속 |
|:---|:---|:---|
| `0` (CPO) | CPO가 소유·운영 | CPO에게 정산 |
| `1` (ENERGYFI) | EnergyFi 직접 소유 | STO 투자자 수익 풀 |

---

#### StationRegistry.registerCharger()

```solidity
function registerCharger(
    bytes32 chargerId,      // DeviceRegistry에 칩이 먼저 등록되어 있어야 함
    bytes32 stationId,
    uint8   chargerType     // 0 = SLOW_AC, 1 = FAST_DC, 2 = ULTRA_FAST_DC
) external onlyRole(ADMIN_ROLE)
```

---

### 4.2 충전 기록 (Bridge 전용) — 핵심

#### ChargeRouter.processCharge()

```solidity
function processCharge(
    IChargeTransaction.ChargeSession calldata session,
    uint256 period_yyyyMM
) external onlyBridge whenNotPaused returns (uint256 tokenId)
```

**ChargeSession 구조체:**

```solidity
struct ChargeSession {
    bytes32 sessionId;          // STRIKON session_id → bytes32
    bytes32 chargerId;          // STRIKON charger_id → bytes32
    bytes32 stationId;          // STRIKON station_id → bytes32
    bytes4  gridRegionCode;     // "KR11" 등 → bytes4
    uint256 energyKwh;          // kWh × 100 (예: 6.78 kWh → 678)
    uint256 distributableKrw;   // 정산 금액 (원). gross - platform_fee
    uint256 startTimestamp;     // Unix seconds
    uint256 endTimestamp;       // Unix seconds
    bytes   seSignature;        // SE 칩 서명 (64 bytes P-256 또는 65 bytes secp256k1)
}
```

**period_yyyyMM**: 월별 기간 (예: `202603` = 2026년 3월)

**이벤트**:
- `ChargeSessionRecorded(tokenId, sessionId, chargerId, stationId, gridRegionCode, energyKwh, distributableKrw, startTimestamp, endTimestamp)` — from ChargeTransaction
- `RevenueRecorded(stationId, distributableKrw, accumulated, period_yyyyMM)` — from RevenueTracker
- `ChargeProcessed(tokenId, sessionId, stationId, period_yyyyMM)` — from ChargeRouter

**Revert 조건:**

| 에러 | 원인 |
|:---|:---|
| `DuplicateSession` | 동일 sessionId로 이미 민팅됨 |
| `StationNotRegistered` | stationId가 StationRegistry에 없음 |
| `ChipNotActive` | chargerId의 SE 칩이 DeviceRegistry에 없거나 비활성 |
| `InvalidSESignature` | SE 서명 검증 실패 |
| `ZeroAmount` | distributableKrw가 0 |

---

### 4.3 조회 함수 (Public)

#### 충전 기록 조회

```solidity
// 토큰 ID로 세션 조회
ChargeTransaction.getSession(uint256 tokenId) → ChargeSession

// 세션 ID로 토큰 ID 조회
ChargeTransaction.getTokenIdBySessionId(bytes32 sessionId) → uint256

// 총 세션 수
ChargeTransaction.totalSessions() → uint256
```

#### 수익 조회

```solidity
// 충전소별 수익 (누적/정산/미정산)
RevenueTracker.getStationRevenue(bytes32 stationId)
    → (uint256 accumulated, uint256 settled, uint256 pending)

// 충전소 월별 수익
RevenueTracker.getStationRevenuePeriod(bytes32 stationId, uint256 period_yyyyMM)
    → uint256

// CPO별 수익
RevenueTracker.getCPORevenue(bytes32 cpoId)
    → (uint256 accumulated, uint256 settled, uint256 pending)

// 지역별 EnergyFi 소유 수익 (STO 풀)
RevenueTracker.getEnergyFiRegionRevenue(bytes4 regionId)
    → uint256 pending
```

---

## 5. invoice.paid → processCharge 매핑

STRIKON `invoice.paid` 이벤트 필드가 `ChargeSession` 구조체로 어떻게 매핑되는지:

```
invoice.paid 필드                    ChargeSession 필드
──────────────────────────────────────────────────────────────
payload.session_id        →  sessionId          (UUID → bytes32)
payload.charger_id        →  chargerId          (UUID → bytes32)
payload.station_id        →  stationId          (UUID → bytes32)
payload.region_id         →  gridRegionCode     ("KR-11" → bytes4("KR11"))
payload.charging.energy_delivered_kwh  →  energyKwh  (× 100, 소수점 제거)
payload.amount.distributable_krw       →  distributableKrw (정수 그대로)
payload.charging.charging_started_at   →  startTimestamp (ISO 8601 → Unix)
payload.charging.charging_stopped_at   →  endTimestamp   (ISO 8601 → Unix)
payload.se_signature      →  seSignature        (hex → bytes)
```

**period_yyyyMM**: `payload.charging.charging_stopped_at`에서 추출 (예: 2026-03-20 → `202603`)

### SE 서명 생성 규칙

```
msgHash = keccak256(abi.encodePacked(chargerId, energyKwh, startTimestamp, endTimestamp))
```

SE 칩(TPM 2.0)이 이 해시에 P-256 서명을 생성합니다. 테스트 시에는 secp256k1 사용 가능.

---

## 6. ethers.js 호출 예시 (Bridge 구현 참고)

```typescript
import { ethers } from "ethers";

// 로컬 노드 연결
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const signer = new ethers.Wallet("<deployer-private-key>", provider);

// deployments.json에서 주소 로드
import deployments from "./deployments.json" assert { type: "json" };
const addrs = deployments["localhost"];

// ABI 로드 (컴파일 후 생성됨)
import ChargeRouterABI from "./artifacts/contracts/ChargeRouter.sol/ChargeRouter.json" assert { type: "json" };

const router = new ethers.Contract(addrs.ChargeRouter, ChargeRouterABI.abi, signer);

// processCharge 호출
const session = {
  sessionId: ethers.id("sess_a1b2c3d4"),        // bytes32
  chargerId: ethers.id("chrg_9f8e7d6c"),        // bytes32
  stationId: ethers.id("stn_1a2b3c4d"),         // bytes32
  gridRegionCode: ethers.encodeBytes32String("KR11").slice(0, 10),  // bytes4
  energyKwh: 678n,                // 6.78 kWh × 100
  distributableKrw: 14400n,       // 14,400원
  startTimestamp: 1711000000n,
  endTimestamp: 1711004000n,
  seSignature: "0x..."            // SE 칩 서명 bytes
};

const tx = await router.processCharge(session, 202603n);
const receipt = await tx.wait();
console.log("Token ID:", receipt.logs[0].args.tokenId);
```

---

## 7. ABI 파일 위치

컴파일 후 (`npm run compile`) artifacts 폴더에 생성:

```
contracts/l1/artifacts/contracts/
├── ChargeRouter.sol/ChargeRouter.json       ← "abi" 필드
├── ChargeTransaction.sol/ChargeTransaction.json
├── RevenueTracker.sol/RevenueTracker.json
├── DeviceRegistry.sol/DeviceRegistry.json
└── StationRegistry.sol/StationRegistry.json
```

각 JSON 파일의 `"abi"` 필드를 사용하면 됩니다.

---

## 8. 유용한 명령어

```bash
npm run node             # 로컬 EVM 노드 시작
npm run deploy:local     # 로컬에 컨트랙트 배포
npm run compile          # 솔리디티 컴파일 (ABI 생성)
npm run test             # 전체 테스트 실행
npm run dashboard:local    # 웹 대시보드 (Hardhat 내장 네트워크)
npm run dashboard:l1-local # 웹 대시보드 (로컬 노드 연결)
```

---

## 9. 참고 문서

| 문서 | 경로 | 내용 |
|:---|:---|:---|
| STRIKON 인터페이스 명세 | `docs/strikon-interface-spec.md` | invoice.paid 페이로드 전체 정의 |
| Phase 2 스펙 | `contracts/l1/docs/phase2-transaction-spec.md` | ChargeTransaction + RevenueTracker 상세 설계 |
| Phase 1 스펙 | `contracts/l1/docs/phase1-infra-spec.md` | DeviceRegistry + StationRegistry 상세 설계 |
| 프로젝트 아키텍처 | `docs/architecture.md` | 3-Layer 전체 구조 |

---

## 10. FAQ

**Q: 로컬 노드의 Chain ID는?**
A: Hardhat 기본값 `31337`. 프로덕션 EnergyFi L1은 `270626`.

**Q: 가스비가 드나요?**
A: 로컬 노드에서는 테스트 계정에 ETH가 충분합니다. 프로덕션 EnergyFi L1은 zero-gas (가스비 없음).

**Q: 컨트랙트를 수정하고 싶으면?**
A: 별도 Git 브랜치에서 작업 후 PR을 올려주세요. `main` 브랜치에 직접 push하지 마세요.

**Q: SE 서명 없이 테스트할 수 있나요?**
A: 테스트 시 secp256k1 (algorithm=1)로 등록하면 일반 Ethereum 키로 서명 가능합니다. `test/helpers.ts`의 `signRaw()`, `getPublicKey64()` 참고.

**Q: processCharge가 revert되면?**
A: 에러 메시지 확인 → 마스터 데이터(칩, 충전소, 충전기) 등록 상태를 먼저 확인하세요.
