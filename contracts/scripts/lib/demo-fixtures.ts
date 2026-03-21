import {
  Wallet,
  getBytes,
  hexlify,
  keccak256,
  solidityPackedKeccak256,
  toUtf8Bytes,
} from "ethers";
import {
  buildRegionSnapshot,
  type SnapshotMetricsSeed,
  regionBytes4,
} from "./reputation-fixtures.js";

export const CURRENT_PERIOD = 202603n;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const PRIMARY_INVESTOR_LABEL = "energyfi-demo:investor-primary";
export const RESERVE_INVESTOR_LABEL = "energyfi-demo:investor-reserve";

export type RegionCode = "KR11" | "KR26" | "KR27" | "KR28" | "KR29" | "KR41" | "KR49";

interface StoMintSeed {
  primary: bigint;
  reserve: bigint;
}

export interface RegionSeed {
  code: RegionCode;
  tokenName: string;
  tokenSymbol: string;
  stationLocations: [string, string];
  finalizedPeriods: readonly bigint[];
  sessionsPerFinalizedPeriod: 2 | 3 | 4;
  stoMint: StoMintSeed;
  snapshotMetrics: Record<"202602" | "202603", SnapshotMetricsSeed>;
}

export interface StationSeed {
  label: string;
  regionCode: RegionCode;
  location: string;
  chargers: ChargerSeed[];
}

export interface ChargerSeed {
  label: string;
  chargerType: number;
}

export interface SessionSeed {
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

export const REGION_SEEDS: RegionSeed[] = [
  {
    code: "KR11",
    tokenName: "EnergyFi Seoul STO",
    tokenSymbol: "EFI-KR11",
    stationLocations: [
      "Seoul Gangnam Terrace 101",
      "Seoul Mapo Riverside 202",
    ],
    finalizedPeriods: [202509n, 202510n, 202511n, 202512n, 202601n, 202602n, 202603n],
    sessionsPerFinalizedPeriod: 4,
    stoMint: { primary: 720n, reserve: 480n },
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
    tokenName: "EnergyFi Busan STO",
    tokenSymbol: "EFI-KR26",
    stationLocations: [
      "Busan Haeundae Harbor 301",
      "Busan Suyeong Marina 402",
    ],
    finalizedPeriods: [202509n, 202510n, 202511n, 202512n, 202601n, 202602n, 202603n],
    sessionsPerFinalizedPeriod: 4,
    stoMint: { primary: 525n, reserve: 375n },
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
    tokenName: "EnergyFi Daegu STO",
    tokenSymbol: "EFI-KR27",
    stationLocations: [
      "Daegu Suseong Bloom 501",
      "Daegu Dalseo Metro 602",
    ],
    finalizedPeriods: [202509n, 202510n, 202511n, 202512n, 202601n, 202602n, 202603n],
    sessionsPerFinalizedPeriod: 4,
    stoMint: { primary: 610n, reserve: 190n },
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
    tokenName: "EnergyFi Incheon STO",
    tokenSymbol: "EFI-KR28",
    stationLocations: [
      "Incheon Songdo Central 701",
      "Incheon Bupyeong Garden 702",
    ],
    finalizedPeriods: [202512n, 202601n, 202602n, 202603n],
    sessionsPerFinalizedPeriod: 3,
    stoMint: { primary: 360n, reserve: 340n },
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
    tokenName: "EnergyFi Gwangju STO",
    tokenSymbol: "EFI-KR29",
    stationLocations: [
      "Gwangju Sangmu Horizon 801",
      "Gwangju Bukgu Junction 802",
    ],
    finalizedPeriods: [202602n, 202603n],
    sessionsPerFinalizedPeriod: 2,
    stoMint: { primary: 280n, reserve: 220n },
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
    tokenName: "EnergyFi Gyeonggi STO",
    tokenSymbol: "EFI-KR41",
    stationLocations: [
      "Gyeonggi Pangyo Tech 901",
      "Gyeonggi Gwanggyo Lake 902",
    ],
    finalizedPeriods: [202512n, 202601n, 202602n, 202603n],
    sessionsPerFinalizedPeriod: 3,
    stoMint: { primary: 450n, reserve: 300n },
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
    tokenName: "EnergyFi Jeju STO",
    tokenSymbol: "EFI-KR49",
    stationLocations: [
      "Jeju Aewol Coast 1001",
      "Jeju Seogwipo Breeze 1002",
    ],
    finalizedPeriods: [202602n, 202603n],
    sessionsPerFinalizedPeriod: 2,
    stoMint: { primary: 180n, reserve: 370n },
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

export const FINALIZED_PERIODS = [202509n, 202510n, 202511n, 202512n, 202601n, 202602n, 202603n];

export const REVOKED_CHARGER_LABELS = new Set<`${RegionCode}-ST02-CH03`>([
  "KR28-ST02-CH03",
  "KR29-ST02-CH03",
  "KR49-ST02-CH03",
]);

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

export function buildStationLabel(code: RegionCode, stationIndex: number): string {
  return `${code}-ST${String(stationIndex).padStart(2, "0")}`;
}

function buildChargerLabel(code: RegionCode, stationIndex: number, chargerIndex: number): string {
  return `${code}-ST${String(stationIndex).padStart(2, "0")}-CH${String(chargerIndex).padStart(2, "0")}`;
}

export function buildStations(region: RegionSeed): StationSeed[] {
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

export function deterministicWallet(label: string): Wallet {
  return new Wallet(keccak256(toUtf8Bytes(label)));
}

export function publicKey64(wallet: Wallet): Uint8Array {
  return getBytes(wallet.signingKey.publicKey).slice(1);
}

function buildMessageHash(chargerId: string, energyKwh: bigint, startTimestamp: bigint, endTimestamp: bigint): string {
  return solidityPackedKeccak256(
    ["bytes32", "uint256", "uint256", "uint256"],
    [chargerId, energyKwh, startTimestamp, endTimestamp],
  );
}

export function signSession(
  chargerLabel: string,
  chargerId: string,
  energyKwh: bigint,
  startTimestamp: bigint,
  endTimestamp: bigint,
): `0x${string}` {
  const wallet = deterministicWallet(chargerLabel);
  const digest = buildMessageHash(chargerId, energyKwh, startTimestamp, endTimestamp);
  return hexlify(wallet.signingKey.sign(digest).serialized) as `0x${string}`;
}

function sessionIdFor(key: string): `0x${string}` {
  return keccak256(toUtf8Bytes(`energyfi-demo:${key}`)) as `0x${string}`;
}

export function buildSnapshot(region: RegionSeed, period: 202602n | 202603n) {
  const metrics = region.snapshotMetrics[period.toString() as "202602" | "202603"];
  return buildRegionSnapshot(region.code, period, metrics, "demo");
}

export function buildHistoricalSessions(region: RegionSeed, period: bigint, regionIndex: number): SessionSeed[] {
  if (!region.finalizedPeriods.includes(period)) {
    return [];
  }

  const { year, month } = periodToParts(period);
  const templates = {
    4: { days: [5, 12, 19, 26], stationCycle: [1, 2, 1, 2], chargerCycle: [1, 2, 3, 1] },
    3: { days: [6, 16, 26], stationCycle: [1, 2, 1], chargerCycle: [1, 2, 3] },
    2: { days: [8, 22], stationCycle: [1, 2], chargerCycle: [1, 2] },
  } as const;
  const template = templates[region.sessionsPerFinalizedPeriod];

  return template.days.map((day, ordinal) => {
    const stationIndex = template.stationCycle[ordinal] ?? 1;
    const chargerSlot = template.chargerCycle[ordinal] ?? 1;
    const stationLabel = buildStationLabel(region.code, stationIndex);
    const chargerLabel = buildChargerLabel(region.code, stationIndex, chargerSlot);
    const startHour = 7 + ((regionIndex + ordinal + month) % 9);
    const durationMinutes = 46 + (regionIndex * 6) + (ordinal * 8);
    const startTimestamp = toUnixSecondsKst(year, month, day, startHour, 15);
    const endTimestamp = startTimestamp + BigInt(durationMinutes * 60);
    const energyKwh = BigInt(1230 + (regionIndex * 110) + ((month % 12) * 18) + (ordinal * 72));
    const rate = BigInt(286 + (regionIndex * 9) + (ordinal * 8));
    const distributableKrw = (energyKwh * rate) / 100n;
    const key = `${region.code}:${period.toString()}:hist:${ordinal}`;

    return {
      key,
      sessionId: sessionIdFor(key),
      stationLabel,
      chargerLabel,
      chargerType: chargerSlot - 1,
      regionCode: region.code,
      energyKwh,
      startTimestamp,
      endTimestamp,
      distributableKrw,
      vehicleCategory: ordinal % 2 === 0 ? 1 : 2,
    };
  });
}

export function buildLiveSessions(regions: RegionSeed[]): SessionSeed[] {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const totalLiveSessions = regions.length * 2;
  let globalIndex = 0;

  return regions.flatMap((region, regionIndex) => {
    return Array.from({ length: 2 }, (_, ordinal) => {
      const stationIndex = ordinal + 1;
      const chargerSlot = ordinal === 0 ? 1 : 2;
      const stationLabel = buildStationLabel(region.code, stationIndex);
      const chargerLabel = buildChargerLabel(region.code, stationIndex, chargerSlot);
      const energyKwh = BigInt(1460 + (regionIndex * 102) + (ordinal * 95));
      const rate = BigInt(306 + (regionIndex * 7) + (ordinal * 10));
      const distributableKrw = (energyKwh * rate) / 100n;
      const key = `${region.code}:${CURRENT_PERIOD.toString()}:live:${ordinal}`;

      let startTimestamp: bigint;
      let endTimestamp: bigint;

      if (globalIndex >= totalLiveSessions - 4) {
        const recentOffsetMinutes = [52, 38, 24, 10][globalIndex - (totalLiveSessions - 4)];
        endTimestamp = BigInt(nowSeconds - (recentOffsetMinutes * 60));
        startTimestamp = endTimestamp - BigInt((58 + ordinal * 9) * 60);
      } else {
        const day = 18 + ((regionIndex + ordinal) % 7);
        const startHour = 9 + ((regionIndex + ordinal) % 7);
        startTimestamp = toUnixSecondsKst(2026, 3, day, startHour, 25);
        endTimestamp = startTimestamp + BigInt((52 + ordinal * 10) * 60);
      }

      globalIndex++;

      return {
        key,
        sessionId: sessionIdFor(key),
        stationLabel,
        chargerLabel,
        chargerType: chargerSlot - 1,
        regionCode: region.code,
        energyKwh,
        startTimestamp,
        endTimestamp,
        distributableKrw,
        vehicleCategory: ordinal === 0 ? 1 : 2,
      };
    });
  });
}

export { regionBytes4 };
