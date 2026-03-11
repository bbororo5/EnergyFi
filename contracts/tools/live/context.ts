import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { LiveTestSigner } from "./lib/live-test-signer.js";
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

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

export interface ContractCtx {
  signer: ethers.Signer;
  deviceRegistry: IDeviceRegistry;
  stationRegistry: IStationRegistry;
  chargeTransaction?: IChargeTransaction;
  revenueTracker?: IRevenueTracker;
  chargeRouter?: IChargeRouter;
  deviceRegistryAdmin: DeviceRegistry;
  stationRegistryAdmin: StationRegistry;
  chargeRouterAdmin?: ChargeRouter;
}

export interface DeploymentAddresses {
  DeviceRegistry: string;
  StationRegistry: string;
  ChargeTransaction?: string;
  RevenueTracker?: string;
  ChargeRouter?: string;
}

export interface LiveRuntime {
  ctx: ContractCtx;
  wallet: LiveTestSigner;
  addresses: DeploymentAddresses;
}

export function hasPhase2(ctx: ContractCtx): boolean {
  return !!(ctx.chargeTransaction && ctx.revenueTracker && ctx.chargeRouter);
}

export function loadDeployments(deploymentsPath: string, network: string): DeploymentAddresses {
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployments.json not found. npm run deploy를 먼저 실행하세요.");
  }

  const all = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const net = all[network];
  if (!net?.DeviceRegistry || !net?.StationRegistry) {
    throw new Error(`배포 정보 없음: ${network}`);
  }
  return net;
}

export function getRpcUrl(network: string): string {
  const map: Record<string, string> = {
    "energyfi-l1-testnet": process.env["ENERGYFI_L1_TESTNET_RPC"] ?? "",
  };
  const url = map[network];
  if (!url) {
    throw new Error(`알 수 없는 네트워크: ${network}. RPC URL을 .env의 ENERGYFI_L1_TESTNET_RPC에 설정하세요.`);
  }
  return url;
}

export function createLiveContext(
  signer: ethers.Signer,
  addresses: DeploymentAddresses,
): ContractCtx {
  const ctx: ContractCtx = {
    signer,
    deviceRegistry: IDeviceRegistry__factory.connect(addresses.DeviceRegistry, signer),
    stationRegistry: IStationRegistry__factory.connect(addresses.StationRegistry, signer),
    deviceRegistryAdmin: DeviceRegistry__factory.connect(addresses.DeviceRegistry, signer),
    stationRegistryAdmin: StationRegistry__factory.connect(addresses.StationRegistry, signer),
  };

  if (addresses.ChargeTransaction && addresses.RevenueTracker && addresses.ChargeRouter) {
    ctx.chargeTransaction = IChargeTransaction__factory.connect(addresses.ChargeTransaction, signer);
    ctx.revenueTracker = IRevenueTracker__factory.connect(addresses.RevenueTracker, signer);
    ctx.chargeRouter = IChargeRouter__factory.connect(addresses.ChargeRouter, signer);
    ctx.chargeRouterAdmin = ChargeRouter__factory.connect(addresses.ChargeRouter, signer);
  }

  return ctx;
}

export function buildLiveRuntime(network: string, deploymentsPath: string): LiveRuntime {
  const privateKey = process.env["DEPLOYER_PRIVATE_KEY"];
  if (!privateKey) {
    throw new Error(".env에 DEPLOYER_PRIVATE_KEY가 없습니다.");
  }

  const provider = new ethers.JsonRpcProvider(getRpcUrl(network));
  const wallet = new LiveTestSigner(privateKey, provider);
  const addresses = loadDeployments(deploymentsPath, network);
  const ctx = createLiveContext(wallet, addresses);

  return { ctx, wallet, addresses };
}
