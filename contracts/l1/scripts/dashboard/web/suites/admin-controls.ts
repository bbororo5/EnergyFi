/**
 * Suite 7: 운영 안전성 — 긴급 정지/복구 + Bridge 키 교체
 * 비즈니스 시나리오: 비상 정지, AWS KMS 키 로테이션, 내부 파이프라인 Bridge 교체
 * 3 cases
 */

import { Wallet } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../server.js";
import {
  newCounts, expectValue,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";
import { buildRandomSession } from "../lib/p256-keys.js";
import { calculatePeriod } from "../lib/utils.js";

export const adminControlsSuite: TestSuite = {
  id: "admin-controls",
  label: "운영 안전성",
  caseCount: 3,
  requires: "phase2",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    const cr = ctx.chargeRouter!;
    const ct = ctx.chargeTransaction!;
    const counts = newCounts();

    // ── AD-1. 시스템 긴급 정지 → 충전 차단 → 복구 → 정상 처리 ──────────
    emit({ type: "case-start", label: "AD-1 시스템 긴급 정지 → 충전 차단 → 복구 → 정상 처리", kind: "verify" });
    try {
      // 1) CR pause
      const pauseTx = await cr.pause();
      await pauseTx.wait();

      // 2) processCharge → revert (시스템 정지 상태에서 데이터 거부)
      let blockedDuringPause = false;
      try {
        const session = await buildRandomSession(ctx);
        const period = calculatePeriod(Number(session.endTimestamp));
        const tx = await cr.processCharge(session, period);
        await tx.wait();
      } catch {
        blockedDuringPause = true;
      }

      // 3) CR unpause
      const unpauseTx = await cr.unpause();
      await unpauseTx.wait();

      // 4) processCharge → 성공 (복구 후 정상 동작)
      let successAfterUnpause = false;
      try {
        const session = await buildRandomSession(ctx);
        const period = calculatePeriod(Number(session.endTimestamp));
        const tx = await cr.processCharge(session, period);
        await tx.wait();
        successAfterUnpause = true;
      } catch { /* failed */ }

      const checks: string[] = [];
      if (!blockedDuringPause) checks.push("정지 중 충전이 차단되지 않음");
      if (!successAfterUnpause) checks.push("복구 후 충전 실패");

      if (checks.length === 0) {
        counts.passed++;
        emit({ type: "pass", label: "AD-1 시스템 긴급 정지 → 충전 차단 → 복구 → 정상 처리", kind: "verify" });
      } else {
        counts.failed++;
        emit({ type: "fail", label: "AD-1 시스템 긴급 정지 → 충전 차단 → 복구 → 정상 처리",
          reason: checks.join(", "), kind: "verify" });
      }
    } catch (err: unknown) {
      // 에러 발생 시 unpause 보장
      try { await cr.unpause(); } catch { /* already unpaused */ }
      counts.failed++;
      emit({ type: "fail", label: "AD-1 시스템 긴급 정지 → 충전 차단 → 복구 → 정상 처리",
        reason: String(err).slice(0, 200), kind: "verify" });
    }

    // ── AD-2. Bridge 키 교체 → 새 Bridge 파이프라인 정상 ────────────────
    await expectValue("AD-2 Bridge 키 교체 → 새 Bridge 파이프라인 정상",
      async () => {
        const deployerAddr = await ctx.signer.getAddress();
        const tempAddr = Wallet.createRandom().address;

        // 1) CR bridge를 임시 주소로 변경
        const updateTx = await cr.updateBridgeAddress(tempAddr);
        await updateTx.wait();

        // 2) bridgeAddress() === 임시 주소 확인
        const newBridge = await cr.bridgeAddress();
        const matches = newBridge === tempAddr;

        // 3) deployer로 복구
        const restoreTx = await cr.updateBridgeAddress(deployerAddr);
        await restoreTx.wait();

        return { matches, tempAddr, newBridge };
      },
      (r: any) => {
        if (r.matches) return true;
        return `bridgeAddress=${r.newBridge}, expected=${r.tempAddr}`;
      },
      emit, counts);

    // ── AD-3. CT Bridge 교체 → 내부 파이프라인 반영 ─────────────────────
    await expectValue("AD-3 CT Bridge 교체 → 내부 파이프라인 반영",
      async () => {
        const crAddr = await cr.getAddress();
        const tempAddr = Wallet.createRandom().address;

        // 1) CT의 bridge를 임시 주소로 변경
        const updateTx = await ct.updateBridgeAddress(tempAddr);
        await updateTx.wait();

        // 2) 확인
        const newBridge = await ct.bridgeAddress();
        const matches = newBridge === tempAddr;

        // 3) CR proxy 주소로 복구
        const restoreTx = await ct.updateBridgeAddress(crAddr);
        await restoreTx.wait();

        return { matches, tempAddr, newBridge };
      },
      (r: any) => {
        if (r.matches) return true;
        return `bridgeAddress=${r.newBridge}, expected=${r.tempAddr}`;
      },
      emit, counts);

    return counts;
  },
};
