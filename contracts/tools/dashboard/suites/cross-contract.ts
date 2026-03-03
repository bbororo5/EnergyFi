/**
 * Suite 5: 크로스컨트랙트 원자성
 * ChargeRouter를 통한 CT+RT 동시 처리의 원자성 검증
 * 5 cases
 */

import { encodeBytes32String } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../server.js";
import {
  newCounts, extractErrorName,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";
import { buildRandomSession, generateAndProcessSession } from "../lib/p256-keys.js";
import { calculatePeriod } from "../lib/utils.js";

export const crossContractSuite: TestSuite = {
  id: "cross-contract",
  label: "크로스컨트랙트 원자성",
  caseCount: 4,
  requires: "phase2",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    const counts = newCounts();
    const cr = ctx.chargeRouter!;
    const ct = ctx.chargeTransaction!;
    const rt = ctx.revenueTracker!;

    // A-1. processCharge → CT 세션 저장 + RT 수익 기록 동시 성공
    emit({ type: "case-start", label: "A-1 CT+RT 동시 성공", kind: "happy" });
    try {
      const session = await buildRandomSession(ctx);
      const period = calculatePeriod(Number(session.endTimestamp));
      const tx = await cr.processCharge(session, period);
      const receipt = await tx.wait();

      // CT: 세션 데이터가 실제 조회 가능한지 검증
      const processedEvent = receipt.logs.find((log: any) => {
        try { return cr.interface.parseLog(log)?.name === "ChargeProcessed"; } catch { return false; }
      });
      const tokenId = processedEvent ? cr.interface.parseLog(processedEvent)?.args[0] : null;
      const stored = tokenId ? await ct.getSession(tokenId) : null;
      const sessionMatch = stored && stored.sessionId === session.sessionId;

      // RT: 해당 충전소에 수익이 누적되었는지 검증
      const rev = await rt.getStationRevenue(session.stationId);
      const acc = BigInt(rev[0] ?? rev.accumulated ?? 0);

      if (sessionMatch && acc > 0n) {
        counts.passed++;
        emit({ type: "pass", label: "A-1 CT+RT 동시 성공", kind: "happy" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "A-1 CT+RT 동시 성공",
          reason: `세션 조회=${!!sessionMatch}, acc=${acc}`, kind: "happy" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "A-1 CT+RT 동시 성공", reason: String(err).slice(0, 200), kind: "happy" });
    }

    // A-2. 미등록 station → StationNotRegistered로 거부
    // EVM이 revert 시 상태 롤백을 보장하므로, 올바른 사유로 거부되는지만 검증
    emit({ type: "case-start", label: "A-2 미등록 station → 거부", kind: "verify" });
    try {
      const ifaces = [cr.interface, ct.interface, rt.interface];
      const session = await buildRandomSession(ctx);
      session.stationId = encodeBytes32String("NONEXIST-STN");
      const period = calculatePeriod(Number(session.endTimestamp));

      try {
        const tx = await cr.processCharge(session, period);
        await tx.wait();
        counts.failed++;
        emit({ type: "fail", label: "A-2 미등록 station → 거부", reason: "성공해버림", kind: "verify" });
      } catch (innerErr: unknown) {
        const errorName = extractErrorName(innerErr, ifaces);
        if (errorName && errorName.includes("StationNotRegistered")) {
          counts.passed++;
          emit({ type: "pass", label: "A-2 미등록 station → 거부", kind: "verify" });
        } else {
          counts.failed++;
          emit({ type: "fail", label: "A-2 미등록 station → 거부",
            reason: `revert 사유: "${errorName}" (expected StationNotRegistered)`, kind: "verify" });
        }
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "A-2 미등록 station → 거부", reason: String(err).slice(0, 200), kind: "verify" });
    }

    // A-4. 연속 10건 processCharge → 전수 조회 가능
    // 비즈니스 의미: 대량 트래픽에서 단 1건도 유실 없이 기록되는가
    emit({ type: "case-start", label: "A-4 연속 10건 → 전수 조회 가능", kind: "verify" });
    try {
      const sessionIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const result = await generateAndProcessSession(ctx);
        sessionIds.push(result.sessionId);
      }

      // 10건 모두 sessionId로 역조회 가능한지 검증
      let retrievable = 0;
      for (const sid of sessionIds) {
        try {
          const tokenId = await ct.getTokenIdBySessionId(sid);
          if (tokenId && BigInt(tokenId) > 0n) retrievable++;
        } catch { /* not found */ }
      }

      if (retrievable === 10) {
        counts.passed++;
        emit({ type: "pass", label: "A-4 연속 10건 → 전수 조회 가능", kind: "verify" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "A-4 연속 10건 → 전수 조회 가능",
          reason: `조회 가능: ${retrievable}/10`, kind: "verify" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "A-4 연속 10건 → 전수 조회 가능", reason: String(err).slice(0, 200), kind: "verify" });
    }

    // A-5. 실패 TX 후 성공 TX → 성공 세션 정상 기록
    // 비즈니스 의미: 장애 발생 후에도 다음 정상 충전이 정확히 기록되는가
    emit({ type: "case-start", label: "A-5 실패 후 성공 → 데이터 무결성", kind: "verify" });
    try {
      const ifaces = [cr.interface, ct.interface, rt.interface];

      // 실패 TX (금액 0) — ZeroAmount로 revert되는지 확인
      const badSession = await buildRandomSession(ctx);
      badSession.distributableKrw = 0n;
      const badPeriod = calculatePeriod(Number(badSession.endTimestamp));
      let failedCorrectly = false;
      try {
        const tx = await cr.processCharge(badSession, badPeriod);
        await tx.wait();
      } catch (innerErr: unknown) {
        const errorName = extractErrorName(innerErr, ifaces);
        failedCorrectly = !!errorName && errorName.includes("ZeroAmount");
      }

      // 성공 TX — 데이터 조회 가능 여부로 검증
      const result = await generateAndProcessSession(ctx);
      let sessionRetrievable = false;
      try {
        const tokenId = await ct.getTokenIdBySessionId(result.sessionId);
        if (tokenId && BigInt(tokenId) > 0n) {
          const stored = await ct.getSession(tokenId);
          sessionRetrievable = stored.sessionId === result.sessionId;
        }
      } catch { /* not found */ }

      const checks: string[] = [];
      if (!failedCorrectly) checks.push("실패 TX가 ZeroAmount로 revert되지 않음");
      if (!sessionRetrievable) checks.push("성공 세션 조회 불가");

      if (checks.length === 0) {
        counts.passed++;
        emit({ type: "pass", label: "A-5 실패 후 성공 → 데이터 무결성", kind: "verify" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "A-5 실패 후 성공 → 데이터 무결성",
          reason: checks.join(", "), kind: "verify" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "A-5 실패 후 성공 → 데이터 무결성", reason: String(err).slice(0, 200), kind: "verify" });
    }

    return counts;
  },
};
