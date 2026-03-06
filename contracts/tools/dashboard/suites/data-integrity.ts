/**
 * Suite 9: 데이터 정합성 — 교차 컨트랙트 데이터 일관성 검증
 * 개별 함수가 아닌 컨트랙트 간 합산/역조회 교차 검증
 * 4 cases
 */

import { encodeBytes32String } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../server.js";
import {
  newCounts, expectValue,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";
import { generateAndProcessSession } from "../lib/p256-keys.js";
import { regionBytes4 } from "../lib/utils.js";

export const dataIntegritySuite: TestSuite = {
  id: "data-integrity",
  label: "데이터 정합성",
  caseCount: 4,
  requires: "phase2",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    const counts = newCounts();
    const rt = ctx.revenueTracker!;
    const ct = ctx.chargeTransaction!;
    const sr = ctx.stationRegistry;

    // 세션 2건 추가 (교차 검증 데이터 확보)
    let result1: any;
    let result2: any;
    try {
      result1 = await generateAndProcessSession(ctx, "STATION-001");
      result2 = await generateAndProcessSession(ctx, undefined, "KR11");
    } catch (err: unknown) {
      const reason = `초기 세션 생성 실패: ${String(err).slice(0, 200)}`;
      for (const label of [
        "DI-1 지역 수익 = 충전소 pending 합",
        "DI-2 충전소 수익 합산 불변량",
        "DI-3 감사 추적: 세션ID로 온체인 기록 조회",
        "DI-4 지역 충전소 전수 유효성",
      ]) {
        counts.failed++;
        emit({ type: "case-start", label, kind: "verify" });
        emit({ type: "fail", label, reason, kind: "verify" });
      }
      return counts;
    }

    // DI-1. 지역 수익 = 소속 충전소 pending 합
    const regionKR11 = regionBytes4("KR11");
    await expectValue("DI-1 지역 수익 = 충전소 pending 합",
      async () => {
        const regionPending = BigInt(await rt.getRegionRevenue(regionKR11));

        const stations: string[] = await sr.getStationsByRegion(regionKR11);
        let stationPendingSum = 0n;
        for (const sid of stations) {
          const sRev = await rt.getStationRevenue(sid);
          stationPendingSum += BigInt(sRev[2] ?? 0);
        }
        return { regionPending, stationPendingSum, stationCount: stations.length };
      },
      (r: any) => {
        if (r.regionPending === r.stationPendingSum) return true;
        return `지역 pending=${r.regionPending}, 충전소 합=${r.stationPendingSum} (${r.stationCount}개)`;
      },
      emit, counts);

    // DI-2. 충전소 수익 불변량: accumulated = settled + pending
    const station1Id = encodeBytes32String("STATION-001");
    await expectValue("DI-2 충전소 수익 합산 불변량",
      async () => {
        const rev = await rt.getStationRevenue(station1Id);
        const acc = BigInt(rev[0] ?? 0);
        const settled = BigInt(rev[1] ?? 0);
        const pending = BigInt(rev[2] ?? 0);
        return { acc, settled, pending };
      },
      (r: any) => {
        if (r.acc === r.settled + r.pending) return true;
        return `acc=${r.acc}, settled=${r.settled}, pending=${r.pending} (불일치)`;
      },
      emit, counts);

    // DI-3. 감사 추적: 세션ID로 온체인 기록 조회
    await expectValue("DI-3 감사 추적: 세션ID로 온체인 기록 조회",
      async () => {
        const tokenId = BigInt(result1.tokenId);
        const session = await ct.getSession(tokenId);
        const reverseLookup = BigInt(await ct.getTokenIdBySessionId(session.sessionId));
        return { tokenId, reverseLookup };
      },
      (r: any) => {
        if (r.tokenId === r.reverseLookup) return true;
        return `tokenId=${r.tokenId}, 역조회=${r.reverseLookup}`;
      },
      emit, counts);

    // DI-4. 지역 충전소 전수 유효성
    await expectValue("DI-4 지역 충전소 전수 유효성",
      async () => {
        const stations: string[] = await sr.getStationsByRegion(regionKR11);
        let validCount = 0;
        for (const sid of stations) {
          try {
            const station = await sr.getStation(sid);
            if (station.active) validCount++;
          } catch { /* StationNotFound */ }
        }
        return { listCount: stations.length, validCount };
      },
      (r: any) => {
        if (r.listCount === r.validCount && r.listCount > 0) return true;
        return `목록 ${r.listCount}개, 유효 ${r.validCount}개`;
      },
      emit, counts);

    return counts;
  },
};
