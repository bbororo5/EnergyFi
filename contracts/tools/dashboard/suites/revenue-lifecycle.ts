/**
 * Suite 4: 수익 라이프사이클
 * CPO 수익 기록 → 정산 → 정산 후 상태 검증
 * 9 cases
 */

import { encodeBytes32String } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../server.js";
import {
  b32, newCounts, expectSuccess, expectValue, expectRevert,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";
import {
  buildRandomSession, generateAndProcessSession,
  generateP256KeyPair, chipKeyPairs,
} from "../lib/p256-keys.js";
import { calculatePeriod, currentPeriod, safeDecodeB32 } from "../lib/utils.js";

export const revenueLifecycleSuite: TestSuite = {
  id: "revenue-lifecycle",
  label: "수익 라이프사이클",
  caseCount: 11,
  requires: "phase2",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    const counts = newCounts();
    const rt = ctx.revenueTracker!;
    const sr = ctx.stationRegistry;
    const srAdmin = ctx.stationRegistryAdmin; // registerStation/Charger/deactivate* — 비인터페이스 write ops
    const ifaces = [rt.interface, srAdmin.interface];

    // CPO 충전소에 다수 세션 기록
    let cpoStationId: string | null = null;
    let cpoStationLabel: string | null = null;
    let cpoId: string | null = null;
    let cpoRevAccBefore = 0n;
    let stationAccBefore = 0n;
    let historyLenBefore = 0;
    const period = currentPeriod();

    // R-1. 다수 세션 기록 후 CPO 수익 합산 정확성
    // M1 fix: buildRandomSession → receipt에서 직접 stationId 추출 (queryFilter 제거)
    // 동일 충전소에 3건 고정하여 합산 검증 가능하도록 함
    emit({ type: "case-start", label: "R-1 다수 세션 기록 (3건)", kind: "verify" });
    try {
      // 먼저 CPO 충전소 하나를 고정
      const firstSession = await buildRandomSession(ctx, undefined, "CPO");
      cpoStationId = firstSession.stationId;
      const station = await sr.getStation(cpoStationId);
      cpoId = station.cpoId;

      // CPO 수익 before 캡처 (R-2 증분 검증용)
      const cpoRevBeforeR1 = await rt.getCPORevenue(cpoId);
      cpoRevAccBefore = BigInt(cpoRevBeforeR1[0] ?? 0);

      // 고정된 충전소의 stationIdStr 추출 (buildRandomSession에 전달용)
      const stationLabel = safeDecodeB32(cpoStationId!);
      cpoStationLabel = stationLabel;

      // 3건 동일 충전소에 기록
      const revBefore = await rt.getStationRevenue(cpoStationId);
      const accBefore = BigInt(revBefore[0] ?? 0);
      stationAccBefore = accBefore; // R-2 증분 검증용

      for (let i = 0; i < 3; i++) {
        await generateAndProcessSession(ctx, stationLabel, "CPO");
      }

      const revAfter = await rt.getStationRevenue(cpoStationId);
      const accAfter = BigInt(revAfter[0] ?? 0);

      if (accAfter > accBefore && cpoStationId) {
        counts.passed++;
        emit({ type: "pass", label: "R-1 다수 세션 기록 (3건)", kind: "verify" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "R-1 다수 세션 기록 (3건)",
          reason: `acc: ${accBefore}→${accAfter}`, kind: "verify" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "R-1 다수 세션 기록 (3건)", reason: String(err).slice(0, 200), kind: "verify" });
    }

    // R-2. getCPORevenue accumulated 정밀 대조
    if (cpoId) {
      await expectValue("R-2 getCPORevenue accumulated 정밀 대조",
        async () => {
          const rev = await rt.getCPORevenue(cpoId!);
          const accAfter = BigInt(rev[0] ?? rev.accumulated ?? 0);
          const increase = accAfter - cpoRevAccBefore;
          // R-1에서 3건 기록했으므로 increase > 0이고 정확한 증분 검증
          // 충전소 수익 증분과 CPO 수익 증분을 대조
          const stationRev = await rt.getStationRevenue(cpoStationId!);
          const stationAccNow = BigInt(stationRev[0] ?? 0);
          const stationIncrease = stationAccNow - stationAccBefore;
          return { cpoIncrease: increase, stationIncrease };
        },
        (r: any) => {
          // CPO 증분 ≥ 충전소 증분 (CPO에 충전소 여러 개일 수 있으므로 ≥)
          if (r.cpoIncrease > 0n && r.cpoIncrease >= r.stationIncrease) return true;
          return `CPO 증분=${r.cpoIncrease}, 충전소 증분=${r.stationIncrease}`;
        },
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-2", kind: "verify" });
      emit({ type: "fail", label: "R-2", reason: "cpoId 없음", kind: "verify" });
    }

    // 정산 전 이력 길이 캡처 (R-7 증분 검증용)
    if (cpoStationId) {
      try {
        const h = await rt.getSettlementHistory(cpoStationId);
        historyLenBefore = h?.length ?? 0;
      } catch { /* ignore */ }
    }

    // R-3. claim 성공 → settled 증가, pending=0
    let claimReceipt: any = null;
    if (cpoId) {
      emit({ type: "case-start", label: "R-3 claim 성공", kind: "happy" });
      try {
        const tx = await rt.claim(cpoId!, period);
        claimReceipt = await tx.wait();
        counts.passed++;
        emit({ type: "pass", label: "R-3 claim 성공", kind: "happy" });
      } catch (err: unknown) {
        counts.failed++;
        emit({ type: "fail", label: "R-3 claim 성공", reason: String(err).slice(0, 200), kind: "happy" });
      }
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-3", kind: "happy" });
      emit({ type: "fail", label: "R-3", reason: "cpoId 없음", kind: "happy" });
    }

    // R-4. 정산 후 pending=0 불변량
    if (cpoId) {
      await expectValue("R-4 정산 후 pending=0 불변량",
        async () => {
          const rev = await rt.getCPORevenue(cpoId!);
          const pending = BigInt(rev[2] ?? rev.pending ?? 0);
          return { pending };
        },
        (r: any) => {
          if (r.pending === 0n) return true;
          return `pending=${r.pending} (expected 0)`;
        },
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-4", kind: "verify" });
      emit({ type: "fail", label: "R-4", reason: "cpoId 없음", kind: "verify" });
    }

    // R-5. claim 재호출 → NothingToClaim revert
    if (cpoId) {
      await expectRevert("R-5 claim 재호출 → NothingToClaim",
        () => rt.claim(cpoId!, period),
        "NothingToClaim",
        ifaces, emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-5", kind: "reject" });
      emit({ type: "fail", label: "R-5", reason: "cpoId 없음", kind: "reject" });
    }

    // R-6. 정산 후 추가 수익 기록 → 새 pending 누적
    if (cpoId && cpoStationLabel) {
      emit({ type: "case-start", label: "R-6 정산 후 추가 세션", kind: "verify" });
      try {
        await generateAndProcessSession(ctx, cpoStationLabel, "CPO");
        const rev = await rt.getCPORevenue(cpoId!);
        const pending = BigInt(rev[2] ?? rev.pending ?? 0);
        if (pending > 0n) {
          counts.passed++;
          emit({ type: "pass", label: "R-6 정산 후 추가 세션 → 새 pending", kind: "verify" });
        } else {
          counts.failed++;
          emit({ type: "fail", label: "R-6 정산 후 추가 세션", reason: `pending = ${pending}`, kind: "verify" });
        }
      } catch (err: unknown) {
        counts.failed++;
        emit({ type: "fail", label: "R-6 정산 후 추가 세션", reason: String(err).slice(0, 200), kind: "verify" });
      }
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-6", kind: "verify" });
      emit({ type: "fail", label: "R-6", reason: "cpoId 없음", kind: "verify" });
    }

    // R-7. getSettlementHistory 기록 확인
    if (cpoStationId) {
      await expectValue("R-7 getSettlementHistory 증분 확인",
        () => rt.getSettlementHistory(cpoStationId!),
        (history: any[]) => {
          if (history && history.length > historyLenBefore) return true;
          return `이력 ${history?.length ?? 0}건 (이전: ${historyLenBefore}건)`;
        },
        emit, counts);
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-7", kind: "verify" });
      emit({ type: "fail", label: "R-7", reason: "stationId 없음", kind: "verify" });
    }

    // R-8. EnergyFi 지역 수익은 CPO claim에 영향 없음
    // C2 fix: CPO pending을 before/after 비교하여 EFI 세션이 CPO 수익에 영향 없음을 검증
    if (cpoId) {
      emit({ type: "case-start", label: "R-8 EFI 수익은 CPO claim 무관", kind: "verify" });
      try {
        const revBefore = await rt.getCPORevenue(cpoId!);
        const cpoPendingBefore = BigInt(revBefore[2] ?? revBefore.pending ?? 0);
        const cpoAccBefore = BigInt(revBefore[0] ?? revBefore.accumulated ?? 0);

        // EFI 세션 생성 (CPO 수익과 무관해야 함)
        await generateAndProcessSession(ctx, undefined, "ENERGYFI");

        const revAfter = await rt.getCPORevenue(cpoId!);
        const cpoPendingAfter = BigInt(revAfter[2] ?? revAfter.pending ?? 0);
        const cpoAccAfter = BigInt(revAfter[0] ?? revAfter.accumulated ?? 0);

        // CPO pending/accumulated가 EFI 세션 전후로 동일해야 함
        if (cpoPendingAfter === cpoPendingBefore && cpoAccAfter === cpoAccBefore) {
          counts.passed++;
          emit({ type: "pass", label: "R-8 EFI 수익은 CPO claim 무관", kind: "verify" });
        } else {
          counts.failed++;
          emit({ type: "fail", label: "R-8 EFI 수익은 CPO claim 무관",
            reason: `CPO acc: ${cpoAccBefore}→${cpoAccAfter}, pending: ${cpoPendingBefore}→${cpoPendingAfter}`,
            kind: "verify" });
        }
      } catch (err: unknown) {
        counts.failed++;
        emit({ type: "fail", label: "R-8 EFI 수익은 CPO claim 무관", reason: String(err).slice(0, 200), kind: "verify" });
      }
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-8", kind: "verify" });
      emit({ type: "fail", label: "R-8", reason: "cpoId 없음", kind: "verify" });
    }

    // R-9. 금액 정밀 대조: processCharge 입력 = RT 누적
    if (cpoStationLabel) {
      emit({ type: "case-start", label: "R-9 금액 정밀 대조: processCharge 입력 = RT 누적", kind: "verify" });
      try {
        // 충전소 수익 before 캡처
        const revBefore = await rt.getStationRevenue(cpoStationId!);
        const pendingBefore = BigInt(revBefore[2] ?? 0);

        // 단일 세션 생성 — distributableKrw 캡처
        const session = await buildRandomSession(ctx, cpoStationLabel!, "CPO");
        const sessionAmount = BigInt(session.distributableKrw);
        const sessionPeriod = calculatePeriod(Number(session.endTimestamp));
        const tx = await ctx.chargeRouter!.processCharge(session, sessionPeriod);
        await tx.wait();

        // 충전소 수익 after 캡처
        const revAfter = await rt.getStationRevenue(cpoStationId!);
        const pendingAfter = BigInt(revAfter[2] ?? 0);

        const diff = pendingAfter - pendingBefore;
        if (diff === sessionAmount) {
          counts.passed++;
          emit({ type: "pass", label: "R-9 금액 정밀 대조: processCharge 입력 = RT 누적", kind: "verify" });
        } else {
          counts.failed++;
          emit({ type: "fail", label: "R-9 금액 정밀 대조: processCharge 입력 = RT 누적",
            reason: `입력=${sessionAmount}, 증분=${diff}`, kind: "verify" });
        }
      } catch (err: unknown) {
        counts.failed++;
        emit({ type: "fail", label: "R-9 금액 정밀 대조: processCharge 입력 = RT 누적",
          reason: String(err).slice(0, 200), kind: "verify" });
      }
    } else {
      counts.failed++;
      emit({ type: "case-start", label: "R-9", kind: "verify" });
      emit({ type: "fail", label: "R-9", reason: "stationLabel 없음", kind: "verify" });
    }

    // R-10. ownerType 수익 분기: CPO↔EFI 정확 귀속
    emit({ type: "case-start", label: "R-10 ownerType 수익 분기: CPO↔EFI 정확 귀속", kind: "verify" });
    try {
      // CPO 충전소 pending before
      const cpoRevBefore = await rt.getCPORevenue(cpoId!);
      const cpoPendingBefore = BigInt(cpoRevBefore[2] ?? 0);

      // EFI 세션용: 첫 번째 EFI 충전소 찾기
      const session = await buildRandomSession(ctx, undefined, "ENERGYFI");
      const efiRegion = session.gridRegionCode;
      const efiRegionRevBefore = BigInt(await rt.getEnergyFiRegionRevenue(efiRegion));

      // CPO 세션 기록
      const cpoSession = await buildRandomSession(ctx, cpoStationLabel!, "CPO");
      const cpoAmount = BigInt(cpoSession.distributableKrw);
      const cpoPeriod = calculatePeriod(Number(cpoSession.endTimestamp));
      const cpoTx = await ctx.chargeRouter!.processCharge(cpoSession, cpoPeriod);
      await cpoTx.wait();

      // EFI 세션 기록
      const efiAmount = BigInt(session.distributableKrw);
      const efiPeriod = calculatePeriod(Number(session.endTimestamp));
      const efiTx = await ctx.chargeRouter!.processCharge(session, efiPeriod);
      await efiTx.wait();

      // CPO pending after
      const cpoRevAfter = await rt.getCPORevenue(cpoId!);
      const cpoPendingAfter = BigInt(cpoRevAfter[2] ?? 0);
      const cpoIncrease = cpoPendingAfter - cpoPendingBefore;

      // EFI region after
      const efiRegionRevAfter = BigInt(await rt.getEnergyFiRegionRevenue(efiRegion));
      const efiIncrease = efiRegionRevAfter - efiRegionRevBefore;

      const checks: string[] = [];
      if (cpoIncrease !== cpoAmount) checks.push(`CPO: 입력=${cpoAmount}, 증분=${cpoIncrease}`);
      if (efiIncrease !== efiAmount) checks.push(`EFI: 입력=${efiAmount}, 증분=${efiIncrease}`);

      if (checks.length === 0) {
        counts.passed++;
        emit({ type: "pass", label: "R-10 ownerType 수익 분기: CPO↔EFI 정확 귀속", kind: "verify" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "R-10 ownerType 수익 분기: CPO↔EFI 정확 귀속",
          reason: checks.join(", "), kind: "verify" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "R-10 ownerType 수익 분기: CPO↔EFI 정확 귀속",
        reason: String(err).slice(0, 200), kind: "verify" });
    }

    // R-11. 비활성 충전소 미정산 수익 보존
    emit({ type: "case-start", label: "R-11 비활성 충전소 미정산 수익 보존", kind: "verify" });
    try {
      // 새 충전소 + 충전기 등록 → 세션 기록 → pending 확보 → 충전기 비활성화 → 충전소 비활성화 → claim 가능
      const ts = Date.now();
      const testCpoId = cpoId!;
      const testStationId = b32(`R11-STN-${ts}`);
      const testChargerId = b32(`R11-CHG-${ts}`);
      const regionKR11 = "0x4b523131";

      // 충전소 등록
      const stnTx = await srAdmin.registerStation(testStationId, testCpoId, 0, regionKR11, `R11 테스트 충전소`);
      await stnTx.wait();

      // SE칩 + 충전기 등록
      const { publicKey, wallet } = generateP256KeyPair();
      const enrollTx = await ctx.deviceRegistryAdmin.enrollChip(testChargerId, publicKey, 0);
      await enrollTx.wait();
      chipKeyPairs.set(testChargerId, { publicKey, wallet });

      const chgTx = await srAdmin.registerCharger(testChargerId, testStationId, 0);
      await chgTx.wait();

      // 세션 기록
      const stationLabel = safeDecodeB32(testStationId);
      await generateAndProcessSession(ctx, stationLabel, "CPO");

      // pending 확인
      const revMid = await rt.getStationRevenue(testStationId);
      const pendingMid = BigInt(revMid[2] ?? 0);

      // 충전기 비활성화 → 충전소 비활성화
      const deChgTx = await srAdmin.deactivateCharger(testChargerId);
      await deChgTx.wait();
      const deStTx = await srAdmin.deactivateStation(testStationId);
      await deStTx.wait();

      // claim — 비활성 충전소의 pending도 정산 가능해야 함
      const claimTx = await rt.claim(testCpoId, period);
      await claimTx.wait();

      // 정산 후 pending=0 확인 (비활성 충전소 포함)
      const revEnd = await rt.getStationRevenue(testStationId);
      const pendingEnd = BigInt(revEnd[2] ?? 0);

      if (pendingMid > 0n && pendingEnd === 0n) {
        counts.passed++;
        emit({ type: "pass", label: "R-11 비활성 충전소 미정산 수익 보존", kind: "verify" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "R-11 비활성 충전소 미정산 수익 보존",
          reason: `비활성화 전 pending=${pendingMid}, 정산 후 pending=${pendingEnd}`, kind: "verify" });
      }
    } catch (err: unknown) {
      counts.failed++;
      emit({ type: "fail", label: "R-11 비활성 충전소 미정산 수익 보존",
        reason: String(err).slice(0, 200), kind: "verify" });
    }

    return counts;
  },
};
