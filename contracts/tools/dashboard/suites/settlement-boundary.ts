/**
 * Suite 10: 정산 경계 — 다기간 수익 독립성 검증
 * 기간별 수익이 독립적으로 기록되는지, 충전소 간 간섭이 없는지 검증
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

    // 기간 A (이번달) / 기간 B (다음달)
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12, 0, 0);
    const startOfNext = new Date(now.getFullYear(), now.getMonth() + 1, 5, 12, 0, 0);
    const tsA = Math.floor(endOfMonth.getTime() / 1000);
    const tsB = Math.floor(startOfNext.getTime() / 1000);
    const periodA = calculatePeriod(tsA);
    const periodB = calculatePeriod(tsB);

    let stationId: string | null = null;

    // 기간 A 세션 기록
    try {
      const sA = await buildRandomSession(ctx, "STATION-001");
      stationId = sA.stationId;
      sA.endTimestamp = BigInt(tsA);
      sA.startTimestamp = BigInt(tsA - 3600);
      sA.seSignature = hexlify(generateMockSignature(
        sA.chargerId, sA.energyKwh, sA.startTimestamp, sA.endTimestamp,
      ));
      const txA = await cr.processCharge(sA, periodA);
      await txA.wait();
    } catch (err: unknown) {
      emit({ type: "case-start", label: "SB 전제조건 실패", kind: "happy" });
      emit({ type: "fail", label: "SB 전제조건: 기간 A 세션 기록", reason: String(err).slice(0, 200), kind: "happy" });
      counts.failed += 4;
      return counts;
    }

    // SB-1. 기간 A 수익 기록 확인
    await expectValue("SB-1 기간 A 수익 기록",
      async () => {
        const rev = await rt.getStationRevenuePeriod(stationId!, periodA);
        return { revA: BigInt(rev) };
      },
      (r: any) => {
        if (r.revA > 0n) return true;
        return `기간A 수익 = ${r.revA} (expected > 0)`;
      },
      emit, counts);

    // SB-2. 기간 B 세션 기록 -> 기간별 독립 확인
    await expectValue("SB-2 기간 B 수익 독립 기록",
      async () => {
        const sB = await buildRandomSession(ctx, "STATION-001");
        sB.endTimestamp = BigInt(tsB);
        sB.startTimestamp = BigInt(tsB - 3600);
        sB.seSignature = hexlify(generateMockSignature(
          sB.chargerId, sB.energyKwh, sB.startTimestamp, sB.endTimestamp,
        ));
        const txB = await cr.processCharge(sB, periodB);
        await txB.wait();

        const revA = await rt.getStationRevenuePeriod(stationId!, periodA);
        const revB = await rt.getStationRevenuePeriod(stationId!, periodB);

        return { revA: BigInt(revA), revB: BigInt(revB) };
      },
      (r: any) => {
        if (r.revA > 0n && r.revB > 0n) return true;
        return `기간A=${r.revA}, 기간B=${r.revB}`;
      },
      emit, counts);

    // SB-3. 새 기간에 추가 수익 누적
    await expectValue("SB-3 새 기간 수익 독립 누적",
      async () => {
        const revBefore = await rt.getStationRevenue(stationId!);
        const pendingBefore = BigInt(revBefore[2] ?? 0);

        const sC = await buildRandomSession(ctx, "STATION-001");
        const currentPeriod = calculatePeriod(Number(sC.endTimestamp));
        const txC = await cr.processCharge(sC, currentPeriod);
        await txC.wait();

        const revAfter = await rt.getStationRevenue(stationId!);
        const pendingAfter = BigInt(revAfter[2] ?? 0);

        return { pendingBefore, pendingAfter };
      },
      (r: any) => {
        if (r.pendingAfter > r.pendingBefore) return true;
        return `pending: ${r.pendingBefore} -> ${r.pendingAfter} (증가 없음)`;
      },
      emit, counts);

    // SB-4. STATION-001 세션이 STATION-002 수익에 영향 없음
    await expectValue("SB-4 STATION-001 세션 -> STATION-002 무영향",
      async () => {
        const station2Id = encodeBytes32String("STATION-002");

        // STATION-002 세션 추가 (pending 생성)
        const s2 = await buildRandomSession(ctx, "STATION-002");
        const p2 = calculatePeriod(Number(s2.endTimestamp));
        const tx2 = await cr.processCharge(s2, p2);
        await tx2.wait();

        // STATION-002 pending before
        const rev2Before = await rt.getStationRevenue(station2Id);
        const pending2Before = BigInt(rev2Before[2] ?? 0);

        // STATION-001 세션 추가
        const s1 = await buildRandomSession(ctx, "STATION-001");
        const p1 = calculatePeriod(Number(s1.endTimestamp));
        const tx1 = await cr.processCharge(s1, p1);
        await tx1.wait();

        // STATION-002 pending after
        const rev2After = await rt.getStationRevenue(station2Id);
        const pending2After = BigInt(rev2After[2] ?? 0);

        return { pending2Before, pending2After };
      },
      (r: any) => {
        if (r.pending2Before === r.pending2After) return true;
        return `STATION-002 pending: ${r.pending2Before} -> ${r.pending2After} (변동됨)`;
      },
      emit, counts);

    return counts;
  },
};
