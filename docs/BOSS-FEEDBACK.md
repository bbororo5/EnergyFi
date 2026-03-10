# BOSS-FEEDBACK

Accumulated feedback from BOSS during AUTOPILOT loop.
Claude must read this file first before every session.
Apply previous feedback patterns before starting implementation.

## Recording Rules
- Auto-record when BOSS correction/judgment occurs at CHECKPOINT
- Format: [Date] [ScenarioID] Situation → BOSS Decision → Applied Pattern
- No deletion allowed, accumulation only
- Apply patterns from this file first when similar cases occur

---

## Business Rule Decisions

[2026-03-04] [MISMATCH-01 → NOT A MISMATCH]
Situation: Session status stays CHARGING after billing completes (not updated to COMPLETED)
Claude judgment: Low priority mismatch, document for future fix
BOSS correction: This is CORRECT behavior. Session status must ONLY be changed by OCPP StatusNotification messages. Billing flow must never modify charger session status.
Applied pattern: charging_sessions.status is controlled exclusively by OCPP StatusNotification — no other service/flow may modify it. This is a CRITICAL business rule.

---

## Edge Case Handling

[2026-03-04] [GAP-02-BILLING]
Situation: Invoice PaymentStatus uses OVERDUE, but DB CHECK constraint has both UNPAID and OVERDUE
Claude judgment: [CONFIRM NEEDED] — UNPAID vs OVERDUE status mismatch
BOSS decision: Only use UNPAID for invoice PaymentStatus. Store unpaid reason in existing unpaid_records table (add reason column).
Applied pattern: Invoice status uses UNPAID only (never OVERDUE). Unpaid reason stored in business.unpaid_records.reason column. UnpaidRecord status lifecycle (UNPAID→OVERDUE→RESOLVED/WRITTEN_OFF) remains separate from invoice PaymentStatus.

---

## Priority Decisions
<!-- Example
[2026-03-03] [GAP-03]
Situation: ReserveNow implementation
BOSS decision: Post-MVP, keep deactivated
Applied pattern: ReserveNow implementation prohibited before MVP
-->

---

## Architecture Decisions

[2026-03-04] [GAP-02]
Situation: charger-gateway events use hardware_id in source.DeviceID for internal processing
Claude judgment: No action — by design for gateway scalability
BOSS correction: hardware_id is for charger info lookup ONLY. All internal processing must use charger UUID (id). Must fix.
Applied pattern: hardware_id는 충전기 정보 조회 전용. 내부 처리(이벤트, 세션, 빌링 등)는 반드시 charger UUID만 사용할 것. CRITICAL.

[2026-03-04] [GAP-03]
Situation: Country code "KR" hardcoded in domain-logic-processor
Claude judgment: No action for KR-only MVP
BOSS correction: Must fix — will cause problems when expanding to US or other countries.
Applied pattern: Country code 하드코딩 금지. 반드시 DB/config에서 동적으로 조회할 것.

[2026-03-04] [ARCH-04]
Situation: Transport selection policy for message brokers
BOSS decision: RabbitMQ = time-ordering + persistence required messages only (billing, payment — must not be lost). Redis = all other simple event delivery.
Applied pattern: RabbitMQ는 순서+영속성 보장 필요한 메시지만 (결제 등 유실 불가). 그 외 단순 이벤트는 Redis. CRITICAL transport selection rule.

---

## Accumulated Pattern Summary
<!-- Claude auto-adds summary when 10+ feedbacks accumulated -->