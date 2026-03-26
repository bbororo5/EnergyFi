import { useMemo } from 'react';
import { demoInvestorAddress } from '@/constants/contracts';
import {
  applyOwnedShare,
  calculateOwnedShareBps,
  formatPeriodLabel,
  type AnalyticsOverview,
  type RegionEvidenceSummary,
  type RevenueAttestation,
} from '@/lib/domain/analytics';
import { useAnalyticsOverview } from '@/hooks/use-analytics-overview';

const payoutDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export type AccountPayoutStatus = 'Paid' | 'Scheduled' | 'Processing';

export interface AccountPayoutRecord {
  periodId: bigint;
  periodLabel: string;
  finalizedShareKrw: bigint;
  evidenceStatus: 'Published';
  evidencePublishedLabel: string;
  payoutStatus: AccountPayoutStatus;
  payoutDateLabel: string;
  partnerLabel: string;
  partnerNote: string;
  isDemo: boolean;
}

export interface DemoInvestorHolding {
  code: string;
  name: string;
  fullName: string;
  stoAddress: `0x${string}`;
  trancheCount: number;
  balance: bigint;
  totalSupply: bigint;
  ownedShareBps: number;
  latestFinalizedRevenueKrw: bigint | null;
  estimatedFinalizedMonthlyRevenueKrw: bigint;
  currentPendingRevenueShareKrw: bigint;
  latestTrancheTokenAmount: bigint | null;
  latestTrancheIssuedAt: bigint | null;
}

export interface DemoInvestorPortfolioSummary {
  holderAddress: `0x${string}`;
  heldRegions: number;
  totalTokenUnits: bigint;
  weightedShareBps: number | null;
  estimatedFinalizedMonthlyRevenueKrw: bigint;
  latestMonthlyShareKrw: bigint;
  currentPendingRevenueShareKrw: bigint;
  latestPayoutStatus: AccountPayoutStatus | null;
  payoutRecords: AccountPayoutRecord[];
  holdings: DemoInvestorHolding[];
}

function formatEvidencePublishedDate(finalizedAt: bigint | null) {
  if (!finalizedAt || finalizedAt <= 0n) {
    return 'Published on-chain';
  }

  return payoutDateFormatter.format(new Date(Number(finalizedAt) * 1000));
}

function buildPayoutDate(periodId: bigint) {
  const raw = periodId.toString().padStart(6, '0');
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));

  return payoutDateFormatter.format(new Date(year, month, 12));
}

function buildPayoutRecords(overview: AnalyticsOverview) {
  const periodTotals = new Map<string, {
    periodId: bigint;
    finalizedShareKrw: bigint;
    finalizedAt: bigint;
  }>();

  overview.regions.forEach((region) => {
    if (!region.stoAddress || region.demoBalance <= 0n || region.totalSupply <= 0n) {
      return;
    }

    const ownedShareBps = region.ownedShareBps ?? calculateOwnedShareBps(region.demoBalance, region.totalSupply) ?? 0;

    region.settlement.attestationHistory.forEach((attestation: RevenueAttestation) => {
      const finalizedShareKrw = applyOwnedShare(attestation.distributableKrw, ownedShareBps);

      if (finalizedShareKrw <= 0n) {
        return;
      }

      const key = attestation.period_yyyyMM.toString();
      const current = periodTotals.get(key);

      periodTotals.set(key, {
        periodId: attestation.period_yyyyMM,
        finalizedShareKrw: (current?.finalizedShareKrw ?? 0n) + finalizedShareKrw,
        finalizedAt: current ? (current.finalizedAt > attestation.finalizedAt ? current.finalizedAt : attestation.finalizedAt) : attestation.finalizedAt,
      });
    });
  });

  return [...periodTotals.values()]
    .sort((left, right) => Number(right.periodId - left.periodId))
    .slice(0, 6)
    .map((record, index): AccountPayoutRecord => {
      const payoutStatus: AccountPayoutStatus = index === 0 ? 'Scheduled' : 'Paid';

      return {
        periodId: record.periodId,
        periodLabel: formatPeriodLabel(record.periodId),
        finalizedShareKrw: record.finalizedShareKrw,
        evidenceStatus: 'Published',
        evidencePublishedLabel: formatEvidencePublishedDate(record.finalizedAt),
        payoutStatus,
        payoutDateLabel: buildPayoutDate(record.periodId),
        partnerLabel: 'Demo partner timeline',
        partnerNote: payoutStatus === 'Scheduled'
          ? 'Demo payout is scheduled after the monthly record is published.'
          : 'Demo payout is shown as completed on the partner timeline.',
        isDemo: true,
      };
    });
}

function buildHolding(region: RegionEvidenceSummary): DemoInvestorHolding | null {
  if (!region.stoAddress || region.demoBalance <= 0n || region.totalSupply <= 0n) {
    return null;
  }

  const ownedShareBps = region.ownedShareBps ?? calculateOwnedShareBps(region.demoBalance, region.totalSupply) ?? 0;
  const latestFinalizedRevenueKrw = region.settlement.latestAttestation?.distributableKrw ?? null;

  return {
    code: region.code,
    name: region.name,
    fullName: region.fullName,
    stoAddress: region.stoAddress,
    trancheCount: region.trancheCount,
    balance: region.demoBalance,
    totalSupply: region.totalSupply,
    ownedShareBps,
    latestFinalizedRevenueKrw,
    estimatedFinalizedMonthlyRevenueKrw: latestFinalizedRevenueKrw ? applyOwnedShare(latestFinalizedRevenueKrw, ownedShareBps) : 0n,
    currentPendingRevenueShareKrw: applyOwnedShare(region.settlement.pendingRevenueKrw, ownedShareBps),
    latestTrancheTokenAmount: region.latestTranche?.tokenAmount ?? null,
    latestTrancheIssuedAt: region.latestTranche?.issuedAt ?? null,
  };
}

export function buildDemoInvestorPortfolio(overview: AnalyticsOverview | null): DemoInvestorPortfolioSummary | null {
  if (!overview) {
    return null;
  }

  const holdings = overview.regions
      .map(buildHolding)
      .filter((value): value is DemoInvestorHolding => Boolean(value))
      .sort((left, right) => {
        if (left.currentPendingRevenueShareKrw === right.currentPendingRevenueShareKrw) {
          return Number(right.balance - left.balance);
        }
        return Number(right.currentPendingRevenueShareKrw - left.currentPendingRevenueShareKrw);
      });

  const totalTokenUnits = holdings.reduce((sum, holding) => sum + holding.balance, 0n);
  const aggregateSupply = holdings.reduce((sum, holding) => sum + holding.totalSupply, 0n);
  const payoutRecords = buildPayoutRecords(overview);
  const latestMonthlyShareKrw = payoutRecords[0]?.finalizedShareKrw ?? 0n;

  return {
    holderAddress: demoInvestorAddress,
    heldRegions: holdings.length,
    totalTokenUnits,
    weightedShareBps: aggregateSupply > 0n ? calculateOwnedShareBps(totalTokenUnits, aggregateSupply) : null,
    estimatedFinalizedMonthlyRevenueKrw: holdings.reduce((sum, holding) => sum + holding.estimatedFinalizedMonthlyRevenueKrw, 0n),
    latestMonthlyShareKrw,
    currentPendingRevenueShareKrw: holdings.reduce((sum, holding) => sum + holding.currentPendingRevenueShareKrw, 0n),
    latestPayoutStatus: payoutRecords[0]?.payoutStatus ?? null,
    payoutRecords,
    holdings,
  };
}

export function useDemoInvestorPortfolio() {
  const analytics = useAnalyticsOverview();
  const portfolio = useMemo<DemoInvestorPortfolioSummary | null>(() => buildDemoInvestorPortfolio(analytics.overview), [analytics.overview]);

  return {
    ...analytics,
    portfolio,
  };
}
