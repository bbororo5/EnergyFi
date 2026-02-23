# ELECTRA × STRIKON × AVALANCHE
## 인터페이스 데이터 명세서 v1.0

> **문서 구분**: 프로세스 인터페이스 & 스마트컨트랙트 정의  
> **버전**: v1.0 — 2026.02  
> **커버리지**: 9단계 End-to-End + 스마트컨트랙트  
> **블록체인**: Avalanche L1 (AvaCloud Managed)  
> **주관**: STRIKON (Wingside Inc.)  

---

## 목차

1. [인터페이스 전체 맵](#1-인터페이스-전체-맵)
2. [STEP ① ELECTRA 충전기 → Charger Gateway](#2-step--electra-충전기--charger-gateway)
3. [STEP ② Charger Gateway → RabbitMQ](#3-step--charger-gateway--rabbitmq)
4. [STEP ③ Domain Logic Processor → Payments Gateway](#4-step--domain-logic-processor--payments-gateway)
5. [STEP ④ 외부 PG → External Callback Gateway](#5-step--외부-pg--external-callback-gateway)
6. [STEP ⑤ Domain Logic Processor → RabbitMQ (invoice.paid)](#6-step--domain-logic-processor--rabbitmq-invoicepaid)
7. [STEP ⑥ Blockchain Bridge → Avalanche L1](#7-step--blockchain-bridge--avalanche-l1)
8. [STEP ⑦ Avalanche L1 → Blockchain Bridge](#8-step--avalanche-l1--blockchain-bridge)
9. [STEP ⑧ Blockchain Bridge → PostgreSQL](#9-step--blockchain-bridge--postgresql)
10. [STEP ⑨ 투자자 앱 → Avalanche L1 (claim)](#10-step--투자자-앱--avalanche-l1-claim)
11. [스마트컨트랙트 인터페이스](#11-스마트컨트랙트-인터페이스)
    - [RegionSTOFactory.sol](#regionstofactorysol)
    - [RegionSTO.sol](#regionstosol)
12. [오류 코드 정의](#12-오류-코드-정의)

---

## 1. 인터페이스 전체 맵

ELECTRA 충전기에서 투자자 AVAX 수령까지 9단계 인터페이스. 각 단계는 JSON 페이로드, 필드 타입, 유효성 규칙을 포함한다.

| # | 송신 | 수신 | 프로토콜 | 핵심 데이터 |
|---|------|------|----------|------------|
| ① | ELECTRA 충전기 | Charger Gateway | OCPP 1.6 WebSocket | `StopTransaction` |
| ② | Charger Gateway | RabbitMQ | AMQP Publish | `session.stopped` |
| ③ | Domain Logic Processor | Payments Gateway | gRPC `:50067` | `ExecutePayment` |
| ④ | 외부 PG | External Callback GW | HTTPS Webhook | `payment_result` |
| ⑤ | Domain Logic Processor | RabbitMQ | AMQP Publish | `invoice.paid` |
| ⑥ | Blockchain Bridge | Avalanche L1 (RPC) | JSON-RPC `eth_sendRawTransaction` | `distributeRevenue()` |
| ⑦ | Avalanche L1 | Blockchain Bridge | Event Log `eth_getLogs` | `RevenueDistributed` |
| ⑧ | Blockchain Bridge | PostgreSQL | SQL UPDATE | `blockchain_status` |
| ⑨ | 투자자 앱 | Avalanche L1 (RPC) | JSON-RPC `eth_sendRawTransaction` | `claim()` |

---

## 2. STEP ① ELECTRA 충전기 → Charger Gateway

**프로토콜**: OCPP 1.6 · WebSocket JSON · Call [2]  
**방향**: `ELECTRA 충전기` → `Charger Gateway`

### 요청 페이로드 — StopTransaction.req

```json
{
  "messageTypeId": 2,
  "uniqueId": "550e8400-e29b-41d4-a716-446655440000",
  "action": "StopTransaction",
  "payload": {
    "transactionId": 98765,
    "meterStop": 45230,
    "timestamp": "2026-02-20T14:35:22.000Z",
    "reason": "EVDisconnected",
    "idTag": "A1B2C3D4",
    "transactionData": [
      {
        "timestamp": "2026-02-20T14:35:22.000Z",
        "sampledValue": [
          {
            "value": "45230",
            "measurand": "Energy.Active.Import.Register",
            "unit": "Wh",
            "context": "Transaction.End",
            "location": "Outlet"
          },
          {
            "value": "7.4",
            "measurand": "Power.Active.Import",
            "unit": "kW",
            "context": "Transaction.End"
          }
        ]
      }
    ]
  }
}
```

### 응답 페이로드 — StopTransaction.conf

```json
{
  "messageTypeId": 3,
  "uniqueId": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {
    "idTagInfo": {
      "status": "Accepted",
      "expiryDate": "2026-12-31T23:59:59.000Z"
    }
  }
}
```

### 필드 정의

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `transactionId` | `integer` | ✓ | StartTransaction 시 부여된 OCPP 트랜잭션 ID. 세션 레코드 연결 키. |
| `meterStop` | `integer` | ✓ | 종료 시 에너지 미터값(Wh). `meterStop - meterStart` = 충전 전력량. DERA 이상치 검증 대상. |
| `timestamp` | `ISO 8601` | ✓ | UTC 세션 종료 시각. 서버 시각과 ±5분 이내여야 함. |
| `reason` | `enum` | ✓ | `EVDisconnected` \| `Local` \| `Remote` \| `EmergencyStop` \| `PowerLoss` \| `Reboot` \| `Other` |
| `idTag` | `string` | — | RFID/QR/앱 인증 토큰. 앱 세션은 null 허용. |
| `transactionData` | `array` | — | MeterValue 스냅샷 배열. 정밀 과금 및 DERA 이상 감지에 필수. |

---

## 3. STEP ② Charger Gateway → RabbitMQ

**프로토콜**: AMQP 0-9-1 · Publish  
**Exchange**: `strikon.events`  
**방향**: `Charger Gateway` → `RabbitMQ`

### 이벤트 페이로드 — session.stopped

```json
{
  "event_type": "session.stopped",
  "event_id": "evt_7f3a8b2c-1d4e-4f5a-8c7b-9e0d1f2a3b4c",
  "event_version": "1.0",
  "published_at": "2026-02-20T14:35:23.145Z",
  "source_service": "charger-gateway",
  "payload": {
    "session_id": "sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "transaction_id": 98765,
    "charger_id": "chrg_9f8e7d6c-5b4a-3210-fedc-ba9876543210",
    "charger_serial": "ELEC-2026-GN-001-005",
    "station_id": "stn_1a2b3c4d-5e6f-7890-1234-abcdef567890",
    "region_id": "KR-11",
    "connector_id": 2,
    "id_tag": "A1B2C3D4",
    "meter_start": 38450,
    "meter_stop": 45230,
    "energy_delivered_wh": 6780,
    "started_at": "2026-02-20T13:22:10.000Z",
    "stopped_at": "2026-02-20T14:35:22.000Z",
    "duration_seconds": 4392,
    "stop_reason": "EVDisconnected",
    "dera_anomaly_flag": false,
    "ocpp_transaction_data": {
      "sampled_values": [
        { "measurand": "Energy.Active.Import.Register", "value": 45230, "unit": "Wh" },
        { "measurand": "Power.Active.Import", "value": 7.4, "unit": "kW" }
      ]
    }
  }
}
```

### 필드 정의

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `event_id` | `UUID v4` | ✓ | 전역 고유 이벤트 식별자. 하위 서비스 멱등성 처리 키. |
| `charger_id` | `UUID v4` | ✓ | STRIKON 충전기 엔티티 ID. |
| `charger_serial` | `string` | ✓ | 물리 시리얼. 형식: `ELEC-{년도}-{지역}-{스테이션}-{유닛}` |
| `energy_delivered_wh` | `integer` | ✓ | 청구 대상 전력량(Wh). DERA가 통계적 이상치 여부 검증. |
| `dera_anomaly_flag` | `boolean` | ✓ | `true` 시 과금 및 블록체인 제출 보류. DERA가 별도 조사 큐로 라우팅. |
| `station_id` | `UUID v4` | ✓ | 프랜차이즈 스테이션 ID. Blockchain Bridge가 StationRegistry를 통해 region_id를 조회하여 Region STO 컨트랙트로 라우팅. |
| `region_id`  | `string`  | ✓ | 행정구역 코드 (ISO 3166-2:KR). 예: `"KR-11"` (서울). 1 행정구역 = 1 STO 컨트랙트. Blockchain Bridge가 `region_sto_contracts` 테이블 조회에 사용. |
| `stop_reason` | `enum` | ✓ | `EVDisconnected` \| `Local` \| `Remote` \| `EmergencyStop` \| `PowerLoss` \| `Reboot` \| `Other` |

> **RabbitMQ 라우팅**  
> 라우팅 키: `session.stopped` · Exchange: `strikon.events` · Queue: `domain-logic.session-events`  
> Dead Letter Queue: `strikon.dlq` (3회 재시도 후, 30초 / 5분 / 15분 백오프)

---

## 4. STEP ③ Domain Logic Processor → Payments Gateway

**프로토콜**: gRPC · UnaryCall  
**엔드포인트**: `:50067` `/payments.PaymentsService/ExecutePayment`  
**방향**: `Domain Logic Processor` → `Payments Gateway`

### gRPC 요청 — ExecutePaymentRequest

```json
{
  "invoice_id": "inv_c3d4e5f6-7890-abcd-ef12-345678901234",
  "session_id": "sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "charger_id": "chrg_9f8e7d6c-5b4a-3210-fedc-ba9876543210",
  "station_id": "stn_1a2b3c4d-5e6f-7890-1234-abcdef567890",
  "region_id": "KR-11",
  "cpo_id": "cpo_f1e2d3c4-b5a6-9870-fedc-ba0987654321",
  "user_id": "usr_a0b1c2d3-e4f5-6789-0abc-def123456789",
  "billing_mode": "POSTPAID",
  "amount": {
    "subtotal_krw": 14545,
    "vat_krw": 1455,
    "total_krw": 16000,
    "energy_kwh": 6.780,
    "unit_price_per_kwh": 214.5,
    "currency": "KRW"
  },
  "payment_method": {
    "type": "CREDIT_CARD",
    "billing_key": "bk_encrypted_xxxx",
    "pg_provider": "INICIS"
  },
  "metadata": {
    "charging_started_at": "2026-02-20T13:22:10.000Z",
    "charging_stopped_at": "2026-02-20T14:35:22.000Z"
  }
}
```

### gRPC 응답 — ExecutePaymentResponse

```json
{
  "invoice_id": "inv_c3d4e5f6-7890-abcd-ef12-345678901234",
  "pg_transaction_id": "pg_INICIS_20260220143526_abcdef",
  "pg_provider": "INICIS",
  "status": "PENDING",
  "message": "결제 처리 중. PG 콜백 대기.",
  "initiated_at": "2026-02-20T14:35:26.000Z"
}
```

### 필드 정의

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `invoice_id` | `UUID v4` | ✓ | STRIKON 생성 인보이스 ID. `invoices` 테이블 PK. 하위 모든 이벤트 참조 키. |
| `total_krw` | `integer` | ✓ | 최종 청구 금액(원). VAT 포함. Blockchain Bridge의 AVAX 환산 입력값. |
| `billing_mode` | `enum` | ✓ | `PREPAID` \| `POSTPAID` \| `MEMBERSHIP` \| `ROAMING`. 과금 방식 및 PG 흐름 결정. |
| `billing_key` | `string` | ✓ | AES-256-GCM 암호화된 PG 빌링키. **평문 로그 출력 절대 금지.** |
| `pg_provider` | `enum` | ✓ | `INICIS` \| `KAKAOPAY` \| `NAVERPAY` \| `TOSS` \| `KSNET`. `cpo_id` 기반 자동 라우팅. |
| `unit_price_per_kwh` | `decimal` | ✓ | 적용 단가(원/kWh). 활성 타리프 스케줄로부터 계산. |

---

## 5. STEP ④ 외부 PG → External Callback Gateway

**프로토콜**: HTTPS POST · HMAC-SHA256 검증  
**엔드포인트**: `/webhooks/pg/result`  
**방향**: `PG (INICIS / TOSS 등)` → `External Callback Gateway`

### 인바운드 웹훅 페이로드 (정규화)

```json
{
  "pg_provider": "INICIS",
  "pg_transaction_id": "pg_INICIS_20260220143526_abcdef",
  "merchant_order_id": "inv_c3d4e5f6-7890-abcd-ef12-345678901234",
  "result_code": "0000",
  "result_message": "정상처리",
  "paid_amount": 16000,
  "currency": "KRW",
  "paid_at": "2026-02-20T14:35:28.417Z",
  "payment_method": "CREDIT_CARD",
  "card_info": {
    "masked_number": "4321-****-****-1234",
    "issuer": "KB",
    "approval_number": "12345678"
  },
  "checksum": "sha256_hmac_base64encoded_signature"
}
```

### 내부 정규화 이벤트 — PAYMENT.RESULT

```json
{
  "event_type": "PAYMENT.RESULT",
  "invoice_id": "inv_c3d4e5f6-7890-abcd-ef12-345678901234",
  "pg_transaction_id": "pg_INICIS_20260220143526_abcdef",
  "pg_provider": "INICIS",
  "status": "SUCCESS",
  "paid_amount_krw": 16000,
  "paid_at": "2026-02-20T14:35:28.417Z",
  "failure_code": null,
  "failure_reason": null
}
```

### 필드 정의

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `merchant_order_id` | `UUID v4` | ✓ | STRIKON `invoice_id`와 반드시 일치. 불일치 시 즉시 거부. |
| `result_code` | `string` | ✓ | `"0000"` = 성공. 그 외 코드는 실패 경로 → 블록체인 제출 없음. |
| `checksum` | `string` | ✓ | HMAC-SHA256 서명. 공유 PG 시크릿으로 검증. 검증 실패 시 처리 거부. |
| `paid_at` | `ISO 8601` | ✓ | PG 확정 결제 시각. `invoices.pg_paid_at`에 저장. |
| `failure_reason` | `string` | — | 실패 사유. DERA 이상 추적 로그 기록. |

> **⚠️ 보안 정책**  
> - `checksum` 검증은 모든 처리 전 필수. 무결성 실패 시 HTTP 400 즉시 반환.  
> - 멱등성: 동일 `pg_transaction_id` 재수신 시 무시 (HTTP 202 반환, 재처리 없음).  
> - `result_code ≠ "0000"` 인 경우 `invoice.paid` 이벤트를 발행하지 않으며, 블록체인 제출이 일어나지 않는다.

---

## 6. STEP ⑤ Domain Logic Processor → RabbitMQ (invoice.paid)

**프로토콜**: AMQP 0-9-1 · Publish  
**Exchange**: `strikon.billing`  
**방향**: `Domain Logic Processor` → `RabbitMQ`

> `invoice.paid`는 STO 온체인 배분의 핵심 트리거 이벤트다.

### 이벤트 페이로드 — invoice.paid

```json
{
  "event_type": "invoice.paid",
  "event_id": "evt_9a8b7c6d-5e4f-3210-fedc-ba9876543210",
  "event_version": "1.0",
  "published_at": "2026-02-20T14:35:29.002Z",
  "source_service": "domain-logic-processor",
  "payload": {
    "invoice_id": "inv_c3d4e5f6-7890-abcd-ef12-345678901234",
    "session_id": "sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "charger_id": "chrg_9f8e7d6c-5b4a-3210-fedc-ba9876543210",
    "station_id": "stn_1a2b3c4d-5e6f-7890-1234-abcdef567890",
    "region_id": "KR-11",
    "cpo_id": "cpo_f1e2d3c4-b5a6-9870-fedc-ba0987654321",
    "amount": {
      "gross_krw": 16000,
      "platform_fee_krw": 1600,
      "distributable_krw": 14400,
      "platform_fee_rate": 0.10
    },
    "payment": {
      "pg_transaction_id": "pg_INICIS_20260220143526_abcdef",
      "pg_provider": "INICIS",
      "pg_paid_at": "2026-02-20T14:35:28.417Z"
    },
    "charging": {
      "energy_delivered_kwh": 6.780,
      "unit_price_per_kwh": 214.5,
      "charging_started_at": "2026-02-20T13:22:10.000Z",
      "charging_stopped_at": "2026-02-20T14:35:22.000Z"
    }
  }
}
```

### 필드 정의

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `invoice_id` | `UUID v4` | ✓ | `sto_revenue_distributions` 테이블의 FK. 블록체인 제출 상태 추적 기준. |
| `gross_krw` | `integer` | ✓ | PG 수령 총액(원). AVAX 환산의 입력값. |
| `platform_fee_krw` | `integer` | ✓ | STRIKON 플랫폼 수수료 10%. 공제 후 `distributable_krw` 산출. |
| `distributable_krw` | `integer` | ✓ | `gross_krw - platform_fee_krw`. 이 금액만큼 AVAX 구매 후 홀더에게 배분. |
| `charger_id` | `UUID v4` | ✓ | 충전기 ID. |
| `station_id` | `UUID v4` | ✓ | 스테이션 ID. RegionSTO의 `distributeRevenue()` 호출 시 매출 원천 추적에 사용. |
| `region_id` | `string` | ✓ | 행정구역 코드 (ISO 3166-2:KR). Blockchain Bridge가 `region_sto_contracts` 테이블 조회에 사용. 해당 구역에 Region STO 컨트랙트가 없으면 ACK 후 스킵. |

> **RabbitMQ 라우팅**
> 라우팅 키: `invoice.paid` · Exchange: `strikon.billing` · Queue: `blockchain-bridge.invoice-paid`
> 중요: `result_code="0000"` 인 결제 성공 건만 이 이벤트를 발행한다.
> Region STO 컨트랙트 없는 행정구역이면 즉시 ACK하고 블록체인 동작 없이 종료.

---

## 7. STEP ⑥ Blockchain Bridge → Avalanche L1

**프로토콜**: JSON-RPC 2.0 · `eth_sendRawTransaction`  
**엔드포인트**: AvaCloud L1 RPC `:8545`  
**방향**: `Blockchain Bridge Service` → `Avalanche L1`

### Bridge 내부 처리 입력 (DB 조회 결과 합산)

```json
{
  "invoice_id": "inv_c3d4e5f6-7890-abcd-ef12-345678901234",
  "region_id": "KR-11",
  "station_id": "stn_1a2b3c4d-5e6f-7890-1234-abcdef567890",
  "contract_address": "0xAbC1234567890dEf1234567890ABCdef12345678",
  "distributable_krw": 14400,
  "avax_amount_wei": "28800000000000000",
  "avax_price_krw": 50000,
  "exchange_rate_id": "rate_2026-02-20",
  "holders": [
    { "wallet": "0xAaa...111", "tokens": 300, "share_pct": 30.0 },
    { "wallet": "0xBbb...222", "tokens": 500, "share_pct": 50.0 },
    { "wallet": "0xCcc...333", "tokens": 200, "share_pct": 20.0 }
  ]
}
```

### eth_sendRawTransaction 요청

```json
{
  "jsonrpc": "2.0",
  "method": "eth_sendRawTransaction",
  "params": [
    "0x02f8ac...signed_rlp_encoded_transaction"
  ],
  "id": 1
}
```

**디코딩된 트랜잭션 필드 (참고용)**

```json
{
  "to": "0xAbC1234567890dEf1234567890ABCdef12345678",
  "value": "0x6671BED38D800",
  "data": "0x9b3f1234...",
  "chainId": 424242,
  "nonce": 47,
  "gasLimit": "0x30D40",
  "maxFeePerGas": "0x3B9ACA00"
}
```

| 필드 | 값 | 설명 |
|------|-----|------|
| `to` | `RegionSTO 주소` | 대상 스마트컨트랙트 (행정구역별 1개) |
| `value` | `distributable AVAX (wei, hex)` | 전송할 AVAX |
| `data` | `distributeRevenue(invoiceId, amount, stationId) ABI 인코딩` | 함수 호출 데이터 |
| `chainId` | `424242` | STRIKON Avalanche L1 전용 체인 ID |
| `gasLimit` | `200,000` | `distributeRevenue` 리전 홀더 수 기반 추산 |

### eth_sendRawTransaction 응답

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x7f3a8b2c1d4e4f5a8c7b9e0d1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a"
}
```

### 재시도 정책

| 단계 | 시점 | 처리 |
|------|------|------|
| 1차 재시도 | 30초 후 | `bridge_retry_count = 1`. 동일 nonce로 재전송 (gas price +10%). |
| 2차 재시도 | 5분 후 | `bridge_retry_count = 2`. gas price +20%. |
| 3차 실패 | — | Dead Letter Queue 이관. `blockchain_status = FAILED`. 운영자 알림 + 수동 재처리. |

---

## 8. STEP ⑦ Avalanche L1 → Blockchain Bridge

**프로토콜**: `eth_getTransactionReceipt` / `eth_getLogs` · 이벤트 폴링  
**방향**: `Avalanche L1` → `Blockchain Bridge Service`

### 트랜잭션 Receipt 조회 요청

```json
{
  "jsonrpc": "2.0",
  "method": "eth_getTransactionReceipt",
  "params": [
    "0x7f3a8b2c1d4e4f5a8c7b9e0d1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a"
  ],
  "id": 2
}
```

### Receipt 응답 (블록 컨펌 후)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "transactionHash": "0x7f3a8b2c...9f0a",
    "blockNumber": "0x1A2B3C",
    "blockHash": "0xdeadbeef...cafe",
    "status": "0x1",
    "gasUsed": "0x1F4A0",
    "logs": [
      {
        "address": "0xAbC1234567890dEf1234567890ABCdef12345678",
        "topics": [
          "0x8b9e5a6f...",
          "0x696e766f..."
        ],
        "data": "0x000...distributable_amount_and_timestamp",
        "logIndex": "0x0"
      }
    ]
  }
}
```

### RevenueDistributed 이벤트 디코딩 결과

```json
{
  "event": "RevenueDistributed",
  "contract_address": "0xAbC1234567890dEf1234567890ABCdef12345678",
  "region_id": "KR-11",
  "station_id": "stn_1a2b3c4d-5e6f-7890-1234-abcdef567890",
  "tx_hash": "0x7f3a8b2c...9f0a",
  "block_number": 1715004,
  "block_timestamp": 1740059730,
  "invoice_id": "inv_c3d4e5f6-7890-abcd-ef12-345678901234",
  "total_distributed_wei": "28800000000000000",
  "holder_count": 3,
  "cumulative_revenue_wei": "144000000000000000"
}
```

### 필드 정의

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `status` | `0x1 / 0x0` | ✓ | `0x1` = 성공. `0x0` = reverted. reverted 시 Bridge가 DLQ로 이관 후 분석. |
| `topics[0]` | `bytes32` | ✓ | `keccak256(이벤트 시그니처)`. Bridge가 필터링에 사용. |
| `invoice_id` | `bytes32` | ✓ | 인보이스 ID (indexed). `eth_getLogs`의 topics 필터로 효율적 조회 가능. |
| `total_distributed_wei` | `string` | ✓ | 실제 배분된 AVAX 총액 (wei). DB의 `distributed_amount`와 대조 검증. |
| `block_number` | `string (hex)` | ✓ | 컨펌 임계값: 1 블록 (~2초, Avalanche Granite 기준). |

---

## 9. STEP ⑧ Blockchain Bridge → PostgreSQL

**프로토콜**: SQL · pgx/v5  
**방향**: `Blockchain Bridge Service` → `PostgreSQL`

### invoices 테이블 업데이트

```sql
UPDATE invoices SET
  blockchain_status        = 'CONFIRMED',
  blockchain_tx_hash       = '0x7f3a8b2c...9f0a',
  blockchain_submitted_at  = '2026-02-20T14:35:30.500Z',
  blockchain_confirmed_at  = '2026-02-20T14:35:32.891Z',
  blockchain_retry_count   = 0,
  updated_at               = NOW()
WHERE id = 'inv_c3d4e5f6-7890-abcd-ef12-345678901234';
```

### sto_revenue_distributions 레코드 삽입

```json
{
  "id": "dist_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "invoice_id": "inv_c3d4e5f6-7890-abcd-ef12-345678901234",
  "charger_id": "chrg_9f8e7d6c-5b4a-3210-fedc-ba9876543210",
  "station_id": "stn_1a2b3c4d-5e6f-7890-1234-abcdef567890",
  "region_id": "KR-11",
  "contract_address": "0xAbC1234567890dEf1234567890ABCdef12345678",
  "gross_amount_krw": 16000,
  "platform_fee_krw": 1600,
  "distributable_krw": 14400,
  "avax_price_krw": 50000,
  "distributed_avax_wei": "28800000000000000",
  "blockchain_status": "CONFIRMED",
  "tx_hash": "0x7f3a8b2c...9f0a",
  "block_number": 1715004,
  "retry_count": 0,
  "submitted_at": "2026-02-20T14:35:30.500Z",
  "confirmed_at": "2026-02-20T14:35:32.891Z",
  "exchange_rate_id": "rate_2026-02-20"
}
```

### blockchain_status Enum 전이

| 상태 | 전이 조건 | 설명 |
|------|-----------|------|
| `PENDING` | 이벤트 소비 직후 | `invoice.paid` 소비 → DB 레코드 생성. RPC 전송 전. |
| `SUBMITTED` | `eth_sendRawTx` 성공 | tx_hash 수령 완료. 블록 컨펌 대기 중. |
| `CONFIRMED` | `receipt.status = 0x1` | 온체인 실행 성공. 홀더 claimable 잔액 적립 완료. |
| `FAILED` | 3회 재시도 모두 실패 | DLQ 이관. 운영자 알림. 수동 재처리 필요. |

---

## 10. STEP ⑨ 투자자 앱 → Avalanche L1 (claim)

**프로토콜**: JSON-RPC 2.0 · `eth_sendRawTransaction` · WalletConnect v2  
**방향**: `ELECTRA STO 투자자 앱` → `Avalanche L1 (RegionSTO 컨트랙트)`

### 출금 전 잔액 조회 — getClaimable()

```json
{
  "jsonrpc": "2.0",
  "method": "eth_call",
  "params": [
    {
      "to": "0xAbC1234567890dEf1234567890ABCdef12345678",
      "data": "0x4e71d92d000000000000000000000000Aaa...111"
    },
    "latest"
  ],
  "id": 3
}
```

**응답**

```json
{
  "result": "0x000000000000000000000000000000000000000000000000006671BED38D800"
}
```

> `0x006671BED38D800` = 28,800,000,000,000,000 wei = **0.0288 AVAX**

### claim() 트랜잭션 전송

```json
{
  "jsonrpc": "2.0",
  "method": "eth_sendRawTransaction",
  "params": ["0x02f8...claim_signed_tx"],
  "id": 4
}
```

**디코딩된 트랜잭션 필드**

```json
{
  "from": "0xAaa...111",
  "to": "0xAbC1234567890dEf1234567890ABCdef12345678",
  "value": "0x0",
  "data": "0x4e71d92d",
  "chainId": 424242,
  "gasLimit": "0x186A0"
}
```

### claim() 실행 결과 — 앱 표시용 데이터

```json
{
  "status": "SUCCESS",
  "tx_hash": "0xf1e2d3c4...claim_tx_hash",
  "claimed_avax_wei": "28800000000000000",
  "claimed_avax_display": "0.0288 AVAX",
  "claimed_krw_est": 1440,
  "confirmed_at": "2026-02-20T14:35:51.203Z",
  "snowtrace_url": "https://explorer.strikon-l1.avax.network/tx/0xf1e2d3c4..."
}
```

### 필드 정의

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `claimed_avax_wei` | `string` | ✓ | 수령한 AVAX (wei). JavaScript `BigInt` 사용 필수 (Number 정밀도 초과 위험). |
| `claimed_avax_display` | `string` | ✓ | 앱 표시용 소수점 변환값. `formatEther(claimed_avax_wei)` 적용. |
| `snowtrace_url` | `string` | ✓ | STRIKON L1 블록 익스플로러 URL. 투자자가 직접 온체인 확인 가능. |
| `chainId` | `integer` | ✓ | STRIKON Avalanche L1 전용 체인 ID. 다른 네트워크 전송 방지. |

---

## 11. 스마트컨트랙트 인터페이스

Avalanche L1에 배포되는 2개 컨트랙트의 전체 함수, 파라미터, 이벤트를 정의한다.

---

### RegionSTOFactory.sol

행정구역별 `RegionSTO` 컨트랙트를 표준화 배포하고, 전체 레지스트리를 관리하는 팩토리 컨트랙트. 전국 17개 행정구역 각각에 대해 최대 1개의 RegionSTO를 배포한다.

#### 함수 — deployRegionSTO()

```solidity
function deployRegionSTO(
  bytes4         regionId,
  string calldata regionName,
  string calldata tokenSymbol,
  address[] calldata holders,
  uint256[] calldata tokenAmounts,
  address        bridgeAddress
) external onlyAdmin returns (address contractAddress)
```

**파라미터**

| 파라미터 | JSON 타입 | Solidity | 설명 |
|----------|-----------|----------|------|
| `regionId` | `string (bytes4)` | `bytes4` | 행정구역 코드 (ISO 3166-2:KR). 예: `0x4b523131` = `"KR-11"` (서울). |
| `regionName` | `string` | `string` | 행정구역 명칭. 예: `"서울특별시"`. |
| `tokenSymbol` | `string` | `string` | 토큰 심볼. 예: `"ELEC-SEOUL"`. 중복 허용 안 됨. |
| `holders` | `string[]` | `address[]` | KYC 완료 투자자 지갑 주소 배열. |
| `tokenAmounts` | `integer[]` | `uint256[]` | 각 홀더 초기 보유 토큰 수. 합산 = 초기 `totalSupply`. |
| `bridgeAddress` | `string` | `address` | Blockchain Bridge Service 지갑 주소. `distributeRevenue` 권한 부여. |

**요청 JSON 예시**

```json
{
  "method": "deployRegionSTO",
  "params": {
    "regionId": "0x4b523131",
    "regionName": "서울특별시",
    "tokenSymbol": "ELEC-SEOUL",
    "holders": [
      "0xAaa...111",
      "0xBbb...222",
      "0xCcc...333"
    ],
    "tokenAmounts": [300, 500, 200],
    "bridgeAddress": "0xBridge...ServiceWallet"
  }
}
```

**이벤트**

```solidity
event RegionSTODeployed(
  bytes4  indexed regionId,
  address indexed contractAddress,
  string          regionName,
  string          tokenSymbol,
  uint256         totalSupply,
  uint256         deployedAt
);
```

#### 함수 — getContract()

```solidity
function getContract(
  bytes4 regionId
) external view returns (address contractAddress, bool isActive)
```

**응답 예시**

```json
{
  "regionId": "0x4b523131",
  "regionName": "서울특별시",
  "contractAddress": "0xAbC1234567890dEf1234567890ABCdef12345678",
  "isActive": true
}
```

---

### RegionSTO.sol

행정구역 1개당 1개 배포되는 핵심 STO 컨트랙트. 리전 내 모든 충전소의 수익을 풀링하여 토큰 보유자에게 배분한다. 동적 공급량(mint)을 지원한다.

#### 상태 변수 (Storage Layout)

```json
{
  "regionId":           "bytes4   — 행정구역 코드 (ISO 3166-2:KR)",
  "regionName":         "string   — 행정구역 명칭 (예: '서울특별시')",
  "tokenSymbol":        "string   — 예: 'ELEC-SEOUL'",
  "totalSupply":        "uint256  — 현재 총 토큰 수 (동적 민팅 가능)",
  "bridgeAddress":      "address  — onlyBridge modifier 대상",
  "totalRevenue":       "uint256  — 누적 배분 AVAX 총액 (wei)",
  "tokenBalances":      "mapping(address => uint256) — 홀더별 토큰 수",
  "claimable":          "mapping(address => uint256) — 홀더별 미출금 AVAX (wei)",
  "whitelist":          "mapping(address => bool)    — KYC 화이트리스트",
  "processedInvoices":  "mapping(bytes32 => bool)    — 이중 배분 방지 nonce"
}
```

---

#### 함수 — distributeRevenue()

```solidity
function distributeRevenue(
  bytes32 invoiceId,
  uint256 amount,
  bytes32 stationId
) external payable onlyBridge
```

> 충전 1회 수익을 홀더별 지분율(`share_pct`)로 자동 배분.
> 호출 시 AVAX를 함께 전송(`msg.value`).
> 동일 `invoiceId` 이중 실행 방지 (nonce 체크).
> `stationId`는 매출 원천 추적용 — 라우팅에는 사용하지 않음.

**파라미터**

| 파라미터 | JSON 타입 | Solidity | 설명 |
|----------|-----------|----------|------|
| `invoiceId` | `string (bytes32)` | `bytes32` | STRIKON 인보이스 ID. bytes32 변환. 이중 배분 방지 nonce 역할. |
| `amount` | `string` | `uint256` | 배분할 총 AVAX 금액(wei). `msg.value`와 반드시 일치 검증. |
| `stationId` | `string (bytes32)` | `bytes32` | 매출이 발생한 스테이션 ID. 투자자 투명성을 위한 이벤트 기록용. |

**요청 JSON 예시**

```json
{
  "method": "distributeRevenue",
  "contract": "0xAbC1234567890dEf1234567890ABCdef12345678",
  "value_wei": "28800000000000000",
  "params": {
    "invoiceId": "0x696e765f63336434653566362d373839302d616263642d656631322d333435363738393031323334",
    "amount": "28800000000000000",
    "stationId": "0x73746e5f31613262336334642d356536662d373839302d313233342d616263646566353637383930"
  }
}
```

**내부 실행 로직**

```solidity
// Solidity 의사코드 — distributeRevenue 내부 처리
function distributeRevenue(bytes32 invoiceId, uint256 amount, bytes32 stationId) external payable onlyBridge {

  // 1. 검증
  require(msg.sender == bridgeAddress,        "onlyBridge");
  require(!processedInvoices[invoiceId],       "DuplicateInvoice");
  require(msg.value == amount,                 "AmountMismatch");

  // 2. 홀더별 배분 계산 및 claimable 적립
  for (uint i = 0; i < holders.length; i++) {
    uint256 share = (amount * tokenBalances[holders[i]]) / totalSupply;
    claimable[holders[i]] += share;
  }

  // 3. 상태 업데이트
  processedInvoices[invoiceId] = true;  // 이중 실행 방지
  totalRevenue += amount;

  // 4. 이벤트 발행 (stationId로 매출 원천 추적 가능)
  emit RevenueDistributed(invoiceId, amount, holders.length, totalRevenue, stationId);
}
```

**이벤트**

```solidity
event RevenueDistributed(
  bytes32 indexed invoiceId,
  uint256         totalAmountWei,
  uint256         holderCount,
  uint256         cumulativeRevenue,
  bytes32         stationId
);
```

---

#### 함수 — claim()

```solidity
function claim() external onlyWhitelisted nonReentrant
```

> 누적된 `claimable` AVAX 전액을 호출자 지갑으로 이체.  
> Pull 방식 — 홀더가 원하는 시점에 직접 호출.  
> `ReentrancyGuard` 적용 필수.

**요청 JSON 예시**

```json
{
  "method": "claim",
  "contract": "0xAbC1234567890dEf1234567890ABCdef12345678",
  "caller": "0xAaa...111"
}
```

**이벤트**

```solidity
event RevenueClaimed(
  address indexed holder,
  uint256         amountWei,
  uint256         claimedAt
);
```

---

#### 함수 — registerHolder()

```solidity
function registerHolder(
  address wallet,
  uint256 tokenAmount
) external onlyAdmin
```

> KYC 완료 투자자 지갑을 화이트리스트에 추가하고 토큰 잔액을 설정.  
> STO 최초 발행 또는 양도 시 호출.

**파라미터**

| 파라미터 | JSON 타입 | Solidity | 설명 |
|----------|-----------|----------|------|
| `wallet` | `string` | `address` | KYC 인증 완료 투자자 지갑 주소. 0x 형식. |
| `tokenAmount` | `integer` | `uint256` | 보유 토큰 수량. 합산이 `totalSupply`를 초과할 수 없음. |

**요청 JSON 예시**

```json
{
  "method": "registerHolder",
  "contract": "0xAbC1234567890dEf1234567890ABCdef12345678",
  "params": {
    "wallet": "0xDdd...444",
    "tokenAmount": 150
  }
}
```

**이벤트**

```solidity
event HolderRegistered(
  address indexed wallet,
  uint256         tokenAmount,
  uint256         totalRegistered
);
```

---

#### 함수 — mint()

```solidity
function mint(
  address to,
  uint256 amount
) external onlyAdmin
```

> 리전 내 충전 인프라 확장에 따른 동적 토큰 추가 발행.
> 새 충전소/충전기 설치 시 인프라 확대분을 반영하여 `totalSupply`를 증가시킴.
> 기존 홀더 지분율 보호를 위해 비례 배분 또는 신규 투자자 배정 가능.

**파라미터**

| 파라미터 | JSON 타입 | Solidity | 설명 |
|----------|-----------|----------|------|
| `to` | `string` | `address` | 신규 민팅 토큰 수령 지갑 주소. |
| `amount` | `integer` | `uint256` | 추가 발행할 토큰 수량. |

**이벤트**

```solidity
event TokensMinted(
  address indexed to,
  uint256         amount,
  uint256         newTotalSupply,
  uint256         mintedAt
);
```

---

#### 함수 — getClaimable()

```solidity
function getClaimable(
  address holder
) external view returns (uint256 amountWei)
```

**요청 JSON 예시**

```json
{
  "method": "eth_call",
  "params": {
    "to": "0xAbC1234567890dEf1234567890ABCdef12345678",
    "data": "getClaimable(0xAaa...111)"
  }
}
```

**응답 예시**

```json
{
  "amountWei": "28800000000000000",
  "amountAvax": "0.0288",
  "amountKrwEst": 1440
}
```

---

#### 함수 — getHolderInfo()

```solidity
function getHolderInfo(
  address wallet
) external view returns (
  uint256 tokenBalance,
  uint256 sharePercent,
  bool    isWhitelisted,
  uint256 claimable
)
```

**응답 예시**

```json
{
  "wallet": "0xAaa...111",
  "tokenBalance": 300,
  "sharePercent": 30,
  "isWhitelisted": true,
  "claimable": "28800000000000000"
}
```

---

#### 전체 이벤트 요약

| 이벤트 | 발생 함수 | 설명 |
|--------|-----------|------|
| `RegionSTODeployed(bytes4 regionId, address contractAddress, string regionName, string tokenSymbol, uint256 totalSupply, uint256 deployedAt)` | `deployRegionSTO()` | 행정구역별 RegionSTO 컨트랙트 배포 완료. STRIKON 백오피스가 `region_sto_contracts` 테이블 동기화. |
| `RevenueDistributed(bytes32 invoiceId, uint256 totalAmountWei, uint256 holderCount, uint256 cumulativeRevenue, bytes32 stationId)` | `distributeRevenue()` | Bridge Service가 이 이벤트로 온체인 실행 성공을 확인하고 DB를 `CONFIRMED`로 업데이트. `stationId`로 매출 원천 추적. |
| `RevenueClaimed(address holder, uint256 amountWei, uint256 claimedAt)` | `claim()` | 투자자 앱이 이 이벤트를 구독하여 실시간 출금 완료 알림 표시. |
| `HolderRegistered(address wallet, uint256 tokenAmount, uint256 totalRegistered)` | `registerHolder()` | STRIKON 백오피스가 이 이벤트로 `sto_token_holders` 테이블을 동기화. |
| `TokensMinted(address to, uint256 amount, uint256 newTotalSupply, uint256 mintedAt)` | `mint()` | 리전 내 인프라 확장에 따른 추가 토큰 발행. |

---

## 12. 오류 코드 정의

모든 인터페이스에서 공통으로 사용하는 오류 코드 및 처리 방침.

| # | 오류 코드 | 발생 위치 | 설명 / 처리 |
|---|-----------|-----------|-------------|
| 1 | `OCPP_MISMATCH` | Step ① | OCPP 응답 `uniqueId` 불일치. Charger Gateway 거부. |
| 2 | `DERA_ANOMALY_DETECTED` | Step ② | DERA 이상 감지. `dera_anomaly_flag=true`. 과금 보류 → 조사 큐. |
| 3 | `PAYMENT_FAILED` | Step ④ | `result_code ≠ "0000"`. `invoice.paid` 발행 안 함. 블록체인 동작 없음. |
| 4 | `HMAC_INVALID` | Step ④ | PG 웹훅 서명 불일치. HTTP 400 즉시 반환. 보안 알림 발송. |
| 5 | `DUPLICATE_PG_TX` | Step ④ | 동일 `pg_transaction_id` 재수신. 무시 후 HTTP 202 반환. |
| 6 | `NO_REGION_STO_CONTRACT` | Step ⑥ | `region_sto_contracts` 조회 결과 없음 (해당 행정구역에 RegionSTO 미배포). 이벤트 ACK 후 종료. |
| 7 | `TX_REVERTED` | Step ⑦ | `receipt.status=0x0`. DLQ 이관 + 운영자 알림 + 원인 분석. |
| 8 | `DUPLICATE_INVOICE` | SC | `processedInvoices[invoiceId]=true`. Solidity `require` 실패 → TX revert. |
| 9 | `AMOUNT_MISMATCH` | SC | `msg.value ≠ amount` 파라미터. Solidity `require` 실패 → TX revert. |
| 10 | `NOT_WHITELISTED` | SC | `claim()` 호출자가 `whitelist`에 없음. `onlyWhitelisted` modifier → revert. |
| 11 | `BRIDGE_RETRY_EXHAUSTED` | Step ⑥ | 3회 재시도 모두 실패. `blockchain_status=FAILED`. 수동 재처리 필요. |

---

> © 2026 STRIKON (Wingside Inc.) — 본 문서는 대외비입니다. 사전 승인 없이 외부 공유를 금합니다.
