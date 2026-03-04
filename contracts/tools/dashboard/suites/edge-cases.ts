/**
 * Suite 6: 엣지케이스/경계값
 * 7 cases
 */

import { ethers, hexlify, encodeBytes32String } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../server.js";
import {
  newCounts, expectValue, expectSuccess, b32,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";
import {
  chipKeyPairs,
  STATION_CHARGER_MAP,
  buildRandomSession,
  generateMockSignature,
  generateAndProcessSession,
  generateP256KeyPair,
} from "../lib/p256-keys.js";
import { calculatePeriod } from "../lib/utils.js";

export const edgeCasesSuite: TestSuite = {
  id: "edge-cases",
  label: "엣지케이스/경계값",
  caseCount: 7,
  requires: "phase2",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    const counts = newCounts();
    const cr = ctx.chargeRouter!;
    const ct = ctx.chargeTransaction!;
    const rt = ctx.revenueTracker!;
    const dr = ctx.deviceRegistry;
    const drAdmin = ctx.deviceRegistryAdmin; // enrollChip/revokeChip — 비인터페이스 write ops

    // E-1. 월경계: 이번달 말 23:59 세션 → 기간 A
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 0);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 1, 0);
    const endTs1 = Math.floor(endOfMonth.getTime() / 1000);
    const endTs2 = Math.floor(startOfNextMonth.getTime() / 1000);
    const period1 = calculatePeriod(endTs1);
    const period2 = calculatePeriod(endTs2);

    let monthStation1: string | null = null;
    let monthStation2: string | null = null;

    // E-1
    emit({ type: "case-start", label: "E-1 월말 23:59 세션", kind: "edge" });
    try {
      const s1 = await buildRandomSession(ctx);
      monthStation1 = s1.stationId;
      s1.endTimestamp = BigInt(endTs1);
      s1.startTimestamp = BigInt(endTs1 - 3600);
      s1.seSignature = hexlify(generateMockSignature(
        s1.chargerId, s1.energyKwh, s1.startTimestamp, s1.endTimestamp,
      ));
      const tx = await cr.processCharge(s1, period1);
      await tx.wait();
      counts.passed++;
      emit({ type: "pass", label: "E-1 월말 23:59 세션", kind: "edge" });
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "E-1 월말 23:59 세션", reason: String(err).slice(0, 200), kind: "edge" });
    }

    // E-2. 다음달 초 00:01 세션 → 기간 B
    emit({ type: "case-start", label: "E-2 다음달 00:01 세션", kind: "edge" });
    try {
      const s2 = await buildRandomSession(ctx);
      monthStation2 = s2.stationId;
      s2.endTimestamp = BigInt(endTs2);
      s2.startTimestamp = BigInt(endTs2 - 3600);
      s2.seSignature = hexlify(generateMockSignature(
        s2.chargerId, s2.energyKwh, s2.startTimestamp, s2.endTimestamp,
      ));
      const tx = await cr.processCharge(s2, period2);
      await tx.wait();
      counts.passed++;
      emit({ type: "pass", label: "E-2 다음달 00:01 세션", kind: "edge" });
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "E-2 다음달 00:01 세션", reason: String(err).slice(0, 200), kind: "edge" });
    }

    // E-3. 월경계 검증: RevenueTracker에서 두 기간의 수익이 독립적으로 기록되는지 검증
    if (monthStation1 && monthStation2) {
      await expectValue("E-3 월경계: 기간별 수익 독립 기록",
        async () => {
          // E-1 세션의 stationId에서 period1 수익 확인
          const rev1 = await rt.getStationRevenuePeriod(monthStation1!, period1);
          // E-2 세션의 stationId에서 period2 수익 확인
          const rev2 = await rt.getStationRevenuePeriod(monthStation2!, period2);
          return { period1, period2, rev1: BigInt(rev1), rev2: BigInt(rev2) };
        },
        (r: any) => {
          const checks: string[] = [];
          if (r.period1 === r.period2) checks.push(`동일 기간: ${r.period1}`);
          if (r.rev1 === 0n) checks.push(`기간A(${r.period1}) 수익 0`);
          if (r.rev2 === 0n) checks.push(`기간B(${r.period2}) 수익 0`);
          return checks.length === 0 ? true : checks.join(", ");
        },
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "E-3 월경계", kind: "verify" });
      emit({ type: "fail", label: "E-3 월경계", reason: "E-1/E-2 실패로 stationId 없음", kind: "verify" });
    }

    // E-4. 대량 세션 (20건) 연속 처리 → 전수 조회 가능
    emit({ type: "case-start", label: "E-4 대량 20건 전수 조회", kind: "edge" });
    try {
      const sessionIds: string[] = [];
      for (let i = 0; i < 20; i++) {
        const result = await generateAndProcessSession(ctx);
        sessionIds.push(result.sessionId);
      }

      let retrievable = 0;
      for (const sid of sessionIds) {
        try {
          const tokenId = await ct.getTokenIdBySessionId(sid);
          if (tokenId && BigInt(tokenId) > 0n) retrievable++;
        } catch { /* not found */ }
      }

      if (retrievable === 20) {
        counts.passed++;
        emit({ type: "pass", label: "E-4 대량 20건 전수 조회", kind: "edge" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "E-4 대량 20건 전수 조회",
          reason: `조회 가능: ${retrievable}/20`, kind: "edge" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "E-4 대량 20건 전수 조회", reason: String(err).slice(0, 200), kind: "edge" });
    }

    // E-5. SE칩 비활성화 후 재등록 (다른 키) → 정상 동작
    // C4 fix: CHARGER-001은 STATION-001 소속이므로 buildRandomSession도 STATION-001로 고정
    emit({ type: "case-start", label: "E-5 SE칩 재등록 후 정상 동작", kind: "edge" });
    try {
      // CHARGER-001 선택 (이미 P-256 등록, STATION-001 소속)
      const cid = encodeBytes32String("CHARGER-001");

      // 비활성화
      const deactTx = await drAdmin.revokeChip(cid);
      await deactTx.wait();

      // 새 키로 재등록
      const { publicKey, wallet } = generateP256KeyPair();
      const enrollTx = await drAdmin.enrollChip(cid, publicKey, 0);
      await enrollTx.wait();
      chipKeyPairs.set(cid, { publicKey, wallet });

      // STATION-001에서 세션 빌드 (CHARGER-001이 소속된 충전소)
      const session = await buildRandomSession(ctx, "STATION-001");
      // CHARGER-001이 선택되지 않았을 경우 직접 지정
      if (session.chargerId !== cid) {
        session.chargerId = cid;
        session.seSignature = hexlify(generateMockSignature(
          cid, session.energyKwh, session.startTimestamp, session.endTimestamp,
        ));
      }
      const period = calculatePeriod(Number(session.endTimestamp));
      const tx = await cr.processCharge(session, period);
      await tx.wait();
      counts.passed++;
      emit({ type: "pass", label: "E-5 SE칩 재등록 후 정상 동작", kind: "edge" });
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "E-5 SE칩 재등록 후 정상 동작", reason: String(err).slice(0, 200), kind: "edge" });
    }

    // E-6. 동일 충전소·다른 충전기 동시 세션
    emit({ type: "case-start", label: "E-6 동일 충전소·다른 충전기", kind: "edge" });
    try {
      // STATION-001에는 CHARGER-001, 002, 003
      const s1 = await buildRandomSession(ctx, "STATION-001");
      const p1 = calculatePeriod(Number(s1.endTimestamp));
      const tx1 = await cr.processCharge(s1, p1);
      await tx1.wait();

      const s2 = await buildRandomSession(ctx, "STATION-001");
      // 다른 충전기 확보
      if (s2.chargerId === s1.chargerId) {
        // 충전기가 같으면 다른 것을 시도
        const chargerIds: string[] = STATION_CHARGER_MAP["STATION-001"].map(c => encodeBytes32String(c));
        // STATION_CHARGER_MAP 사용 — IStationRegistry 비인터페이스 getChargersByStation 제거
        const alt = chargerIds.find(c => c !== s1.chargerId && chipKeyPairs.has(c));
        if (alt) {
          s2.chargerId = alt;
          s2.seSignature = hexlify(generateMockSignature(
            alt, s2.energyKwh, s2.startTimestamp, s2.endTimestamp,
          ));
        }
      }
      const p2 = calculatePeriod(Number(s2.endTimestamp));
      const tx2 = await cr.processCharge(s2, p2);
      await tx2.wait();
      counts.passed++;
      emit({ type: "pass", label: "E-6 동일 충전소·다른 충전기", kind: "edge" });
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "E-6 동일 충전소·다른 충전기", reason: String(err).slice(0, 200), kind: "edge" });
    }

    // E-7. 다중 CPO 각각 독립 수익 확인
    emit({ type: "case-start", label: "E-7 다중 CPO 독립 수익", kind: "verify" });
    try {
      // CPO-001, CPO-002 각각 세션 1건
      const cpo1Id = encodeBytes32String("CPO-001");
      const cpo2Id = encodeBytes32String("CPO-002");

      const rev1Before = await rt.getCPORevenue(cpo1Id);
      const rev2Before = await rt.getCPORevenue(cpo2Id);
      const acc1Before = BigInt(rev1Before[0] ?? 0);
      const acc2Before = BigInt(rev2Before[0] ?? 0);

      // CPO-001 소속 충전소에 세션 생성
      await generateAndProcessSession(ctx, "STATION-001");

      const rev1After = await rt.getCPORevenue(cpo1Id);
      const rev2After = await rt.getCPORevenue(cpo2Id);
      const acc1After = BigInt(rev1After[0] ?? 0);
      const acc2After = BigInt(rev2After[0] ?? 0);

      // CPO-001 수익 증가, CPO-002 수익 변동 없음
      if (acc1After > acc1Before && acc2After === acc2Before) {
        counts.passed++;
        emit({ type: "pass", label: "E-7 다중 CPO 독립 수익", kind: "verify" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "E-7 다중 CPO 독립 수익",
          reason: `CPO1: ${acc1Before}→${acc1After}, CPO2: ${acc2Before}→${acc2After}`, kind: "verify" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "E-7 다중 CPO 독립 수익", reason: String(err).slice(0, 200), kind: "verify" });
    }

    return counts;
  },
};
