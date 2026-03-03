/**
 * EnergyFi 웹 대시보드 — Express 서버
 * Phase 1 + Phase 2 통합 (Phase 2 graceful degradation)
 *
 * 실행: npm run dashboard:l1-local
 *      npm run dashboard:local
 *
 * 배포자 프라이빗 키는 서버 내에서만 사용. 브라우저에 노출되지 않음.
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import { ethers } from "ethers";
import {
  IDeviceRegistry__factory, IStationRegistry__factory,
  IChargeRouter__factory, IChargeTransaction__factory, IRevenueTracker__factory,
  DeviceRegistry__factory, StationRegistry__factory, ChargeRouter__factory,
} from "../../typechain-types/index.js";
import type {
  IDeviceRegistry, IStationRegistry,
  IChargeRouter, IChargeTransaction, IRevenueTracker,
  DeviceRegistry, StationRegistry, ChargeRouter,
} from "../../typechain-types/index.js";
import { buildQueryRouter } from "./routes/query.js";
import { buildOracleRouter } from "./routes/oracle.js";
import { buildPhase2QueryRouter } from "./routes/phase2-query.js";
import { buildPhase2OracleRouter } from "./routes/phase2-oracle.js";
import { buildEventsRouter, setupEventListeners } from "./routes/events.js";
import { buildVerifyRouter } from "./routes/verify.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 컨트랙트 컨텍스트 타입 ───────────────────────────────────────────────────

/**
 * ContractCtx 두 계층:
 * - 인터페이스 인스턴스 (deviceRegistry, stationRegistry, chargeRouter 등):
 *     인터페이스 파일에 정의된 함수만 ABI에 포함.
 *     테스트 assertion은 오직 이 인스턴스만 사용.
 * - Admin 인스턴스 (deviceRegistryAdmin, stationRegistryAdmin):
 *     full ABI. 테스트 셋업(enrollChip, registerCPO 등)에서만 사용.
 *     인터페이스에 없는 write/read 함수는 여기서만 호출.
 */
export interface ContractCtx {
  signer: ethers.Signer;
  // ── 인터페이스 인스턴스 ──────────────────────────────────────────────────
  deviceRegistry: IDeviceRegistry;
  stationRegistry: IStationRegistry;
  // Phase 2 (optional — 미배포 시 undefined)
  chargeTransaction?: IChargeTransaction;
  revenueTracker?: IRevenueTracker;
  chargeRouter?: IChargeRouter;
  // ── Admin 인스턴스 (셋업 전용) ────────────────────────────────────────
  deviceRegistryAdmin: DeviceRegistry;
  stationRegistryAdmin: StationRegistry;
  // ── Full ABI 인스턴스 (bridge 검증 등 admin 작업) ─────────────────────
  chargeRouterAdmin?: ChargeRouter;
}

// ── 배포 주소 로드 ────────────────────────────────────────────────────────────

interface DeploymentAddresses {
  DeviceRegistry: string;
  StationRegistry: string;
  ChargeTransaction?: string;
  RevenueTracker?: string;
  ChargeRouter?: string;
}

function loadDeployments(network: string): DeploymentAddresses {
  const p = path.resolve(__dirname, "../../deployments.json");
  if (!fs.existsSync(p)) throw new Error("deployments.json not found. deploy_subnet.ts를 먼저 실행하세요.");
  const all = JSON.parse(fs.readFileSync(p, "utf8"));
  const net = all[network];
  if (!net?.DeviceRegistry || !net?.StationRegistry)
    throw new Error(`배포 정보 없음: ${network}`);
  return net;
}

// ── RPC URL ───────────────────────────────────────────────────────────────────

function getRpcUrl(network: string): string {
  const map: Record<string, string> = {
    "energyfi-l1-local":  process.env["ENERGYFI_L1_LOCAL_RPC"] ?? "",
    "localhost":            "http://127.0.0.1:8545",
  };
  const url = map[network];
  if (!url) throw new Error(`알 수 없는 네트워크: ${network}. RPC URL을 .env의 ENERGYFI_L1_LOCAL_RPC에 설정하세요.`);
  return url;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const networkArg = process.argv[2] ?? "energyfi-l1-local";
  const port = Number(process.env["DASHBOARD_PORT"] ?? 3000);

  console.log(`\n=== EnergyFi 웹 대시보드 ===`);
  console.log(`Network : ${networkArg}`);

  // 프라이빗 키 확인
  const privateKey = process.env["DEPLOYER_PRIVATE_KEY"];
  if (!privateKey) throw new Error(".env에 DEPLOYER_PRIVATE_KEY가 없습니다.");

  // Provider + Signer
  const rpcUrl = getRpcUrl(networkArg);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const signer = wallet;
  console.log(`Signer  : ${wallet.address}`);

  // 컨트랙트 주소
  const addrs = loadDeployments(networkArg);
  console.log(`DeviceRegistry  : ${addrs.DeviceRegistry}`);
  console.log(`StationRegistry : ${addrs.StationRegistry}`);

  // Phase 1 컨트랙트 인스턴스 (필수)
  const ctx: ContractCtx = {
    signer,
    deviceRegistry:       IDeviceRegistry__factory.connect(addrs.DeviceRegistry, signer),
    stationRegistry:      IStationRegistry__factory.connect(addrs.StationRegistry, signer),
    deviceRegistryAdmin:  DeviceRegistry__factory.connect(addrs.DeviceRegistry, signer),
    stationRegistryAdmin: StationRegistry__factory.connect(addrs.StationRegistry, signer),
  };

  // Phase 2 컨트랙트 인스턴스 (선택 — graceful loading)
  if (addrs.ChargeTransaction && addrs.RevenueTracker && addrs.ChargeRouter) {
    ctx.chargeTransaction = IChargeTransaction__factory.connect(addrs.ChargeTransaction, signer);
    ctx.revenueTracker    = IRevenueTracker__factory.connect(addrs.RevenueTracker, signer);
    ctx.chargeRouter      = IChargeRouter__factory.connect(addrs.ChargeRouter, signer);
    ctx.chargeRouterAdmin = ChargeRouter__factory.connect(addrs.ChargeRouter, signer);
    console.log(`ChargeTransaction : ${addrs.ChargeTransaction}`);
    console.log(`RevenueTracker    : ${addrs.RevenueTracker}`);
    console.log(`ChargeRouter      : ${addrs.ChargeRouter}`);
  } else {
    console.log(`ℹ️ Phase 2 컨트랙트 미배포 (탭 3~5 비활성)`);
  }

  // Express 앱
  const app = express();
  app.use(express.json());

  // 정적 파일 (index.html, app.js, style.css)
  app.use(express.static(path.join(__dirname, "public")));

  // Phase 1 라우터
  app.use("/query",  buildQueryRouter(ctx));
  app.use("/oracle", buildOracleRouter(ctx));

  // Phase 2 라우터
  app.use("/query/phase2",  buildPhase2QueryRouter(ctx));
  app.use("/oracle/phase2", buildPhase2OracleRouter(ctx));

  // SSE
  app.use("/events", buildEventsRouter(ctx));

  // Phase 1 통합 검증 (SSE 스트리밍)
  app.use("/verify", buildVerifyRouter(ctx));
  setupEventListeners(ctx);

  // Health check
  app.get("/api/status", (_req, res) => {
    res.json({
      network: networkArg,
      signer: wallet.address,
      contracts: {
        DeviceRegistry: addrs.DeviceRegistry,
        StationRegistry: addrs.StationRegistry,
        ChargeTransaction: addrs.ChargeTransaction ?? null,
        RevenueTracker: addrs.RevenueTracker ?? null,
        ChargeRouter: addrs.ChargeRouter ?? null,
      },
      phase2: !!(ctx.chargeTransaction && ctx.revenueTracker && ctx.chargeRouter),
    });
  });

  app.listen(port, () => {
    console.log(`\n✅ 대시보드 실행 중: http://localhost:${port}`);
    console.log(`   네트워크: ${networkArg}`);
    console.log(`   Phase 2: ${ctx.chargeTransaction ? "활성" : "비활성 (컨트랙트 미배포)"}`);
    console.log(`   종료: Ctrl+C\n`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
