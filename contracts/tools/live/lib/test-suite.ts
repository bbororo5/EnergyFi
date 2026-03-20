/**
 * TestSuite 인터페이스 — 모든 테스트 스위트가 구현
 */

import type { ContractCtx } from "../context.js";
import type { EmitFn, Counts } from "./test-helpers.js";

export interface TestSuite {
  id: string;
  label: string;
  caseCount: number;
  requires: "phase1" | "phase2";
  run(ctx: ContractCtx, emit: EmitFn): Promise<Counts>;
}
