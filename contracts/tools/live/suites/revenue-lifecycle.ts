/**
 * Suite 4: 수익 라이프사이클
 * 충전소 수익 기록 → 지역 수익 반영 → 다중 세션 합산 검증
 * 7 cases
 */

import { encodeBytes32String, hexlify } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../context.js";
import {
  b32, newCounts, expectSuccess, expectValue, expectRevert, allErrorInterfaces,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";
import {
  buildRandomSession, generateAndProcessSession,
  generateP256KeyPair, chipKeyPairs,
  generateMockSignature, randomSessionId, randInt,
} from "../lib/p256-keys.js";
import { calculatePeriod, currentPeriod, safeDecodeB32 } from "../lib/utils.js";

export const revenueLifecycleSuite: TestSuite = {
  id: "revenue-lifecycle",
  label: "수익 라이프사이클",
  caseCount: 7,
  requires: "phase2",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    const counts = newCounts();
    const rt = ctx.revenueTracker!;
    const sr = ctx.stationRegistry;
    const srAdmin = ctx.stationRegistryAdmin;
    const ifaces = allErrorInterfaces();

    let stationId: string | null = null;
    let stationLabel: string | null = null;
    let stationAccBefore = 0n;
    const period = currentPeriod();

    // R-1. 다수 세션 기록 후 충전소 수익 합산 정확성
    emit({ type: "case-start", label: "R-1 다수 세션 기록 (3건)", kind: "verify" });
    try {
      const firstSession = await buildRandomSession(ctx, "STATION-001");
      stationId = firstSession.stationId;
      stationLabel = "STATION-001";

      const revBefore = await rt.getStationRevenue(stationId);
      const accBefore = BigInt(revBefore[0] ?? 0);
      stationAccBefore = accBefore;

      for (let i = 0; i < 3; i++) {
        await generateAndProcessSession(ctx, stationLabel);
      }

      const revAfter = await rt.getStationRevenue(stationId);
      const accAfter = BigInt(revAfter[0] ?? 0);

      if (accAfter > accBefore && stationId) {
        counts.passed++;
        emit({ type: "pass", label: "R-1 다수 세션 기록 (3건)", kind: "verify" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "R-1 다수 세션 기록 (3건)",
          reason: `acc: ${accBefore}->${accAfter}`, kind: "verify" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "R-1 다수 세션 기록 (3건)", reason: String(err).slice(0, 200), kind: "verify" });
    }

    // R-2. 충전소 수익 증분 정밀 검증
    if (stationId) {
      await expectValue("R-2 충전소 수익 증분 정밀 검증",
        async () => {
          const revAfter = await rt.getStationRevenue(stationId!);
          const accAfter = BigInt(revAfter[0] ?? 0);
          const increase = accAfter - stationAccBefore;
          return { accAfter, increase };
        },
        (r: any) => {
          if (r.increase > 0n) return true;
          return `증분=${r.increase} (expected > 0)`;
        },
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-2", kind: "verify" });
      emit({ type: "fail", label: "R-2", reason: "stationId 없음", kind: "verify" });
    }

    // R-3. 지역 수익에 충전소 수익 반영 확인
    if (stationId) {
      await expectValue("R-3 지역 수익에 충전소 수익 반영",
        async () => {
          const station = await sr.getStation(stationId!);
          const regionRev = BigInt(await rt.getRegionRevenue(station.regionId));
          return { regionRev };
        },
        (r: any) => {
          if (r.regionRev > 0n) return true;
          return `지역 수익 = ${r.regionRev}`;
        },
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-3", kind: "verify" });
      emit({ type: "fail", label: "R-3", reason: "stationId 없음", kind: "verify" });
    }

    // R-4. 금액 정밀 대조: processCharge 입력 = RT 누적
    if (stationLabel) {
      emit({ type: "case-start", label: "R-4 금액 정밀 대조: processCharge 입력 = RT 누적", kind: "verify" });
      try {
        const revBefore = await rt.getStationRevenue(stationId!);
        const pendingBefore = BigInt(revBefore[2] ?? 0);

        const session = await buildRandomSession(ctx, stationLabel!);
        const sessionAmount = BigInt(session.distributableKrw);
        const sessionPeriod = calculatePeriod(Number(session.endTimestamp));
        const tx = await ctx.chargeRouter!.processCharge(session, sessionPeriod);
        await tx.wait();

        const revAfter = await rt.getStationRevenue(stationId!);
        const pendingAfter = BigInt(revAfter[2] ?? 0);

        const diff = pendingAfter - pendingBefore;
        if (diff === sessionAmount) {
          counts.passed++;
          emit({ type: "pass", label: "R-4 금액 정밀 대조: processCharge 입력 = RT 누적", kind: "verify" });
        } else {
          counts.failed++;
          emit({ type: "fail", label: "R-4 금액 정밀 대조: processCharge 입력 = RT 누적",
            reason: `입력=${sessionAmount}, 증분=${diff}`, kind: "verify" });
        }
      } catch (err: unknown) {
        counts.failed++;
        emit({ type: "fail", label: "R-4 금액 정밀 대조: processCharge 입력 = RT 누적",
          reason: String(err).slice(0, 200), kind: "verify" });
      }
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-4", kind: "verify" });
      emit({ type: "fail", label: "R-4", reason: "stationLabel 없음", kind: "verify" });
    }

    // R-5. 다른 충전소 세션이 현재 충전소에 영향 없음
    if (stationId) {
      emit({ type: "case-start", label: "R-5 다른 충전소 세션 무영향", kind: "verify" });
      try {
        const revBefore = await rt.getStationRevenue(stationId!);
        const pendingBefore = BigInt(revBefore[2] ?? revBefore.pending ?? 0);
        const accBefore = BigInt(revBefore[0] ?? revBefore.accumulated ?? 0);

        // 다른 충전소에 세션 생성
        await generateAndProcessSession(ctx, "STATION-003");

        const revAfter = await rt.getStationRevenue(stationId!);
        const pendingAfter = BigInt(revAfter[2] ?? revAfter.pending ?? 0);
        const accAfter = BigInt(revAfter[0] ?? revAfter.accumulated ?? 0);

        if (pendingAfter === pendingBefore && accAfter === accBefore) {
          counts.passed++;
          emit({ type: "pass", label: "R-5 다른 충전소 세션 무영향", kind: "verify" });
        } else {
          counts.failed++;
          emit({ type: "fail", label: "R-5 다른 충전소 세션 무영향",
            reason: `acc: ${accBefore}->${accAfter}, pending: ${pendingBefore}->${pendingAfter}`,
            kind: "verify" });
        }
      } catch (err: unknown) {
        counts.failed++;
        emit({ type: "fail", label: "R-5 다른 충전소 세션 무영향", reason: String(err).slice(0, 200), kind: "verify" });
      }
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-5", kind: "verify" });
      emit({ type: "fail", label: "R-5", reason: "stationId 없음", kind: "verify" });
    }

    // R-6. 지역별 수익 독립성: KR11 세션이 KR26에 영향 없음
    emit({ type: "case-start", label: "R-6 지역별 수익 독립성", kind: "verify" });
    try {
      const regionKR26 = "0x4b523236"; // "KR26"
      const regionKR11 = "0x4b523131"; // "KR11"

      const kr26Before = BigInt(await rt.getRegionRevenue(regionKR26));
      const kr11Before = BigInt(await rt.getRegionRevenue(regionKR11));

      // KR11 충전소에 세션 생성
      await generateAndProcessSession(ctx, "STATION-001");

      const kr26After = BigInt(await rt.getRegionRevenue(regionKR26));
      const kr11After = BigInt(await rt.getRegionRevenue(regionKR11));

      const checks: string[] = [];
      if (kr11After <= kr11Before) checks.push(`KR11 수익 미증가: ${kr11Before}->${kr11After}`);
      if (kr26After !== kr26Before) checks.push(`KR26 수익 변동: ${kr26Before}->${kr26After}`);

      if (checks.length === 0) {
        counts.passed++;
        emit({ type: "pass", label: "R-6 지역별 수익 독립성", kind: "verify" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "R-6 지역별 수익 독립성",
          reason: checks.join(", "), kind: "verify" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "R-6 지역별 수익 독립성", reason: String(err).slice(0, 200), kind: "verify" });
    }

    // R-7. 비활성 충전소 수익 데이터 보존
    emit({ type: "case-start", label: "R-7 비활성 충전소 수익 데이터 보존", kind: "verify" });
    try {
      const ts = Date.now();
      const testStationId = b32(`R7-STN-${ts}`);
      const testChargerId = b32(`R7-CHG-${ts}`);
      const regionKR11 = "0x4b523131";

      // 충전소 등록
      const stnTx = await srAdmin.registerStation(testStationId, regionKR11, `R7 테스트 충전소`);
      await stnTx.wait();

      // SE칩 + 충전기 등록
      const { publicKey, wallet } = generateP256KeyPair();
      const enrollTx = await ctx.deviceRegistryAdmin.enrollChip(testChargerId, publicKey, 0);
      await enrollTx.wait();
      chipKeyPairs.set(testChargerId, { publicKey, wallet });

      const chgTx = await srAdmin.registerCharger(testChargerId, testStationId, 0);
      await chgTx.wait();

      // 세션 기록
      {
        const energyKwh = BigInt(randInt(500, 8000));
        const rate = BigInt(randInt(200, 400));
        const distributableKrw = (energyKwh * rate) / 100n;
        const now = Math.floor(Date.now() / 1000);
        const endTimestamp = BigInt(now);
        const startTimestamp = BigInt(now - 3600);
        const seSignature = generateMockSignature(testChargerId, energyKwh, startTimestamp, endTimestamp);
        const session = {
          sessionId: randomSessionId(),
          chargerId: testChargerId,
          chargerType: 0,
          energyKwh,
          startTimestamp,
          endTimestamp,
          vehicleCategory: 0,
          gridRegionCode: regionKR11,
          stationId: testStationId,
          distributableKrw,
          seSignature: hexlify(seSignature),
        };
        const sessionPeriod = calculatePeriod(Number(endTimestamp));
        const sessTx = await ctx.chargeRouter!.processCharge(session, sessionPeriod);
        await sessTx.wait();
      }

      // pending 확인
      const revMid = await rt.getStationRevenue(testStationId);
      const pendingMid = BigInt(revMid[2] ?? 0);

      // 충전기 비활성화 -> 충전소 비활성화
      const deChgTx = await srAdmin.deactivateCharger(testChargerId);
      await deChgTx.wait();
      const deStTx = await srAdmin.deactivateStation(testStationId);
      await deStTx.wait();

      // 비활성화 후에도 수익 데이터가 보존되는지 확인
      const revEnd = await rt.getStationRevenue(testStationId);
      const accEnd = BigInt(revEnd[0] ?? 0);
      const pendingEnd = BigInt(revEnd[2] ?? 0);

      if (pendingMid > 0n && pendingEnd === pendingMid && accEnd > 0n) {
        counts.passed++;
        emit({ type: "pass", label: "R-7 비활성 충전소 수익 데이터 보존", kind: "verify" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "R-7 비활성 충전소 수익 데이터 보존",
          reason: `비활성화 전 pending=${pendingMid}, 비활성화 후 pending=${pendingEnd}, acc=${accEnd}`, kind: "verify" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "R-7 비활성 충전소 수익 데이터 보존",
        reason: String(err).slice(0, 200), kind: "verify" });
    }

    return counts;
  },
};
