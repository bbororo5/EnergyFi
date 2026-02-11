# EnergyFi — Frontend Specification (Flutter Mobile App)

## 1. Overview

EnergyFi's frontend is a **cross-platform mobile application** built with Flutter, serving as the investor-facing interface for the STO platform.

| Property | Value |
|:---|:---|
| **Path** | `frontend/` |
| **Framework** | Flutter ^3.7.0 |
| **Language** | Dart ^3.7.0 |
| **State Management** | Riverpod ^2.6.1 |
| **Web3** | web3dart ^2.7.3 |
| **Wallet** | WalletConnect v2 |
| **Routing** | go_router ^15.1.2 |
| **Platforms** | iOS, Android |

## 2. Screen Map

| Screen | Description | Data Source |
|:---|:---|:---|
| **Login** | Social login (Apple, Google) | Auth provider |
| **Portfolio Dashboard** | Token holdings, P&L, monthly summary | C-Chain (EnergyToken) |
| **STO Marketplace** | Browse available energy tokens, pricing | C-Chain (EnergyOracle) |
| **Charging Station Map** | Nearby stations, availability, charger specs | STRIKON API / Mock |
| **Real-time Charging** | Live charge progress (kW, kWh, cost, time) | STRIKON API / Mock |
| **Trade Execution** | Buy/sell orders (Phase 2: EnergyDEX) | C-Chain |
| **AI Valuation View** | APEX-powered insights, NPV/IRR charts | Oracle Relay / APEX API |
| **Yield Claim** | View and claim revenue distributions | C-Chain (RevenueVault) |
| **Wallet** | Payment methods, transaction history, balances | WalletConnect v2 |
| **KYC Onboarding** | Identity verification flow | Phase 2 (IdentityRegistry) |
| **Profile** | User settings, notifications | Local storage |

## 3. Project Structure

**Current scaffold:**
```
frontend/
├── pubspec.yaml                # Dependencies
├── analysis_options.yaml       # Lint rules (flutter_lints)
└── lib/
    ├── main.dart               # App entry point (MaterialApp)
    └── config/
        └── constants.dart      # Contract addresses, RPC URLs
```

**Target structure (as development progresses):**
```
lib/
├── main.dart
├── config/
│   └── constants.dart
├── models/                     # Data models (Station, Token, Order, etc.)
├── providers/                  # Riverpod providers (state management)
├── screens/                    # Screen widgets
│   ├── auth/                   # Login, register
│   ├── dashboard/              # Portfolio home
│   ├── map/                    # Charging station map
│   ├── charging/               # Real-time charging session
│   ├── marketplace/            # Token browse & details
│   ├── trade/                  # Buy/sell execution
│   ├── yield/                  # Revenue claim
│   ├── wallet/                 # Wallet & payment
│   └── profile/                # Settings
├── services/                   # Business logic layer
│   ├── web3_service.dart       # ethers/web3dart RPC calls
│   ├── contract_service.dart   # Contract ABI bindings
│   └── api_service.dart        # REST API calls (STRIKON/Mock)
└── widgets/                    # Reusable UI components
    ├── stat_card.dart
    ├── charge_gauge.dart
    └── bottom_nav.dart
```

## 4. Design System

Based on the existing STRIKON app design language:

| Element | Specification |
|:---|:---|
| **Theme** | Dark mode primary (#0D1117 background) |
| **Accent** | Neon cyan (#00F5FF) for CTAs and highlights |
| **Cards** | Dark gray (#1A1A2E) with subtle borders |
| **Typography** | System font, bold headings, muted subtitles |
| **Icons** | Rounded square icon badges with color-coded backgrounds |
| **Navigation** | Bottom nav bar: Home, Map, Wallet, Profile |

## 5. Contract Integration

After deploying contracts (Units B & C), update `lib/config/constants.dart`:

```dart
class ContractAddresses {
  static const String energyToken = '0x...';    // from Unit B
  static const String energyOracle = '0x...';   // from Unit B
  static const String revenueVault = '0x...';   // from Unit B
  static const String assetLogger = '0x...';    // from Unit C
  static const String deviceRegistry = '0x...'; // from Unit C
}

class RpcEndpoints {
  static const String cChain = 'https://api.avax-test.network/ext/bc/C/rpc';
  static const String subnet = 'http://127.0.0.1:9650/ext/bc/.../rpc';
}
```

## 6. Build & Run

```bash
cd frontend
flutter pub get
flutter run                  # Debug mode (hot reload)
flutter build apk --release  # Android release
flutter build ios --release  # iOS release (macOS only)
```

## 7. Dependencies

| Package | Version | Purpose |
|:---|:---|:---|
| flutter_riverpod | ^2.6.1 | State management |
| web3dart | ^2.7.3 | Ethereum RPC, contract ABI interaction |
| walletconnect_flutter_v2 | ^2.4.4 | Multi-wallet support (MetaMask, Core) |
| http | ^1.3.0 | REST API calls |
| shared_preferences | ^2.5.3 | Local key-value storage |
| go_router | ^15.1.2 | Declarative routing |

## 8. Data Flow

```
Flutter App
    │
    ├── web3dart ──────► C-Chain RPC (read contract state)
    │                      ├── EnergyToken.balanceOf()
    │                      ├── EnergyOracle.latestReport()
    │                      └── RevenueVault.claimable()
    │
    ├── WalletConnect ──► MetaMask / Core Wallet
    │                      └── Sign & broadcast transactions
    │
    └── HTTP ──────────► Mock API / STRIKON API
                           ├── Station list & details
                           └── Charging session data
```
