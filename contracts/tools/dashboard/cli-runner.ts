/**
 * EnergyFi 통합 테스트 CLI 러너
 *
 * 기존 TestSuite 모듈을 그대로 재사용하며 Express/SSE 없이 터미널에서 실행.
 * 사용: npx tsx scripts/dashboard/cli-runner.ts [network]
 *       npm run test:integration
 */

import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { LiveTestSigner } from "./lib/live-test-signer.js";
import type { ContractCtx } from "./server.js";
import type { TestSuite } from "./lib/test-suite.js";
import type { VerifyEvent, EmitFn, SuiteResult } from "./lib/test-helpers.js";
import { ensureBulkData, ensureP256Setup } from "./lib/bulk-setup.js";
import {
  IDeviceRegistry__factory, IStationRegistry__factory,
  IChargeRouter__factory, IChargeTransaction__factory, IRevenueTracker__factory,
  DeviceRegistry__factory, StationRegistry__factory, ChargeRouter__factory,
} from "../../typechain-types/index.js";

import { phase1InfraSuite } from "./suites/phase1-infra.js";
import { phase2HappySuite } from "./suites/phase2-happy.js";
import { phase2FailuresSuite } from "./suites/phase2-failures.js";
import { revenueLifecycleSuite } from "./suites/revenue-lifecycle.js";
import { crossContractSuite } from "./suites/cross-contract.js";
import { edgeCasesSuite } from "./suites/edge-cases.js";
import { dataIntegritySuite } from "./suites/data-integrity.js";
import { settlementBoundarySuite } from "./suites/settlement-boundary.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

// admin-controls 스위트 제거:
// pause/unpause/bridgeAddress/updateBridgeAddress 는 인터페이스에 없는 함수.
// 테스트 코드는 인터페이스에 정의된 함수만 사용해야 한다.
const ALL_SUITES: TestSuite[] = [
  phase1InfraSuite,
  phase2HappySuite,
  phase2FailuresSuite,
  revenueLifecycleSuite,
  crossContractSuite,
  edgeCasesSuite,
  dataIntegritySuite,
  settlementBoundarySuite,
];

// ── Deployments (server.ts 로직 재사용) ───────────────────────────────────────

interface DeploymentAddresses {
  DeviceRegistry: string;
  StationRegistry: string;
  ChargeTransaction?: string;
  RevenueTracker?: string;
  ChargeRouter?: string;
}

function loadDeployments(network: string): DeploymentAddresses {
  const p = path.resolve(process.cwd(), "deployments.json");
  if (!fs.existsSync(p)) throw new Error("deployments.json not found. npm run deploy를 먼저 실행하세요.");
  const all = JSON.parse(fs.readFileSync(p, "utf8"));
  const net = all[network];
  if (!net?.DeviceRegistry || !net?.StationRegistry)
    throw new Error(`배포 정보 없음: ${network}`);
  return net;
}

function getRpcUrl(network: string): string {
  const map: Record<string, string> = {
    "energyfi-l1-testnet": process.env["ENERGYFI_L1_TESTNET_RPC"] ?? "",
  };
  const url = map[network];
  if (!url) throw new Error(`알 수 없는 네트워크: ${network}. RPC URL을 .env에 설정하세요.`);
  return url;
}

// ── Console emit ──────────────────────────────────────────────────────────────

function hasPhase2(ctx: ContractCtx): boolean {
  return !!(ctx.chargeTransaction && ctx.revenueTracker && ctx.chargeRouter);
}

function createConsoleEmit(): EmitFn {
  return (event: VerifyEvent) => {
    switch (event.type) {
      case "suite-start":
        console.log(`\n── ${event.label} (${event.caseCount} cases) ──`);
        break;
      case "pass":
        console.log(`  \x1b[32m✓\x1b[0m ${event.label}`);
        break;
      case "fail":
        console.log(`  \x1b[31m✗\x1b[0m ${event.label}`);
        if (event.reason) console.log(`    → ${event.reason}`);
        break;
      case "gap":
        console.log(`  \x1b[33m◌\x1b[0m ${event.label}`);
        if (event.detail) console.log(`    → ${event.detail}`);
        break;
      case "suite-end":
        console.log(`  ${event.passed}/${event.passed + event.failed} passed`);
        break;
      case "setup-ok":
        console.log(`  [setup] ${event.label}`);
        break;
      case "summary":
        // handled in main
        break;
      case "done":
        break;
    }
  };
}

// ── Run suites (verify.ts 로직 재사용) ────────────────────────────────────────

async function runSuites(
  suites: TestSuite[],
  ctx: ContractCtx,
  emit: EmitFn,
): Promise<{ totalPassed: number; totalFailed: number; totalGaps: number; suiteResults: SuiteResult[] }> {
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
      return { totalPassed, totalFailed: 1, totalGaps, suiteResults };
    }
  }

  for (const suite of suites) {
    // Phase 2 스위트인데 미배포 → 스킵
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
        suiteId: suite.id, label: suite.label,
        passed: counts.passed, failed: counts.failed, gaps: counts.gaps,
      });
      totalPassed += counts.passed;
      totalFailed += counts.failed;
      totalGaps += counts.gaps;
      emit({ type: "suite-end", suiteId: suite.id, passed: counts.passed, failed: counts.failed, gaps: counts.gaps });
    } catch (err: unknown) {
      emit({ type: "suite-end", suiteId: suite.id, passed: 0, failed: 1, gaps: 0 });
      suiteResults.push({ suiteId: suite.id, label: suite.label, passed: 0, failed: 1, gaps: 0 });
      totalFailed++;
    }
  }

  return { totalPassed, totalFailed, totalGaps, suiteResults };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const networkArg = process.argv[2] ?? "energyfi-l1-testnet";
  const startTime = Date.now();

  console.log(`\n=== EnergyFi 통합 테스트 ===`);
  console.log(`Network: ${networkArg}`);

  // 프라이빗 키
  const privateKey = process.env["DEPLOYER_PRIVATE_KEY"];
  if (!privateKey) throw new Error(".env에 DEPLOYER_PRIVATE_KEY가 없습니다.");

  // Provider + Signer
  const rpcUrl = getRpcUrl(networkArg);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new LiveTestSigner(privateKey, provider);
  const signer = wallet;
  console.log(`Signer : ${wallet.address}`);

  // 컨트랙트 주소
  const addrs = loadDeployments(networkArg);

  // ── Phase 1 컨트랙트 인스턴스 ──────────────────────────────────────────────
  const ctx: ContractCtx = {
    signer,
    deviceRegistry:       IDeviceRegistry__factory.connect(addrs.DeviceRegistry, signer),
    stationRegistry:      IStationRegistry__factory.connect(addrs.StationRegistry, signer),
    deviceRegistryAdmin:  DeviceRegistry__factory.connect(addrs.DeviceRegistry, signer),
    stationRegistryAdmin: StationRegistry__factory.connect(addrs.StationRegistry, signer),
  };

  // ── Phase 2 컨트랙트 인스턴스 (선택) ────────────────────────────────────────
  if (addrs.ChargeTransaction && addrs.RevenueTracker && addrs.ChargeRouter) {
    ctx.chargeTransaction = IChargeTransaction__factory.connect(addrs.ChargeTransaction, signer);
    ctx.revenueTracker    = IRevenueTracker__factory.connect(addrs.RevenueTracker, signer);
    ctx.chargeRouter      = IChargeRouter__factory.connect(addrs.ChargeRouter, signer);
    ctx.chargeRouterAdmin = ChargeRouter__factory.connect(addrs.ChargeRouter, signer);
  }

  // ── Bridge 주소 검증 및 자동 수정 ────────────────────────────────────────────
  if (ctx.chargeRouterAdmin) {
    try {
      const signerAddr = await signer.getAddress();
      const currentBridge: string = await ctx.chargeRouterAdmin.bridgeAddress();
      if (currentBridge.toLowerCase() !== signerAddr.toLowerCase()) {
        console.log(`  [setup] CR bridge 불일치 (${currentBridge.slice(0,10)}…→ ${signerAddr.slice(0,10)}…) 수정 중...`);
        const tx = await ctx.chargeRouterAdmin.updateBridgeAddress(signerAddr);
        await tx.wait();
        console.log(`  [setup] CR bridge → ${signerAddr.slice(0, 10)}… 완료`);
      }
    } catch (err) {
      console.warn(`  [setup] Bridge 주소 검증 실패 (권한 없음?): ${String(err).slice(0, 100)}`);
    }
  }

  console.log(`Phase 2: ${hasPhase2(ctx) ? "활성" : "비활성"}`);

  // 실행
  const emit = createConsoleEmit();
  const { totalPassed, totalFailed, totalGaps } = await runSuites(ALL_SUITES, ctx, emit);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 최종 요약
  console.log(`\n${"═".repeat(45)}`);
  const total = totalPassed + totalFailed;
  if (totalFailed === 0) {
    console.log(`  \x1b[32mTotal: ${totalPassed}/${total} passed\x1b[0m`);
  } else {
    console.log(`  \x1b[31mTotal: ${totalPassed}/${total} passed, ${totalFailed} failed\x1b[0m`);
  }
  if (totalGaps > 0) {
    console.log(`  Gaps: ${totalGaps}`);
  }
  console.log(`  Time: ${elapsed}s`);
  console.log(`${"═".repeat(45)}\n`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
