/**
 * Suite 9: 데이터 정합성 — 교차 컨트랙트 데이터 일관성 검증
 * 개별 함수가 아닌 컨트랙트 간 합산/역조회 교차 검증
 * 5 cases
 */

import { encodeBytes32String } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../server.js";
import {
  newCounts, expectValue,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";
import { generateAndProcessSession } from "../lib/p256-keys.js";

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
      result1 = await generateAndProcessSession(ctx, "STATION-001", "CPO");
      result2 = await generateAndProcessSession(ctx, undefined, "ENERGYFI", "KR11");
    } catch (err: unknown) {
      const reason = `초기 세션 생성 실패: ${String(err).slice(0, 200)}`;
      for (const label of [
        "DI-1 CPO 총수익 = 충전소 수익 합",
        "DI-2 EFI 지역 수익 = 충전소 pending 합",
        "DI-3 감사 추적: 세션ID로 온체인 기록 조회",
        "DI-4 CPO 소속 충전소 전수 유효성",
      ]) {
        counts.failed++;
        emit({ type: "case-start", label, kind: "verify" });
        emit({ type: "fail", label, reason, kind: "verify" });
      }
      return counts;
    }

    // DI-1. CPO 총수익 = 소속 충전소 수익 합
    const cpo1Id = encodeBytes32String("CPO-001");
    await expectValue("DI-1 CPO 총수익 = 충전소 수익 합",
      async () => {
        const cpoRev = await rt.getCPORevenue(cpo1Id);
        const cpoAcc = BigInt(cpoRev[0] ?? 0);

        const stationIds: string[] = await sr.getStationsByCPO(cpo1Id);
        let stationSum = 0n;
        for (const sid of stationIds) {
          const sRev = await rt.getStationRevenue(sid);
          stationSum += BigInt(sRev[0] ?? 0);
        }
        return { cpoAcc, stationSum, stationCount: stationIds.length };
      },
      (r: any) => {
        if (r.cpoAcc === r.stationSum) return true;
        return `CPO acc=${r.cpoAcc}, 충전소 합=${r.stationSum} (${r.stationCount}개)`;
      },
      emit, counts);

    // DI-2. EFI 지역 수익 = EFI 소속 충전소 pending 합
    const regionKR11 = "0x4b523131"; // "KR11"
    await expectValue("DI-2 EFI 지역 수익 = 충전소 pending 합",
      async () => {
        const regionPending = BigInt(await rt.getEnergyFiRegionRevenue(regionKR11));

        const efiStations: string[] = await sr.getEnergyFiStationsByRegion(regionKR11);
        let stationPendingSum = 0n;
        for (const sid of efiStations) {
          const sRev = await rt.getStationRevenue(sid);
          stationPendingSum += BigInt(sRev[2] ?? 0);
        }
        return { regionPending, stationPendingSum, stationCount: efiStations.length };
      },
      (r: any) => {
        if (r.regionPending === r.stationPendingSum) return true;
        return `지역 pending=${r.regionPending}, 충전소 합=${r.stationPendingSum} (${r.stationCount}개)`;
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

    // DI-4. CPO 소속 충전소 전수 유효성
    await expectValue("DI-4 CPO 소속 충전소 전수 유효성",
      async () => {
        const cpo1Stations: string[] = await sr.getStationsByCPO(cpo1Id);
        // 각 충전소가 실제로 조회 가능한지 확인
        let validCount = 0;
        for (const sid of cpo1Stations) {
          try {
            const station = await sr.getStation(sid);
            if (station.active) validCount++;
          } catch { /* StationNotFound */ }
        }
        return { listCount: cpo1Stations.length, validCount };
      },
      (r: any) => {
        if (r.listCount === r.validCount && r.listCount > 0) return true;
        return `목록 ${r.listCount}개, 유효 ${r.validCount}개`;
      },
      emit, counts);

    return counts;
  },
};
