import hre from "hardhat";
import { nativeSymbol, requireAddress, requireEnv, requirePrivateKey } from "../lib/env.js";
import { upsertNetworkDeployments } from "../lib/deployments.js";
import {
  deployEssentialSurface,
  deployPlainContract,
  deployUpgradeableContract,
} from "../lib/proxy.js";

async function main() {
  const conn = await hre.network.connect();
  const ethers = conn.ethers;
  const network = conn.networkName;

  const rpcUrl = requireEnv("ENERGYFI_L1_TESTNET_RPC");
  requirePrivateKey("DEPLOYER_PRIVATE_KEY");
  const adminAddress = requireAddress(ethers, "ENERGYFI_ADMIN_ADDRESS");
  const bridgeAddress = requireAddress(ethers, "ENERGYFI_BRIDGE_ADDRESS");
  const reputationBridgeAddress = requireAddress(ethers, "ENERGYFI_REPUTATION_BRIDGE_ADDRESS");

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log("\n=== EnergyFi Surface Deployment ===");
  console.log(`Network            : ${network}`);
  console.log(`RPC                : ${rpcUrl}`);
  console.log(`Deployer           : ${deployerAddress}`);
  console.log(`Balance            : ${ethers.formatEther(balance)} ${nativeSymbol()}`);
  console.log(`Admin              : ${adminAddress}`);
  console.log(`ChargeRouter bridge: ${bridgeAddress}`);
  console.log(`Reputation bridge  : ${reputationBridgeAddress}`);
  console.log("Precondition       : RIP-7212 (0x100) must already be enabled on the target L1.\n");

  const { addresses } = await deployEssentialSurface(ethers, {
    adminAddress,
    chargeRouterBridgeAddress: bridgeAddress,
    log: console.log,
  });

  console.log("\n─── Demo read surface ───");

  const reputationRegistry = await deployUpgradeableContract(ethers, "ReputationRegistry");
  await (await reputationRegistry.contract.initialize(adminAddress, reputationBridgeAddress)).wait();
  console.log(`ReputationRegistry : ${reputationRegistry.proxyAddress}`);

  const regionStoImpl = await deployPlainContract(ethers, "RegionSTO");
  console.log(`RegionSTO impl     : ${regionStoImpl.address}`);

  const regionStoFactory = await deployUpgradeableContract(ethers, "RegionSTOFactory");
  await (
    await regionStoFactory.contract.initialize(
      adminAddress,
      regionStoImpl.address,
      addresses.StationRegistry,
    )
  ).wait();
  console.log(`RegionSTOFactory   : ${regionStoFactory.proxyAddress}`);

  upsertNetworkDeployments(network, {
    ...addresses,
    ReputationRegistry: reputationRegistry.proxyAddress,
    RegionSTOImpl: regionStoImpl.address,
    RegionSTOFactory: regionStoFactory.proxyAddress,
  });

  console.log("\ndeployments.json updated");
  console.log("\nFrontend wiring:");
  console.log(`  EXPO_PUBLIC_ENERGYFI_RPC_URL=${rpcUrl}`);
  console.log(`  EXPO_PUBLIC_CHARGE_TRANSACTION_ADDRESS=${addresses.ChargeTransaction}`);
  console.log(`  EXPO_PUBLIC_REVENUE_TRACKER_ADDRESS=${addresses.RevenueTracker}`);
  console.log(`  EXPO_PUBLIC_STATION_REGISTRY_ADDRESS=${addresses.StationRegistry}`);
  console.log(`  EXPO_PUBLIC_DEVICE_REGISTRY_ADDRESS=${addresses.DeviceRegistry}`);
  console.log(`  EXPO_PUBLIC_REPUTATION_REGISTRY_ADDRESS=${reputationRegistry.proxyAddress}`);
  console.log(`  EXPO_PUBLIC_REGION_STO_FACTORY_ADDRESS=${regionStoFactory.proxyAddress}`);
  console.log("\n=== Surface deployment complete ===\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
