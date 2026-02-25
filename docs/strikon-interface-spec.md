# EnergyFi × STRIKON × AVALANCHE
## 인터페이스 데이터 명세서 v1.0

> **문서 구분**: 프로세스 인터페이스 (STRIKON 플랫폼 레이어)
> **버전**: v1.0 — 2026.02
> **커버리지**: 5단계 — 충전 종료 → `invoice.paid` 이벤트 발행까지
> **주관**: STRIKON (Wingside Inc.)

> **참고**: 온체인 인터페이스(스마트컨트랙트, Blockchain Bridge 등)는 본 문서 범위 밖이며, EnergyFi 아키텍처 로드맵(`contracts/l1/docs/implementation-roadmap.md`)을 참조할 것.

---

## 목차

1. [인터페이스 전체 맵](#1-인터페이스-전체-맵)
2. [STEP ① ELECTRA 충전기 → Charger Gateway](#2-step--electra-충전기--charger-gateway)
3. [STEP ② Charger Gateway → RabbitMQ](#3-step--charger-gateway--rabbitmq)
4. [STEP ③ Domain Logic Processor → Payments Gateway](#4-step--domain-logic-processor--payments-gateway)
5. [STEP ④ 외부 PG → External Callback Gateway](#5-step--외부-pg--external-callback-gateway)
6. [STEP ⑤ Domain Logic Processor → RabbitMQ (invoice.paid)](#6-step--domain-logic-processor--rabbitmq-invoicepaid)
7. [오류 코드 정의](#7-오류-코드-정의)

---

## 1. 인터페이스 전체 맵

ELECTRA 충전기에서 `invoice.paid` 이벤트 발행까지 5단계 인터페이스. 각 단계는 JSON 페이로드, 필드 타입, 유효성 규칙을 포함한다.

| # | 송신 | 수신 | 프로토콜 | 핵심 데이터 |
|---|------|------|----------|------------|
| ① | ELECTRA 충전기 | Charger Gateway | OCPP 1.6 WebSocket | `StopTransaction` |
| ② | Charger Gateway | RabbitMQ | AMQP Publish | `session.stopped` |
| ③ | Domain Logic Processor | Payments Gateway | gRPC `:50067` | `ExecutePayment` |
| ④ | 외부 PG | External Callback GW | HTTPS Webhook | `payment_result` |
| ⑤ | Domain Logic Processor | RabbitMQ | AMQP Publish | `invoice.paid` |

> `invoice.paid` 이벤트가 EnergyFi 온체인 레이어의 입력 트리거가 된다. Blockchain Bridge는 수신 후 (1) `ChargeTransaction.mint()` → (2) `RevenueTracker.recordRevenue()`를 연속 호출한다. 이후 상세 흐름은 EnergyFi 컨트랙트 명세(`contracts/l1/docs/phase2-transaction-spec.md`) 참조.

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
| `station_id` | `UUID v4` | ✓ | 스테이션 ID. Blockchain Bridge가 `ChargeTransaction.mint()` + `RevenueTracker.recordRevenue()` 연속 호출 시 사용. StationRegistry에서 ownerType(CPO/ENERGYFI) 조회 → 수익 귀속 결정. |
| `region_id`  | `string`  | ✓ | 행정구역 코드 (ISO 3166-2:KR). 예: `"KR-11"` (서울). Bridge가 두 가지 목적으로 사용: (1) [EnergyFi 소유 충전소] `StationRegistry.getEnergyFiRegionRevenue()`로 STO 수익 풀 귀속 지역 결정 (2) [전체 충전소] Phase 4 탄소 계산 시 지역별 전력 배출 계수(EFkw) 조회. CPO 소유 충전소에서는 STO 목적 사용 없음. |
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

> **보안 정책**
> - `checksum` 검증은 모든 처리 전 필수. 무결성 실패 시 HTTP 400 즉시 반환.
> - 멱등성: 동일 `pg_transaction_id` 재수신 시 무시 (HTTP 202 반환, 재처리 없음).
> - `result_code ≠ "0000"` 인 경우 `invoice.paid` 이벤트를 발행하지 않으며, 블록체인 제출이 일어나지 않는다.

---

## 6. STEP ⑤ Domain Logic Processor → RabbitMQ (invoice.paid)

**프로토콜**: AMQP 0-9-1 · Publish
**Exchange**: `strikon.billing`
**방향**: `Domain Logic Processor` → `RabbitMQ`

> `invoice.paid`는 EnergyFi 온체인 레이어의 입력 트리거 이벤트다. Blockchain Bridge는 이 이벤트 수신 시 (1) `ChargeTransaction.mint(session)` → (2) `RevenueTracker.recordRevenue(stationId, distributableKrw)`를 단일 트랜잭션 또는 연속 호출로 처리한다.

> ⚠️ `se_signature` 필드는 현재 페이로드에 미포함. STRIKON 인터페이스 업데이트 후 활성화 예정.

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
    },
    "se_signature": "3045022100...hex..."
  }
}
```

### 필드 정의

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `invoice_id` | `UUID v4` | ✓ | 블록체인 제출 상태 추적 기준. |
| `gross_krw` | `integer` | ✓ | PG 수령 총액(원). |
| `platform_fee_krw` | `integer` | ✓ | STRIKON 플랫폼 수수료 10%. 공제 후 `distributable_krw` 산출. |
| `distributable_krw` | `integer` | ✓ | `gross_krw - platform_fee_krw`. |
| `charger_id` | `UUID v4` | ✓ | 충전기 ID. |
| `station_id` | `UUID v4` | ✓ | 스테이션 ID. 매출 원천 추적에 사용. |
| `region_id` | `string` | ✓ | 행정구역 코드 (ISO 3166-2:KR). Bridge가 두 가지 목적으로 사용: (1) [EnergyFi 소유 충전소] STO 수익 풀 귀속 지역 결정 (2) [전체 충전소] Phase 4 탄소 EFkw 조회. CPO 소유 충전소에서는 STO 목적 사용 없음. |
| `se_signature` | `bytes (hex)` | ✓ (추가 예정) | TPM 2.0 SE 칩 P-256 서명. STRIKON이 session.stopped → invoice.paid 경로로 전파. Bookend 신뢰 모델 필수 필드. |

> **RabbitMQ 라우팅**
> 라우팅 키: `invoice.paid` · Exchange: `strikon.billing` · Queue: `blockchain-bridge.invoice-paid`
> 중요: `result_code="0000"` 인 결제 성공 건만 이 이벤트를 발행한다.

---

## 7. 오류 코드 정의

STRIKON 플랫폼 레이어 인터페이스에서 사용하는 오류 코드 및 처리 방침.

| # | 오류 코드 | 발생 위치 | 설명 / 처리 |
|---|-----------|-----------|-------------|
| 1 | `OCPP_MISMATCH` | Step ① | OCPP 응답 `uniqueId` 불일치. Charger Gateway 거부. |
| 2 | `DERA_ANOMALY_DETECTED` | Step ② | DERA 이상 감지. `dera_anomaly_flag=true`. 과금 보류 → 조사 큐. |
| 3 | `PAYMENT_FAILED` | Step ④ | `result_code ≠ "0000"`. `invoice.paid` 발행 안 함. 블록체인 동작 없음. |
| 4 | `HMAC_INVALID` | Step ④ | PG 웹훅 서명 불일치. HTTP 400 즉시 반환. 보안 알림 발송. |
| 5 | `DUPLICATE_PG_TX` | Step ④ | 동일 `pg_transaction_id` 재수신. 무시 후 HTTP 202 반환. |

---

> © 2026 STRIKON (Wingside Inc.) — 본 문서는 대외비입니다. 사전 승인 없이 외부 공유를 금합니다.
