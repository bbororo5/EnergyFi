import type { ContractCtx } from "./context.js";
import { hasPhase2 } from "./context.js";
import type { TestSuite } from "./lib/test-suite.js";
import type { EmitFn, SuiteResult } from "./lib/test-helpers.js";
import { ensureBulkData, ensureP256Setup } from "./lib/bulk-setup.js";
import { phase1InfraSuite } from "./suites/phase1-infra.js";
import { phase2HappySuite } from "./suites/phase2-happy.js";
import { phase2FailuresSuite } from "./suites/phase2-failures.js";
import { revenueLifecycleSuite } from "./suites/revenue-lifecycle.js";
import { crossContractSuite } from "./suites/cross-contract.js";
import { edgeCasesSuite } from "./suites/edge-cases.js";
import { adminControlsSuite } from "./suites/admin-controls.js";
import { dataIntegritySuite } from "./suites/data-integrity.js";
import { settlementBoundarySuite } from "./suites/settlement-boundary.js";

export interface RunSuitesResult {
  totalPassed: number;
  totalFailed: number;
  totalGaps: number;
  suiteResults: SuiteResult[];
}

export const ALL_SUITES: TestSuite[] = [
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

export async function runSuites(
  suites: TestSuite[],
  ctx: ContractCtx,
  emit: EmitFn,
): Promise<RunSuitesResult> {
  const suiteResults: SuiteResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalGaps = 0;

  const needsPhase2 = suites.some((suite) => suite.requires === "phase2");
  if (needsPhase2 && hasPhase2(ctx)) {
    try {
      emit({ type: "setup-ok", label: "Phase 1 bulk 데이터 자동 등록 중..." });
      await ensureBulkData(ctx, emit);
      emit({ type: "setup-ok", label: "P-256 키 자동 셋업 중..." });
      await ensureP256Setup(ctx, emit);
      emit({ type: "setup-ok", label: "자동 셋업 완료" });
    } catch (err: unknown) {
      emit({ type: "fail", label: "자동 셋업 실패", reason: String(err).slice(0, 300), kind: "happy" });
      return { totalPassed, totalFailed: 1, totalGaps, suiteResults };
    }
  }

  for (const suite of suites) {
    if (suite.requires === "phase2" && !hasPhase2(ctx)) {
      emit({ type: "suite-start", suiteId: suite.id, label: suite.label, caseCount: suite.caseCount });
      emit({ type: "suite-end", suiteId: suite.id, passed: 0, failed: 0, gaps: 0 });
      suiteResults.push({ suiteId: suite.id, label: suite.label, passed: 0, failed: 0, gaps: 0 });
      continue;
    }

    emit({ type: "suite-start", suiteId: suite.id, label: suite.label, caseCount: suite.caseCount });

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
      emit({ type: "suite-end", suiteId: suite.id, passed: counts.passed, failed: counts.failed, gaps: counts.gaps });
    } catch {
      emit({ type: "suite-end", suiteId: suite.id, passed: 0, failed: 1, gaps: 0 });
      suiteResults.push({ suiteId: suite.id, label: suite.label, passed: 0, failed: 1, gaps: 0 });
      totalFailed++;
    }
  }

  return { totalPassed, totalFailed, totalGaps, suiteResults };
}
