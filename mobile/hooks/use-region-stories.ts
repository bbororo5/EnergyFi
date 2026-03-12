import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { colors } from '@/constants/theme';
import {
  energyfiChain,
  energyfiRpcUrl,
  hasLiveReputationRegistry,
  reputationGranularity,
  reputationRegistryAddress,
} from '@/constants/contracts';
import { regionCatalog, type RegionCatalogEntry } from '@/data/regions';
import { reputationRegistryAbi } from '@/generated/reputation-registry';
import {
  normalizeReputationSnapshot,
  type ReputationSnapshot as Snapshot,
  type ReputationSnapshotInput,
} from '@/lib/reputation-snapshot';

const siteType = {
  unknown: 0,
  residential: 1,
  workplace: 2,
  publicCommercial: 3,
  mixed: 4,
} as const;

const client = createPublicClient({
  chain: energyfiChain,
  transport: http(energyfiRpcUrl),
});

export type ExploreFilterValue =
  | 'all'
  | 'published'
  | 'awaiting'
  | 'residential'
  | 'workplace'
  | 'public-commercial'
  | 'mixed';

type ChipTone = 'trust' | 'rhythm' | 'site';

export interface RegionStoryChip {
  axis: 'trust' | 'rhythm' | 'site';
  tone: ChipTone;
  label: string;
  detail: string;
}

export interface RegionStoryMetric {
  label: string;
  value: string;
  accentColor: string;
}

export interface RegionStoryCardData {
  code: string;
  regionId: `0x${string}`;
  name: string;
  fullName: string;
  summary: string;
  changeSummary: string;
  periodLabel: string;
  updatedLabel: string;
  published: boolean;
  primarySiteFilter: ExploreFilterValue;
  chips: RegionStoryChip[];
  metrics: RegionStoryMetric[];
}

function toPercent(valueBps: number) {
  return `${(valueBps / 100).toFixed(0)}%`;
}

function toMetricPercent(valueBps: number) {
  return `${(valueBps / 100).toFixed(1)}%`;
}

function formatPeriodLabel(periodId: bigint) {
  const raw = periodId.toString();
  const year = raw.slice(0, 4);
  const month = Number(raw.slice(4, 6));
  const label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(Number(year), month - 1, 1));
  return `${label} ${year}`;
}

function formatRelativeTime(updatedAt: bigint) {
  const now = Date.now();
  const timestamp = Number(updatedAt) * 1000;
  const diffMinutes = Math.max(1, Math.round((now - timestamp) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatPeakWindow(start: number, end: number) {
  const fmt = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;
  return `${fmt(start)}-${fmt(end)} KST`;
}

function signedDelta(nextValue: number, prevValue: number, unit: 'sessions' | 'pp') {
  const delta = nextValue - prevValue;
  const prefix = delta > 0 ? '+' : '';
  if (unit === 'sessions') {
    return `${prefix}${delta.toLocaleString()} sessions`;
  }
  return `${prefix}${(delta / 100).toFixed(1)}pp`;
}

function resolvePrimarySiteFilter(primaryType: number): ExploreFilterValue {
  switch (primaryType) {
    case siteType.residential:
      return 'residential';
    case siteType.workplace:
      return 'workplace';
    case siteType.publicCommercial:
      return 'public-commercial';
    case siteType.mixed:
      return 'mixed';
    default:
      return 'awaiting';
  }
}

function resolveDominantSiteLabel(snapshot: Snapshot) {
  const primaryType = Number(snapshot.site.primaryType);

  switch (primaryType) {
    case siteType.residential:
      return {
        label: 'Residential-heavy demand',
        detail: `Residential sites ${toPercent(Number(snapshot.site.residentialBps))} of the mix`,
      };
    case siteType.workplace:
      return {
        label: 'Workplace corridor',
        detail: `Workplace sites ${toPercent(Number(snapshot.site.workplaceBps))} of the mix`,
      };
    case siteType.publicCommercial:
      return {
        label: 'Public-commercial pull',
        detail: `Public-commercial sites ${toPercent(Number(snapshot.site.publicCommercialBps))} of the mix`,
      };
    case siteType.mixed:
      return {
        label: 'Balanced everyday mix',
        detail: `Mixed-use sites ${toPercent(Number(snapshot.site.mixedBps))} of the mix`,
      };
    default:
      return {
        label: 'Site mix pending',
        detail: 'Site composition not yet published',
      };
  }
}

function resolvePeakLabel(snapshot: Snapshot) {
  const peakStartHour = Number(snapshot.rhythm.peakStartHour);
  const peakEndHour = Number(snapshot.rhythm.peakEndHour);

  if (peakStartHour > peakEndHour) {
    return 'Overnight residential rhythm';
  }
  if (peakStartHour >= 17 && peakEndHour <= 23) {
    return 'Evening commuter rhythm';
  }
  if (peakStartHour >= 6 && peakEndHour <= 11) {
    return 'Morning workplace rhythm';
  }
  if (peakStartHour >= 11 && peakEndHour <= 16) {
    return 'Midday visitor rhythm';
  }
  return 'All-day charging cadence';
}

function buildPublishedStory(region: RegionCatalogEntry, snapshot: Snapshot, previous: Snapshot | null): RegionStoryCardData {
  const siteStory = resolveDominantSiteLabel(snapshot);
  const trustChip: RegionStoryChip = {
    axis: 'trust',
    tone: 'trust',
    label:
      Number(snapshot.trust.maintenanceResolutionRateBps) >= 8600 && Number(snapshot.trust.settlementContinuityBps) >= 9400
        ? 'High maintenance discipline'
        : 'Operationally steady',
    detail: `${toPercent(Number(snapshot.trust.activeChargerRatioBps))} active chargers · ${toPercent(Number(snapshot.trust.maintenanceResolutionRateBps))} maintenance resolution`,
  };

  const rhythmChip: RegionStoryChip = {
    axis: 'rhythm',
    tone: 'rhythm',
    label: resolvePeakLabel(snapshot),
    detail: `${snapshot.rhythm.sessionVolume.toLocaleString()} sessions · ${toPercent(Number(snapshot.rhythm.revenueStabilityBps))} revenue stability`,
  };

  const siteChip: RegionStoryChip = {
    axis: 'site',
    tone: 'site',
    label: siteStory.label,
    detail: siteStory.detail,
  };

  const peakStartHour = Number(snapshot.rhythm.peakStartHour);
  const peakEndHour = Number(snapshot.rhythm.peakEndHour);
  const changeSummary = previous
    ? `${signedDelta(Number(snapshot.rhythm.sessionVolume), Number(previous.rhythm.sessionVolume), 'sessions')} vs ${formatPeriodLabel(previous.periodId)} · ${signedDelta(Number(snapshot.trust.activeChargerRatioBps), Number(previous.trust.activeChargerRatioBps), 'pp')} charger activity`
    : 'Latest monthly snapshot published on-chain';

  return {
    code: region.code,
    regionId: region.regionId,
    name: region.name,
    fullName: region.fullName,
    summary: `${region.name} reads as ${siteStory.label.toLowerCase()} with ${toPercent(Number(snapshot.trust.settlementContinuityBps))} settlement continuity and a ${formatPeakWindow(peakStartHour, peakEndHour)} peak window.`,
    changeSummary,
    periodLabel: formatPeriodLabel(snapshot.periodId),
    updatedLabel: formatRelativeTime(snapshot.updatedAt),
    published: true,
    primarySiteFilter: resolvePrimarySiteFilter(Number(snapshot.site.primaryType)),
    chips: [trustChip, rhythmChip, siteChip],
    metrics: [
      {
        label: 'Active Chargers',
        value: toMetricPercent(Number(snapshot.trust.activeChargerRatioBps)),
        accentColor: colors.emerald400,
      },
      {
        label: 'Settlement',
        value: toMetricPercent(Number(snapshot.trust.settlementContinuityBps)),
        accentColor: colors.sky400,
      },
      {
        label: 'Sessions',
        value: snapshot.rhythm.sessionVolume.toLocaleString(),
        accentColor: colors.indigo400,
      },
    ],
  };
}

function buildFallbackStory(region: RegionCatalogEntry): RegionStoryCardData {
  return {
    code: region.code,
    regionId: region.regionId,
    name: region.name,
    fullName: region.fullName,
    summary: 'Data not yet published. This card will populate after the STRIKON bridge publishes a monthly region reputation snapshot.',
    changeSummary: 'Awaiting first monthly publication',
    periodLabel: 'No snapshot',
    updatedLabel: 'Pending',
    published: false,
    primarySiteFilter: 'awaiting',
    chips: [],
    metrics: [
      { label: 'Trust', value: 'Pending', accentColor: colors.textMuted },
      { label: 'Rhythm', value: 'Pending', accentColor: colors.textMuted },
      { label: 'Site Mix', value: 'Pending', accentColor: colors.textMuted },
    ],
  };
}

async function readLatestSnapshot(regionId: `0x${string}`) {
  const snapshot = await client.readContract({
    address: reputationRegistryAddress,
    abi: reputationRegistryAbi,
    functionName: 'getLatestRegionSnapshot',
    args: [regionId, reputationGranularity.monthly],
  });
  return normalizeReputationSnapshot(snapshot as ReputationSnapshotInput);
}

async function readSnapshotPeriods(regionId: `0x${string}`) {
  return client.readContract({
    address: reputationRegistryAddress,
    abi: reputationRegistryAbi,
    functionName: 'getRegionSnapshotPeriods',
    args: [regionId, reputationGranularity.monthly],
  }) as Promise<readonly bigint[]>;
}

async function readSnapshot(regionId: `0x${string}`, periodId: bigint) {
  const snapshot = await client.readContract({
    address: reputationRegistryAddress,
    abi: reputationRegistryAbi,
    functionName: 'getRegionSnapshot',
    args: [regionId, reputationGranularity.monthly, periodId],
  });
  return normalizeReputationSnapshot(snapshot as ReputationSnapshotInput);
}

export function useRegionStories() {
  const [stories, setStories] = useState<RegionStoryCardData[]>(regionCatalog.map(buildFallbackStory));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStories = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    if (!hasLiveReputationRegistry) {
      setStories(regionCatalog.map(buildFallbackStory));
      setErrorMessage('ReputationRegistry address is not configured yet.');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const latestResults = await Promise.all(
        regionCatalog.map(async (region) => {
          try {
            const latest = await readLatestSnapshot(region.regionId);
            return { region, latest };
          } catch {
            return { region, latest: null as Snapshot | null };
          }
        }),
      );

      const nextStories = await Promise.all(
        latestResults.map(async ({ region, latest }) => {
          if (!latest) {
            return buildFallbackStory(region);
          }

          try {
            const periods = await readSnapshotPeriods(region.regionId);
            const previousPeriodId = periods.length > 1 ? periods[periods.length - 2] : null;
            const previous = previousPeriodId ? await readSnapshot(region.regionId, previousPeriodId) : null;
            return buildPublishedStory(region, latest, previous);
          } catch {
            return buildPublishedStory(region, latest, null);
          }
        }),
      );

      setStories(nextStories);
      setErrorMessage(null);
    } catch (error) {
      console.warn('Failed to load region stories from ReputationRegistry', error);
      setStories(regionCatalog.map(buildFallbackStory));
      setErrorMessage('Failed to read ReputationRegistry. Showing neutral fallback cards.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStories();

    const timer = setInterval(() => {
      void loadStories(true);
    }, 60000);

    return () => clearInterval(timer);
  }, [loadStories]);

  const publishedCount = stories.filter((story) => story.published).length;
  const latestPublishedPeriod = stories.find((story) => story.published)?.periodLabel ?? 'No snapshot';

  return {
    stories,
    isLoading,
    isRefreshing,
    errorMessage,
    publishedCount,
    latestPublishedPeriod,
    refresh: () => loadStories(true),
  };
}
