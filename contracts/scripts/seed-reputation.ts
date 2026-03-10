import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AbiCoder, keccak256, id } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const abiCoder = AbiCoder.defaultAbiCoder();

const MONTHLY = 2;
const SITE = {
  UNKNOWN: 0,
  RESIDENTIAL: 1,
  WORKPLACE: 2,
  PUBLIC_COMMERCIAL: 3,
  MIXED: 4,
} as const;

interface SnapshotSeed {
  regionCode: string;
  periodId: bigint;
  metricVersion: number;
  trust: {
    activeChargerRatioBps: number;
    maintenanceResolutionRateBps: number;
    settlementContinuityBps: number;
  };
  rhythm: {
    sessionVolume: bigint;
    revenueStabilityBps: number;
    peakStartHour: number;
    peakEndHour: number;
  };
  site: {
    primaryType: number;
    residentialBps: number;
    workplaceBps: number;
    publicCommercialBps: number;
    mixedBps: number;
  };
}

function regionBytes4(code: string): `0x${string}` {
  const hex = Buffer.from(code, "ascii").toString("hex").padEnd(8, "0");
  return `0x${hex}` as `0x${string}`;
}

function sourceHash(regionId: `0x${string}`, periodId: bigint, metricVersion: number) {
  const chargeDataRoot = id(`charge:${regionId}:${periodId.toString()}`);
  const revenueDataRoot = id(`revenue:${regionId}:${periodId.toString()}`);
  const stationDataRoot = id(`station:${regionId}:${periodId.toString()}`);
  const opsDataRoot = id(`ops:${regionId}:${periodId.toString()}`);

  return keccak256(
    abiCoder.encode(
      ["bytes4", "uint8", "uint256", "uint32", "bytes32", "bytes32", "bytes32", "bytes32"],
      [regionId, MONTHLY, periodId, metricVersion, chargeDataRoot, revenueDataRoot, stationDataRoot, opsDataRoot],
    ),
  );
}

function makeSnapshot(seed: SnapshotSeed) {
  const regionId = regionBytes4(seed.regionCode);
  return {
    regionId,
    granularity: MONTHLY,
    periodId: seed.periodId,
    metricVersion: seed.metricVersion,
    sourceHash: sourceHash(regionId, seed.periodId, seed.metricVersion),
    trust: seed.trust,
    rhythm: seed.rhythm,
    site: seed.site,
  };
}

function loadRegistryAddress(network: string): string {
  const deploymentsPath = path.resolve(__dirname, "../deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployments.json not found. Deploy ReputationRegistry first.");
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8")) as Record<string, Record<string, string>>;
  const address = deployments[network]?.ReputationRegistry;
  if (!address) {
    throw new Error(`ReputationRegistry is not recorded for network "${network}" in deployments.json`);
  }
  return address;
}

async function main() {
  const conn = await hre.network.connect();
  const ethers = conn.ethers;
  const network = conn.networkName;

  const [deployer] = await ethers.getSigners();
  const registryAddress = loadRegistryAddress(network);
  const registry = await ethers.getContractAt("ReputationRegistry", registryAddress);

  const bridgeAddress = await registry.bridgeAddress();
  if (bridgeAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Current bridge ${bridgeAddress} does not match deployer ${deployer.address}`);
  }

  const snapshots = [
    makeSnapshot({
      regionCode: "KR11",
      periodId: 202602n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 9040, maintenanceResolutionRateBps: 8620, settlementContinuityBps: 9420 },
      rhythm: { sessionVolume: 1624n, revenueStabilityBps: 7980, peakStartHour: 18, peakEndHour: 22 },
      site: { primaryType: SITE.RESIDENTIAL, residentialBps: 6200, workplaceBps: 1500, publicCommercialBps: 1400, mixedBps: 900 },
    }),
    makeSnapshot({
      regionCode: "KR11",
      periodId: 202603n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 9220, maintenanceResolutionRateBps: 8840, settlementContinuityBps: 9650 },
      rhythm: { sessionVolume: 1810n, revenueStabilityBps: 8260, peakStartHour: 18, peakEndHour: 23 },
      site: { primaryType: SITE.RESIDENTIAL, residentialBps: 6400, workplaceBps: 1300, publicCommercialBps: 1500, mixedBps: 800 },
    }),
    makeSnapshot({
      regionCode: "KR26",
      periodId: 202602n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 8860, maintenanceResolutionRateBps: 8340, settlementContinuityBps: 9180 },
      rhythm: { sessionVolume: 1328n, revenueStabilityBps: 7820, peakStartHour: 17, peakEndHour: 22 },
      site: { primaryType: SITE.PUBLIC_COMMERCIAL, residentialBps: 1900, workplaceBps: 1600, publicCommercialBps: 4900, mixedBps: 1600 },
    }),
    makeSnapshot({
      regionCode: "KR26",
      periodId: 202603n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 9010, maintenanceResolutionRateBps: 8510, settlementContinuityBps: 9360 },
      rhythm: { sessionVolume: 1484n, revenueStabilityBps: 8010, peakStartHour: 17, peakEndHour: 22 },
      site: { primaryType: SITE.PUBLIC_COMMERCIAL, residentialBps: 1800, workplaceBps: 1600, publicCommercialBps: 5200, mixedBps: 1400 },
    }),
    makeSnapshot({
      regionCode: "KR27",
      periodId: 202602n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 8780, maintenanceResolutionRateBps: 8420, settlementContinuityBps: 9100 },
      rhythm: { sessionVolume: 1096n, revenueStabilityBps: 7680, peakStartHour: 8, peakEndHour: 11 },
      site: { primaryType: SITE.WORKPLACE, residentialBps: 2200, workplaceBps: 4600, publicCommercialBps: 1900, mixedBps: 1300 },
    }),
    makeSnapshot({
      regionCode: "KR27",
      periodId: 202603n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 8890, maintenanceResolutionRateBps: 8560, settlementContinuityBps: 9260 },
      rhythm: { sessionVolume: 1178n, revenueStabilityBps: 7840, peakStartHour: 8, peakEndHour: 11 },
      site: { primaryType: SITE.WORKPLACE, residentialBps: 2100, workplaceBps: 4800, publicCommercialBps: 1800, mixedBps: 1300 },
    }),
    makeSnapshot({
      regionCode: "KR28",
      periodId: 202602n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 8960, maintenanceResolutionRateBps: 8460, settlementContinuityBps: 9240 },
      rhythm: { sessionVolume: 1264n, revenueStabilityBps: 7920, peakStartHour: 6, peakEndHour: 9 },
      site: { primaryType: SITE.MIXED, residentialBps: 2800, workplaceBps: 2200, publicCommercialBps: 2200, mixedBps: 2800 },
    }),
    makeSnapshot({
      regionCode: "KR28",
      periodId: 202603n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 9110, maintenanceResolutionRateBps: 8640, settlementContinuityBps: 9450 },
      rhythm: { sessionVolume: 1396n, revenueStabilityBps: 8090, peakStartHour: 6, peakEndHour: 9 },
      site: { primaryType: SITE.MIXED, residentialBps: 2600, workplaceBps: 2200, publicCommercialBps: 2300, mixedBps: 2900 },
    }),
    makeSnapshot({
      regionCode: "KR41",
      periodId: 202602n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 8820, maintenanceResolutionRateBps: 8380, settlementContinuityBps: 9210 },
      rhythm: { sessionVolume: 1418n, revenueStabilityBps: 7740, peakStartHour: 7, peakEndHour: 10 },
      site: { primaryType: SITE.RESIDENTIAL, residentialBps: 5100, workplaceBps: 2100, publicCommercialBps: 1300, mixedBps: 1500 },
    }),
    makeSnapshot({
      regionCode: "KR41",
      periodId: 202603n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 8970, maintenanceResolutionRateBps: 8570, settlementContinuityBps: 9380 },
      rhythm: { sessionVolume: 1562n, revenueStabilityBps: 7960, peakStartHour: 7, peakEndHour: 10 },
      site: { primaryType: SITE.RESIDENTIAL, residentialBps: 5400, workplaceBps: 1900, publicCommercialBps: 1200, mixedBps: 1500 },
    }),
    makeSnapshot({
      regionCode: "KR49",
      periodId: 202602n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 8720, maintenanceResolutionRateBps: 8240, settlementContinuityBps: 9020 },
      rhythm: { sessionVolume: 844n, revenueStabilityBps: 7460, peakStartHour: 11, peakEndHour: 15 },
      site: { primaryType: SITE.MIXED, residentialBps: 1800, workplaceBps: 1200, publicCommercialBps: 2600, mixedBps: 4400 },
    }),
    makeSnapshot({
      regionCode: "KR49",
      periodId: 202603n,
      metricVersion: 1,
      trust: { activeChargerRatioBps: 8840, maintenanceResolutionRateBps: 8390, settlementContinuityBps: 9170 },
      rhythm: { sessionVolume: 932n, revenueStabilityBps: 7610, peakStartHour: 11, peakEndHour: 15 },
      site: { primaryType: SITE.MIXED, residentialBps: 1700, workplaceBps: 1200, publicCommercialBps: 2700, mixedBps: 4400 },
    }),
  ];

  console.log(`\nPublishing ${snapshots.length} monthly reputation snapshots to ${registryAddress}...`);
  const tx = await registry.upsertRegionSnapshots(snapshots);
  const receipt = await tx.wait();
  console.log(`Seed tx hash : ${receipt?.hash}`);
  console.log("Published periods:");
  console.log("  202602, 202603");
  console.log("Published regions:");
  console.log("  KR11, KR26, KR27, KR28, KR41, KR49");
  console.log("\n=== ReputationRegistry seed complete ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
