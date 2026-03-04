/**
 * 통합 테스트 러너 — SSE 스트리밍 라우트
 *
 * GET /verify/run-all       → 전체 스위트 순차 실행 (SSE)
 * GET /verify/run/:suiteId  → 단일 스위트 실행 (SSE)
 * GET /verify/suites        → 스위트 목록 JSON
 */

import { Router } from "express";
import type { ContractCtx } from "../server.js";
import type { TestSuite } from "../lib/test-suite.js";
import type { VerifyEvent, EmitFn, SuiteResult } from "../lib/test-helpers.js";
import { ensureBulkData, ensureP256Setup } from "../lib/bulk-setup.js";

import { phase1InfraSuite } from "../suites/phase1-infra.js";
import { phase2HappySuite } from "../suites/phase2-happy.js";
import { phase2FailuresSuite } from "../suites/phase2-failures.js";
import { revenueLifecycleSuite } from "../suites/revenue-lifecycle.js";
import { crossContractSuite } from "../suites/cross-contract.js";
import { edgeCasesSuite } from "../suites/edge-cases.js";
import { adminControlsSuite } from "../suites/admin-controls.js";
import { dataIntegritySuite } from "../suites/data-integrity.js";
import { settlementBoundarySuite } from "../suites/settlement-boundary.js";

const ALL_SUITES: TestSuite[] = [
  phase1InfraSuite,
  phase2HappySuite,
  phase2FailuresSuite,
  revenueLifecycleSuite,
  crossContractSuite,
  edgeCasesSuite,
  adminControlsSuite,
  dataIntegritySuite,
  settlementBoundarySuite,
];

function sseHeaders(res: any) {
  res.writeHead(200, {
    "Content-Type":       "text/event-stream",
    "Cache-Control":      "no-cache",
    Connection:           "keep-alive",
    "X-Accel-Buffering":  "no",
  });
}

function createEmit(res: any): EmitFn {
  return (event: VerifyEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
}

function hasPhase2(ctx: ContractCtx): boolean {
  return !!(ctx.chargeTransaction && ctx.revenueTracker && ctx.chargeRouter);
}

async function runSuites(suites: TestSuite[], ctx: ContractCtx, emit: EmitFn): Promise<void> {
  const suiteResults: SuiteResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalGaps = 0;

  // Phase 2 스위트가 포함된 경우 자동 셋업
  const needsPhase2 = suites.some(s => s.requires === "phase2");
  if (needsPhase2 && hasPhase2(ctx)) {
    try {
      emit({ type: "setup-ok", label: "Phase 1 bulk 데이터 자동 등록 중..." });
      await ensureBulkData(ctx, emit);
      emit({ type: "setup-ok", label: "P-256 키 자동 셋업 중..." });
      await ensureP256Setup(ctx, emit);
      emit({ type: "setup-ok", label: "자동 셋업 완료" });
    } catch (err: unknown) {
      emit({ type: "fail", label: "자동 셋업 실패", reason: String(err).slice(0, 300), kind: "happy" });
      emit({ type: "done" });
      return;
    }
  }

  for (const suite of suites) {
    // Phase 2 스위트인데 미배포 → 스킵
    if (suite.requires === "phase2" && !hasPhase2(ctx)) {
      emit({
        type: "suite-start",
        suiteId: suite.id,
        label: suite.label,
        caseCount: suite.caseCount,
      });
      emit({
        type: "suite-end",
        suiteId: suite.id,
        passed: 0,
        failed: 0,
        gaps: 0,
      });
      suiteResults.push({
        suiteId: suite.id,
        label: suite.label,
        passed: 0,
        failed: 0,
        gaps: 0,
      });
      continue;
    }

    emit({
      type: "suite-start",
      suiteId: suite.id,
      label: suite.label,
      caseCount: suite.caseCount,
    });

    try {
      const counts = await suite.run(ctx, emit);
      suiteResults.push({
        suiteId: suite.id,
        label: suite.label,
        passed: counts.passed,
        failed: counts.failed,
        gaps: counts.gaps,
      });
      totalPassed += counts.passed;
      totalFailed += counts.failed;
      totalGaps += counts.gaps;

      emit({
        type: "suite-end",
        suiteId: suite.id,
        passed: counts.passed,
        failed: counts.failed,
        gaps: counts.gaps,
      });
    } catch (err: unknown) {
      emit({
        type: "suite-end",
        suiteId: suite.id,
        passed: 0,
        failed: 1,
        gaps: 0,
      });
      suiteResults.push({
        suiteId: suite.id,
        label: suite.label,
        passed: 0,
        failed: 1,
        gaps: 0,
      });
      totalFailed++;
    }
  }

  emit({ type: "summary", totalPassed, totalFailed, totalGaps, suiteResults });
  emit({ type: "done" });
}

export function buildVerifyRouter(ctx: ContractCtx): Router {
  const router = Router();

  // GET /verify/suites — 스위트 목록 JSON
  router.get("/suites", (_req, res) => {
    const phase2 = hasPhase2(ctx);
    res.json(
      ALL_SUITES.map((s) => ({
        id: s.id,
        label: s.label,
        caseCount: s.caseCount,
        requires: s.requires,
        available: s.requires === "phase1" || phase2,
      })),
    );
  });

  // GET /verify/run-all — 전체 스위트 순차 실행
  router.get("/run-all", (req, res) => {
    sseHeaders(res);
    const emit = createEmit(res);

    runSuites(ALL_SUITES, ctx, emit)
      .then(() => res.end())
      .catch((err: unknown) => {
        emit({ type: "fail", label: "예기치 않은 오류", reason: String(err).slice(0, 300), kind: "happy" });
        emit({ type: "done" });
        res.end();
      });
  });

  // GET /verify/run/:suiteId — 단일 스위트 실행
  router.get("/run/:suiteId", (req, res) => {
    const { suiteId } = req.params;
    const suite = ALL_SUITES.find((s) => s.id === suiteId);

    if (!suite) {
      res.status(404).json({ error: `Suite not found: ${suiteId}` });
      return;
    }

    sseHeaders(res);
    const emit = createEmit(res);

    runSuites([suite], ctx, emit)
      .then(() => res.end())
      .catch((err: unknown) => {
        emit({ type: "fail", label: "예기치 않은 오류", reason: String(err).slice(0, 300), kind: "happy" });
        emit({ type: "done" });
        res.end();
      });
  });

  // 하위호환: GET /verify/run → run-all로 리다이렉트
  router.get("/run", (req, res) => {
    res.redirect("/verify/run-all");
  });

  return router;
}
