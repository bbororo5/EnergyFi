import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { regionCatalog } from '@/data/regions';
import {
  type AnalyticsOverview,
  formatKrwShort,
  formatPeakWindow,
  formatPeriodLabel,
  formatPercentFromBps,
  siteTypeLabel,
  useAnalyticsOverview,
} from '@/hooks/use-analytics-overview';
import {
  energyfiChain,
  energyfiRpcUrl,
  chargeTransactionAddress,
  stationRegistryAddress,
} from '@/constants/contracts';
import { chargeTransactionAbi, stationRegistryAbi } from '@/lib/analytics-contracts';
import { applyShareBps, fetchOwnershipOverlay, type OwnershipOverlay } from '@/lib/home-ownership';

const homeClient = createPublicClient({
  chain: energyfiChain,
  transport: http(energyfiRpcUrl),
});

type ChargeSession = {
  sessionId: `0x${string}`;
  chargerId: `0x${string}`;
  chargerType: number;
  energyKwh: bigint;
  startTimestamp: bigint;
  endTimestamp: bigint;
  vehicleCategory: number;
  gridRegionCode: `0x${string}`;
  stationId: `0x${string}`;
  distributableKrw: bigint;
  seSignature: `0x${string}`;
};

export interface HomeHeroPoint {
  label: string;
  value: number;
  rawKrw: bigint;
}

export interface HomeRegionCardData {
  id: string;
  name: string;
  stationCount: number;
  published: boolean;
  siteLabel: string;
  pendingRevenueLabel: string;
  latestFinalizedLabel: string;
  activeCoverageLabel: string;
  snapshotLabel: string;
  issuanceLabel: string;
  chartData: { value: number }[];
}

export interface HomeImpactSummary {
  estimatedCo2Kg: number;
  deliveredEnergyKwh: number;
  treeEquivalent: number;
  methodologyLabel: string;
}

export interface HomeLiveSession {
  id: string;
  station: string;
  regionName: string;
  kwh: string;
  revenue: number;
  time: string;
  deviceType: string;
}

export interface HomeDashboardData {
  heroLabel: string;
  heroSubLabel: string;
  heroValue: number;
  heroChart: HomeHeroPoint[];
  averageRevenueKrw: bigint | null;
  growthPercent: number | null;
  footerLabel: string;
  footerValue: string;
  footerBadgeText: string | null;
  ownershipOverlay: OwnershipOverlay;
  regionCards: HomeRegionCardData[];
  impact: HomeImpactSummary | null;
  liveSessions: HomeLiveSession[];
}

const ICE_KG_CO2_PER_KM = 0.192;
const EV_KWH_PER_KM = 0.18;
const MATURE_TREE_KG_CO2_PER_YEAR = 21;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function formatSharePercent(shareBps: number | null) {
  if (shareBps == null) {
    return null;
  }

  return `${(shareBps / 100).toFixed(2)}%`;
}

function formatRelativeTime(timestamp: bigint) {
  const diffSeconds = Math.max(0, Math.round(Date.now() / 1000 - Number(timestamp)));
  if (diffSeconds < 60) {
    return 'Just now';
  }
  if (diffSeconds < 3600) {
    return `${Math.round(diffSeconds / 60)}m ago`;
  }
  if (diffSeconds < 86400) {
    return `${Math.round(diffSeconds / 3600)}h ago`;
  }
  return `${Math.round(diffSeconds / 86400)}d ago`;
}

function resolveRegionName(regionId: `0x${string}`) {
  return regionCatalog.find((entry) => entry.regionId.toLowerCase() === regionId.toLowerCase())?.name ?? regionId;
}

async function readAllSessions(totalSessions: number) {
  if (totalSessions <= 0) {
    return [] as ChargeSession[];
  }

  const tokenIds = Array.from({ length: totalSessions }, (_, index) => BigInt(index + 1));
  const batches = chunk(tokenIds, 25);
  const sessions: ChargeSession[] = [];

  for (const batch of batches) {
    const nextSessions = await Promise.all(
      batch.map((tokenId) => (
        homeClient.readContract({
          address: chargeTransactionAddress,
          abi: chargeTransactionAbi,
          functionName: 'getSession',
          args: [tokenId],
        })
      )),
    ) as ChargeSession[];

    sessions.push(...nextSessions);
  }

  return sessions;
}

function buildHeroSeries(overview: AnalyticsOverview, shareBps: number | null) {
  const totals = new Map<string, bigint>();

  for (const region of overview.regions) {
    for (const attestation of region.settlement.attestationHistory) {
      const key = attestation.period_yyyyMM.toString();
      totals.set(key, (totals.get(key) ?? 0n) + attestation.distributableKrw);
    }
  }

  const sortedPeriods = [...totals.entries()]
    .sort((a, b) => Number(BigInt(a[0]) - BigInt(b[0])))
    .slice(-6);

  return sortedPeriods.map(([period, amount]) => {
    const displayAmount = applyShareBps(amount, shareBps) ?? amount;
    return {
      label: formatPeriodLabel(BigInt(period)).split(' ')[0],
      value: Number(displayAmount),
      rawKrw: displayAmount,
    };
  });
}

function buildRegionCards(overview: AnalyticsOverview): HomeRegionCardData[] {
  return overview.regions.slice(0, 3).map((region) => ({
    id: region.code,
    name: region.name,
    stationCount: region.coverage.stationCount,
    published: Boolean(region.snapshot),
    siteLabel: region.snapshot ? siteTypeLabel(region.snapshot.site.primaryType) : 'Awaiting snapshot',
    pendingRevenueLabel: formatKrwShort(region.settlement.pendingRevenueKrw),
    latestFinalizedLabel: region.settlement.latestAttestation
      ? formatKrwShort(region.settlement.latestAttestation.distributableKrw)
      : 'Pending only',
    activeCoverageLabel: region.snapshot
      ? formatPercentFromBps(region.snapshot.trust.activeChargerRatioBps)
      : region.coverage.activeChargerRatio != null
        ? `${region.coverage.activeChargerRatio.toFixed(1)}%`
        : 'N/A',
    snapshotLabel: region.snapshot
      ? `${formatPeriodLabel(region.snapshot.periodId)} · ${formatPeakWindow(region.snapshot.rhythm.peakStartHour, region.snapshot.rhythm.peakEndHour)}`
      : 'No monthly snapshot yet',
    issuanceLabel: region.stoAddress ? `Live · ${region.trancheCount} tranches` : 'Not issued yet',
    chartData: region.settlement.attestationHistory.length > 0
      ? region.settlement.attestationHistory.slice(-6).map((attestation) => ({
          value: Math.max(1, Number(attestation.distributableKrw) / 1_000_000),
        }))
      : [{ value: Math.max(1, Number(region.settlement.pendingRevenueKrw) / 1_000_000) }],
  }));
}

function buildImpactSummary(sessions: ChargeSession[]) {
  if (sessions.length === 0) {
    return null;
  }

  const deliveredEnergyKwh = sessions.reduce((sum, session) => sum + Number(session.energyKwh) / 100, 0);
  const estimatedCo2Kg = deliveredEnergyKwh * (ICE_KG_CO2_PER_KM / EV_KWH_PER_KM);
  const treeEquivalent = Math.max(1, Math.round(estimatedCo2Kg / MATURE_TREE_KG_CO2_PER_YEAR));

  return {
    estimatedCo2Kg,
    deliveredEnergyKwh,
    treeEquivalent,
    methodologyLabel: 'Estimated versus ICE using 0.18 kWh/km EV and 0.192 kg CO2/km gasoline baseline.',
  };
}

async function buildLiveSessions(sessions: ChargeSession[]) {
  const latestSessions = [...sessions].slice(-4).reverse();
  if (latestSessions.length === 0) {
    return [] as HomeLiveSession[];
  }

  const stationRecords = await Promise.all(
    latestSessions.map(async (session) => {
      try {
        return await homeClient.readContract({
          address: stationRegistryAddress,
          abi: stationRegistryAbi,
          functionName: 'getStation',
          args: [session.stationId],
        });
      } catch {
        return null;
      }
    }),
  );

  return latestSessions.map((session, index) => {
    const stationRecord = stationRecords[index];
    const regionName = resolveRegionName(session.gridRegionCode);
    return {
      id: `${session.sessionId}-${index}`,
      station: stationRecord?.location || regionName,
      regionName,
      kwh: (Number(session.energyKwh) / 100).toFixed(1),
      revenue: Number(session.distributableKrw),
      time: formatRelativeTime(session.endTimestamp),
      deviceType: Number(session.chargerType) === 2 ? 'DC Fast' : 'AC Slow',
    };
  });
}

export function useHomeDashboard() {
  const { overview, isLoading: overviewLoading, isRefreshing: overviewRefreshing, errorMessage, refresh: refreshOverview } = useAnalyticsOverview();
  const [ownershipOverlay, setOwnershipOverlay] = useState<OwnershipOverlay | null>(null);
  const [impact, setImpact] = useState<HomeImpactSummary | null>(null);
  const [liveSessions, setLiveSessions] = useState<HomeLiveSession[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const loadOverlay = useCallback(async () => {
    const overlay = await fetchOwnershipOverlay();
    if (mountedRef.current) {
      setOwnershipOverlay(overlay);
    }
  }, []);

  const loadSessionDerivedData = useCallback(async () => {
    setFeedLoading(true);

    try {
      const totalSessionsRaw = await homeClient.readContract({
        address: chargeTransactionAddress,
        abi: chargeTransactionAbi,
        functionName: 'totalSessions',
      });

      const totalSessions = Number(totalSessionsRaw);
      const sessions = await readAllSessions(totalSessions);
      const [impactSummary, nextLiveSessions] = await Promise.all([
        Promise.resolve(buildImpactSummary(sessions)),
        buildLiveSessions(sessions),
      ]);

      if (!mountedRef.current) {
        return;
      }

      startTransition(() => {
        setImpact(impactSummary);
        setLiveSessions(nextLiveSessions);
      });
    } catch (error) {
      console.warn('Failed to load Home session-derived data', error);
      if (mountedRef.current) {
        setImpact(null);
        setLiveSessions([]);
      }
    } finally {
      if (mountedRef.current) {
        setFeedLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadOverlay();
  }, [loadOverlay, reloadToken]);

  useEffect(() => {
    void loadSessionDerivedData();
    const interval = setInterval(() => {
      void loadSessionDerivedData();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadSessionDerivedData, reloadToken]);

  const dashboard = useMemo<HomeDashboardData | null>(() => {
    if (!overview || !ownershipOverlay) {
      return null;
    }

    const heroChart = buildHeroSeries(overview, ownershipOverlay.shareBps);
    const latestPoint = heroChart[heroChart.length - 1];
    const previousPoint = heroChart.length > 1 ? heroChart[heroChart.length - 2] : null;
    const averageRevenueKrw = heroChart.length > 0
      ? heroChart.reduce((sum, point) => sum + point.rawKrw, 0n) / BigInt(heroChart.length)
      : null;
    const growthPercent = latestPoint && previousPoint && previousPoint.rawKrw > 0n
      ? ((Number(latestPoint.rawKrw - previousPoint.rawKrw) / Number(previousPoint.rawKrw)) * 100)
      : null;

    const footerValue = ownershipOverlay.estimatedPortfolioValueKrw
      ? formatKrwShort(ownershipOverlay.estimatedPortfolioValueKrw)
      : ownershipOverlay.shareBps != null
        ? formatSharePercent(ownershipOverlay.shareBps) ?? 'N/A'
        : formatKrwShort(overview.totalPendingRevenueKrw);

    return {
      heroLabel: ownershipOverlay.shareBps != null ? 'Estimated Monthly Revenue' : 'Monthly Network Revenue',
      heroSubLabel: ownershipOverlay.source === 'securities-api'
        ? 'On-chain revenue with securities-account ownership overlay'
        : ownershipOverlay.source === 'manual-input'
          ? 'On-chain revenue with manual ownership-share input'
          : 'Pure on-chain network revenue until ownership input is supplied',
      heroValue: latestPoint ? Number(latestPoint.rawKrw) : Number(overview.totalPendingRevenueKrw),
      heroChart,
      averageRevenueKrw,
      growthPercent,
      footerLabel: ownershipOverlay.estimatedPortfolioValueKrw
        ? 'Estimated Portfolio'
        : ownershipOverlay.shareBps != null
          ? 'Ownership Share'
          : 'Pending Network Revenue',
      footerValue,
      footerBadgeText: ownershipOverlay.shareBps != null ? formatSharePercent(ownershipOverlay.shareBps) : null,
      ownershipOverlay,
      regionCards: buildRegionCards(overview),
      impact,
      liveSessions,
    };
  }, [impact, liveSessions, overview, ownershipOverlay]);

  const refresh = useCallback(() => {
    refreshOverview();
    setReloadToken((value) => value + 1);
  }, [refreshOverview]);

  return {
    dashboard,
    isLoading: overviewLoading || !ownershipOverlay || feedLoading,
    isRefreshing: overviewRefreshing || feedLoading,
    errorMessage,
    refresh,
  };
}
