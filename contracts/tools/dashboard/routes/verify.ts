/**
 * 통합 테스트 러너 — SSE 스트리밍 라우트
 *
 * GET /verify/run-all       → 전체 스위트 순차 실행 (SSE)
 * GET /verify/run/:suiteId  → 단일 스위트 실행 (SSE)
 * GET /verify/suites        → 스위트 목록 JSON
 */

import { Router } from "express";
import type { ContractCtx } from "../../live/context.js";
import { hasPhase2 } from "../../live/context.js";
import type { EmitFn, VerifyEvent } from "../../live/lib/test-helpers.js";
import { ALL_SUITES, runSuites } from "../../live/runner.js";

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
      .then((result) => {
        emit({ type: "summary", ...result });
        emit({ type: "done" });
        res.end();
      })
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
      .then((result) => {
        emit({ type: "summary", ...result });
        emit({ type: "done" });
        res.end();
      })
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
