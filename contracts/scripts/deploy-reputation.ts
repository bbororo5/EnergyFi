import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function nativeSymbol(): string {
  return "EGF";
}

async function main() {
  const conn = await hre.network.connect();
  const ethers = conn.ethers;
  const network = conn.networkName;

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("\n=== ReputationRegistry Deployment ===");
  console.log(`Network  : ${network}`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(balance)} ${nativeSymbol()}\n`);

  const RegistryImpl = await ethers.getContractFactory("ReputationRegistry");
  const impl = await RegistryImpl.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log(`ReputationRegistry impl  : ${implAddress}`);

  const EnergyFiProxy = await ethers.getContractFactory("EnergyFiProxy");
  const proxy = await EnergyFiProxy.deploy(implAddress, "0x");
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log(`ReputationRegistry proxy : ${proxyAddress}`);

  const registry = await ethers.getContractAt("ReputationRegistry", proxyAddress);
  await (await registry.initialize(deployer.address, deployer.address)).wait();

  console.log("Initialized with:");
  console.log(`  admin  = ${deployer.address}`);
  console.log(`  bridge = ${deployer.address}`);

  const deploymentsPath = path.resolve(__dirname, "../deployments.json");
  let deployments: Record<string, Record<string, string>> = {};

  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8")) as Record<string, Record<string, string>>;
  }

  deployments[network] = {
    ...(deployments[network] ?? {}),
    ReputationRegistry: proxyAddress,
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));

  console.log("\ndeployments.json updated");
  console.log("\nNext steps:");
  console.log(`  1. npm run seed:reputation`);
  console.log(`  2. Wire ${proxyAddress} into mobile Explore config`);
  console.log("\n=== ReputationRegistry deployment complete ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
