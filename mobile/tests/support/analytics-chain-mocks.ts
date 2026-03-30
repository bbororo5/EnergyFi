import type {
  AnalyticsOverview,
  RegionOperationalCoverage,
  RegionSettlementProof,
  RegionEvidenceSummary,
} from '@/lib/domain/analytics';

interface AnalyticsChainMocks {
  readTotalSessions: jest.Mock;
  readSettlement: jest.Mock;
  readCoverage: jest.Mock;
  readSnapshot: jest.Mock;
  readStoReadiness: jest.Mock;
}

const emptySettlement: RegionSettlementProof = {
  pendingRevenueKrw: 0n,
  latestAttestation: null,
  attestationPeriods: [],
  attestationHistory: [],
};

const emptyCoverage: RegionOperationalCoverage = {
  stationCount: 0,
  activeStationCount: 0,
  chargerCount: 0,
  activeChargerCount: 0,
  activeChipCount: 0,
  activeChargerRatio: null,
  chipCoverageRatio: null,
};

function getRegionById(overview: AnalyticsOverview, regionId: `0x${string}`) {
  return overview.regions.find((region) => region.regionId === regionId) ?? null;
}

function buildStoReadiness(region: RegionEvidenceSummary | null) {
  if (!region) {
    return {
      stoAddress: null,
      trancheCount: 0,
      totalSupply: 0n,
      demoBalance: 0n,
      latestTranche: null,
      latestTrancheActiveStations: null,
    };
  }

  return {
    stoAddress: region.stoAddress,
    trancheCount: region.trancheCount,
    totalSupply: region.totalSupply,
    demoBalance: region.demoBalance,
    latestTranche: region.latestTranche,
    latestTrancheActiveStations: region.latestTrancheActiveStations,
  };
}

export function applyAnalyticsOverviewMocks(mocks: AnalyticsChainMocks, overview: AnalyticsOverview) {
  mocks.readTotalSessions.mockReset();
  mocks.readSettlement.mockReset();
  mocks.readCoverage.mockReset();
  mocks.readSnapshot.mockReset();
  mocks.readStoReadiness.mockReset();

  mocks.readTotalSessions.mockImplementation(async () => overview.totalSessions);
  mocks.readSettlement.mockImplementation(async (regionId: `0x${string}`) => (
    getRegionById(overview, regionId)?.settlement ?? emptySettlement
  ));
  mocks.readCoverage.mockImplementation(async (regionId: `0x${string}`) => (
    getRegionById(overview, regionId)?.coverage ?? emptyCoverage
  ));
  mocks.readSnapshot.mockImplementation(async (regionId: `0x${string}`) => {
    const region = getRegionById(overview, regionId);
    return {
      snapshot: region?.snapshot ?? null,
      previousSnapshot: region?.previousSnapshot ?? null,
    };
  });
  mocks.readStoReadiness.mockImplementation(async (regionId: `0x${string}`) => (
    buildStoReadiness(getRegionById(overview, regionId))
  ));
}
