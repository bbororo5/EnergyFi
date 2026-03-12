import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  applyOwnedShare,
  formatKrwShort,
  formatPeakWindow,
  formatPeriodLabel,
  type AnalyticsOverview,
} from '@/lib/domain/analytics';
import { useAnalyticsOverviewQuery } from '@/hooks/use-analytics-overview';
import { buildDemoInvestorPortfolio, type DemoInvestorPortfolioSummary } from '@/lib/domain/demo-investor-portfolio';
import {
  buildDemoInvestorOverlay,
  fetchOwnershipOverlay,
  type OwnershipOverlay,
} from '@/lib/home-ownership';
import { fetchHomeSessionDerivedData } from '@/lib/chain/home-session-derived';
import type { HomeImpactSummary, HomeLiveSession } from '@/lib/domain/home-dashboard';

export interface HomeHeroPoint {
  label: string;
  periodLabel: string;
  value: number;
  rawKrw: bigint;
}

export interface HomeRegionChartBar {
  periodId: bigint;
  label: string;
  value: number;
  rawKrw: bigint | null;
  valueLabel: string;
  isLatest: boolean;
  isMissing: boolean;
  isPendingLike: boolean;
}

export type HomeRegionSummaryTone = 'sky' | 'emerald' | 'indigo' | 'neutral';

export interface HomeRegionSummaryItem {
  title: string;
  description: string;
  tone: HomeRegionSummaryTone;
}

export interface HomeRegionCardData {
  id: string;
  name: string;
  frontRevenueValue: string;
  frontRevenueLabel: string;
  frontCoverageValue: string;
  frontCoverageLabel: string;
  frontTrendEyebrow: string;
  backSummaryItems: HomeRegionSummaryItem[];
  chartData: HomeRegionChartBar[];
}

export interface HomeDashboardData {
  heroLabel: string;
  heroSubLabel: string;
  heroValue: number;
  heroChart: HomeHeroPoint[];
  latestPublishedPeriodLabel: string;
  latestPublishedValueLabel: string;
  ownershipOverlay: OwnershipOverlay;
  regionCards: HomeRegionCardData[];
  impact: HomeImpactSummary | null;
  liveSessions: HomeLiveSession[];
}

export interface HomeDashboardState {
  dashboard: HomeDashboardData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isFeedLoading: boolean;
  isRegionCardsLoading: boolean;
  isImpactLoading: boolean;
  errorMessage: string | null;
  refresh: () => void;
}

function formatWholePercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value)}%`;
}

function formatWholePercentFromBps(value: bigint | null) {
  if (value == null) {
    return null;
  }

  return formatWholePercent(Number(value) / 100);
}

function currentPeriodId(date = new Date()) {
  return BigInt(date.getFullYear() * 100 + date.getMonth() + 1);
}

function shiftPeriod(period: bigint, deltaMonths: number) {
  const raw = period.toString().padStart(6, '0');
  const year = Number(raw.slice(0, 4));
  const monthIndex = Number(raw.slice(4, 6)) - 1;
  const absoluteMonth = year * 12 + monthIndex + deltaMonths;
  const nextYear = Math.floor(absoluteMonth / 12);
  const nextMonth = (absoluteMonth % 12) + 1;

  return BigInt(nextYear * 100 + nextMonth);
}

function buildRecentPeriods(anchorPeriod: bigint, count = 6) {
  return Array.from({ length: count }, (_, index) => shiftPeriod(anchorPeriod, index - (count - 1)));
}

function buildInvestorHeroSeries(portfolio: DemoInvestorPortfolioSummary): HomeHeroPoint[] {
  return [...portfolio.payoutRecords]
    .reverse()
    .map((record) => ({
      label: record.periodLabel.split(' ')[0],
      periodLabel: record.periodLabel,
      value: Number(record.finalizedShareKrw),
      rawKrw: record.finalizedShareKrw,
    }));
}

function buildNetworkHeroSeries(overview: AnalyticsOverview): HomeHeroPoint[] {
  const totals = new Map<string, bigint>();

  for (const region of overview.regions) {
    for (const attestation of region.settlement.attestationHistory) {
      const key = attestation.period_yyyyMM.toString();
      totals.set(key, (totals.get(key) ?? 0n) + attestation.distributableKrw);
    }
  }

  return [...totals.entries()]
    .sort((left, right) => Number(BigInt(left[0]) - BigInt(right[0])))
    .slice(-7)
    .map(([period, amount]) => ({
      label: formatPeriodLabel(BigInt(period)).split(' ')[0],
      periodLabel: formatPeriodLabel(BigInt(period)),
      value: Number(amount),
      rawKrw: amount,
    }));
}

function buildFrontRevenueSummary(region: AnalyticsOverview['regions'][number]) {
  if (region.settlement.latestAttestation) {
    return {
      value: formatKrwShort(region.settlement.latestAttestation.distributableKrw),
      label: 'Latest monthly revenue',
    };
  }

  if (region.settlement.pendingRevenueKrw > 0n) {
    return {
      value: formatKrwShort(region.settlement.pendingRevenueKrw),
      label: 'Current pending revenue',
    };
  }

  return {
    value: 'Awaiting',
    label: 'Monthly revenue pending',
  };
}

function buildFrontCoverageSummary(region: AnalyticsOverview['regions'][number]) {
  const ratio = region.snapshot
    ? formatWholePercentFromBps(region.snapshot.trust.activeChargerRatioBps)
    : formatWholePercent(region.coverage.activeChargerRatio);

  if (ratio) {
    return {
      value: ratio,
      label: 'of chargers active',
    };
  }

  return {
    value: 'N/A',
    label: 'charger activity pending',
  };
}

function buildBackSummaryItems(region: AnalyticsOverview['regions'][number]): HomeRegionSummaryItem[] {
  const monthlyEvidence = region.settlement.latestAttestation
    ? `Published through ${formatPeriodLabel(region.settlement.latestAttestation.period_yyyyMM)}.`
    : region.snapshot
      ? `Snapshot published for ${formatPeriodLabel(region.snapshot.periodId)}; revenue finalization is still catching up.`
      : region.settlement.pendingRevenueKrw > 0n
        ? 'Revenue is accumulating while the first monthly publication is pending.'
        : 'Monthly evidence will appear after the first publication cycle.';

  const usagePattern = region.snapshot
    ? `Peak charging runs ${formatPeakWindow(region.snapshot.rhythm.peakStartHour, region.snapshot.rhythm.peakEndHour)}.`
    : 'Usage pattern will appear after the first monthly snapshot publishes.';

  const issuanceState = region.stoAddress
    ? `STO live with ${region.trancheCount} tranche${region.trancheCount === 1 ? '' : 's'}.`
    : 'Operational evidence only for now.';

  return [
    {
      title: 'Monthly evidence',
      description: monthlyEvidence,
      tone: 'sky',
    },
    {
      title: 'Usage pattern',
      description: usagePattern,
      tone: 'emerald',
    },
    {
      title: 'Issuance state',
      description: issuanceState,
      tone: 'indigo',
    },
  ];
}

function buildRegionChartData(region: AnalyticsOverview['regions'][number]): HomeRegionChartBar[] {
  const historyMap = new Map(
    region.settlement.attestationHistory.map((attestation) => [attestation.period_yyyyMM.toString(), attestation]),
  );
  const latestFinalizedPeriod = region.settlement.latestAttestation?.period_yyyyMM ?? null;
  const anchorPeriod = latestFinalizedPeriod ?? currentPeriodId();
  const periods = buildRecentPeriods(anchorPeriod, 6);
  const shouldUsePendingFallback = latestFinalizedPeriod == null && region.settlement.pendingRevenueKrw > 0n;

  return periods.map((period) => {
    const attestation = historyMap.get(period.toString());

    if (attestation) {
      return {
        periodId: period,
        label: formatPeriodLabel(period).split(' ')[0],
        value: Number(attestation.distributableKrw),
        rawKrw: attestation.distributableKrw,
        valueLabel: formatKrwShort(attestation.distributableKrw),
        isLatest: latestFinalizedPeriod != null && period === latestFinalizedPeriod,
        isMissing: false,
        isPendingLike: false,
      };
    }

    const isPendingFallbackSlot = shouldUsePendingFallback && period === anchorPeriod;
    if (isPendingFallbackSlot) {
      return {
        periodId: period,
        label: formatPeriodLabel(period).split(' ')[0],
        value: Number(region.settlement.pendingRevenueKrw),
        rawKrw: region.settlement.pendingRevenueKrw,
        valueLabel: formatKrwShort(region.settlement.pendingRevenueKrw),
        isLatest: true,
        isMissing: false,
        isPendingLike: true,
      };
    }

    return {
      periodId: period,
      label: formatPeriodLabel(period).split(' ')[0],
      value: 0,
      rawKrw: null,
      valueLabel: 'No data',
      isLatest: false,
      isMissing: true,
      isPendingLike: false,
    };
  });
}

function buildRegionTrendEyebrow(chartData: HomeRegionChartBar[]) {
  const availableSlots = chartData.filter((slot) => !slot.isMissing);

  if (availableSlots.some((slot) => slot.isPendingLike) && availableSlots.length <= 1) {
    return 'CURRENT REVENUE STATUS';
  }

  if (availableSlots.length <= 1) {
    return 'LATEST REVENUE POINT';
  }

  return '6-MONTH REVENUE FLOW';
}

function buildRegionCards(overview: AnalyticsOverview): HomeRegionCardData[] {
  return [...overview.regions]
    .sort((left, right) => {
      const leftOwnedPending = applyOwnedShare(left.settlement.pendingRevenueKrw, left.ownedShareBps);
      const rightOwnedPending = applyOwnedShare(right.settlement.pendingRevenueKrw, right.ownedShareBps);
      if (leftOwnedPending === rightOwnedPending) {
        return Number(right.demoBalance - left.demoBalance);
      }
      return Number(rightOwnedPending - leftOwnedPending);
    })
    .slice(0, 3)
    .map((region) => {
      const chartData = buildRegionChartData(region);
      const frontRevenue = buildFrontRevenueSummary(region);
      const frontCoverage = buildFrontCoverageSummary(region);

      return {
        id: region.code,
        name: region.name,
        frontRevenueValue: frontRevenue.value,
        frontRevenueLabel: frontRevenue.label,
        frontCoverageValue: frontCoverage.value,
        frontCoverageLabel: frontCoverage.label,
        frontTrendEyebrow: buildRegionTrendEyebrow(chartData),
        backSummaryItems: buildBackSummaryItems(region),
        chartData,
      };
    });
}

export function useHomeDashboard(): HomeDashboardState {
  const { overview, isLoading: overviewLoading, isRefreshing: overviewRefreshing, errorMessage, refresh: refreshOverview } = useAnalyticsOverviewQuery();
  const ownershipQuery = useQuery({
    queryKey: ['home-ownership-overlay'],
    queryFn: fetchOwnershipOverlay,
    staleTime: Infinity,
  });
  const sessionDerivedQuery = useQuery({
    queryKey: ['home-live-sessions'],
    queryFn: fetchHomeSessionDerivedData,
    refetchInterval: 30_000,
  });

  const dashboard = useMemo<HomeDashboardData | null>(() => {
    if (!overview) {
      return null;
    }

    const portfolio = buildDemoInvestorPortfolio(overview);
    const investorPortfolio = portfolio && portfolio.heldRegions > 0 ? portfolio : null;
    const ownershipOverlay = investorPortfolio
      ? buildDemoInvestorOverlay({
          holderLabel: 'Demo investor',
          holderAddress: investorPortfolio.holderAddress,
          shareBps: investorPortfolio.weightedShareBps,
          heldRegionCount: investorPortfolio.heldRegions,
          totalTokenUnits: investorPortfolio.totalTokenUnits,
        })
      : ownershipQuery.data ?? null;

    if (!ownershipOverlay) {
      return null;
    }

    const heroChart = investorPortfolio
      ? buildInvestorHeroSeries(investorPortfolio)
      : buildNetworkHeroSeries(overview);
    const latestPublishedPoint = heroChart[heroChart.length - 1] ?? null;

    return {
      heroLabel: 'Current month revenue',
      heroSubLabel: investorPortfolio
        ? 'Estimated investor share from live on-chain sessions still in progress, based on your holdings'
        : 'Live on-chain revenue from sessions still in progress across the network',
      heroValue: investorPortfolio
        ? Number(investorPortfolio.currentPendingRevenueShareKrw)
        : Number(overview.totalPendingRevenueKrw),
      heroChart,
      latestPublishedPeriodLabel: latestPublishedPoint?.periodLabel ?? 'No published month yet',
      latestPublishedValueLabel: latestPublishedPoint ? formatKrwShort(latestPublishedPoint.rawKrw) : 'Awaiting',
      ownershipOverlay,
      regionCards: buildRegionCards(overview),
      impact: sessionDerivedQuery.data?.impact ?? null,
      liveSessions: sessionDerivedQuery.data?.liveSessions ?? [],
    };
  }, [overview, ownershipQuery.data, sessionDerivedQuery.data]);

  const refresh = useCallback(() => {
    refreshOverview();
    void ownershipQuery.refetch();
    void sessionDerivedQuery.refetch();
  }, [ownershipQuery, refreshOverview, sessionDerivedQuery]);

  const hasRegionCards = (dashboard?.regionCards.length ?? 0) > 0;
  const isInitialLoading = dashboard == null && (overviewLoading || ownershipQuery.isPending || !overview);
  const isRegionCardsLoading = isInitialLoading && !hasRegionCards;
  const isImpactLoading = (isInitialLoading || sessionDerivedQuery.isPending) && !sessionDerivedQuery.data?.impact;

  return {
    dashboard,
    isLoading: isInitialLoading,
    isRefreshing: overviewRefreshing,
    isFeedLoading: sessionDerivedQuery.isPending || sessionDerivedQuery.isRefetching,
    isRegionCardsLoading,
    isImpactLoading,
    errorMessage,
    refresh,
  };
}
