import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function nativeSymbol(): string {
  return "EGF";
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`.env에 ${name}가 없습니다.`);
  }
  return value;
}

function requireAddress(
  ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"],
  name: string,
): string {
  const value = requireEnv(name);
  if (!ethers.isAddress(value)) {
    throw new Error(`${name} 값이 유효한 address가 아닙니다: ${value}`);
  }
  return value;
}

async function main() {
  const conn = await hre.network.connect();
  const ethers = conn.ethers;
  const network = conn.networkName;

  const rpcUrl = requireEnv("ENERGYFI_L1_TESTNET_RPC");
  const privateKey = requireEnv("DEPLOYER_PRIVATE_KEY");
  const adminAddress = requireAddress(ethers, "ENERGYFI_ADMIN_ADDRESS");
  const bridgeAddress = requireAddress(ethers, "ENERGYFI_BRIDGE_ADDRESS");
  const reputationBridgeAddress = requireAddress(ethers, "ENERGYFI_REPUTATION_BRIDGE_ADDRESS");

  if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
    throw new Error("DEPLOYER_PRIVATE_KEY 형식이 올바르지 않습니다.");
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("\n=== EnergyFi Full-Surface Deployment ===");
  console.log(`Network            : ${network}`);
  console.log(`RPC                : ${rpcUrl}`);
  console.log(`Deployer           : ${deployer.address}`);
  console.log(`Balance            : ${ethers.formatEther(balance)} ${nativeSymbol()}`);
  console.log(`Admin              : ${adminAddress}`);
  console.log(`ChargeRouter bridge: ${bridgeAddress}`);
  console.log(`Reputation bridge  : ${reputationBridgeAddress}`);
  console.log("Precondition       : RIP-7212 (0x100) must already be enabled on the target L1.\n");

  const EnergyFiProxy = await ethers.getContractFactory("EnergyFiProxy");

  console.log("─── Essential surface ───");

  const DRImpl = await ethers.getContractFactory("DeviceRegistry");
  const drImpl = await DRImpl.deploy();
  await drImpl.waitForDeployment();
  const drImplAddr = await drImpl.getAddress();
  const drProxy = await EnergyFiProxy.deploy(drImplAddr, "0x");
  await drProxy.waitForDeployment();
  const drProxyAddr = await drProxy.getAddress();
  const dr = await ethers.getContractAt("DeviceRegistry", drProxyAddr);
  await (await dr.initialize(adminAddress)).wait();
  console.log(`DeviceRegistry     : ${drProxyAddr}`);

  const SRImpl = await ethers.getContractFactory("StationRegistry");
  const srImpl = await SRImpl.deploy();
  await srImpl.waitForDeployment();
  const srImplAddr = await srImpl.getAddress();
  const srProxy = await EnergyFiProxy.deploy(srImplAddr, "0x");
  await srProxy.waitForDeployment();
  const srProxyAddr = await srProxy.getAddress();
  const sr = await ethers.getContractAt("StationRegistry", srProxyAddr);
  await (await sr.initialize(adminAddress, drProxyAddr)).wait();
  console.log(`StationRegistry    : ${srProxyAddr}`);

  const CTImpl = await ethers.getContractFactory("ChargeTransaction");
  const ctImpl = await CTImpl.deploy();
  await ctImpl.waitForDeployment();
  const ctImplAddr = await ctImpl.getAddress();
  const ctProxy = await EnergyFiProxy.deploy(ctImplAddr, "0x");
  await ctProxy.waitForDeployment();
  const ctProxyAddr = await ctProxy.getAddress();
  console.log(`ChargeTransaction  : ${ctProxyAddr}`);

  const RTImpl = await ethers.getContractFactory("RevenueTracker");
  const rtImpl = await RTImpl.deploy();
  await rtImpl.waitForDeployment();
  const rtImplAddr = await rtImpl.getAddress();
  const rtProxy = await EnergyFiProxy.deploy(rtImplAddr, "0x");
  await rtProxy.waitForDeployment();
  const rtProxyAddr = await rtProxy.getAddress();
  console.log(`RevenueTracker     : ${rtProxyAddr}`);

  const CRImpl = await ethers.getContractFactory("ChargeRouter");
  const crImpl = await CRImpl.deploy();
  await crImpl.waitForDeployment();
  const crImplAddr = await crImpl.getAddress();
  const crProxy = await EnergyFiProxy.deploy(crImplAddr, "0x");
  await crProxy.waitForDeployment();
  const crProxyAddr = await crProxy.getAddress();
  console.log(`ChargeRouter       : ${crProxyAddr}`);

  const ct = await ethers.getContractAt("ChargeTransaction", ctProxyAddr);
  await (await ct.initialize(drProxyAddr, srProxyAddr, crProxyAddr, adminAddress)).wait();

  const rt = await ethers.getContractAt("RevenueTracker", rtProxyAddr);
  await (await rt.initialize(srProxyAddr, crProxyAddr, adminAddress)).wait();

  const cr = await ethers.getContractAt("ChargeRouter", crProxyAddr);
  await (await cr.initialize(ctProxyAddr, rtProxyAddr, bridgeAddress, adminAddress)).wait();

  console.log("\n─── Frontend read surface ───");

  const ReputationImpl = await ethers.getContractFactory("ReputationRegistry");
  const reputationImpl = await ReputationImpl.deploy();
  await reputationImpl.waitForDeployment();
  const reputationImplAddr = await reputationImpl.getAddress();
  const reputationProxy = await EnergyFiProxy.deploy(reputationImplAddr, "0x");
  await reputationProxy.waitForDeployment();
  const reputationProxyAddr = await reputationProxy.getAddress();
  const reputation = await ethers.getContractAt("ReputationRegistry", reputationProxyAddr);
  await (await reputation.initialize(adminAddress, reputationBridgeAddress)).wait();
  console.log(`ReputationRegistry : ${reputationProxyAddr}`);

  const RegionSTOImpl = await ethers.getContractFactory("RegionSTO");
  const regionStoImpl = await RegionSTOImpl.deploy();
  await regionStoImpl.waitForDeployment();
  const regionStoImplAddr = await regionStoImpl.getAddress();
  console.log(`RegionSTO impl     : ${regionStoImplAddr}`);

  const FactoryImpl = await ethers.getContractFactory("RegionSTOFactory");
  const factoryImpl = await FactoryImpl.deploy();
  await factoryImpl.waitForDeployment();
  const factoryImplAddr = await factoryImpl.getAddress();
  const factoryProxy = await EnergyFiProxy.deploy(factoryImplAddr, "0x");
  await factoryProxy.waitForDeployment();
  const factoryProxyAddr = await factoryProxy.getAddress();
  const factory = await ethers.getContractAt("RegionSTOFactory", factoryProxyAddr);
  await (await factory.initialize(adminAddress, regionStoImplAddr, srProxyAddr)).wait();
  console.log(`RegionSTOFactory   : ${factoryProxyAddr}`);

  const deploymentsPath = path.resolve(__dirname, "../deployments.json");
  let deployments: Record<string, Record<string, string>> = {};

  if (fs.existsSync(deploymentsPath)) {
    const raw = fs.readFileSync(deploymentsPath, "utf8");
    deployments = JSON.parse(raw) as Record<string, Record<string, string>>;
  }

  deployments[network] = {
    ...(deployments[network] ?? {}),
    DeviceRegistry: drProxyAddr,
    StationRegistry: srProxyAddr,
    ChargeTransaction: ctProxyAddr,
    RevenueTracker: rtProxyAddr,
    ChargeRouter: crProxyAddr,
    ReputationRegistry: reputationProxyAddr,
    RegionSTOImpl: regionStoImplAddr,
    RegionSTOFactory: factoryProxyAddr,
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

  console.log("\ndeployments.json updated");
  console.log("\nFrontend wiring:");
  console.log(`  EXPO_PUBLIC_ENERGYFI_RPC_URL=${rpcUrl}`);
  console.log(`  EXPO_PUBLIC_CHARGE_TRANSACTION_ADDRESS=${ctProxyAddr}`);
  console.log(`  EXPO_PUBLIC_REVENUE_TRACKER_ADDRESS=${rtProxyAddr}`);
  console.log(`  EXPO_PUBLIC_STATION_REGISTRY_ADDRESS=${srProxyAddr}`);
  console.log(`  EXPO_PUBLIC_DEVICE_REGISTRY_ADDRESS=${drProxyAddr}`);
  console.log(`  EXPO_PUBLIC_REPUTATION_REGISTRY_ADDRESS=${reputationProxyAddr}`);
  console.log(`  EXPO_PUBLIC_REGION_STO_FACTORY_ADDRESS=${factoryProxyAddr}`);
  console.log("\n=== Full-surface deployment complete ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
