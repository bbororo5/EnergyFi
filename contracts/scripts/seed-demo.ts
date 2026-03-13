import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AbiCoder,
  Wallet,
  encodeBytes32String,
  getBytes,
  hexlify,
  id,
  keccak256,
  solidityPackedKeccak256,
  toUtf8Bytes,
} from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const abiCoder = AbiCoder.defaultAbiCoder();

const MONTHLY = 2;
const CURRENT_PERIOD = 202603n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

type RegionCode = "KR11" | "KR26" | "KR27" | "KR28" | "KR29" | "KR41" | "KR49";
type RegionTier = "featured" | "secondary" | "pending";

interface SnapshotMetricsSeed {
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

interface RegionSeed {
  code: RegionCode;
  tier: RegionTier;
  stationLocations: [string, string];
  snapshotMetrics: Record<"202602" | "202603", SnapshotMetricsSeed>;
}

interface StationSeed {
  label: string;
  regionCode: RegionCode;
  location: string;
  chargers: ChargerSeed[];
}

interface ChargerSeed {
  label: string;
  chargerType: number;
}

interface SessionSeed {
  key: string;
  sessionId: `0x${string}`;
  stationLabel: string;
  chargerLabel: string;
  chargerType: number;
  regionCode: RegionCode;
  energyKwh: bigint;
  startTimestamp: bigint;
  endTimestamp: bigint;
  distributableKrw: bigint;
  vehicleCategory: number;
}

interface DeploymentAddresses {
  DeviceRegistry: string;
  StationRegistry: string;
  ChargeTransaction: string;
  RevenueTracker: string;
  ChargeRouter: string;
  ReputationRegistry?: string;
}

interface Stats {
  chipsEnrolled: number;
  chipsSkipped: number;
  chipsRevoked: number;
  stationsRegistered: number;
  stationsSkipped: number;
  chargersRegistered: number;
  chargersSkipped: number;
  sessionsProcessed: number;
  sessionsSkipped: number;
  regionClaims: number;
  regionClaimsSkipped: number;
  snapshotsPublished: number;
  snapshotsSkipped: number;
}

const REGION_SEEDS: RegionSeed[] = [
  {
    code: "KR11",
    tier: "featured",
    stationLocations: [
      "Seoul Gangnam Terrace 101",
      "Seoul Mapo Riverside 202",
    ],
    snapshotMetrics: {
      "202602": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 9240, maintenanceResolutionRateBps: 8860, settlementContinuityBps: 9660 },
        rhythm: { sessionVolume: 1880n, revenueStabilityBps: 8320, peakStartHour: 18, peakEndHour: 22 },
        site: { primaryType: 1, residentialBps: 6400, workplaceBps: 1500, publicCommercialBps: 1400, mixedBps: 700 },
      },
      "202603": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 9310, maintenanceResolutionRateBps: 8920, settlementContinuityBps: 9720 },
        rhythm: { sessionVolume: 1965n, revenueStabilityBps: 8440, peakStartHour: 18, peakEndHour: 23 },
        site: { primaryType: 1, residentialBps: 6500, workplaceBps: 1400, publicCommercialBps: 1400, mixedBps: 700 },
      },
    },
  },
  {
    code: "KR26",
    tier: "featured",
    stationLocations: [
      "Busan Haeundae Harbor 301",
      "Busan Suyeong Marina 402",
    ],
    snapshotMetrics: {
      "202602": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 9120, maintenanceResolutionRateBps: 8710, settlementContinuityBps: 9480 },
        rhythm: { sessionVolume: 1540n, revenueStabilityBps: 8080, peakStartHour: 17, peakEndHour: 22 },
        site: { primaryType: 3, residentialBps: 1900, workplaceBps: 1700, publicCommercialBps: 4700, mixedBps: 1700 },
      },
      "202603": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 9180, maintenanceResolutionRateBps: 8780, settlementContinuityBps: 9540 },
        rhythm: { sessionVolume: 1618n, revenueStabilityBps: 8160, peakStartHour: 17, peakEndHour: 22 },
        site: { primaryType: 3, residentialBps: 1800, workplaceBps: 1700, publicCommercialBps: 4900, mixedBps: 1600 },
      },
    },
  },
  {
    code: "KR27",
    tier: "featured",
    stationLocations: [
      "Daegu Suseong Bloom 501",
      "Daegu Dalseo Metro 602",
    ],
    snapshotMetrics: {
      "202602": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 9010, maintenanceResolutionRateBps: 8620, settlementContinuityBps: 9360 },
        rhythm: { sessionVolume: 1425n, revenueStabilityBps: 7920, peakStartHour: 8, peakEndHour: 11 },
        site: { primaryType: 2, residentialBps: 2200, workplaceBps: 4600, publicCommercialBps: 1900, mixedBps: 1300 },
      },
      "202603": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 9070, maintenanceResolutionRateBps: 8690, settlementContinuityBps: 9420 },
        rhythm: { sessionVolume: 1496n, revenueStabilityBps: 8010, peakStartHour: 8, peakEndHour: 11 },
        site: { primaryType: 2, residentialBps: 2100, workplaceBps: 4780, publicCommercialBps: 1800, mixedBps: 1320 },
      },
    },
  },
  {
    code: "KR28",
    tier: "secondary",
    stationLocations: [
      "Incheon Songdo Central 701",
      "Incheon Bupyeong Garden 702",
    ],
    snapshotMetrics: {
      "202602": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 8870, maintenanceResolutionRateBps: 8520, settlementContinuityBps: 9280 },
        rhythm: { sessionVolume: 1288n, revenueStabilityBps: 7860, peakStartHour: 6, peakEndHour: 9 },
        site: { primaryType: 4, residentialBps: 2700, workplaceBps: 2200, publicCommercialBps: 2200, mixedBps: 2900 },
      },
      "202603": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 8930, maintenanceResolutionRateBps: 8610, settlementContinuityBps: 9360 },
        rhythm: { sessionVolume: 1354n, revenueStabilityBps: 7960, peakStartHour: 6, peakEndHour: 9 },
        site: { primaryType: 4, residentialBps: 2600, workplaceBps: 2200, publicCommercialBps: 2300, mixedBps: 2900 },
      },
    },
  },
  {
    code: "KR29",
    tier: "pending",
    stationLocations: [
      "Gwangju Sangmu Horizon 801",
      "Gwangju Bukgu Junction 802",
    ],
    snapshotMetrics: {
      "202602": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 8740, maintenanceResolutionRateBps: 8340, settlementContinuityBps: 8420 },
        rhythm: { sessionVolume: 1042n, revenueStabilityBps: 7680, peakStartHour: 13, peakEndHour: 17 },
        site: { primaryType: 3, residentialBps: 2400, workplaceBps: 1900, publicCommercialBps: 3800, mixedBps: 1900 },
      },
      "202603": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 8810, maintenanceResolutionRateBps: 8420, settlementContinuityBps: 8480 },
        rhythm: { sessionVolume: 1104n, revenueStabilityBps: 7760, peakStartHour: 13, peakEndHour: 18 },
        site: { primaryType: 3, residentialBps: 2300, workplaceBps: 1900, publicCommercialBps: 4000, mixedBps: 1800 },
      },
    },
  },
  {
    code: "KR41",
    tier: "secondary",
    stationLocations: [
      "Gyeonggi Pangyo Tech 901",
      "Gyeonggi Gwanggyo Lake 902",
    ],
    snapshotMetrics: {
      "202602": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 8980, maintenanceResolutionRateBps: 8610, settlementContinuityBps: 9340 },
        rhythm: { sessionVolume: 1488n, revenueStabilityBps: 7980, peakStartHour: 7, peakEndHour: 10 },
        site: { primaryType: 1, residentialBps: 5200, workplaceBps: 2100, publicCommercialBps: 1200, mixedBps: 1500 },
      },
      "202603": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 9040, maintenanceResolutionRateBps: 8690, settlementContinuityBps: 9410 },
        rhythm: { sessionVolume: 1558n, revenueStabilityBps: 8060, peakStartHour: 7, peakEndHour: 10 },
        site: { primaryType: 1, residentialBps: 5400, workplaceBps: 1900, publicCommercialBps: 1200, mixedBps: 1500 },
      },
    },
  },
  {
    code: "KR49",
    tier: "pending",
    stationLocations: [
      "Jeju Aewol Coast 1001",
      "Jeju Seogwipo Breeze 1002",
    ],
    snapshotMetrics: {
      "202602": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 8680, maintenanceResolutionRateBps: 8260, settlementContinuityBps: 8360 },
        rhythm: { sessionVolume: 918n, revenueStabilityBps: 7540, peakStartHour: 11, peakEndHour: 15 },
        site: { primaryType: 4, residentialBps: 1800, workplaceBps: 1200, publicCommercialBps: 2500, mixedBps: 4500 },
      },
      "202603": {
        metricVersion: 1,
        trust: { activeChargerRatioBps: 8750, maintenanceResolutionRateBps: 8340, settlementContinuityBps: 8440 },
        rhythm: { sessionVolume: 988n, revenueStabilityBps: 7620, peakStartHour: 11, peakEndHour: 15 },
        site: { primaryType: 4, residentialBps: 1700, workplaceBps: 1200, publicCommercialBps: 2600, mixedBps: 4500 },
      },
    },
  },
];

const FINALIZED_PERIODS = [202509n, 202510n, 202511n, 202512n, 202601n, 202602n];
const REVOKED_CHARGER_LABELS = new Set<`${RegionCode}-ST02-CH03`>([
  "KR28-ST02-CH03",
  "KR29-ST02-CH03",
  "KR49-ST02-CH03",
]);

function nativeSymbol(): string {
  return "EGF";
}

function regionBytes4(code: string): `0x${string}` {
  const hex = Buffer.from(code, "ascii").toString("hex").padEnd(8, "0");
  return `0x${hex}` as `0x${string}`;
}

function periodToParts(period: bigint): { year: number; month: number } {
  const raw = period.toString();
  return {
    year: Number(raw.slice(0, 4)),
    month: Number(raw.slice(4, 6)),
  };
}

function toUnixSecondsKst(year: number, month: number, day: number, hour: number, minute: number): bigint {
  const timestamp = Date.UTC(year, month - 1, day, hour - 9, minute, 0);
  return BigInt(Math.floor(timestamp / 1000));
}

function buildStationLabel(code: RegionCode, stationIndex: number): string {
  return `${code}-ST${String(stationIndex).padStart(2, "0")}`;
}

function buildChargerLabel(code: RegionCode, stationIndex: number, chargerIndex: number): string {
  return `${code}-ST${String(stationIndex).padStart(2, "0")}-CH${String(chargerIndex).padStart(2, "0")}`;
}

function buildStations(region: RegionSeed): StationSeed[] {
  return region.stationLocations.map((location, index) => ({
    label: buildStationLabel(region.code, index + 1),
    regionCode: region.code,
    location,
    chargers: [0, 1, 2].map((chargerType, chargerIndex) => ({
      label: buildChargerLabel(region.code, index + 1, chargerIndex + 1),
      chargerType,
    })),
  }));
}

function deterministicWallet(label: string): Wallet {
  return new Wallet(keccak256(toUtf8Bytes(`energyfi-demo:${label}`)));
}

function publicKey64(wallet: Wallet): Uint8Array {
  return getBytes(wallet.signingKey.publicKey).slice(1);
}

function buildMessageHash(chargerId: string, energyKwh: bigint, startTimestamp: bigint, endTimestamp: bigint): string {
  return solidityPackedKeccak256(
    ["bytes32", "uint256", "uint256", "uint256"],
    [chargerId, energyKwh, startTimestamp, endTimestamp],
  );
}

function signSession(chargerLabel: string, chargerId: string, energyKwh: bigint, startTimestamp: bigint, endTimestamp: bigint): `0x${string}` {
  const wallet = deterministicWallet(chargerLabel);
  const digest = buildMessageHash(chargerId, energyKwh, startTimestamp, endTimestamp);
  return hexlify(wallet.signingKey.sign(digest).serialized) as `0x${string}`;
}

function sessionIdFor(key: string): `0x${string}` {
  return keccak256(toUtf8Bytes(`energyfi-demo:${key}`)) as `0x${string}`;
}

function sourceHash(regionId: `0x${string}`, periodId: bigint, metricVersion: number) {
  const chargeDataRoot = id(`charge:${regionId}:${periodId.toString()}:demo`);
  const revenueDataRoot = id(`revenue:${regionId}:${periodId.toString()}:demo`);
  const stationDataRoot = id(`station:${regionId}:${periodId.toString()}:demo`);
  const opsDataRoot = id(`ops:${regionId}:${periodId.toString()}:demo`);

  return keccak256(
    abiCoder.encode(
      ["bytes4", "uint8", "uint256", "uint32", "bytes32", "bytes32", "bytes32", "bytes32"],
      [regionId, MONTHLY, periodId, metricVersion, chargeDataRoot, revenueDataRoot, stationDataRoot, opsDataRoot],
    ),
  );
}

function buildSnapshot(region: RegionSeed, period: 202602n | 202603n) {
  const metrics = region.snapshotMetrics[period.toString() as "202602" | "202603"];
  const regionId = regionBytes4(region.code);

  return {
    regionId,
    granularity: MONTHLY,
    periodId: period,
    metricVersion: metrics.metricVersion,
    sourceHash: sourceHash(regionId, period, metrics.metricVersion),
    trust: metrics.trust,
    rhythm: metrics.rhythm,
    site: metrics.site,
  };
}

function sessionsPerRegionForPeriod(region: RegionSeed, period: bigint): number {
  if (region.tier === "featured") {
    return 4;
  }
  if (region.tier === "secondary" && period >= 202512n) {
    return 2;
  }
  return 0;
}

function buildHistoricalSessions(region: RegionSeed, period: bigint, regionIndex: number): SessionSeed[] {
  const count = sessionsPerRegionForPeriod(region, period);
  if (count === 0) {
    return [];
  }

  const { year, month } = periodToParts(period);
  const days = count === 4 ? [5, 12, 19, 26] : [8, 21];
  const stationCycle = count === 4 ? [1, 2, 1, 2] : [1, 2];
  const chargerCycle = count === 4 ? [1, 2, 2, 1] : [1, 2];

  return days.map((day, ordinal) => {
    const stationIndex = stationCycle[ordinal] ?? 1;
    const stationLabel = buildStationLabel(region.code, stationIndex);
    const chargerSlot = chargerCycle[ordinal] ?? 1;
    const chargerLabel = buildChargerLabel(region.code, stationIndex, chargerSlot);
    const chargerType = chargerSlot - 1;
    const startHour = 8 + ((regionIndex + ordinal) % 8);
    const durationMinutes = 50 + (regionIndex * 7) + (ordinal * 6);
    const startTimestamp = toUnixSecondsKst(year, month, day, startHour, 10);
    const endTimestamp = startTimestamp + BigInt(durationMinutes * 60);
    const energyKwh = BigInt(1240 + (regionIndex * 120) + ((month % 12) * 14) + (ordinal * 65));
    const rate = BigInt(278 + (regionIndex * 9) + (ordinal * 7));
    const distributableKrw = (energyKwh * rate) / 100n;
    const key = `${region.code}:${period.toString()}:hist:${ordinal}`;

    return {
      key,
      sessionId: sessionIdFor(key),
      stationLabel,
      chargerLabel,
      chargerType,
      regionCode: region.code,
      energyKwh,
      startTimestamp,
      endTimestamp,
      distributableKrw,
      vehicleCategory: ordinal % 2 === 0 ? 1 : 2,
    };
  });
}

function buildCurrentSessions(regions: RegionSeed[]): SessionSeed[] {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const totalCurrentSessions = regions.length * 3;
  let globalIndex = 0;

  return regions.flatMap((region, regionIndex) => {
    return Array.from({ length: 3 }, (_, ordinal) => {
      const stationIndex = ordinal % 2;
      const stationLabel = buildStationLabel(region.code, stationIndex + 1);
      const chargerSlot = (ordinal === 2 ? 2 : 1);
      const chargerLabel = buildChargerLabel(region.code, stationIndex + 1, chargerSlot);
      const chargerType = chargerSlot - 1;
      const energyKwh = BigInt(1380 + (regionIndex * 115) + (ordinal * 84));
      const rate = BigInt(302 + (regionIndex * 6) + (ordinal * 8));
      const distributableKrw = (energyKwh * rate) / 100n;
      const key = `${region.code}:${CURRENT_PERIOD.toString()}:curr:${ordinal}`;

      let startTimestamp: bigint;
      let endTimestamp: bigint;

      if (globalIndex >= totalCurrentSessions - 4) {
        const recentOffsetMinutes = [48, 36, 24, 12][globalIndex - (totalCurrentSessions - 4)];
        endTimestamp = BigInt(nowSeconds - (recentOffsetMinutes * 60));
        startTimestamp = endTimestamp - BigInt((55 + ordinal * 8) * 60);
      } else {
        const day = 2 + ((regionIndex + ordinal) % 7);
        const startHour = 9 + ((regionIndex + ordinal) % 6);
        startTimestamp = toUnixSecondsKst(2026, 3, day, startHour, 20);
        endTimestamp = startTimestamp + BigInt((48 + ordinal * 10) * 60);
      }

      globalIndex++;

      return {
        key,
        sessionId: sessionIdFor(key),
        stationLabel,
        chargerLabel,
        chargerType,
        regionCode: region.code,
        energyKwh,
        startTimestamp,
        endTimestamp,
        distributableKrw,
        vehicleCategory: ordinal % 2 === 0 ? 1 : 2,
      };
    });
  });
}

function loadDeployments(network: string): Record<string, Record<string, string>> {
  const deploymentsPath = path.resolve(__dirname, "../deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployments.json not found. Deploy contracts first.");
  }
  return JSON.parse(fs.readFileSync(deploymentsPath, "utf8")) as Record<string, Record<string, string>>;
}

function saveDeployments(deployments: Record<string, Record<string, string>>) {
  const deploymentsPath = path.resolve(__dirname, "../deployments.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
}

function requireDeployment(network: string, deployments: Record<string, Record<string, string>>): DeploymentAddresses {
  const values = deployments[network];
  if (!values?.DeviceRegistry || !values?.StationRegistry || !values?.ChargeTransaction || !values?.RevenueTracker || !values?.ChargeRouter) {
    throw new Error(`Missing Phase 1/2 deployment addresses for network "${network}" in deployments.json`);
  }

  return {
    DeviceRegistry: values.DeviceRegistry,
    StationRegistry: values.StationRegistry,
    ChargeTransaction: values.ChargeTransaction,
    RevenueTracker: values.RevenueTracker,
    ChargeRouter: values.ChargeRouter,
    ReputationRegistry: values.ReputationRegistry,
  };
}

function newStats(): Stats {
  return {
    chipsEnrolled: 0,
    chipsSkipped: 0,
    chipsRevoked: 0,
    stationsRegistered: 0,
    stationsSkipped: 0,
    chargersRegistered: 0,
    chargersSkipped: 0,
    sessionsProcessed: 0,
    sessionsSkipped: 0,
    regionClaims: 0,
    regionClaimsSkipped: 0,
    snapshotsPublished: 0,
    snapshotsSkipped: 0,
  };
}

function matchesCustomError(err: unknown, signature: string): boolean {
  const selector = id(signature).slice(0, 10).toLowerCase();
  const maybeError = err as { data?: string; error?: { data?: string } };
  const directData = typeof maybeError?.data === "string" ? maybeError.data.toLowerCase() : "";
  const nestedData = typeof maybeError?.error?.data === "string" ? maybeError.error.data.toLowerCase() : "";
  const message = String(err).toLowerCase();
  const errorName = signature.slice(0, signature.indexOf("(")).toLowerCase();

  return (
    directData.startsWith(selector)
    || nestedData.startsWith(selector)
    || message.includes(errorName)
  );
}

async function ensureReputationRegistry(
  ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"],
  network: string,
  signerAddress: string,
  deployments: Record<string, Record<string, string>>,
  current: DeploymentAddresses,
): Promise<string> {
  if (current.ReputationRegistry) {
    return current.ReputationRegistry;
  }

  console.log("\nReputationRegistry not found in deployments.json. Deploying one for the demo surface...");

  const RegistryImpl = await ethers.getContractFactory("ReputationRegistry");
  const impl = await RegistryImpl.deploy();
  await impl.waitForDeployment();

  const Proxy = await ethers.getContractFactory("EnergyFiProxy");
  const proxy = await Proxy.deploy(await impl.getAddress(), "0x");
  await proxy.waitForDeployment();

  const reputationRegistry = await ethers.getContractAt("ReputationRegistry", await proxy.getAddress());
  await (await reputationRegistry.initialize(signerAddress, signerAddress)).wait();

  deployments[network] = {
    ...(deployments[network] ?? {}),
    ReputationRegistry: await proxy.getAddress(),
  };
  saveDeployments(deployments);

  console.log(`ReputationRegistry deployed at ${await proxy.getAddress()}`);
  return await proxy.getAddress();
}

async function assertDemoPermissions(
  signerAddress: string,
  deviceRegistry: any,
  stationRegistry: any,
  revenueTracker: any,
  chargeRouter: any,
  reputationRegistry: any,
) {
  const issues: string[] = [];
  const adminRole = await deviceRegistry.ADMIN_ROLE();
  const stationAdminRole = await stationRegistry.ADMIN_ROLE();

  if (!(await deviceRegistry.hasRole(adminRole, signerAddress))) {
    issues.push("DeviceRegistry.ADMIN_ROLE missing");
  }
  if (!(await stationRegistry.hasRole(stationAdminRole, signerAddress))) {
    issues.push("StationRegistry.ADMIN_ROLE missing");
  }
  if (!(await revenueTracker.hasRole(DEFAULT_ADMIN_ROLE, signerAddress))) {
    issues.push("RevenueTracker.DEFAULT_ADMIN_ROLE missing");
  }

  const routerBridge = await chargeRouter.bridgeAddress();
  if (routerBridge.toLowerCase() !== signerAddress.toLowerCase()) {
    issues.push(`ChargeRouter bridge mismatch (current: ${routerBridge})`);
  }

  const reputationBridge = await reputationRegistry.bridgeAddress();
  if (reputationBridge.toLowerCase() !== signerAddress.toLowerCase()) {
    issues.push(`ReputationRegistry bridge mismatch (current: ${reputationBridge})`);
  }

  if (issues.length > 0) {
    throw new Error(
      `Current signer ${signerAddress} cannot seed the demo surface:\n- ${issues.join("\n- ")}`,
    );
  }
}

async function ensureChip(deviceRegistry: any, charger: ChargerSeed, stats: Stats) {
  const chargerId = encodeBytes32String(charger.label);
  const wallet = deterministicWallet(charger.label);
  const expectedPublicKey = hexlify(publicKey64(wallet)).toLowerCase();
  const [publicKey, , algorithm, , active] = await deviceRegistry.getChipRecord(chargerId);
  const currentPublicKey = hexlify(publicKey).toLowerCase();
  const hasExistingPublicKey = currentPublicKey !== "0x";

  if (active) {
    if (currentPublicKey !== expectedPublicKey || Number(algorithm) !== 0) {
      throw new Error(`Chip metadata conflict for ${charger.label}`);
    }
    stats.chipsSkipped++;
    return;
  }

  if (hasExistingPublicKey && currentPublicKey !== expectedPublicKey) {
    throw new Error(`Inactive chip metadata conflict for ${charger.label}`);
  }

  await (await deviceRegistry.enrollChip(chargerId, publicKey64(wallet), 0)).wait();
  stats.chipsEnrolled++;
}

async function ensureStation(stationRegistry: any, station: StationSeed, stats: Stats) {
  const stationId = encodeBytes32String(station.label);
  const expectedRegionId = regionBytes4(station.regionCode);

  const exists = await stationRegistry.isRegistered(stationId);
  if (exists) {
    const existing = await stationRegistry.getStation(stationId);
    if (
      existing.regionId !== expectedRegionId
      || existing.location !== station.location
      || existing.active !== true
    ) {
      throw new Error(`Station metadata conflict for ${station.label}`);
    }
    stats.stationsSkipped++;
    return;
  }

  await (await stationRegistry.registerStation(stationId, expectedRegionId, station.location)).wait();
  stats.stationsRegistered++;
}

async function ensureCharger(stationRegistry: any, station: StationSeed, charger: ChargerSeed, stats: Stats) {
  const chargerId = encodeBytes32String(charger.label);
  const stationId = encodeBytes32String(station.label);

  try {
    const existing = await stationRegistry.getCharger(chargerId);
    if (
      existing.stationId !== stationId
      || Number(existing.chargerType) !== charger.chargerType
      || existing.active !== true
    ) {
      throw new Error(`Charger metadata conflict for ${charger.label}`);
    }
    stats.chargersSkipped++;
  } catch (err) {
    if (!matchesCustomError(err, "ChargerNotFound(bytes32)")) {
      throw err;
    }
    await (await stationRegistry.registerCharger(chargerId, stationId, charger.chargerType)).wait();
    stats.chargersRegistered++;
  }
}

async function ensureSession(chargeTransaction: any, chargeRouter: any, session: SessionSeed, stats: Stats) {
  const existingTokenId = await chargeTransaction.getTokenIdBySessionId(session.sessionId);
  const chargerId = encodeBytes32String(session.chargerLabel);
  const stationId = encodeBytes32String(session.stationLabel);
  const isCurrentSeed = session.key.includes(":curr:");

  if (existingTokenId > 0n) {
    const existing = await chargeTransaction.getSession(existingTokenId);
    if (
      existing.sessionId !== session.sessionId
      || existing.chargerId !== chargerId
      || Number(existing.chargerType) !== session.chargerType
      || existing.energyKwh !== session.energyKwh
      || (!isCurrentSeed && existing.startTimestamp !== session.startTimestamp)
      || (!isCurrentSeed && existing.endTimestamp !== session.endTimestamp)
      || Number(existing.vehicleCategory) !== session.vehicleCategory
      || existing.gridRegionCode !== regionBytes4(session.regionCode)
      || existing.stationId !== stationId
      || existing.distributableKrw !== session.distributableKrw
    ) {
      throw new Error(`Session metadata conflict for ${session.key}`);
    }
    stats.sessionsSkipped++;
    return;
  }

  const tx = await chargeRouter.processCharge(
    {
      sessionId: session.sessionId,
      chargerId,
      chargerType: session.chargerType,
      energyKwh: session.energyKwh,
      startTimestamp: session.startTimestamp,
      endTimestamp: session.endTimestamp,
      vehicleCategory: session.vehicleCategory,
      gridRegionCode: regionBytes4(session.regionCode),
      stationId,
      distributableKrw: session.distributableKrw,
      seSignature: signSession(session.chargerLabel, chargerId, session.energyKwh, session.startTimestamp, session.endTimestamp),
    },
    session.key.includes(":curr:") ? CURRENT_PERIOD : BigInt(session.key.split(":")[1]),
  );
  await tx.wait();
  stats.sessionsProcessed++;
}

async function finalizeHistoricalPeriod(
  revenueTracker: any,
  chargeTransaction: any,
  chargeRouter: any,
  region: RegionSeed,
  period: bigint,
  sessions: SessionSeed[],
  stats: Stats,
) {
  const regionId = regionBytes4(region.code);
  const expectedTotal = sessions.reduce((sum, session) => sum + session.distributableKrw, 0n);
  const attestation = await revenueTracker.getRegionAttestation(regionId, period);

  if (attestation.finalizedAt !== 0n) {
    for (const session of sessions) {
      const tokenId = await chargeTransaction.getTokenIdBySessionId(session.sessionId);
      if (tokenId === 0n) {
        throw new Error(`Historical period ${region.code} ${period.toString()} is already finalized but missing session ${session.key}`);
      }
      await ensureSession(chargeTransaction, chargeRouter, session, stats);
    }
    if (attestation.distributableKrw !== expectedTotal) {
      throw new Error(`Attestation amount conflict for ${region.code} ${period.toString()}`);
    }
    stats.regionClaimsSkipped++;
    return;
  }

  for (const session of sessions) {
    await ensureSession(chargeTransaction, chargeRouter, session, stats);
  }

  const tx = await revenueTracker.claimRegion(regionId, period);
  await tx.wait();

  const nextAttestation = await revenueTracker.getRegionAttestation(regionId, period);
  if (nextAttestation.finalizedAt === 0n || nextAttestation.distributableKrw !== expectedTotal) {
    throw new Error(`Failed to finalize ${region.code} ${period.toString()} with the expected total`);
  }
  stats.regionClaims++;
}

async function revokeCoverageChips(deviceRegistry: any, stats: Stats) {
  for (const chargerLabel of REVOKED_CHARGER_LABELS) {
    const chargerId = encodeBytes32String(chargerLabel);
    const isActive = await deviceRegistry.isActiveChip(chargerId);
    if (!isActive) {
      continue;
    }
    await (await deviceRegistry.revokeChip(chargerId)).wait();
    stats.chipsRevoked++;
  }
}

async function publishSnapshots(reputationRegistry: any, stats: Stats) {
  const pendingSnapshots: any[] = [];

  for (const region of REGION_SEEDS) {
    for (const period of [202602n, 202603n] as const) {
      const snapshot = buildSnapshot(region, period);
      const exists = await reputationRegistry.hasRegionSnapshot(snapshot.regionId, MONTHLY, period);
      if (!exists) {
        pendingSnapshots.push(snapshot);
        continue;
      }

      const existing = await reputationRegistry.getRegionSnapshot(snapshot.regionId, MONTHLY, period);
      const same = (
        Number(existing.metricVersion) === snapshot.metricVersion
        && existing.sourceHash === snapshot.sourceHash
        && Number(existing.trust.activeChargerRatioBps) === snapshot.trust.activeChargerRatioBps
        && Number(existing.trust.maintenanceResolutionRateBps) === snapshot.trust.maintenanceResolutionRateBps
        && Number(existing.trust.settlementContinuityBps) === snapshot.trust.settlementContinuityBps
        && existing.rhythm.sessionVolume === snapshot.rhythm.sessionVolume
        && Number(existing.rhythm.revenueStabilityBps) === snapshot.rhythm.revenueStabilityBps
        && Number(existing.rhythm.peakStartHour) === snapshot.rhythm.peakStartHour
        && Number(existing.rhythm.peakEndHour) === snapshot.rhythm.peakEndHour
        && Number(existing.site.primaryType) === snapshot.site.primaryType
        && Number(existing.site.residentialBps) === snapshot.site.residentialBps
        && Number(existing.site.workplaceBps) === snapshot.site.workplaceBps
        && Number(existing.site.publicCommercialBps) === snapshot.site.publicCommercialBps
        && Number(existing.site.mixedBps) === snapshot.site.mixedBps
      );
      if (!same) {
        throw new Error(`Snapshot metadata conflict for ${region.code} ${period.toString()}`);
      }
        stats.snapshotsSkipped++;
    }
  }

  if (pendingSnapshots.length === 0) {
    return;
  }

  await (await reputationRegistry.upsertRegionSnapshots(pendingSnapshots)).wait();
  stats.snapshotsPublished += pendingSnapshots.length;
}

function printSummary(stats: Stats, deployments: DeploymentAddresses, rpcUrl: string | undefined) {
  console.log("\n=== Demo seed summary ===");
  console.log(`chips enrolled   : ${stats.chipsEnrolled}`);
  console.log(`chips skipped    : ${stats.chipsSkipped}`);
  console.log(`chips revoked    : ${stats.chipsRevoked}`);
  console.log(`stations added   : ${stats.stationsRegistered}`);
  console.log(`stations skipped : ${stats.stationsSkipped}`);
  console.log(`chargers added   : ${stats.chargersRegistered}`);
  console.log(`chargers skipped : ${stats.chargersSkipped}`);
  console.log(`sessions minted  : ${stats.sessionsProcessed}`);
  console.log(`sessions skipped : ${stats.sessionsSkipped}`);
  console.log(`claims finalized : ${stats.regionClaims}`);
  console.log(`claims skipped   : ${stats.regionClaimsSkipped}`);
  console.log(`snapshots added  : ${stats.snapshotsPublished}`);
  console.log(`snapshots skipped: ${stats.snapshotsSkipped}`);

  console.log("\nMobile runtime env:");
  console.log(`EXPO_PUBLIC_ENERGYFI_RPC_URL=${rpcUrl ?? "<set me>"}`);
  console.log(`EXPO_PUBLIC_CHARGE_TRANSACTION_ADDRESS=${deployments.ChargeTransaction}`);
  console.log(`EXPO_PUBLIC_REVENUE_TRACKER_ADDRESS=${deployments.RevenueTracker}`);
  console.log(`EXPO_PUBLIC_STATION_REGISTRY_ADDRESS=${deployments.StationRegistry}`);
  console.log(`EXPO_PUBLIC_DEVICE_REGISTRY_ADDRESS=${deployments.DeviceRegistry}`);
  console.log(`EXPO_PUBLIC_REPUTATION_REGISTRY_ADDRESS=${deployments.ReputationRegistry ?? ZERO_ADDRESS}`);
  console.log(`EXPO_PUBLIC_REGION_STO_FACTORY_ADDRESS=${ZERO_ADDRESS}`);
  console.log("\n=== Demo seeding complete ===\n");
}

async function main() {
  const conn = await hre.network.connect();
  const ethers = conn.ethers;
  const network = conn.networkName;
  const deploymentsRaw = loadDeployments(network);
  const currentDeployments = requireDeployment(network, deploymentsRaw);
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  const balance = await ethers.provider.getBalance(signerAddress);
  const rpcUrl = process.env.ENERGYFI_L1_TESTNET_RPC?.trim();

  console.log("\n=== EnergyFi Demo Seeder ===");
  console.log(`Network : ${network}`);
  console.log(`Signer  : ${signerAddress}`);
  console.log(`Balance : ${ethers.formatEther(balance)} ${nativeSymbol()}`);

  const reputationRegistryAddress = await ensureReputationRegistry(
    ethers,
    network,
    signerAddress,
    deploymentsRaw,
    currentDeployments,
  );
  currentDeployments.ReputationRegistry = reputationRegistryAddress;

  const deviceRegistry = await ethers.getContractAt("DeviceRegistry", currentDeployments.DeviceRegistry);
  const stationRegistry = await ethers.getContractAt("StationRegistry", currentDeployments.StationRegistry);
  const chargeTransaction = await ethers.getContractAt("ChargeTransaction", currentDeployments.ChargeTransaction);
  const revenueTracker = await ethers.getContractAt("RevenueTracker", currentDeployments.RevenueTracker);
  const chargeRouter = await ethers.getContractAt("ChargeRouter", currentDeployments.ChargeRouter);
  const reputationRegistry = await ethers.getContractAt("ReputationRegistry", reputationRegistryAddress);

  await assertDemoPermissions(
    signerAddress,
    deviceRegistry,
    stationRegistry,
    revenueTracker,
    chargeRouter,
    reputationRegistry,
  );

  const stats = newStats();
  const stations = REGION_SEEDS.flatMap(buildStations);

  console.log("\n1. Ensuring deterministic demo chips...");
  for (const station of stations) {
    for (const charger of station.chargers) {
      await ensureChip(deviceRegistry, charger, stats);
    }
  }

  console.log("2. Ensuring stations...");
  for (const station of stations) {
    await ensureStation(stationRegistry, station, stats);
  }

  console.log("3. Ensuring chargers...");
  for (const station of stations) {
    for (const charger of station.chargers) {
      await ensureCharger(stationRegistry, station, charger, stats);
    }
  }

  console.log("4. Processing historical sessions and region finalizations...");
  for (const period of FINALIZED_PERIODS) {
    for (const [regionIndex, region] of REGION_SEEDS.entries()) {
      const sessions = buildHistoricalSessions(region, period, regionIndex);
      if (sessions.length === 0) {
        continue;
      }
      await finalizeHistoricalPeriod(
        revenueTracker,
        chargeTransaction,
        chargeRouter,
        region,
        period,
        sessions,
        stats,
      );
    }
  }

  console.log("5. Processing current-month pending sessions...");
  const currentSessions = buildCurrentSessions(REGION_SEEDS);
  for (const session of currentSessions) {
    await ensureSession(chargeTransaction, chargeRouter, session, stats);
  }

  console.log("6. Revoking three chips for coverage variance...");
  await revokeCoverageChips(deviceRegistry, stats);

  console.log("7. Publishing region reputation snapshots...");
  await publishSnapshots(reputationRegistry, stats);

  printSummary(stats, currentDeployments, rpcUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
