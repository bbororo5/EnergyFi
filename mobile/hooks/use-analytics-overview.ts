import { useCallback } from 'react';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { regionCatalog, type RegionCatalogEntry } from '@/data/regions';
import {
  buildAttention,
  calculateOwnedShareBps,
  formatPeriodLabel,
  type AnalyticsOverview,
  type RegionEvidenceSummary,
  type RevenueAttestation,
} from '@/lib/domain/analytics';
import {
  readCoverage,
  readSettlement,
  readSnapshot,
  readStoReadiness,
  readTotalSessions,
} from '@/lib/chain/analytics';

export type {
  AnalyticsOverview,
  RegionEvidenceSummary,
  RevenueAttestation,
};

async function readRegionSummary(entry: RegionCatalogEntry): Promise<RegionEvidenceSummary> {
  const [settlement, coverage, snapshotData, stoReadiness] = await Promise.all([
    readSettlement(entry.regionId),
    readCoverage(entry.regionId),
    readSnapshot(entry.regionId),
    readStoReadiness(entry.regionId),
  ]);

  const ownedShareBps = calculateOwnedShareBps(stoReadiness.demoBalance, stoReadiness.totalSupply);
  const attention = buildAttention({
    snapshot: snapshotData.snapshot,
    coverage,
    stoAddress: stoReadiness.stoAddress,
  });

  return {
    code: entry.code,
    regionId: entry.regionId,
    name: entry.name,
    fullName: entry.fullName,
    settlement,
    coverage,
    snapshot: snapshotData.snapshot,
    previousSnapshot: snapshotData.previousSnapshot,
    stoAddress: stoReadiness.stoAddress,
    trancheCount: stoReadiness.trancheCount,
    totalSupply: stoReadiness.totalSupply,
    demoBalance: stoReadiness.demoBalance,
    ownedShareBps,
    latestTranche: stoReadiness.latestTranche,
    latestTrancheActiveStations: stoReadiness.latestTrancheActiveStations,
    attention,
  };
}

function buildOverview(totalSessions: number | null, regions: RegionEvidenceSummary[]): AnalyticsOverview {
  const publishedRegions = regions.filter((region) => region.snapshot).length;
  const liveStoRegions = regions.filter((region) => region.stoAddress && region.trancheCount > 0).length;
  const totalPendingRevenueKrw = regions.reduce((sum, region) => sum + region.settlement.pendingRevenueKrw, 0n);
  const latestAttestationPeriod = regions
    .map((region) => region.settlement.latestAttestation?.period_yyyyMM ?? 0n)
    .sort((left, right) => Number(left - right))
    .pop() ?? 0n;

  const aggregateStations = regions.reduce((sum, region) => sum + region.coverage.stationCount, 0);
  const aggregateActiveStations = regions.reduce((sum, region) => sum + region.coverage.activeStationCount, 0);
  const aggregateChargers = regions.reduce((sum, region) => sum + region.coverage.chargerCount, 0);
  const aggregateActiveChargers = regions.reduce((sum, region) => sum + region.coverage.activeChargerCount, 0);
  const aggregateActiveChipCount = regions.reduce((sum, region) => sum + region.coverage.activeChipCount, 0);

  return {
    totalSessions,
    publishedRegions,
    liveStoRegions,
    latestSettlementPeriodLabel: formatPeriodLabel(latestAttestationPeriod > 0n ? latestAttestationPeriod : null),
    totalPendingRevenueKrw,
    aggregateStations,
    aggregateActiveStations,
    aggregateChargers,
    aggregateActiveChargers,
    aggregateActiveChipCoverage: aggregateChargers > 0 ? (aggregateActiveChipCount / aggregateChargers) * 100 : null,
    regions,
    attention: regions.flatMap((region) => region.attention.map((message) => ({
      regionCode: region.code,
      message,
      tone: message.includes('not') || message.includes('below') || message.includes('incomplete') ? 'warning' as const : 'info' as const,
    }))),
  };
}

export async function fetchAnalyticsOverview() {
  const [totalSessions, regions] = await Promise.all([
    readTotalSessions(),
    Promise.all(regionCatalog.map(readRegionSummary)),
  ]);

  return buildOverview(totalSessions, regions);
}

export const analyticsOverviewQueryKey = ['analytics-overview'] as const;

export function analyticsOverviewQueryOptions() {
  return queryOptions({
    queryKey: analyticsOverviewQueryKey,
    queryFn: fetchAnalyticsOverview,
    refetchInterval: 60_000,
  });
}

export function useAnalyticsOverviewQuery() {
  const query = useQuery(analyticsOverviewQueryOptions());

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    overview: query.data ?? null,
    isLoading: query.isPending,
    isRefreshing: query.isRefetching,
    errorMessage: query.error ? 'Analytics evidence could not be fully loaded. Neutral fallbacks are shown where needed.' : null,
    refresh,
  };
}

export const useAnalyticsOverview = useAnalyticsOverviewQuery;
