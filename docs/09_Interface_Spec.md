# EnergyFi — STRIKON ↔ DeFi Interface Specification

| Field | Value |
|:---|:---|
| **Version** | 1.0.0 |
| **Author** | Wingside Technology |
| **Created** | 2026-02-12 |
| **Hackathon** | Avalanche Build Games 2026 |

> Hackathon MVP uses **mock JSON data**. In production, all data flows through the STRIKON Platform API.

---

## Overview

EnergyFi consumes 8 interface types across 3 layers:

| Layer | Interfaces | Direction |
|:---|:---|:---|
| **Supply (Platform → Chain)** | 1. Station Data, 2. Oracle On-Chain Payload | STRIKON → Oracle Relay → C-Chain |
| **DeFi Internal** | 3. AI Valuation, 4. Token Metadata, 5. Trade Order, 6. Revenue Distribution | Smart Contracts ↔ Backend |
| **App Display** | 7. Portfolio View, 8. Marketplace Listing | Backend → Flutter App |

```
STRIKON Platform
    │
    ├── ① Station Data ──→ Oracle Relay ──→ ② On-Chain Payload ──→ EnergyOracle.sol
    │                                                                    │
    │                                                               ③ AI Valuation
    │                                                                    │
    │   ┌────────────────────────────────────────────────────────────────┘
    │   │
    │   ├── ④ Token Metadata ──→ EnergyToken.sol
    │   ├── ⑤ Trade Order ──→ EnergyDEX.sol
    │   ├── ⑥ Revenue Distribution ──→ RevenueVault.sol
    │   │
    │   └──→ Flutter App
    │         ├── ⑦ Portfolio View
    │         └── ⑧ Marketplace Listing
```

---

## 1. Station Data

**STRIKON → Oracle Relay**: Charging station operational metrics.

- **Direction**: STRIKON → Oracle Relay → On-Chain
- **Frequency**: Every 15 minutes (hackathon: mock cron)
- **Endpoint**: `GET /api/v1/stations/{stationId}/metrics`

### Request

```json
{
  "stationId": "STK-KR-0001",
  "period": "latest",
  "apiKey": "energyfi_oracle_xxxx"
}
```

### Response

```json
{
  "stationId": "STK-KR-0001",
  "stationName": "강남역 충전소 A",
  "operator": "WingSide Energy",
  "location": {
    "country": "KR",
    "city": "Seoul",
    "district": "Gangnam-gu",
    "latitude": 37.4979,
    "longitude": 127.0276
  },
  "chargers": {
    "total": 8,
    "online": 7,
    "offline": 1,
    "types": [
      { "type": "DC_FAST", "power_kw": 200, "count": 4 },
      { "type": "DC_FAST", "power_kw": 100, "count": 2 },
      { "type": "AC_SLOW", "power_kw": 7, "count": 2 }
    ]
  },
  "metrics": {
    "timestamp": "2026-02-12T09:00:00Z",
    "period_hours": 24,
    "energy_kwh_dispensed": 4820.5,
    "revenue_usd": 1687.18,
    "session_count": 142,
    "avg_session_kwh": 33.95,
    "avg_session_duration_min": 38,
    "uptime_percent": 97.2,
    "utilization_percent": 62.4,
    "peak_hour": 18,
    "peak_utilization_percent": 94.1
  },
  "health": {
    "overall_score": 92,
    "dera_anomaly_flag": false,
    "last_maintenance": "2026-02-01T10:00:00Z",
    "alerts": []
  },
  "financial": {
    "monthly_revenue_usd": 48250.00,
    "monthly_energy_kwh": 138400,
    "electricity_cost_usd": 18630.00,
    "net_revenue_usd": 29620.00,
    "gross_margin_percent": 61.4
  }
}
```

---

## 2. Oracle On-Chain Payload

**Oracle Relay → EnergyOracle.sol**: Gas-optimised on-chain record.

- **Direction**: Oracle Relay → Avalanche C-Chain
- **Method**: `updateStationData(bytes calldata)`
- **Note**: Minimal fields on-chain for gas efficiency. Full data stored off-chain (IPFS or database).

### On-Chain Data

```json
{
  "stationId": "STK-KR-0001",
  "timestamp": 1739350800,
  "energyKwh": 482050,
  "revenueUsd": 168718,
  "sessionCount": 142,
  "uptimePercent": 9720,
  "utilizationPercent": 6240,
  "healthScore": 92,
  "anomalyFlag": false
}
```

### Encoding Rules

| Field | Encoding | Example |
|:---|:---|:---|
| `energyKwh` | actual × 100 (2 decimal places preserved, uint256) | 4820.50 → `482050` |
| `revenueUsd` | actual × 100 (cents, uint256) | 1687.18 → `168718` |
| `uptimePercent` | actual × 100 | 97.20% → `9720` |
| `utilizationPercent` | actual × 100 | 62.40% → `6240` |
| `timestamp` | Unix timestamp (seconds) | — |

---

## 3. AI Valuation

**Flutter App → AI Backend**: Token valuation request via APEX Engine.

- **Direction**: Flutter → Backend → Claude API
- **Endpoint**: `POST /api/v1/valuation/analyze`

### Request

```json
{
  "stationId": "STK-KR-0001",
  "tokenId": "ENRG-KR-0001",
  "analysis_type": "full",
  "parameters": {
    "discount_rate": 0.08,
    "projection_years": 10,
    "include_risk_score": true,
    "include_comparables": true
  }
}
```

### Response

```json
{
  "tokenId": "ENRG-KR-0001",
  "stationId": "STK-KR-0001",
  "timestamp": "2026-02-12T09:05:00Z",
  "valuation": {
    "fair_value_usd": 24.85,
    "current_price_usd": 22.50,
    "price_signal": "UNDERVALUED",
    "confidence": 0.82,
    "npv_usd": 248500.00,
    "irr_percent": 14.2,
    "payback_years": 4.8,
    "projected_annual_yield_percent": 8.6
  },
  "risk_assessment": {
    "overall_risk": "MEDIUM_LOW",
    "risk_score": 32,
    "factors": [
      {
        "factor": "revenue_stability",
        "score": 85,
        "grade": "A",
        "detail": "Consistent daily revenue with low variance (CV: 0.12)"
      },
      {
        "factor": "utilization_trend",
        "score": 78,
        "grade": "B+",
        "detail": "Steady upward trend, 62.4% avg utilization"
      },
      {
        "factor": "equipment_health",
        "score": 92,
        "grade": "A",
        "detail": "DERA health score 92, no anomalies detected"
      },
      {
        "factor": "market_competition",
        "score": 65,
        "grade": "B",
        "detail": "3 competing stations within 2km radius"
      },
      {
        "factor": "regulatory_risk",
        "score": 70,
        "grade": "B",
        "detail": "Stable EV policy environment in South Korea"
      }
    ]
  },
  "revenue_forecast": {
    "monthly_projections": [
      { "month": "2026-03", "revenue_usd": 49800, "confidence_low": 44200, "confidence_high": 54100 },
      { "month": "2026-04", "revenue_usd": 51200, "confidence_low": 44800, "confidence_high": 56500 },
      { "month": "2026-05", "revenue_usd": 53600, "confidence_low": 46100, "confidence_high": 59800 }
    ]
  },
  "comparables": [
    {
      "stationId": "STK-KR-0015",
      "name": "서초역 충전소 B",
      "token_price_usd": 26.10,
      "yield_percent": 7.8,
      "similarity_score": 0.89
    },
    {
      "stationId": "STK-KR-0023",
      "name": "역삼 충전소 C",
      "token_price_usd": 19.80,
      "yield_percent": 9.4,
      "similarity_score": 0.76
    }
  ],
  "ai_summary": "강남역 충전소 A는 안정적인 수익 구조와 높은 가동률을 보이며, 현재 토큰 가격 대비 약 10.4% 저평가 상태입니다. IRR 14.2%로 유사 충전소 대비 우수한 투자 효율을 나타냅니다."
}
```

---

## 4. Token Metadata

**EnergyToken**: STO metadata recorded at token issuance.

- **Direction**: Stored on-chain + IPFS
- **Standard**: Lightweight ERC-3643

```json
{
  "tokenId": "ENRG-KR-0001",
  "name": "EnergyFi Gangnam Station A",
  "symbol": "ENRG-GN-A",
  "decimals": 18,
  "total_supply": "10000",
  "token_type": "SECURITY_TOKEN",
  "standard": "ERC-3643",
  "chain": {
    "network": "avalanche-c-chain",
    "chain_id": 43114,
    "contract_address": "0x1234...abcd"
  },
  "underlying_asset": {
    "type": "EV_CHARGING_STATION",
    "stationId": "STK-KR-0001",
    "operator": "WingSide Energy",
    "location": "Seoul, Gangnam-gu",
    "capacity_kw": 814,
    "charger_count": 8,
    "commission_date": "2025-06-15"
  },
  "financial_terms": {
    "revenue_share_percent": 70,
    "distribution_frequency": "MONTHLY",
    "distribution_currency": "USDC",
    "minimum_holding_period_days": 30,
    "max_investors": 500
  },
  "compliance": {
    "kyc_required": true,
    "accredited_only": false,
    "jurisdiction_whitelist": ["KR", "US", "SG", "JP", "DE"],
    "jurisdiction_blacklist": ["CN", "RU"],
    "transfer_restricted": true,
    "identity_registry": "0xAAAA...1111"
  },
  "metadata_uri": "ipfs://QmXyz.../enrg-kr-0001.json"
}
```

---

## 5. Trade Order

**Flutter App → EnergyDEX.sol**: P2P order placement and matching.

- **Direction**: Flutter → Avalanche C-Chain (direct Tx)
- **Method**: `createOrder(bytes calldata)`

### Create Order

```json
{
  "tokenId": "ENRG-KR-0001",
  "side": "BUY",
  "order_type": "LIMIT",
  "quantity": "50",
  "price_usdc": "22.50",
  "total_usdc": "1125.00",
  "expiry_timestamp": 1739437200,
  "trader_address": "0xBBBB...2222"
}
```

### Event: OrderCreated

```json
{
  "event": "OrderCreated",
  "orderId": "0x9876...fedc",
  "tokenId": "ENRG-KR-0001",
  "trader": "0xBBBB...2222",
  "side": "BUY",
  "quantity": "50",
  "price_usdc": "22500000",
  "expiry": 1739437200,
  "block_number": 58234567,
  "tx_hash": "0xabcd...1234",
  "timestamp": 1739350800
}
```

### Event: OrderMatched

```json
{
  "event": "OrderMatched",
  "buyOrderId": "0x9876...fedc",
  "sellOrderId": "0x5432...abcd",
  "tokenId": "ENRG-KR-0001",
  "buyer": "0xBBBB...2222",
  "seller": "0xCCCC...3333",
  "quantity": "50",
  "price_usdc": "22500000",
  "total_usdc": "1125000000",
  "fee_usdc": "2812500",
  "fee_percent": 0.25,
  "block_number": 58234589,
  "tx_hash": "0xefgh...5678",
  "timestamp": 1739350920
}
```

### USDC Encoding

| Field | Rule | Example |
|:---|:---|:---|
| `price_usdc` | USDC 6 decimals | 22.50 → `22500000` |
| `total_usdc` | USDC 6 decimals | 1125.00 → `1125000000` |
| `fee_usdc` | USDC 6 decimals (0.25% trading fee) | 2.8125 → `2812500` |

---

## 6. Revenue Distribution

**RevenueVault.sol → Token Holders**: Yield deposit and claim events.

- **Direction**: On-Chain → Flutter App (event listening)

### Event: RevenueDeposited

```json
{
  "event": "RevenueDeposited",
  "tokenId": "ENRG-KR-0001",
  "period": "2026-01",
  "gross_revenue_usdc": "48250000000",
  "net_revenue_usdc": "29620000000",
  "distributable_usdc": "20734000000",
  "per_token_usdc": "2073400",
  "depositor": "0xDDDD...4444",
  "block_number": 58300000,
  "timestamp": 1738368000
}
```

### Claim Request (App → Contract)

```json
{
  "tokenId": "ENRG-KR-0001",
  "holder_address": "0xBBBB...2222",
  "token_balance": "50",
  "claimable_usdc": "103670000",
  "periods_unclaimed": ["2026-01"]
}
```

### Event: YieldClaimed

```json
{
  "event": "YieldClaimed",
  "tokenId": "ENRG-KR-0001",
  "holder": "0xBBBB...2222",
  "amount_usdc": "103670000",
  "period": "2026-01",
  "token_balance_at_snapshot": "50",
  "tx_hash": "0xijkl...9012",
  "timestamp": 1738454400
}
```

### Yield Calculation Example

| Metric | Value |
|:---|:---|
| per_token_usdc | `2073400` = 2.0734 USDC per token (Jan 2026) |
| Annualised | 2.0734 × 12 = ~24.88 USDC/year |
| At token price $22.50 | **~10.6% APY** |

---

## 7. Portfolio View

**Backend → Flutter App**: Aggregated portfolio data for the dashboard screen.

- **Direction**: AI Backend → Flutter App
- **Endpoint**: `GET /api/v1/portfolio/{walletAddress}`

### Response

```json
{
  "wallet_address": "0xBBBB...2222",
  "total_value_usd": 3847.50,
  "total_unrealized_pnl_usd": 292.50,
  "total_unrealized_pnl_percent": 8.23,
  "total_claimed_yield_usd": 103.67,
  "holdings": [
    {
      "tokenId": "ENRG-KR-0001",
      "symbol": "ENRG-GN-A",
      "station_name": "강남역 충전소 A",
      "quantity": 50,
      "avg_buy_price_usd": 21.00,
      "current_price_usd": 22.50,
      "market_value_usd": 1125.00,
      "unrealized_pnl_usd": 75.00,
      "unrealized_pnl_percent": 7.14,
      "claimable_yield_usd": 0,
      "last_yield_claimed": "2026-02-01T00:00:00Z",
      "ai_signal": "UNDERVALUED",
      "ai_fair_value_usd": 24.85,
      "risk_grade": "A-",
      "annual_yield_percent": 10.6
    },
    {
      "tokenId": "ENRG-KR-0015",
      "symbol": "ENRG-SC-B",
      "station_name": "서초역 충전소 B",
      "quantity": 100,
      "avg_buy_price_usd": 24.50,
      "current_price_usd": 26.10,
      "market_value_usd": 2610.00,
      "unrealized_pnl_usd": 160.00,
      "unrealized_pnl_percent": 6.53,
      "claimable_yield_usd": 18.40,
      "last_yield_claimed": "2026-01-01T00:00:00Z",
      "ai_signal": "FAIR_VALUE",
      "ai_fair_value_usd": 25.90,
      "risk_grade": "A",
      "annual_yield_percent": 7.8
    }
  ],
  "recent_transactions": [
    {
      "type": "BUY",
      "tokenId": "ENRG-KR-0001",
      "quantity": 50,
      "price_usd": 22.50,
      "total_usd": 1125.00,
      "tx_hash": "0xefgh...5678",
      "timestamp": "2026-02-12T09:15:00Z"
    },
    {
      "type": "YIELD_CLAIM",
      "tokenId": "ENRG-KR-0001",
      "amount_usd": 103.67,
      "period": "2026-01",
      "tx_hash": "0xijkl...9012",
      "timestamp": "2026-02-01T12:00:00Z"
    }
  ]
}
```

---

## 8. Marketplace Listing

**Backend → Flutter App**: Token listing for the marketplace screen.

- **Direction**: AI Backend → Flutter App
- **Endpoint**: `GET /api/v1/marketplace/tokens`

### Response

```json
{
  "total_tokens": 12,
  "total_market_cap_usd": 2845000,
  "tokens": [
    {
      "tokenId": "ENRG-KR-0001",
      "symbol": "ENRG-GN-A",
      "station_name": "강남역 충전소 A",
      "location": "Seoul, Gangnam",
      "country": "KR",
      "current_price_usd": 22.50,
      "price_change_24h_percent": 1.8,
      "market_cap_usd": 225000,
      "volume_24h_usd": 4500,
      "annual_yield_percent": 10.6,
      "ai_signal": "UNDERVALUED",
      "risk_grade": "A-",
      "health_score": 92,
      "utilization_percent": 62.4,
      "charger_count": 8,
      "capacity_kw": 814,
      "open_orders": {
        "best_bid_usd": 22.30,
        "best_ask_usd": 22.80,
        "bid_depth": 320,
        "ask_depth": 180
      }
    },
    {
      "tokenId": "ENRG-KR-0015",
      "symbol": "ENRG-SC-B",
      "station_name": "서초역 충전소 B",
      "location": "Seoul, Seocho",
      "country": "KR",
      "current_price_usd": 26.10,
      "price_change_24h_percent": -0.4,
      "market_cap_usd": 261000,
      "volume_24h_usd": 2800,
      "annual_yield_percent": 7.8,
      "ai_signal": "FAIR_VALUE",
      "risk_grade": "A",
      "health_score": 95,
      "utilization_percent": 71.2,
      "charger_count": 12,
      "capacity_kw": 1200,
      "open_orders": {
        "best_bid_usd": 25.90,
        "best_ask_usd": 26.30,
        "bid_depth": 450,
        "ask_depth": 220
      }
    }
  ],
  "filters_available": {
    "countries": ["KR", "US", "SG", "JP", "DE"],
    "sort_by": ["price", "yield", "risk_grade", "volume", "ai_signal"],
    "ai_signals": ["UNDERVALUED", "FAIR_VALUE", "OVERVALUED"],
    "risk_grades": ["A+", "A", "A-", "B+", "B", "B-", "C"]
  }
}
```
