import hre from "hardhat";
import { requireSurfaceDeployments } from "../lib/deployments.js";
import {
  buildRegionSnapshot,
  DEMO_REPUTATION_SNAPSHOT_SEEDS,
} from "../lib/reputation-fixtures.js";

async function main() {
  const conn = await hre.network.connect();
  const ethers = conn.ethers;
  const network = conn.networkName;

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const { ReputationRegistry: registryAddress } = requireSurfaceDeployments(network);
  const registry = await ethers.getContractAt("ReputationRegistry", registryAddress);

  const bridgeAddress = await registry.bridgeAddress();
  if (bridgeAddress.toLowerCase() !== deployerAddress.toLowerCase()) {
    throw new Error(`Current bridge ${bridgeAddress} does not match deployer ${deployerAddress}`);
  }

  const snapshots = DEMO_REPUTATION_SNAPSHOT_SEEDS.map((seed) =>
    buildRegionSnapshot(seed.regionCode, seed.periodId, {
      metricVersion: seed.metricVersion,
      trust: seed.trust,
      rhythm: seed.rhythm,
      site: seed.site,
    }),
  );

  console.log(`\nPublishing ${snapshots.length} monthly reputation snapshots to ${registryAddress}...`);
  const tx = await registry.upsertRegionSnapshots(snapshots);
  const receipt = await tx.wait();
  console.log(`Seed tx hash : ${receipt?.hash}`);
  console.log("Published periods:");
  console.log("  202602, 202603");
  console.log("Published regions:");
  console.log("  KR11, KR26, KR27, KR28, KR41, KR49");
  console.log("\n=== Reputation seeding complete ===\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
