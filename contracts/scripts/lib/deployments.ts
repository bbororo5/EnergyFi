import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEPLOYMENTS_PATH = path.resolve(__dirname, "../../deployments.json");

export type DeploymentMap = Record<string, Record<string, string>>;

export interface EssentialDeploymentAddresses {
  DeviceRegistry: string;
  StationRegistry: string;
  ChargeTransaction: string;
  RevenueTracker: string;
  ChargeRouter: string;
}

export interface SurfaceDeploymentAddresses extends EssentialDeploymentAddresses {
  ReputationRegistry: string;
  RegionSTOFactory: string;
  RegionSTOImpl?: string;
}

function readDeploymentsFile(): DeploymentMap {
  return JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf8")) as DeploymentMap;
}

export function deploymentsFilePath(): string {
  return DEPLOYMENTS_PATH;
}

export function hasDeploymentsFile(): boolean {
  return fs.existsSync(DEPLOYMENTS_PATH);
}

export function readDeployments(): DeploymentMap {
  if (!hasDeploymentsFile()) {
    return {};
  }
  return readDeploymentsFile();
}

export function requireDeployments(): DeploymentMap {
  if (!hasDeploymentsFile()) {
    throw new Error("deployments.json not found. Deploy contracts first.");
  }
  return readDeploymentsFile();
}

export function writeDeployments(deployments: DeploymentMap) {
  fs.writeFileSync(DEPLOYMENTS_PATH, JSON.stringify(deployments, null, 2));
}

export function upsertNetworkDeployments(
  network: string,
  values: Record<string, string>,
): DeploymentMap {
  const deployments = readDeployments();
  deployments[network] = {
    ...(deployments[network] ?? {}),
    ...values,
  };
  writeDeployments(deployments);
  return deployments;
}

export function loadNetworkDeployments(network: string): Record<string, string> {
  const deployments = requireDeployments();
  const values = deployments[network];
  if (!values) {
    throw new Error(`No deployment addresses are recorded for network "${network}" in deployments.json`);
  }
  return values;
}

export function requireEssentialDeployments(network: string): EssentialDeploymentAddresses {
  const values = loadNetworkDeployments(network);
  if (
    !values.DeviceRegistry
    || !values.StationRegistry
    || !values.ChargeTransaction
    || !values.RevenueTracker
    || !values.ChargeRouter
  ) {
    throw new Error(`Missing essential deployment addresses for network "${network}" in deployments.json`);
  }

  return {
    DeviceRegistry: values.DeviceRegistry,
    StationRegistry: values.StationRegistry,
    ChargeTransaction: values.ChargeTransaction,
    RevenueTracker: values.RevenueTracker,
    ChargeRouter: values.ChargeRouter,
  };
}

export function requireSurfaceDeployments(network: string): SurfaceDeploymentAddresses {
  const values = loadNetworkDeployments(network);
  if (
    !values.DeviceRegistry
    || !values.StationRegistry
    || !values.ChargeTransaction
    || !values.RevenueTracker
    || !values.ChargeRouter
    || !values.ReputationRegistry
    || !values.RegionSTOFactory
  ) {
    throw new Error(`Missing full-surface deployment addresses for network "${network}" in deployments.json`);
  }

  return {
    DeviceRegistry: values.DeviceRegistry,
    StationRegistry: values.StationRegistry,
    ChargeTransaction: values.ChargeTransaction,
    RevenueTracker: values.RevenueTracker,
    ChargeRouter: values.ChargeRouter,
    ReputationRegistry: values.ReputationRegistry,
    RegionSTOFactory: values.RegionSTOFactory,
    RegionSTOImpl: values.RegionSTOImpl,
  };
}
