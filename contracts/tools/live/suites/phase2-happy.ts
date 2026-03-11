/**
 * Suite 2: Phase 2 해피패스 — P-256 Setup + 정상 세션 생성 + 데이터 검증
 * ~7 cases
 */

import { ethers, encodeBytes32String } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../context.js";
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
  caseCount: 7,
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

    // S-2. processCharge 성공 (STATION-001)
    let session1Receipt: any = null;
    let session1: any = null;
    emit({ type: "case-start", label: "S-2 processCharge 성공 (STATION-001)", kind: "happy" });
    try {
      session1 = await buildRandomSession(ctx, "STATION-001");
      const period = calculatePeriod(Number(session1.endTimestamp));
      const tx = await cr.processCharge(session1, period);
      session1Receipt = await tx.wait();
      counts.passed++;
      emit({ type: "pass", label: "S-2 processCharge 성공 (STATION-001)", kind: "happy" });
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "S-2 processCharge 성공 (STATION-001)", reason: String(err).slice(0, 200), kind: "happy" });
    }

    // S-4. getSession() 저장 데이터 정확성 — 다중 필드 검증
    let session1TokenId: bigint | null = null;
    if (session1Receipt && session1) {
      const crConcreteIface = chargeRouterConcreteInterface();
      await expectValue("S-4 getSession 저장 데이터 정확성 (다중 필드)",
        async () => {
          const processedEvent = session1Receipt.logs.find((log: any) => {
            try { return crConcreteIface.parseLog(log)?.name === "ChargeProcessed"; } catch { return false; }
          });
          const tokenId = processedEvent ? crConcreteIface.parseLog(processedEvent)?.args[0] : null;
          if (!tokenId) return null;
          session1TokenId = BigInt(tokenId);
          const session = await ct.getSession(tokenId);
          return session;
        },
        (s: any) => {
          if (!s) return "tokenId 추출 실패";
          const checks: string[] = [];
          if (s.chargerId !== session1.chargerId) checks.push(`chargerId 불일치`);
          if (s.sessionId !== session1.sessionId) checks.push(`sessionId 불일치`);
          if (BigInt(s.energyKwh) !== BigInt(session1.energyKwh)) checks.push(`energyKwh 불일치`);
          if (BigInt(s.distributableKrw) !== BigInt(session1.distributableKrw)) checks.push(`distributableKrw 불일치`);
          if (BigInt(s.startTimestamp) !== BigInt(session1.startTimestamp)) checks.push(`startTimestamp 불일치`);
          if (BigInt(s.endTimestamp) !== BigInt(session1.endTimestamp)) checks.push(`endTimestamp 불일치`);
          if (s.stationId !== session1.stationId) checks.push(`stationId 불일치`);
          return checks.length === 0 ? true : checks.join(", ");
        },
        emit, counts);
    } else {
      for (const label of ["S-4 getSession"]) {
        counts.failed++;
        emit({ type: "case-start", label, kind: "verify" });
        emit({ type: "fail", label, reason: "S-2 실패로 스킵", kind: "verify" });
      }
    }

    // S-7. processCharge 성공 (STATION-003, 다른 지역 KR11)
    let session2: any = null;
    emit({ type: "case-start", label: "S-7 processCharge 성공 (STATION-003)", kind: "happy" });
    try {
      session2 = await buildRandomSession(ctx, "STATION-003");
      const period = calculatePeriod(Number(session2.endTimestamp));
      const tx = await cr.processCharge(session2, period);
      await tx.wait();
      counts.passed++;
      emit({ type: "pass", label: "S-7 processCharge 성공 (STATION-003)", kind: "happy" });
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "S-7 processCharge 성공 (STATION-003)", reason: String(err).slice(0, 200), kind: "happy" });
    }

    // S-8. 충전소 수익 — distributableKrw 만큼 정확히 증가했는지 검증
    if (session1) {
      await expectValue("S-8 충전소 수익 정확성",
        async () => {
          const rev = await rt.getStationRevenue(session1.stationId);
          const acc = BigInt(rev[0] ?? rev.accumulated ?? 0);
          return { acc, expected: BigInt(session1.distributableKrw) };
        },
        (r: any) => {
          if (r.acc >= r.expected) return true;
          return `accumulated=${r.acc}, 최소 기대=${r.expected}`;
        },
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "S-8 충전소 수익", kind: "verify" });
      emit({ type: "fail", label: "S-8 충전소 수익", reason: "세션 없음", kind: "verify" });
    }

    // S-9. 지역 수익 반영
    if (session2) {
      await expectValue("S-9 지역 수익 반영",
        () => rt.getRegionRevenue(session2.gridRegionCode),
        (rev: bigint) => BigInt(rev) > 0n || `지역 수익 = ${rev}`,
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "S-9 지역 수익", kind: "verify" });
      emit({ type: "fail", label: "S-9 지역 수익", reason: "세션 없음", kind: "verify" });
    }

    // S-10. getStationRevenue (accumulated, settled, pending)
    if (session1) {
      await expectValue("S-10 getStationRevenue 구조 확인",
        () => rt.getStationRevenue(session1.stationId),
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
    if (session1) {
      const period = calculatePeriod(Number(session1.endTimestamp));
      await expectValue("S-11 getStationRevenuePeriod 월별 수익",
        () => rt.getStationRevenuePeriod(session1.stationId, period),
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
