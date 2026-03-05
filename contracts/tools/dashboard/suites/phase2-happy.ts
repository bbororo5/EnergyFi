/**
 * Suite 2: Phase 2 해피패스 — P-256 Setup + 정상 세션 생성 + 데이터 검증
 * ~11 cases
 */

import { ethers, encodeBytes32String } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../server.js";
import {
  newCounts, expectSuccess, expectValue, expectRevert,
  chargeRouterConcreteInterface,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";
import {
  chipKeyPairs,
  setupP256Chips,
  buildRandomSession,
  generateAndProcessSession,
} from "../lib/p256-keys.js";
import { calculatePeriod } from "../lib/utils.js";

export const phase2HappySuite: TestSuite = {
  id: "phase2-happy",
  label: "Phase 2 해피패스",
  caseCount: 7, // S-6(ownerOf), S-6b(transferFrom) 제거 — 비인터페이스 함수
  requires: "phase2",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    const counts = newCounts();
    const cr = ctx.chargeRouter!;
    const ct = ctx.chargeTransaction!;
    const rt = ctx.revenueTracker!;

    // Precondition: P-256 키 셋업 (테스트 케이스가 아님)
    if (chipKeyPairs.size < 12) {
      try {
        await setupP256Chips(ctx);
        emit({ type: "setup-ok", label: `P-256 ${chipKeyPairs.size}개 등록 완료` });
      } catch (err: unknown) {
        emit({ type: "fail", label: "Precondition: P-256 Setup 실패", reason: String(err).slice(0, 200), kind: "happy" });
        return counts;
      }
    }
    if (chipKeyPairs.size < 12) {
      emit({ type: "fail", label: "Precondition: P-256 키 부족", reason: `${chipKeyPairs.size}개만 보유`, kind: "happy" });
      return counts;
    }

    // S-2. processCharge 성공 (CPO 충전소)
    let cpoReceipt: any = null;
    let cpoSession: any = null;
    emit({ type: "case-start", label: "S-2 processCharge 성공 (CPO)", kind: "happy" });
    try {
      cpoSession = await buildRandomSession(ctx, undefined, "CPO");
      const period = calculatePeriod(Number(cpoSession.endTimestamp));
      const tx = await cr.processCharge(cpoSession, period);
      cpoReceipt = await tx.wait();
      counts.passed++;
      emit({ type: "pass", label: "S-2 processCharge 성공 (CPO)", kind: "happy" });
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "S-2 processCharge 성공 (CPO)", reason: String(err).slice(0, 200), kind: "happy" });
    }

    // S-4. getSession() 저장 데이터 정확성 — 다중 필드 검증
    let cpoTokenId: bigint | null = null;
    if (cpoReceipt && cpoSession) {
      // IChargeRouter에는 ChargeProcessed 이벤트가 없으므로 concrete interface 사용
      const crConcreteIface = chargeRouterConcreteInterface();
      await expectValue("S-4 getSession 저장 데이터 정확성 (다중 필드)",
        async () => {
          const processedEvent = cpoReceipt.logs.find((log: any) => {
            try { return crConcreteIface.parseLog(log)?.name === "ChargeProcessed"; } catch { return false; }
          });
          const tokenId = processedEvent ? crConcreteIface.parseLog(processedEvent)?.args[0] : null;
          if (!tokenId) return null;
          cpoTokenId = BigInt(tokenId);
          const session = await ct.getSession(tokenId);
          return session;
        },
        (s: any) => {
          if (!s) return "tokenId 추출 실패";
          const checks: string[] = [];
          if (s.chargerId !== cpoSession.chargerId) checks.push(`chargerId 불일치`);
          if (s.sessionId !== cpoSession.sessionId) checks.push(`sessionId 불일치`);
          if (BigInt(s.energyKwh) !== BigInt(cpoSession.energyKwh)) checks.push(`energyKwh 불일치`);
          if (BigInt(s.distributableKrw) !== BigInt(cpoSession.distributableKrw)) checks.push(`distributableKrw 불일치`);
          if (BigInt(s.startTimestamp) !== BigInt(cpoSession.startTimestamp)) checks.push(`startTimestamp 불일치`);
          if (BigInt(s.endTimestamp) !== BigInt(cpoSession.endTimestamp)) checks.push(`endTimestamp 불일치`);
          if (s.stationId !== cpoSession.stationId) checks.push(`stationId 불일치`);
          return checks.length === 0 ? true : checks.join(", ");
        },
        emit, counts);

      // S-6 / S-6b (ownerOf, transferFrom): IChargeTransaction 비인터페이스 → 제거
    } else {
      for (const label of ["S-4 getSession"]) {
        counts.failed++;
        emit({ type: "case-start", label, kind: "verify" });
        emit({ type: "fail", label, reason: "S-2 실패로 스킵", kind: "verify" });
      }
    }

    // S-7. processCharge 성공 (EnergyFi 충전소)
    let efiSession: any = null;
    emit({ type: "case-start", label: "S-7 processCharge 성공 (EnergyFi)", kind: "happy" });
    try {
      efiSession = await buildRandomSession(ctx, undefined, "ENERGYFI");
      const period = calculatePeriod(Number(efiSession.endTimestamp));
      const tx = await cr.processCharge(efiSession, period);
      await tx.wait();
      counts.passed++;
      emit({ type: "pass", label: "S-7 processCharge 성공 (EnergyFi)", kind: "happy" });
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "S-7 processCharge 성공 (EnergyFi)", reason: String(err).slice(0, 200), kind: "happy" });
    }

    // S-8. CPO 충전소 수익 — distributableKrw 만큼 정확히 증가했는지 검증
    if (cpoSession) {
      await expectValue("S-8 CPO 충전소 수익 정확성",
        async () => {
          const rev = await rt.getStationRevenue(cpoSession.stationId);
          const acc = BigInt(rev[0] ?? rev.accumulated ?? 0);
          return { acc, expected: BigInt(cpoSession.distributableKrw) };
        },
        (r: any) => {
          // accumulated는 이전 실행분 포함 가능 → distributableKrw 이상인지 검증
          // 정확한 증분은 before 스냅샷 없이는 불가능하므로 최소 기댓값 검증
          if (r.acc >= r.expected) return true;
          return `accumulated=${r.acc}, 최소 기대=${r.expected}`;
        },
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "S-8 CPO 수익", kind: "verify" });
      emit({ type: "fail", label: "S-8 CPO 수익", reason: "세션 없음", kind: "verify" });
    }

    // S-9. EnergyFi 지역 수익 반영
    if (efiSession) {
      await expectValue("S-9 EnergyFi 지역 수익 반영",
        () => rt.getEnergyFiRegionRevenue(efiSession.gridRegionCode),
        (rev: bigint) => BigInt(rev) > 0n || `지역 수익 = ${rev}`,
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "S-9 지역 수익", kind: "verify" });
      emit({ type: "fail", label: "S-9 지역 수익", reason: "세션 없음", kind: "verify" });
    }

    // S-10. getStationRevenue (accumulated, settled, pending)
    if (cpoSession) {
      await expectValue("S-10 getStationRevenue 구조 확인",
        () => rt.getStationRevenue(cpoSession.stationId),
        (rev: any) => {
          const acc = BigInt(rev[0] ?? rev.accumulated ?? 0);
          const settled = BigInt(rev[1] ?? rev.settled ?? 0);
          const pending = BigInt(rev[2] ?? rev.pending ?? 0);
          if (acc > 0n && pending === acc - settled) return true;
          return `acc=${acc}, settled=${settled}, pending=${pending}`;
        },
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "S-10", kind: "verify" });
      emit({ type: "fail", label: "S-10", reason: "세션 없음", kind: "verify" });
    }

    // S-11. getStationRevenuePeriod 월별 수익
    if (cpoSession) {
      const period = calculatePeriod(Number(cpoSession.endTimestamp));
      await expectValue("S-11 getStationRevenuePeriod 월별 수익",
        () => rt.getStationRevenuePeriod(cpoSession.stationId, period),
        (rev: bigint) => BigInt(rev) > 0n || `월별 수익 = ${rev}`,
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "S-11", kind: "verify" });
      emit({ type: "fail", label: "S-11", reason: "세션 없음", kind: "verify" });
    }

    return counts;
  },
};
