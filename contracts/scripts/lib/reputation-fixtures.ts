import { AbiCoder, keccak256, id } from "ethers";

const abiCoder = AbiCoder.defaultAbiCoder();

export const MONTHLY_GRANULARITY = 2;

export const SITE_TYPE = {
  UNKNOWN: 0,
  RESIDENTIAL: 1,
  WORKPLACE: 2,
  PUBLIC_COMMERCIAL: 3,
  MIXED: 4,
} as const;

export interface SnapshotMetricsSeed {
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

export interface SnapshotSeed {
  regionCode: string;
  periodId: bigint;
  metricVersion: number;
  trust: SnapshotMetricsSeed["trust"];
  rhythm: SnapshotMetricsSeed["rhythm"];
  site: SnapshotMetricsSeed["site"];
}

export function regionBytes4(code: string): `0x${string}` {
  const hex = Buffer.from(code, "ascii").toString("hex").padEnd(8, "0");
  return `0x${hex}` as `0x${string}`;
}

export function buildReputationSourceHash(
  regionId: `0x${string}`,
  periodId: bigint,
  metricVersion: number,
  namespace?: string,
): `0x${string}` {
  const suffix = namespace ? `:${namespace}` : "";
  const chargeDataRoot = id(`charge:${regionId}:${periodId.toString()}${suffix}`);
  const revenueDataRoot = id(`revenue:${regionId}:${periodId.toString()}${suffix}`);
  const stationDataRoot = id(`station:${regionId}:${periodId.toString()}${suffix}`);
  const opsDataRoot = id(`ops:${regionId}:${periodId.toString()}${suffix}`);

  return keccak256(
    abiCoder.encode(
      ["bytes4", "uint8", "uint256", "uint32", "bytes32", "bytes32", "bytes32", "bytes32"],
      [
        regionId,
        MONTHLY_GRANULARITY,
        periodId,
        metricVersion,
        chargeDataRoot,
        revenueDataRoot,
        stationDataRoot,
        opsDataRoot,
      ],
    ),
  ) as `0x${string}`;
}

export function buildRegionSnapshot(
  regionCode: string,
  periodId: bigint,
  metrics: SnapshotMetricsSeed,
  namespace?: string,
) {
  const regionId = regionBytes4(regionCode);
  return {
    regionId,
    granularity: MONTHLY_GRANULARITY,
    periodId,
    metricVersion: metrics.metricVersion,
    sourceHash: buildReputationSourceHash(regionId, periodId, metrics.metricVersion, namespace),
    trust: metrics.trust,
    rhythm: metrics.rhythm,
    site: metrics.site,
  };
}

export const DEMO_REPUTATION_SNAPSHOT_SEEDS: SnapshotSeed[] = [
  {
    regionCode: "KR11",
    periodId: 202602n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 9040, maintenanceResolutionRateBps: 8620, settlementContinuityBps: 9420 },
    rhythm: { sessionVolume: 1624n, revenueStabilityBps: 7980, peakStartHour: 18, peakEndHour: 22 },
    site: { primaryType: SITE_TYPE.RESIDENTIAL, residentialBps: 6200, workplaceBps: 1500, publicCommercialBps: 1400, mixedBps: 900 },
  },
  {
    regionCode: "KR11",
    periodId: 202603n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 9220, maintenanceResolutionRateBps: 8840, settlementContinuityBps: 9650 },
    rhythm: { sessionVolume: 1810n, revenueStabilityBps: 8260, peakStartHour: 18, peakEndHour: 23 },
    site: { primaryType: SITE_TYPE.RESIDENTIAL, residentialBps: 6400, workplaceBps: 1300, publicCommercialBps: 1500, mixedBps: 800 },
  },
  {
    regionCode: "KR26",
    periodId: 202602n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 8860, maintenanceResolutionRateBps: 8340, settlementContinuityBps: 9180 },
    rhythm: { sessionVolume: 1328n, revenueStabilityBps: 7820, peakStartHour: 17, peakEndHour: 22 },
    site: { primaryType: SITE_TYPE.PUBLIC_COMMERCIAL, residentialBps: 1900, workplaceBps: 1600, publicCommercialBps: 4900, mixedBps: 1600 },
  },
  {
    regionCode: "KR26",
    periodId: 202603n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 9010, maintenanceResolutionRateBps: 8510, settlementContinuityBps: 9360 },
    rhythm: { sessionVolume: 1484n, revenueStabilityBps: 8010, peakStartHour: 17, peakEndHour: 22 },
    site: { primaryType: SITE_TYPE.PUBLIC_COMMERCIAL, residentialBps: 1800, workplaceBps: 1600, publicCommercialBps: 5200, mixedBps: 1400 },
  },
  {
    regionCode: "KR27",
    periodId: 202602n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 8780, maintenanceResolutionRateBps: 8420, settlementContinuityBps: 9100 },
    rhythm: { sessionVolume: 1096n, revenueStabilityBps: 7680, peakStartHour: 8, peakEndHour: 11 },
    site: { primaryType: SITE_TYPE.WORKPLACE, residentialBps: 2200, workplaceBps: 4600, publicCommercialBps: 1900, mixedBps: 1300 },
  },
  {
    regionCode: "KR27",
    periodId: 202603n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 8890, maintenanceResolutionRateBps: 8560, settlementContinuityBps: 9260 },
    rhythm: { sessionVolume: 1178n, revenueStabilityBps: 7840, peakStartHour: 8, peakEndHour: 11 },
    site: { primaryType: SITE_TYPE.WORKPLACE, residentialBps: 2100, workplaceBps: 4800, publicCommercialBps: 1800, mixedBps: 1300 },
  },
  {
    regionCode: "KR28",
    periodId: 202602n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 8960, maintenanceResolutionRateBps: 8460, settlementContinuityBps: 9240 },
    rhythm: { sessionVolume: 1264n, revenueStabilityBps: 7920, peakStartHour: 6, peakEndHour: 9 },
    site: { primaryType: SITE_TYPE.MIXED, residentialBps: 2800, workplaceBps: 2200, publicCommercialBps: 2200, mixedBps: 2800 },
  },
  {
    regionCode: "KR28",
    periodId: 202603n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 9110, maintenanceResolutionRateBps: 8640, settlementContinuityBps: 9450 },
    rhythm: { sessionVolume: 1396n, revenueStabilityBps: 8090, peakStartHour: 6, peakEndHour: 9 },
    site: { primaryType: SITE_TYPE.MIXED, residentialBps: 2600, workplaceBps: 2200, publicCommercialBps: 2300, mixedBps: 2900 },
  },
  {
    regionCode: "KR41",
    periodId: 202602n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 8820, maintenanceResolutionRateBps: 8380, settlementContinuityBps: 9210 },
    rhythm: { sessionVolume: 1418n, revenueStabilityBps: 7740, peakStartHour: 7, peakEndHour: 10 },
    site: { primaryType: SITE_TYPE.RESIDENTIAL, residentialBps: 5100, workplaceBps: 2100, publicCommercialBps: 1300, mixedBps: 1500 },
  },
  {
    regionCode: "KR41",
    periodId: 202603n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 8970, maintenanceResolutionRateBps: 8570, settlementContinuityBps: 9380 },
    rhythm: { sessionVolume: 1562n, revenueStabilityBps: 7960, peakStartHour: 7, peakEndHour: 10 },
    site: { primaryType: SITE_TYPE.RESIDENTIAL, residentialBps: 5400, workplaceBps: 1900, publicCommercialBps: 1200, mixedBps: 1500 },
  },
  {
    regionCode: "KR49",
    periodId: 202602n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 8720, maintenanceResolutionRateBps: 8240, settlementContinuityBps: 9020 },
    rhythm: { sessionVolume: 844n, revenueStabilityBps: 7460, peakStartHour: 11, peakEndHour: 15 },
    site: { primaryType: SITE_TYPE.MIXED, residentialBps: 1800, workplaceBps: 1200, publicCommercialBps: 2600, mixedBps: 4400 },
  },
  {
    regionCode: "KR49",
    periodId: 202603n,
    metricVersion: 1,
    trust: { activeChargerRatioBps: 8840, maintenanceResolutionRateBps: 8390, settlementContinuityBps: 9170 },
    rhythm: { sessionVolume: 932n, revenueStabilityBps: 7610, peakStartHour: 11, peakEndHour: 15 },
    site: { primaryType: SITE_TYPE.MIXED, residentialBps: 1700, workplaceBps: 1200, publicCommercialBps: 2700, mixedBps: 4400 },
  },
];
