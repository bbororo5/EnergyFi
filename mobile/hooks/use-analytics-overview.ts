import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { regionCatalog, type RegionCatalogEntry } from '@/data/regions';
import {
  buildAttention,
  calculateOwnedShareBps,
  formatKrwShort,
  formatPeakWindow,
  formatPercentFromBps,
  formatPeriodLabel,
  siteTypeLabel,
  buildSettlementHistoryChart,
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

export {
  buildSettlementHistoryChart,
  calculateOwnedShareBps,
  formatKrwShort,
  formatPeakWindow,
  formatPercentFromBps,
  formatPeriodLabel,
  siteTypeLabel,
};

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

export function useAnalyticsOverview() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const loadOverview = useCallback(async (refresh = false) => {
    if (!mountedRef.current) {
      return;
    }

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [totalSessions, regions] = await Promise.all([
        readTotalSessions(),
        Promise.all(regionCatalog.map(readRegionSummary)),
      ]);

      if (!mountedRef.current) {
        return;
      }

      const nextOverview = buildOverview(totalSessions, regions);

      startTransition(() => {
        if (!mountedRef.current) {
          return;
        }
        setOverview(nextOverview);
        setErrorMessage(null);
      });
    } catch (error) {
      console.warn('Failed to load analytics overview', error);

      if (mountedRef.current) {
        setErrorMessage('Analytics evidence could not be fully loaded. Neutral fallbacks are shown where needed.');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    const interval = setInterval(() => {
      void loadOverview();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [loadOverview]);

  return {
    overview,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh: () => void loadOverview(true),
  };
}
