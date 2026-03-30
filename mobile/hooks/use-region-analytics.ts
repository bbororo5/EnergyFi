import { useMemo } from 'react';
import {
  formatKrwShort,
  formatPeriodLabel,
  type RegionEvidenceSummary,
} from '@/lib/domain/analytics';
import { useAnalyticsOverviewQuery } from '@/hooks/use-analytics-overview';
import { regionCatalog } from '@/data/regions';

type RegionNarrativeTone = 'sky' | 'emerald' | 'indigo' | 'neutral';

export interface RegionNarrativeItem {
  title: string;
  description: string;
  tone: RegionNarrativeTone;
}

export interface RegionHeroSupportItem {
  label: string;
  value: string;
  tone: RegionNarrativeTone;
}

export interface RegionAnalyticsNarratives {
  heroRevenueLabel: string;
  heroRevenueValue: string;
  heroSupportItems: RegionHeroSupportItem[];
  trustItems: RegionNarrativeItem[];
  rhythmNarrative: string;
  siteNarrativeLabel: string;
  siteNarrativeShortLabel: string;
  siteNarrativeBody: string;
  issuanceNarrative: string;
}

export interface RegionAnalyticsDetail extends RegionEvidenceSummary {
  narratives: RegionAnalyticsNarratives;
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

function buildHeroRevenue(region: RegionEvidenceSummary) {
  if (region.settlement.latestAttestation) {
    return {
      label: 'Latest monthly revenue',
      value: formatKrwShort(region.settlement.latestAttestation.distributableKrw),
    };
  }

  if (region.settlement.pendingRevenueKrw > 0n) {
    return {
      label: 'Current pending revenue',
      value: formatKrwShort(region.settlement.pendingRevenueKrw),
    };
  }

  return {
    label: 'Monthly revenue status',
    value: 'Awaiting',
  };
}

function buildHeroSupportItems(region: RegionEvidenceSummary): RegionHeroSupportItem[] {
  const chargerActivity = region.snapshot
    ? formatWholePercentFromBps(region.snapshot.trust.activeChargerRatioBps)
    : formatWholePercent(region.coverage.activeChargerRatio);

  const evidencePeriod = region.snapshot
    ? formatPeriodLabel(region.snapshot.periodId)
    : region.settlement.latestAttestation
      ? formatPeriodLabel(region.settlement.latestAttestation.period_yyyyMM)
      : null;

  return [
    {
      label: 'Charger activity',
      value: chargerActivity ? `${chargerActivity} of chargers active` : 'Charger activity pending',
      tone: 'emerald',
    },
    {
      label: 'Monthly evidence',
      value: evidencePeriod ? `Published for ${evidencePeriod}` : 'Not published yet',
      tone: 'sky',
    },
    {
      label: 'Issuance',
      value: region.stoAddress ? `STO live · ${region.trancheCount} tranches` : 'Operational evidence only',
      tone: 'indigo',
    },
  ];
}

function buildTrustItems(region: RegionEvidenceSummary): RegionNarrativeItem[] {
  const chipCoverage = formatWholePercent(region.coverage.chipCoverageRatio);
  const hardwareDescription = chipCoverage
    ? `${chipCoverage} of chargers currently report through active secure hardware.`
    : region.coverage.activeChipCount > 0
      ? `${region.coverage.activeChipCount} active secure chips are currently publishing charger data.`
      : 'Secure hardware session evidence is still coming online for this region.';

  const revenueDescription = region.settlement.latestAttestation
    ? `Revenue evidence is published through ${formatPeriodLabel(region.settlement.latestAttestation.period_yyyyMM)}.`
    : region.settlement.pendingRevenueKrw > 0n
      ? `${formatKrwShort(region.settlement.pendingRevenueKrw)} is accumulating ahead of the first published month.`
      : 'Revenue evidence will appear after the first charging sessions settle.';

  const snapshotDescription = region.snapshot
    ? `Operational snapshot published for ${formatPeriodLabel(region.snapshot.periodId)}.`
    : 'The first monthly operational snapshot has not been published yet.';

  return [
    {
      title: 'Hardware-verified sessions',
      description: hardwareDescription,
      tone: 'emerald',
    },
    {
      title: 'Revenue evidence',
      description: revenueDescription,
      tone: 'sky',
    },
    {
      title: 'Monthly snapshot',
      description: snapshotDescription,
      tone: 'indigo',
    },
  ];
}

function resolvePeakNarrative(region: RegionEvidenceSummary) {
  if (!region.snapshot) {
    return 'A usage narrative will appear after the first monthly snapshot is published.';
  }

  const peakStartHour = Number(region.snapshot.rhythm.peakStartHour);
  const peakEndHour = Number(region.snapshot.rhythm.peakEndHour);
  const stabilityBps = Number(region.snapshot.rhythm.revenueStabilityBps);

  let peakNarrative = 'Usage is spread across the day';
  if (peakStartHour > peakEndHour || peakStartHour >= 21 || peakEndHour <= 6) {
    peakNarrative = 'Usage leans overnight';
  } else if (peakStartHour >= 17) {
    peakNarrative = 'Usage peaks in the evening';
  } else if (peakStartHour >= 11 && peakEndHour <= 16) {
    peakNarrative = 'Usage concentrates around midday';
  } else if (peakStartHour >= 6 && peakEndHour <= 11) {
    peakNarrative = 'Usage concentrates before work hours';
  }

  let stabilityNarrative = 'revenue is still moving month to month';
  if (stabilityBps >= 8_500) {
    stabilityNarrative = 'revenue has stayed relatively stable';
  } else if (stabilityBps >= 7_000) {
    stabilityNarrative = 'revenue shows a repeatable monthly pattern';
  }

  return `${peakNarrative} and ${stabilityNarrative}.`;
}

function buildSiteNarrative(region: RegionEvidenceSummary) {
  if (!region.snapshot) {
    return {
      label: 'Pattern not published',
      shortLabel: 'Pending',
      body: 'This region will read more clearly once the first monthly site mix snapshot is published.',
    };
  }

  const residential = Math.round(Number(region.snapshot.site.residentialBps) / 100);
  const workplace = Math.round(Number(region.snapshot.site.workplaceBps) / 100);
  const publicCommercial = Math.round(Number(region.snapshot.site.publicCommercialBps) / 100);
  const mixed = Math.round(Number(region.snapshot.site.mixedBps) / 100);

  switch (Number(region.snapshot.site.primaryType)) {
    case 1:
      return {
        label: 'Residential-led mix',
        shortLabel: 'Res-led',
        body: `Residential charging makes up the largest published share at ${residential}% of the current mix.`,
      };
    case 2:
      return {
        label: 'Workplace-led mix',
        shortLabel: 'Work-led',
        body: `Workplace demand leads the published mix at ${workplace}% of the region profile.`,
      };
    case 3:
      return {
        label: 'Public-commercial mix',
        shortLabel: 'Public',
        body: `Public and commercial demand is the strongest published signal at ${publicCommercial}% of the current mix.`,
      };
    case 4:
      return {
        label: 'Mixed region pattern',
        shortLabel: 'Mixed',
        body: `No single site pattern dominates this region. The latest mix reads ${mixed}% mixed, ${residential}% residential, and ${workplace}% workplace.`,
      };
    default:
      return {
        label: 'Pattern not published',
        shortLabel: 'Pending',
        body: 'The site mix classification will appear after the next monthly publication cycle.',
      };
  }
}

function buildIssuanceNarrative(region: RegionEvidenceSummary) {
  if (!region.stoAddress) {
    return 'No region STO contract is deployed yet. Read this region as operational evidence only.';
  }

  const trancheAmount = region.latestTranche?.tokenAmount.toLocaleString() ?? '0';
  return `STO is live with ${region.trancheCount} tranche${region.trancheCount === 1 ? '' : 's'} and ${trancheAmount} units in the latest tranche.`;
}

function buildNarratives(region: RegionEvidenceSummary): RegionAnalyticsNarratives {
  const heroRevenue = buildHeroRevenue(region);
  const siteNarrative = buildSiteNarrative(region);

  return {
    heroRevenueLabel: heroRevenue.label,
    heroRevenueValue: heroRevenue.value,
    heroSupportItems: buildHeroSupportItems(region),
    trustItems: buildTrustItems(region),
    rhythmNarrative: resolvePeakNarrative(region),
    siteNarrativeLabel: siteNarrative.label,
    siteNarrativeShortLabel: siteNarrative.shortLabel,
    siteNarrativeBody: siteNarrative.body,
    issuanceNarrative: buildIssuanceNarrative(region),
  };
}

export function useRegionAnalytics(regionCode: string | undefined) {
  const { overview, isLoading, isRefreshing, errorMessage, refresh } = useAnalyticsOverviewQuery();
  const detail = useMemo<RegionAnalyticsDetail | null>(() => {
    const normalized = regionCode?.toUpperCase();
    if (!normalized || !overview) {
      return null;
    }

    const nextDetail = overview.regions.find((region) => region.code === normalized) ?? null;
    return nextDetail ? { ...nextDetail, narratives: buildNarratives(nextDetail) } : null;
  }, [overview, regionCode]);

  const regionMeta = regionCatalog.find((region) => region.code === regionCode?.toUpperCase()) ?? null;

  return {
    detail,
    regionMeta,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  };
}
