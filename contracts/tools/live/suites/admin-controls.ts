/**
 * Suite 7: 운영 안전성 — pause/unpause/bridgeAddress
 *
 * ⚠️  이 Suite의 모든 테스트(AD-1 pause, AD-2 bridgeAddress CR, AD-3 bridgeAddress CT)는
 *    IChargeRouter / IChargeTransaction 인터페이스에 포함되지 않는 함수를 사용합니다.
 *    인터페이스-전용 원칙에 따라 테스트를 비워두었습니다.
 *    - 라이브 검증 스위트 목록에서도 제외됨
 */

import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../context.js";
import {
  newCounts,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";

export const adminControlsSuite: TestSuite = {
  id: "admin-controls",
  label: "운영 안전성",
  caseCount: 0, // 모든 케이스 비인터페이스 함수 의존 → 제거
  requires: "phase2",

  async run(_ctx: ContractCtx, _emit: EmitFn): Promise<Counts> {
    return newCounts();
  },
};
