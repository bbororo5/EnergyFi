import hre from "hardhat";
import { nativeSymbol } from "../lib/env.js";
import { upsertNetworkDeployments } from "../lib/deployments.js";
import { deployEssentialSurface } from "../lib/proxy.js";

async function main() {
  const conn = await hre.network.connect();
  const ethers = conn.ethers;
  const network = conn.networkName;

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log("\n=== EnergyFi Essential Deployment ===");
  console.log(`Network  : ${network}`);
  console.log(`Deployer : ${deployerAddress}`);
  console.log(`Balance  : ${ethers.formatEther(balance)} ${nativeSymbol()}`);
  console.log(`Admin    : ${deployerAddress}`);
  console.log(`Bridge   : ${deployerAddress}\n`);

  const { addresses } = await deployEssentialSurface(ethers, {
    adminAddress: deployerAddress,
    chargeRouterBridgeAddress: deployerAddress,
    log: console.log,
  });

  upsertNetworkDeployments(network, { ...addresses });

  console.log("\ndeployments.json updated");
  console.log("\n=== Essential deployment complete ===\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
