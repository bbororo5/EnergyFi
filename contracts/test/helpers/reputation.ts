import { expect } from "chai";
import { ZeroHash } from "ethers";
import { regionBytes4 } from "./helpers.js";

export const PeriodGranularity = {
  UNKNOWN: 0,
  WEEKLY: 1,
  MONTHLY: 2,
} as const;

export const SiteType = {
  UNKNOWN: 0,
  RESIDENTIAL: 1,
  WORKPLACE: 2,
  PUBLIC_COMMERCIAL: 3,
  MIXED: 4,
} as const;

export const REGION_SEOUL = regionBytes4("KR11");
export const REGION_BUSAN = regionBytes4("KR26");
export const REGION_DAEGU = regionBytes4("KR27");

export const PERIOD_WEEK_10 = 202610n;
export const PERIOD_WEEK_11 = 202611n;
export const PERIOD_MONTH_JAN = 202601n;
export const PERIOD_MONTH_FEB = 202602n;
export const PERIOD_MONTH_MAR = 202603n;

interface TrustOverrides {
  activeChargerRatioBps?: number;
  maintenanceResolutionRateBps?: number;
  settlementContinuityBps?: number;
}

interface RhythmOverrides {
  sessionVolume?: bigint;
  revenueStabilityBps?: number;
  peakStartHour?: number;
  peakEndHour?: number;
}

interface SiteOverrides {
  primaryType?: number;
  residentialBps?: number;
  workplaceBps?: number;
  publicCommercialBps?: number;
  mixedBps?: number;
}

interface SnapshotOverrides {
  regionId?: string;
  granularity?: number;
  periodId?: bigint;
  metricVersion?: number;
  sourceHash?: string;
  trust?: TrustOverrides;
  rhythm?: RhythmOverrides;
  site?: SiteOverrides;
}

export function makeSnapshot(overrides: SnapshotOverrides = {}) {
  return {
    regionId: overrides.regionId ?? REGION_SEOUL,
    granularity: overrides.granularity ?? PeriodGranularity.MONTHLY,
    periodId: overrides.periodId ?? PERIOD_MONTH_JAN,
    metricVersion: overrides.metricVersion ?? 1,
    sourceHash: overrides.sourceHash ?? ZeroHash,
    trust: {
      activeChargerRatioBps: overrides.trust?.activeChargerRatioBps ?? 9200,
      maintenanceResolutionRateBps: overrides.trust?.maintenanceResolutionRateBps ?? 8750,
      settlementContinuityBps: overrides.trust?.settlementContinuityBps ?? 9600,
    },
    rhythm: {
      sessionVolume: overrides.rhythm?.sessionVolume ?? 144n,
      revenueStabilityBps: overrides.rhythm?.revenueStabilityBps ?? 8100,
      peakStartHour: overrides.rhythm?.peakStartHour ?? 18,
      peakEndHour: overrides.rhythm?.peakEndHour ?? 22,
    },
    site: {
      primaryType: overrides.site?.primaryType ?? SiteType.RESIDENTIAL,
      residentialBps: overrides.site?.residentialBps ?? 6200,
      workplaceBps: overrides.site?.workplaceBps ?? 1400,
      publicCommercialBps: overrides.site?.publicCommercialBps ?? 1600,
      mixedBps: overrides.site?.mixedBps ?? 800,
    },
  };
}

export function expectSnapshotMatches(actual: Record<string, any>, expected: ReturnType<typeof makeSnapshot>) {
  expect(actual.regionId).to.equal(expected.regionId);
  expect(actual.granularity).to.equal(BigInt(expected.granularity));
  expect(actual.periodId).to.equal(expected.periodId);
  expect(actual.metricVersion).to.equal(BigInt(expected.metricVersion));
  expect(actual.sourceHash).to.equal(expected.sourceHash);

  expect(actual.trust.activeChargerRatioBps).to.equal(BigInt(expected.trust.activeChargerRatioBps));
  expect(actual.trust.maintenanceResolutionRateBps).to.equal(BigInt(expected.trust.maintenanceResolutionRateBps));
  expect(actual.trust.settlementContinuityBps).to.equal(BigInt(expected.trust.settlementContinuityBps));

  expect(actual.rhythm.sessionVolume).to.equal(expected.rhythm.sessionVolume);
  expect(actual.rhythm.revenueStabilityBps).to.equal(BigInt(expected.rhythm.revenueStabilityBps));
  expect(actual.rhythm.peakStartHour).to.equal(BigInt(expected.rhythm.peakStartHour));
  expect(actual.rhythm.peakEndHour).to.equal(BigInt(expected.rhythm.peakEndHour));

  expect(actual.site.primaryType).to.equal(BigInt(expected.site.primaryType));
  expect(actual.site.residentialBps).to.equal(BigInt(expected.site.residentialBps));
  expect(actual.site.workplaceBps).to.equal(BigInt(expected.site.workplaceBps));
  expect(actual.site.publicCommercialBps).to.equal(BigInt(expected.site.publicCommercialBps));
  expect(actual.site.mixedBps).to.equal(BigInt(expected.site.mixedBps));
}

export function expectUpdatedAtIncreased(previousUpdatedAt: bigint, nextUpdatedAt: bigint) {
  expect(nextUpdatedAt).to.be.greaterThan(previousUpdatedAt);
}
