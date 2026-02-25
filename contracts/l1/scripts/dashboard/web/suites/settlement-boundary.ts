/**
 * Suite 10: 정산 경계 — 다기간 정산 독립성 검증
 * claim(월A)이 월B에 영향 없음, 순차 정산, CPO 간 독립성
 * 4 cases
 */

import { encodeBytes32String, hexlify } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../server.js";
import {
  newCounts, expectValue,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";
import {
  buildRandomSession,
  generateMockSignature,
} from "../lib/p256-keys.js";
import { calculatePeriod } from "../lib/utils.js";

export const settlementBoundarySuite: TestSuite = {
  id: "settlement-boundary",
  label: "정산 경계",
  caseCount: 4,
  requires: "phase2",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    const counts = newCounts();
    const cr = ctx.chargeRouter!;
    const rt = ctx.revenueTracker!;
    const sr = ctx.stationRegistry;

    // 고정 CPO 충전소에 두 달 세션 기록
    const cpo1Id = encodeBytes32String("CPO-001");

    // 기간 A (이번달) / 기간 B (다음달)
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12, 0, 0);
    const startOfNext = new Date(now.getFullYear(), now.getMonth() + 1, 5, 12, 0, 0);
    const tsA = Math.floor(endOfMonth.getTime() / 1000);
    const tsB = Math.floor(startOfNext.getTime() / 1000);
    const periodA = calculatePeriod(tsA);
    const periodB = calculatePeriod(tsB);

    // 세션을 각 기간에 기록
    let stationId: string | null = null;

    try {
      // 기간 A 세션
      const sA = await buildRandomSession(ctx, "STATION-001", "CPO");
      stationId = sA.stationId;
      sA.endTimestamp = BigInt(tsA);
      sA.startTimestamp = BigInt(tsA - 3600);
      sA.seSignature = hexlify(generateMockSignature(
        sA.chargerId, sA.energyKwh, sA.startTimestamp, sA.endTimestamp,
      ));
      const txA = await cr.processCharge(sA, periodA);
      await txA.wait();

      // 기간 B 세션
      const sB = await buildRandomSession(ctx, "STATION-001", "CPO");
      sB.endTimestamp = BigInt(tsB);
      sB.startTimestamp = BigInt(tsB - 3600);
      sB.seSignature = hexlify(generateMockSignature(
        sB.chargerId, sB.energyKwh, sB.startTimestamp, sB.endTimestamp,
      ));
      const txB = await cr.processCharge(sB, periodB);
      await txB.wait();
    } catch (err: unknown) {
      emit({ type: "case-start", label: "SB 전제조건 실패", kind: "happy" });
      emit({ type: "fail", label: "SB 전제조건: 두 기간 세션 기록", reason: String(err).slice(0, 200), kind: "happy" });
      counts.failed += 4;
      return counts;
    }

    // SB-1. claim(A) 후 기간 B pending 무변동
    await expectValue("SB-1 claim(A) 후 기간 B pending 무변동",
      async () => {
        // B의 기간별 수익 before
        const revBBefore = await rt.getStationRevenuePeriod(stationId!, periodB);
        const pendingBBefore = BigInt(revBBefore);

        // claim 기간 A
        const tx = await rt.claim(cpo1Id, periodA);
        await tx.wait();

        // B의 기간별 수익 after
        const revBAfter = await rt.getStationRevenuePeriod(stationId!, periodB);
        const pendingBAfter = BigInt(revBAfter);

        return { pendingBBefore, pendingBAfter };
      },
      (r: any) => {
        if (r.pendingBBefore === r.pendingBAfter) return true;
        return `기간B: ${r.pendingBBefore} → ${r.pendingBAfter} (변동됨)`;
      },
      emit, counts);

    // SB-2. claim(B) → 기간 B도 정산 완료
    await expectValue("SB-2 순차 claim(B) 성공",
      async () => {
        const cpoPendingBefore = await rt.getCPORevenue(cpo1Id);
        const pendingBefore = BigInt(cpoPendingBefore[2] ?? 0);

        const tx = await rt.claim(cpo1Id, periodB);
        await tx.wait();

        const cpoAfter = await rt.getCPORevenue(cpo1Id);
        const pendingAfter = BigInt(cpoAfter[2] ?? 0);

        return { pendingBefore, pendingAfter };
      },
      (r: any) => {
        if (r.pendingAfter < r.pendingBefore) return true;
        if (r.pendingAfter === 0n) return true;
        return `pending: ${r.pendingBefore} → ${r.pendingAfter}`;
      },
      emit, counts);

    // SB-3. 정산 후 새 기간 C 수익 → pending 누적
    const periodC = periodB + 1; // 기간 B 다음 달
    await expectValue("SB-3 정산 후 새 기간 수익 독립 누적",
      async () => {
        const cpoBefore = await rt.getCPORevenue(cpo1Id);
        const pendingBefore = BigInt(cpoBefore[2] ?? 0);

        // 새 세션 (현재 시간 기준)
        const sC = await buildRandomSession(ctx, "STATION-001", "CPO");
        const currentPeriod = calculatePeriod(Number(sC.endTimestamp));
        const txC = await cr.processCharge(sC, currentPeriod);
        await txC.wait();

        const cpoAfter = await rt.getCPORevenue(cpo1Id);
        const pendingAfter = BigInt(cpoAfter[2] ?? 0);

        return { pendingBefore, pendingAfter };
      },
      (r: any) => {
        if (r.pendingAfter > r.pendingBefore) return true;
        return `pending: ${r.pendingBefore} → ${r.pendingAfter} (증가 없음)`;
      },
      emit, counts);

    // SB-4. CPO-1 claim이 CPO-2 pending에 영향 없음
    const cpo2Id = encodeBytes32String("CPO-002");
    await expectValue("SB-4 CPO-1 claim → CPO-2 무영향",
      async () => {
        // CPO-2 세션 추가
        const s2 = await buildRandomSession(ctx, "STATION-002", "CPO");
        const p2 = calculatePeriod(Number(s2.endTimestamp));
        const tx2 = await cr.processCharge(s2, p2);
        await tx2.wait();

        // CPO-2 pending before
        const rev2Before = await rt.getCPORevenue(cpo2Id);
        const pending2Before = BigInt(rev2Before[2] ?? 0);

        // CPO-1 claim (현재 기간)
        try {
          const currentPeriod = calculatePeriod(Math.floor(Date.now() / 1000));
          const claimTx = await rt.claim(cpo1Id, currentPeriod);
          await claimTx.wait();
        } catch {
          // NothingToClaim이면 무시 (이미 정산됨)
        }

        // CPO-2 pending after
        const rev2After = await rt.getCPORevenue(cpo2Id);
        const pending2After = BigInt(rev2After[2] ?? 0);

        return { pending2Before, pending2After };
      },
      (r: any) => {
        if (r.pending2Before === r.pending2After) return true;
        return `CPO-2 pending: ${r.pending2Before} → ${r.pending2After} (변동됨)`;
      },
      emit, counts);

    return counts;
  },
};
