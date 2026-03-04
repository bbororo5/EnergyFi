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
import type { ContractCtx } from "./web/server.js";
import type { TestSuite } from "./web/lib/test-suite.js";
import type { VerifyEvent, EmitFn, SuiteResult } from "./web/lib/test-helpers.js";
import { ensureBulkData, ensureP256Setup } from "./web/lib/bulk-setup.js";

import { phase1InfraSuite } from "./web/suites/phase1-infra.js";
import { phase2HappySuite } from "./web/suites/phase2-happy.js";
import { phase2FailuresSuite } from "./web/suites/phase2-failures.js";
import { revenueLifecycleSuite } from "./web/suites/revenue-lifecycle.js";
import { crossContractSuite } from "./web/suites/cross-contract.js";
import { edgeCasesSuite } from "./web/suites/edge-cases.js";
import { adminControlsSuite } from "./web/suites/admin-controls.js";
import { dataIntegritySuite } from "./web/suites/data-integrity.js";
import { settlementBoundarySuite } from "./web/suites/settlement-boundary.js";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

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

// ── ABI / Deployments (server.ts 로직 재사용) ─────────────────────────────────

function loadAbi(contractName: string): ethers.InterfaceAbi | null {
  const artifactPath = path.resolve(
    process.cwd(),
    `artifacts/contracts/${contractName}.sol/${contractName}.json`,
  );
  if (!fs.existsSync(artifactPath)) return null;
  return JSON.parse(fs.readFileSync(artifactPath, "utf8")).abi;
}

function requireAbi(contractName: string): ethers.InterfaceAbi {
  const abi = loadAbi(contractName);
  if (!abi) throw new Error(`ABI not found: ${contractName}\n→ npm run compile 먼저 실행하세요.`);
  return abi;
}

interface DeploymentAddresses {
  DeviceRegistry: string;
  StationRegistry: string;
  ChargeTransaction?: string;
  RevenueTracker?: string;
  ChargeRouter?: string;
}

function loadDeployments(network: string): DeploymentAddresses {
  const p = path.resolve(process.cwd(), "deployments.json");
  if (!fs.existsSync(p)) throw new Error("deployments.json not found. deploy_subnet.ts를 먼저 실행하세요.");
  const all = JSON.parse(fs.readFileSync(p, "utf8"));
  const net = all[network];
  if (!net?.DeviceRegistry || !net?.StationRegistry)
    throw new Error(`배포 정보 없음: ${network}`);
  return net;
}

function getRpcUrl(network: string): string {
  const map: Record<string, string> = {
    "energyfi-l1-testnet": process.env["ENERGYFI_L1_TESTNET_RPC"] ?? "",
    "energyfi-l1-local":   process.env["ENERGYFI_L1_LOCAL_RPC"] ?? "",
    "localhost":           "http://127.0.0.1:8545",
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
  const networkArg = process.argv[2] ?? "energyfi-l1-local";
  const startTime = Date.now();

  console.log(`\n=== EnergyFi 통합 테스트 ===`);
  console.log(`Network: ${networkArg}`);

  // 프라이빗 키
  const privateKey = process.env["DEPLOYER_PRIVATE_KEY"];
  if (!privateKey) throw new Error(".env에 DEPLOYER_PRIVATE_KEY가 없습니다.");

  // Provider + Signer
  const rpcUrl = getRpcUrl(networkArg);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const signer = wallet;
  console.log(`Signer : ${wallet.address}`);

  // 컨트랙트 주소
  const addrs = loadDeployments(networkArg);

  // Phase 1 컨트랙트 인스턴스
  const ctx: ContractCtx = {
    signer,
    deviceRegistry:  new ethers.Contract(addrs.DeviceRegistry,  requireAbi("DeviceRegistry"),  signer),
    stationRegistry: new ethers.Contract(addrs.StationRegistry, requireAbi("StationRegistry"), signer),
  };

  // Phase 2 컨트랙트 인스턴스 (선택)
  if (addrs.ChargeTransaction && addrs.RevenueTracker && addrs.ChargeRouter) {
    const ctAbi = loadAbi("ChargeTransaction");
    const rtAbi = loadAbi("RevenueTracker");
    const crAbi = loadAbi("ChargeRouter");
    if (ctAbi && rtAbi && crAbi) {
      ctx.chargeTransaction = new ethers.Contract(addrs.ChargeTransaction, ctAbi, signer);
      ctx.revenueTracker    = new ethers.Contract(addrs.RevenueTracker,    rtAbi, signer);
      ctx.chargeRouter      = new ethers.Contract(addrs.ChargeRouter,      crAbi, signer);
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
