# Platform Team Questions & Confirmed Policies

> 이 문서는 STRIKON 플랫폼팀과 협의하여 확정된 정책 및 미결 사항을 관리합니다.
> 온체인 설계 결정은 [implementation-roadmap.md](../contracts/l1/docs/implementation-roadmap.md) 참조.

## Confirmed Policies

| # | Policy | Status | 설계 영향 |
|:---|:---|:---|:---|
| **P1** | 결제 완료 건만 온체인 기록 (`invoice.paid`) | ✅ 확정 | `ChargeTransaction.mint()`는 `invoice.paid` 이벤트에서만 트리거. 결제 실패·DERA 이상 감지 건 블록체인 제출 없음. |
| **P2** | `invoice.paid` 시점에 두 컨트랙트 연속 호출 | ✅ 확정 | `invoice.paid` → Bridge → `ChargeTransaction.mint()` + `RevenueTracker.recordRevenue()` 연속 처리 (단일 TX 또는 연속 호출). |
| **P3** | RegionSTO 토큰 표준 미확정 — 보류 | ⚠️ 보류 | 발행 경로(CCIP Path / Path A / Path B) + 대통령령 세부 요건 확정 후 결정. ERC-3643 T-REX 참고용으로 검토 중이나 확정 아님. |
| **P4** | SE 칩 서명은 Phase 1부터 실제 값 활성 | ✅ 확정 (2026.03 설계 변경) | 플랫폼과 충전기가 동시 런칭. DeviceRegistry에 SE 공개키 사전 등록 후 ChargeTransaction 배포. `seSignature = 0x` 가정 폐기. |
| **P5** | CarbonReduction은 온체인 내부 계산 (외부 오라클 없음) | ✅ 확정 | CarbonReduction은 ChargeTransaction 데이터 + ParameterRegistry 파라미터만으로 VM0038 수식 적용. |
| **P6** | Phase 3 권장 발행 경로: CCIP Path | ⚠️ 권장 (경로 미확정) | EnergyFi L1(Avalanche) → Chainlink CCIP → KSD 지원 체인으로 Revenue Attestation 전달. 발행인계좌관리기관 자격 불필요. DTCC(Avalanche+Besu+CCIP, 2025) 실증. KSD 지원 체인 확정 후 CCIPRevenueSender 구현 착수. |

## Pending Questions

### STRIKON 인터페이스 관련

| # | 질문 | 현재 상태 | 영향 |
|:---|:---|:---|:---|
| Q1 | `se_signature` 필드 `invoice.paid` 페이로드 포함 일정 | ⚠️ 미포함 (추가 예정) | Phase 2 ChargeTransaction.mint() 착수 전 확인 필수. Bookend 신뢰 모델 핵심 필드. |
| Q2 | `charger_id` UUID → bytes32 인코딩 규칙 | 🔴 미확정 | UTF-8 hex vs keccak256(abi.encodePacked()) — Bridge 구현 전 플랫폼팀 확인 필요. |
| Q3 | Bridge가 두 컨트랙트(ChargeTransaction + RevenueTracker) 연속 호출 가능 여부 | ✅ 라우터 컨트랙트로 해결 가능 | 단일 TX로 양쪽 호출하는 Router 컨트랙트 제공. |

### Phase 3 미결 사항

| # | 사항 | 현재 상태 |
|:---|:---|:---|
| KSD 지원 체인 기술 스택 확정 | CCIP Receiver를 올릴 체인 (Hyperledger Besu 등) | 🔴 미확정 |
| 유통 시장 파트너 | KDX / NXT 컨소시엄 / 루센트블록 중 선택 | 🔴 미결정 |
| 대통령령 세부 요건 | 발행인계좌관리기관 자기자본·설비 요건 | 🔴 미확정 |
| 증권사 파트너십 | KYC/AML, 배당 집행 담당 증권사 | 🔴 미수립 |
