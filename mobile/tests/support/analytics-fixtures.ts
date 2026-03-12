import type {
  AnalyticsOverview,
  RegionEvidenceSummary,
  RegionOperationalCoverage,
  RegionSettlementProof,
  RevenueAttestation,
} from '@/lib/domain/analytics';
import { regionCatalog } from '@/data/regions';

export const TEST_SEOUL_REGION_ID = regionCatalog.find((region) => region.code === 'KR11')!.regionId;

export function createTestAttestation(overrides: Partial<RevenueAttestation> = {}): RevenueAttestation {
  return {
    regionId: TEST_SEOUL_REGION_ID,
    period_yyyyMM: 202604n,
    distributableKrw: 90_000n,
    stationCount: 2n,
    finalizedAt: 1_717_000_000n,
    ...overrides,
  };
}

export function createTestSettlement(overrides: Partial<RegionSettlementProof> = {}): RegionSettlementProof {
  const latestAttestation = overrides.latestAttestation === undefined ? createTestAttestation() : overrides.latestAttestation;
  const attestationHistory = overrides.attestationHistory === undefined
    ? (latestAttestation ? [latestAttestation] : [])
    : overrides.attestationHistory;

  return {
    pendingRevenueKrw: 50_000n,
    latestAttestation,
    attestationPeriods: latestAttestation ? [latestAttestation.period_yyyyMM] : [],
    attestationHistory,
    ...overrides,
  };
}

export function createTestCoverage(overrides: Partial<RegionOperationalCoverage> = {}): RegionOperationalCoverage {
  return {
    stationCount: 1,
    activeStationCount: 1,
    chargerCount: 2,
    activeChargerCount: 2,
    activeChipCount: 2,
    activeChargerRatio: 100,
    chipCoverageRatio: 100,
    ...overrides,
  };
}

export function createTestRegion(
  overrides: Partial<RegionEvidenceSummary> & Pick<RegionEvidenceSummary, 'code' | 'regionId' | 'name' | 'fullName'>,
): RegionEvidenceSummary {
  const { code, regionId, name, fullName, ...rest } = overrides;

  return {
    code,
    regionId,
    name,
    fullName,
    snapshot: null,
    previousSnapshot: null,
    settlement: createTestSettlement(),
    coverage: createTestCoverage(),
    stoAddress: null,
    trancheCount: 0,
    totalSupply: 0n,
    demoBalance: 0n,
    ownedShareBps: null,
    latestTranche: null,
    latestTrancheActiveStations: null,
    attention: [],
    ...rest,
  };
}

export function createSeoulRegion(overrides: Partial<RegionEvidenceSummary> = {}): RegionEvidenceSummary {
  return createTestRegion({
    code: 'KR11',
    regionId: TEST_SEOUL_REGION_ID,
    name: 'Seoul',
    fullName: 'Seoul',
    stoAddress: '0x1111111111111111111111111111111111111111',
    trancheCount: 1,
    totalSupply: 1_000n,
    demoBalance: 250n,
    ownedShareBps: 2_500,
    latestTranche: null,
    latestTrancheActiveStations: null,
    ...overrides,
  });
}

export function createTestOverview(
  regions: RegionEvidenceSummary[],
  overrides: Partial<AnalyticsOverview> = {},
): AnalyticsOverview {
  return {
    totalSessions: 1,
    publishedRegions: regions.filter((region) => region.snapshot).length || 1,
    liveStoRegions: regions.filter((region) => region.stoAddress).length,
    latestSettlementPeriodLabel: 'Apr 2026',
    totalPendingRevenueKrw: regions.reduce((sum, region) => sum + region.settlement.pendingRevenueKrw, 0n),
    aggregateStations: regions.reduce((sum, region) => sum + region.coverage.stationCount, 0),
    aggregateActiveStations: regions.reduce((sum, region) => sum + region.coverage.activeStationCount, 0),
    aggregateChargers: regions.reduce((sum, region) => sum + region.coverage.chargerCount, 0),
    aggregateActiveChargers: regions.reduce((sum, region) => sum + region.coverage.activeChargerCount, 0),
    aggregateActiveChipCoverage: 100,
    attention: [],
    regions,
    ...overrides,
  };
}
