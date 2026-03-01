# ELECTRA STO 투자자 앱 — Flutter Frontend 설계 문서

> **프로젝트**: ELECTRA × STRIKON × AVALANCHE EV 충전소 STO 수익배분 플랫폼  
> **문서 버전**: v0.1 (해커톤 단계)  
> **작성일**: 2026-02-20  
> **대상**: Flutter 프론트엔드 개발

---

## 1. 프로젝트 컨텍스트

### 1.1 시스템 전체 구조

```
ELECTRA (충전기 HW, OCPP)
    ↓ StopTransaction
STRIKON (플랫폼, 충전 데이터 처리 · PG 결제)
    ↓ invoice.paid → Blockchain Bridge Service
Avalanche L1 (STO 스마트컨트랙트, 수익 자동배분)
    ↓ claimable 잔액 조회 / claim() 호출
Flutter 투자자 앱 (본 문서 범위)
```

### 1.2 Flutter 앱의 역할

- Avalanche L1의 스마트컨트랙트를 **읽어서** 투자자에게 실시간 수익 현황을 표시
- 투자자의 **claim() 트랜잭션**을 생성·서명·전송하여 AVAX 출금 처리
- STRIKON 백엔드 API와 연동하여 충전소 정보, STO 목록, KYC 상태 등 조회
- 지갑 생성/연결 및 알림 처리

### 1.3 핵심 온체인 인터랙션

| 동작 | 컨트랙트 함수 | 타입 | 가스비 |
|------|-------------|------|--------|
| 출금 가능 잔액 조회 | `claimableBalance(address)` | read (view) | 없음 |
| 수익 출금 | `claim()` | write (tx) | 있음 |
| 토큰 보유량 조회 | `balanceOf(address)` | read (view) | 없음 |
| 홀더 등록 여부 확인 | `isRegisteredHolder(address)` | read (view) | 없음 |

---

## 2. 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | **Flutter 3.x** | iOS / Android 동시 지원 |
| 상태관리 | **Riverpod** | Provider 대비 테스트 용이, 비동기 처리 강점 |
| 라우팅 | **GoRouter** | 딥링크, 리다이렉트 가드 (KYC 미완료 시 등) |
| 온체인 연동 | **web3dart** | Avalanche L1 RPC 호출, 컨트랙트 ABI 바인딩 |
| 지갑 연결 | **WalletConnect v2** (walletconnect_flutter_v2) | 프로덕션 단계 추가 |
| Custodial 지갑 | **web3dart + flutter_secure_storage** | 해커톤 기본 지갑 |
| HTTP 클라이언트 | **dio** | STRIKON REST API 호출 |
| 알림 | **firebase_messaging** | FCM 푸시 |
| 로컬 저장소 | **flutter_secure_storage** | 프라이빗 키, 토큰 저장 |
| UI 컴포넌트 | **Material 3** | 커스텀 테마 적용 |

---

## 3. 디렉토리 구조

```
lib/
├── main.dart
├── app.dart                          # MaterialApp, GoRouter, Theme 설정
│
├── core/
│   ├── constants/
│   │   ├── app_constants.dart        # 앱 전역 상수
│   │   ├── contract_addresses.dart   # 스마트컨트랙트 주소 (testnet/mainnet)
│   │   └── rpc_endpoints.dart        # Avalanche L1 RPC URL
│   ├── theme/
│   │   ├── app_theme.dart            # Material 3 테마
│   │   └── app_colors.dart           # 컬러 팔레트
│   ├── utils/
│   │   ├── avax_formatter.dart       # wei → AVAX 변환, 소수점 처리
│   │   ├── krw_formatter.dart        # AVAX → KRW 환산 표시
│   │   └── date_formatter.dart       # 타임스탬프 → 한국 시간
│   └── errors/
│       └── app_exceptions.dart       # 커스텀 에러 클래스
│
├── services/
│   ├── avalanche_service.dart        # ★ L1 RPC 연결, 컨트랙트 read/write
│   ├── wallet_service.dart           # ★ 키 생성, 서명, 지갑 관리
│   ├── strikon_api_service.dart      # STRIKON 백엔드 REST 호출
│   └── notification_service.dart     # FCM 초기화, 토큰 등록
│
├── models/
│   ├── sto_token.dart                # STO 토큰 정보 (심볼, 보유량, 충전소 ID)
│   ├── revenue_record.dart           # 충전 건별 수익 기록
│   ├── charger_station.dart          # 충전소 정보 (위치, 충전기 수, 상태)
│   ├── claim_transaction.dart        # Claim 트랜잭션 결과
│   └── user_profile.dart             # 사용자 프로필, KYC 상태
│
├── providers/
│   ├── wallet_provider.dart          # 지갑 상태 (연결 여부, 주소, 잔액)
│   ├── portfolio_provider.dart       # 보유 STO 목록 + claimable 잔액
│   ├── revenue_provider.dart         # 수익 이력 (폴링 or 이벤트)
│   ├── sto_market_provider.dart      # 신규 STO 목록
│   └── notification_provider.dart    # 알림 상태
│
├── features/
│   ├── onboarding/
│   │   ├── screens/
│   │   │   ├── welcome_screen.dart           # 앱 소개
│   │   │   ├── wallet_setup_screen.dart      # 지갑 생성 or 연결
│   │   │   └── kyc_screen.dart               # KYC 인증
│   │   └── widgets/
│   │       └── ...
│   │
│   ├── dashboard/                             # 탭 1: 포트폴리오 대시보드
│   │   ├── screens/
│   │   │   ├── dashboard_screen.dart          # 메인 대시보드
│   │   │   └── station_detail_screen.dart     # 충전소별 상세
│   │   └── widgets/
│   │       ├── total_balance_card.dart        # 총 claimable AVAX 카드
│   │       ├── sto_portfolio_card.dart        # 보유 STO 카드
│   │       └── revenue_chart.dart             # 수익 추이 차트
│   │
│   ├── claim/                                 # 탭 2: 수익 출금 + 이력
│   │   ├── screens/
│   │   │   ├── claim_screen.dart              # Claim 메인 (잔액 + 버튼)
│   │   │   ├── claim_confirm_screen.dart      # Claim 확인/서명
│   │   │   └── revenue_history_screen.dart    # 충전 건별 수익 리스트
│   │   └── widgets/
│   │       ├── claimable_balance_display.dart # 큰 숫자 잔액 표시
│   │       ├── claim_button.dart              # 1-click claim 버튼
│   │       ├── tx_status_indicator.dart       # 트랜잭션 상태 표시
│   │       └── revenue_list_tile.dart         # 수익 기록 타일
│   │
│   ├── market/                                # 탭 3: STO 마켓
│   │   ├── screens/
│   │   │   ├── sto_market_screen.dart         # STO 목록
│   │   │   ├── sto_detail_screen.dart         # 충전소 STO 상세
│   │   │   └── invest_screen.dart             # 투자(토큰 구매) 플로우
│   │   └── widgets/
│   │       ├── sto_card.dart                  # STO 리스트 카드
│   │       └── invest_summary.dart            # 투자 요약
│   │
│   └── settings/                              # 탭 4: 설정
│       ├── screens/
│       │   ├── settings_screen.dart           # 설정 메인
│       │   ├── wallet_manage_screen.dart      # 지갑 관리
│       │   └── notification_settings_screen.dart
│       └── widgets/
│           └── ...
│
└── widgets/                                   # 공통 위젯
    ├── app_bottom_nav.dart                    # BottomNavigationBar
    ├── loading_overlay.dart                   # 트랜잭션 처리 중 오버레이
    └── snowtrace_link.dart                    # Snowtrace 외부 링크 버튼
```

---

## 4. 핵심 서비스 설계

### 4.1 AvalancheService — L1 온체인 연동

```dart
// services/avalanche_service.dart

class AvalancheService {
  final Web3Client _client;
  final DeployedContract _chargerStoContract;

  // --- READ (가스비 없음) ---

  /// 투자자의 출금 가능 AVAX 잔액 조회
  Future<BigInt> getClaimableBalance(EthereumAddress holder);

  /// 투자자의 STO 토큰 보유량 조회
  Future<BigInt> getTokenBalance(EthereumAddress holder);

  /// 전체 수익 배분 이벤트 조회 (이력 표시용)
  Future<List<RevenueRecord>> getRevenueEvents({
    required String contractAddress,
    int? fromBlock,
  });

  /// 홀더 등록 여부 확인
  Future<bool> isRegisteredHolder(EthereumAddress holder);

  // --- WRITE (가스비 있음, 서명 필요) ---

  /// claim() 트랜잭션 생성 및 전송
  Future<String> executeClaim({
    required Credentials credentials,
    required String contractAddress,
  });

  // --- POLLING ---

  /// 주기적 claimable 잔액 조회 (10~30초)
  Stream<BigInt> watchClaimableBalance(EthereumAddress holder);
}
```

**L1 RPC 연결 설정:**

```dart
// core/constants/rpc_endpoints.dart

class RpcEndpoints {
  // AvaCloud Testnet (Fuji) — 해커톤 단계
  static const testnet = 'https://[AVACLOUD_L1_RPC_URL]/ext/bc/[CHAIN_ID]/rpc';

  // AvaCloud Mainnet — 프로덕션 단계
  static const mainnet = 'https://[AVACLOUD_MAINNET_RPC_URL]/ext/bc/[CHAIN_ID]/rpc';
}
```

### 4.2 WalletService — 지갑 관리

```dart
// services/wallet_service.dart

class WalletService {
  // --- Custodial 지갑 (해커톤 기본) ---

  /// 새 지갑 생성 (프라이빗 키 → flutter_secure_storage 저장)
  Future<EthereumAddress> createWallet();

  /// 저장된 지갑 불러오기
  Future<Credentials?> loadWallet();

  /// 니모닉 시드 백업 표시
  Future<String> exportMnemonic();

  // --- WalletConnect (프로덕션 추가) ---

  /// WalletConnect v2 세션 연결
  Future<void> connectWalletConnect();

  /// WalletConnect 서명 요청
  Future<String> signWithWalletConnect(Transaction tx);

  // --- 공통 ---

  /// 현재 연결된 지갑 주소
  EthereumAddress? get currentAddress;

  /// 지갑 AVAX 잔액 (가스비용)
  Future<EtherAmount> getAvaxBalance();
}
```

### 4.3 StrikonApiService — 백엔드 연동

```dart
// services/strikon_api_service.dart

class StrikonApiService {
  final Dio _dio;

  /// 충전소 목록 조회
  Future<List<ChargerStation>> getStations();

  /// 충전소 상세 정보
  Future<ChargerStation> getStationDetail(String stationId);

  /// 신규 STO 목록 조회
  Future<List<StoToken>> getAvailableStos();

  /// KYC 인증 요청
  Future<void> submitKyc(KycData data);

  /// KYC 상태 조회
  Future<KycStatus> getKycStatus(String walletAddress);

  /// 알림 토큰 등록 (FCM)
  Future<void> registerFcmToken(String walletAddress, String fcmToken);
}
```

---

## 5. 화면별 상세 설계

### 5.1 온보딩 플로우

```
[WelcomeScreen]
    │
    ├─ "새 지갑 만들기" → 앱 내 키 생성 → 니모닉 백업 안내
    │
    └─ "기존 지갑 연결" → WalletConnect (프로덕션)
            │
        [KycScreen]
            │  KYC 인증 완료 → 화이트리스트 등록 요청
            │
        [메인 진입]
```

**라우팅 가드:** KYC 미완료 시 대시보드 접근 차단 → KYC 화면으로 리다이렉트

### 5.2 대시보드 (탭 1)

**화면 구성:**

```
┌──────────────────────────────┐
│  총 출금 가능 잔액             │
│  ┌────────────────────────┐  │
│  │   12.847 AVAX          │  │
│  │   ≈ ₩1,284,700        │  │
│  │   [출금하기 →]          │  │
│  └────────────────────────┘  │
│                              │
│  내 충전소 STO               │
│  ┌────────────────────────┐  │
│  │ ⚡ ELEC-GN-001          │  │
│  │ 강남역 충전소 · 50 토큰   │  │
│  │ 이번 달 +2.3 AVAX       │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ ⚡ ELEC-SC-003          │  │
│  │ 서초 충전소 · 30 토큰     │  │
│  │ 이번 달 +1.1 AVAX       │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**데이터 소스:**

- 총 claimable 잔액: `AvalancheService.getClaimableBalance()` (폴링 30초)
- 보유 STO 목록: `StrikonApiService` + `AvalancheService.getTokenBalance()`
- KRW 환산: 외부 시세 API or STRIKON 백엔드 제공 환율

### 5.3 수익 출금 — Claim (탭 2)

**Claim 플로우:**

```
[ClaimScreen]
  claimable 잔액 표시: 12.847 AVAX
  [전액 출금] 버튼 탭
      │
      ▼
[ClaimConfirmScreen]
  출금 금액: 12.847 AVAX
  예상 가스비: ~0.001 AVAX
  실수령: ~12.846 AVAX
  [확인] 버튼 탭
      │
      ▼
  AvalancheService.executeClaim() 호출
  → 트랜잭션 서명 (Custodial: 자동 / WalletConnect: 외부 서명)
  → L1에 전송
  → tx_hash 수신
      │
      ▼
[결과 표시]
  ✅ 출금 완료 · 12.846 AVAX
  tx: 0xabc...def [Snowtrace에서 확인 →]
```

**에러 처리:**

- 가스비 부족 → "AVAX 잔액이 부족합니다. 가스비로 최소 0.01 AVAX가 필요합니다."
- 트랜잭션 실패 → 재시도 안내 + tx_hash로 상태 확인 링크
- 네트워크 오류 → "L1 네트워크 연결 실패. 잠시 후 다시 시도해주세요."

### 5.4 수익 이력 (탭 2 하단)

```
┌──────────────────────────────┐
│  2026.02.20 14:32            │
│  ELEC-GN-001 · 충전 1회      │
│  +0.024 AVAX (≈₩2,400)      │
│  [온체인 확인 →]              │
├──────────────────────────────┤
│  2026.02.20 13:15            │
│  ELEC-GN-001 · 충전 1회      │
│  +0.019 AVAX (≈₩1,900)      │
│  [온체인 확인 →]              │
└──────────────────────────────┘
```

**데이터 소스:** L1의 `RevenueDistributed` 이벤트 로그 필터링

### 5.5 STO 마켓 (탭 3)

```
[StoMarketScreen]
  신규 충전소 STO 리스트
      │ 카드 탭
      ▼
[StoDetailScreen]
  충전소 정보 (위치, 충전기 수, 예상 수익률)
  STO 조건 (총 발행량, 토큰 단가, 잔여 토큰)
  [투자하기] 버튼
      │
      ▼
[InvestScreen]
  구매 수량 입력
  필요 AVAX 표시
  [구매 확인] → 토큰 구매 트랜잭션 전송
```

### 5.6 설정 (탭 4)

- 지갑 주소 표시 / 복사
- 지갑 백업 (니모닉 보기)
- WalletConnect 세션 관리 (프로덕션)
- 알림 ON/OFF
- KYC 상태 표시
- 앱 버전 정보

---

## 6. 스마트컨트랙트 ABI (필요 함수)

Flutter에서 호출해야 하는 ChargerSTO.sol의 함수 목록:

```json
[
  {
    "name": "claimableBalance",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{ "name": "holder", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  {
    "name": "claim",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [],
    "outputs": []
  },
  {
    "name": "balanceOf",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{ "name": "account", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  {
    "name": "isRegisteredHolder",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{ "name": "holder", "type": "address" }],
    "outputs": [{ "name": "", "type": "bool" }]
  },
  {
    "name": "totalSupply",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }]
  }
]
```

**이벤트 (이력 조회용):**

```json
[
  {
    "name": "RevenueDistributed",
    "type": "event",
    "inputs": [
      { "name": "invoiceId", "type": "string", "indexed": true },
      { "name": "totalAmount", "type": "uint256", "indexed": false },
      { "name": "timestamp", "type": "uint256", "indexed": false }
    ]
  },
  {
    "name": "Claimed",
    "type": "event",
    "inputs": [
      { "name": "holder", "type": "address", "indexed": true },
      { "name": "amount", "type": "uint256", "indexed": false }
    ]
  }
]
```

> ⚠️ **위 ABI는 추정 스펙입니다.** STRIKON 실장님이 배포한 실제 ChargerSTO.sol의 ABI를 확인한 후 교체해야 합니다.

---

## 7. 데이터 흐름 요약

```
┌─────────────┐     REST/gRPC      ┌─────────────────┐
│  STRIKON    │ ◄─────────────────► │                 │
│  Backend    │  충전소 정보, KYC,   │                 │
│             │  STO 목록           │                 │
└─────────────┘                     │  Flutter App    │
                                    │                 │
┌─────────────┐     L1 RPC (JSON)   │  ┌───────────┐ │
│ Avalanche   │ ◄─────────────────► │  │ Avalanche │ │
│ L1          │  claimable 조회     │  │ Service   │ │
│ (AvaCloud)  │  claim() 전송      │  └───────────┘ │
│             │  이벤트 로그 조회    │                 │
└─────────────┘                     └─────────────────┘
```

**실시간 업데이트 전략:**

| 단계 | 방식 | 주기 | 비고 |
|------|------|------|------|
| 해커톤 | 폴링 (Timer) | 30초 | 간단 구현, 데모 충분 |
| 프로덕션 | WebSocket 이벤트 구독 | 실시간 | RevenueDistributed 이벤트 리스닝 |

---

## 8. 환경 설정

### 8.1 pubspec.yaml 주요 의존성

```yaml
dependencies:
  flutter:
    sdk: flutter

  # 상태관리
  flutter_riverpod: ^2.4.0
  riverpod_annotation: ^2.3.0

  # 라우팅
  go_router: ^14.0.0

  # 블록체인
  web3dart: ^2.7.0
  walletconnect_flutter_v2: ^2.3.0   # 프로덕션 단계 추가

  # 네트워크
  dio: ^5.4.0

  # 로컬 저장소
  flutter_secure_storage: ^9.0.0

  # 알림
  firebase_messaging: ^15.0.0
  firebase_core: ^3.0.0

  # UI
  fl_chart: ^0.68.0                   # 수익 차트
  url_launcher: ^6.2.0                # Snowtrace 링크
  shimmer: ^3.0.0                     # 로딩 스켈레톤
  intl: ^0.19.0                       # 숫자/날짜 포맷

dev_dependencies:
  build_runner: ^2.4.0
  riverpod_generator: ^2.4.0
  json_serializable: ^6.7.0
  mockito: ^5.4.0                     # 테스트
```

### 8.2 환경 변수

```dart
// core/constants/app_constants.dart

class AppConstants {
  // --- 환경 전환 ---
  static const isTestnet = true; // false로 전환 시 메인넷

  // --- L1 RPC ---
  static const l1RpcUrl = isTestnet
      ? 'https://[AVACLOUD_FUJI_RPC]'
      : 'https://[AVACLOUD_MAINNET_RPC]';

  // --- 컨트랙트 주소 ---
  static const stoFactoryAddress = isTestnet
      ? '0x[TESTNET_FACTORY_ADDRESS]'
      : '0x[MAINNET_FACTORY_ADDRESS]';

  // --- STRIKON API ---
  static const strikonApiBaseUrl = isTestnet
      ? 'https://api-dev.strikon.io'
      : 'https://api.strikon.io';

  // --- 폴링 주기 ---
  static const pollingIntervalSeconds = 30;

  // --- Snowtrace ---
  static const snowtraceBaseUrl = 'https://snowtrace.io/tx/';
}
```

---

## 9. 개발 순서 (해커톤 기준)

| 순서 | 작업 | 산출물 | 예상 기간 |
|------|------|--------|----------|
| **Step 1** | 프로젝트 셋업 + L1 연결 | web3dart로 Fuji RPC 연결 확인, ABI 바인딩 | 1일 |
| **Step 2** | Custodial 지갑 생성 | 키 생성 → secure storage 저장 → 주소 표시 | 0.5일 |
| **Step 3** | 대시보드 UI + claimable 조회 | 대시보드 화면, 30초 폴링으로 잔액 표시 | 1일 |
| **Step 4** | Claim 기능 | claim() 트랜잭션 생성·서명·전송·결과 표시 | 1일 |
| **Step 5** | 수익 이력 | 이벤트 로그 조회, 리스트 표시, Snowtrace 링크 | 0.5일 |
| **Step 6** | STO 마켓 + 투자 | STO 목록, 상세, 토큰 구매 플로우 | 1일 |
| **Step 7** | 알림 + 폴리싱 | FCM 연동, UX 개선, 에러 처리 | 0.5일 |

**최소 데모 가능 시점:** Step 4 완료 후 (대시보드 + Claim 동작)

---

## 10. 프로덕션 전환 시 변경 사항

| 항목 | 해커톤 | 프로덕션 |
|------|--------|---------|
| 정산 화폐 | AVAX | USDC (ICTT 브릿지) |
| 실시간 업데이트 | 폴링 30초 | WebSocket 이벤트 구독 |
| 지갑 | Custodial only | + WalletConnect v2 |
| KYC | 목업 | 외부 KYC 파트너 연동 |
| 네트워크 | AvaCloud Fuji Testnet | AvaCloud Mainnet |
| 시세 환산 | 고정 환율 or 외부 API | STRIKON 백엔드 공식 환율 |
| 보안 | 기본 | 프라이빗 키 암호화, 생체 인증 잠금 |

> USDC 전환 시 `AvalancheService` 내부에서 컨트랙트 호출 대상만 변경하면 됨.  
> UI에서는 "AVAX" → "USDC", 환산 로직 제거.

---

## 11. 참고 리소스

- [AvaCloud 문서 — Interchain Transfer USDC](https://docs.avacloud.io/portal/interoperability/how-to-set-up-an-interchain-transfer-for-usdc-between-avalanche-c-chain-and-an-l-1)
- [Avalanche ICTT 소개](https://build.avax.network/docs/cross-chain/icm-contracts/deep-dive)
- [web3dart 패키지](https://pub.dev/packages/web3dart)
- [WalletConnect Flutter v2](https://pub.dev/packages/walletconnect_flutter_v2)
- [AvaCloud Web3 Data API](https://docs.avacloud.io/)
