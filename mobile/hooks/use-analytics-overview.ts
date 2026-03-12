import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { colors } from '@/constants/theme';
import {
  energyfiChain,
  energyfiRpcUrl,
  chargeTransactionAddress,
  deviceRegistryAddress,
  hasLiveRegionStoFactory,
  hasLiveReputationRegistry,
  regionStoFactoryAddress,
  reputationGranularity,
  reputationRegistryAddress,
  revenueTrackerAddress,
  stationRegistryAddress,
  zeroAddress,
} from '@/constants/contracts';
import { regionCatalog, type RegionCatalogEntry } from '@/data/regions';
import {
  chargeTransactionAbi,
  deviceRegistryAbi,
  regionStoAbi,
  regionStoFactoryAbi,
  revenueTrackerAbi,
  stationRegistryAbi,
} from '@/lib/analytics-contracts';
import {
  normalizeReputationSnapshot,
  type ReputationSnapshot,
  type ReputationSnapshotInput,
} from '@/lib/reputation-snapshot';
import { reputationRegistryAbi } from '@/generated/reputation-registry';

const analyticsClient = createPublicClient({
  chain: energyfiChain,
  transport: http(energyfiRpcUrl),
});

export type RevenueAttestation = {
  regionId: `0x${string}`;
  period_yyyyMM: bigint;
  distributableKrw: bigint;
  stationCount: bigint;
  finalizedAt: bigint;
};

export interface RegionOperationalCoverage {
  stationCount: number;
  activeStationCount: number;
  chargerCount: number;
  activeChargerCount: number;
  activeChipCount: number;
  activeChargerRatio: number | null;
  chipCoverageRatio: number | null;
}

export interface RegionSettlementProof {
  pendingRevenueKrw: bigint;
  latestAttestation: RevenueAttestation | null;
  attestationPeriods: bigint[];
  attestationHistory: RevenueAttestation[];
}

export interface RegionEvidenceSummary {
  code: string;
  regionId: `0x${string}`;
  name: string;
  fullName: string;
  snapshot: ReputationSnapshot | null;
  previousSnapshot: ReputationSnapshot | null;
  settlement: RegionSettlementProof;
  coverage: RegionOperationalCoverage;
  stoAddress: `0x${string}` | null;
  trancheCount: number;
  latestTrancheActiveStations: { activeCount: number; totalCount: number } | null;
  attention: string[];
}

export interface AnalyticsOverview {
  totalSessions: number | null;
  publishedRegions: number;
  liveStoRegions: number;
  latestSettlementPeriodLabel: string;
  totalPendingRevenueKrw: bigint;
  aggregateStations: number;
  aggregateActiveStations: number;
  aggregateChargers: number;
  aggregateActiveChargers: number;
  aggregateActiveChipCoverage: number | null;
  regions: RegionEvidenceSummary[];
  attention: Array<{ regionCode: string; message: string; tone: 'warning' | 'info' }>;
}

export function formatPeriodLabel(periodId: bigint | null) {
  if (!periodId) {
    return 'Not finalized';
  }

  const raw = periodId.toString();
  const year = raw.slice(0, 4);
  const month = Number(raw.slice(4, 6));
  const label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(Number(year), month - 1, 1));
  return `${label} ${year}`;
}

export function formatKrwShort(value: bigint) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 'N/A';
  }
  if (numeric >= 1_000_000_000) {
    return `₩${(numeric / 1_000_000_000).toFixed(1)}B`;
  }
  if (numeric >= 1_000_000) {
    return `₩${(numeric / 1_000_000).toFixed(1)}M`;
  }
  if (numeric >= 1_000) {
    return `₩${Math.round(numeric / 1_000)}K`;
  }
  return `₩${numeric.toLocaleString('ko-KR')}`;
}

export function formatPercentFromBps(value: bigint | null) {
  if (value == null) {
    return 'N/A';
  }
  return `${(Number(value) / 100).toFixed(1)}%`;
}

export function formatPeakWindow(start: bigint | null, end: bigint | null) {
  if (start == null || end == null) {
    return 'Not published';
  }
  const s = Number(start).toString().padStart(2, '0');
  const e = Number(end).toString().padStart(2, '0');
  return `${s}:00-${e}:00`;
}

export function siteTypeLabel(primaryType: number | null) {
  switch (primaryType ?? -1) {
    case 1:
      return 'Residential';
    case 2:
      return 'Workplace';
    case 3:
      return 'Public-Commercial';
    case 4:
      return 'Mixed';
    default:
      return 'Not published';
  }
}

async function readTotalSessions() {
  try {
    const total = await analyticsClient.readContract({
      address: chargeTransactionAddress,
      abi: chargeTransactionAbi,
      functionName: 'totalSessions',
    });

    return Number(total);
  } catch {
    return null;
  }
}

async function readSettlement(regionId: `0x${string}`): Promise<RegionSettlementProof> {
  try {
    const [pendingRevenueKrw, attestationPeriodsRaw] = await Promise.all([
      analyticsClient.readContract({
        address: revenueTrackerAddress,
        abi: revenueTrackerAbi,
        functionName: 'getRegionRevenue',
        args: [regionId],
      }),
      analyticsClient.readContract({
        address: revenueTrackerAddress,
        abi: revenueTrackerAbi,
        functionName: 'getRegionAttestationPeriods',
        args: [regionId],
      }),
    ]);

    const attestationPeriods = [...attestationPeriodsRaw] as bigint[];
    const latestPeriod = attestationPeriods.length > 0 ? attestationPeriods[attestationPeriods.length - 1] : null;
    const attestationHistory = await Promise.all(
      attestationPeriods.map(async (period) => (
        analyticsClient.readContract({
          address: revenueTrackerAddress,
          abi: revenueTrackerAbi,
          functionName: 'getRegionAttestation',
          args: [regionId, period],
        })
      )),
    ) as RevenueAttestation[];

    const latestAttestation = latestPeriod
      ? attestationHistory[attestationHistory.length - 1]
      : null;

    return {
      pendingRevenueKrw,
      latestAttestation,
      attestationPeriods,
      attestationHistory,
    };
  } catch {
    return {
      pendingRevenueKrw: 0n,
      latestAttestation: null,
      attestationPeriods: [],
      attestationHistory: [],
    };
  }
}

async function readSnapshot(regionId: `0x${string}`) {
  if (!hasLiveReputationRegistry) {
    return { snapshot: null, previousSnapshot: null };
  }

  try {
    const latestRaw = await analyticsClient.readContract({
      address: reputationRegistryAddress,
      abi: reputationRegistryAbi,
      functionName: 'getLatestRegionSnapshot',
      args: [regionId, reputationGranularity.monthly],
    });
    const latest = normalizeReputationSnapshot(latestRaw as ReputationSnapshotInput);

    const periods = (await analyticsClient.readContract({
      address: reputationRegistryAddress,
      abi: reputationRegistryAbi,
      functionName: 'getRegionSnapshotPeriods',
      args: [regionId, reputationGranularity.monthly],
    })) as bigint[];

    const previousPeriod = periods.length > 1 ? periods[periods.length - 2] : null;
    const previousSnapshot = previousPeriod
      ? normalizeReputationSnapshot((await analyticsClient.readContract({
          address: reputationRegistryAddress,
          abi: reputationRegistryAbi,
          functionName: 'getRegionSnapshot',
          args: [regionId, reputationGranularity.monthly, previousPeriod],
        })) as ReputationSnapshotInput)
      : null;

    return { snapshot: latest, previousSnapshot };
  } catch {
    return { snapshot: null, previousSnapshot: null };
  }
}

async function readCoverage(regionId: `0x${string}`): Promise<RegionOperationalCoverage> {
  try {
    const stationIds = (await analyticsClient.readContract({
      address: stationRegistryAddress,
      abi: stationRegistryAbi,
      functionName: 'getStationsByRegion',
      args: [regionId],
    })) as `0x${string}`[];

    const stations = await Promise.all(
      stationIds.map(async (stationId) => {
        const station = await analyticsClient.readContract({
          address: stationRegistryAddress,
          abi: stationRegistryAbi,
          functionName: 'getStation',
          args: [stationId],
        });

        const chargerIds = (await analyticsClient.readContract({
          address: stationRegistryAddress,
          abi: stationRegistryAbi,
          functionName: 'getChargersByStation',
          args: [stationId],
        })) as `0x${string}`[];

        const chargers = await Promise.all(
          chargerIds.map(async (chargerId) => {
            const [charger, activeChip] = await Promise.all([
              analyticsClient.readContract({
                address: stationRegistryAddress,
                abi: stationRegistryAbi,
                functionName: 'getCharger',
                args: [chargerId],
              }),
              analyticsClient.readContract({
                address: deviceRegistryAddress,
                abi: deviceRegistryAbi,
                functionName: 'isActiveChip',
                args: [chargerId],
              }),
            ]);

            return {
              active: charger.active,
              activeChip,
            };
          }),
        );

        return {
          active: station.active,
          chargers,
        };
      }),
    );

    const stationCount = stations.length;
    const activeStationCount = stations.filter((station) => station.active).length;
    const chargerCount = stations.reduce((sum, station) => sum + station.chargers.length, 0);
    const activeChargerCount = stations.reduce(
      (sum, station) => sum + station.chargers.filter((charger) => charger.active).length,
      0,
    );
    const activeChipCount = stations.reduce(
      (sum, station) => sum + station.chargers.filter((charger) => charger.activeChip).length,
      0,
    );

    return {
      stationCount,
      activeStationCount,
      chargerCount,
      activeChargerCount,
      activeChipCount,
      activeChargerRatio: chargerCount > 0 ? (activeChargerCount / chargerCount) * 100 : null,
      chipCoverageRatio: chargerCount > 0 ? (activeChipCount / chargerCount) * 100 : null,
    };
  } catch {
    return {
      stationCount: 0,
      activeStationCount: 0,
      chargerCount: 0,
      activeChargerCount: 0,
      activeChipCount: 0,
      activeChargerRatio: null,
      chipCoverageRatio: null,
    };
  }
}

async function readStoReadiness(regionId: `0x${string}`) {
  if (!hasLiveRegionStoFactory) {
    return {
      stoAddress: null,
      trancheCount: 0,
      latestTrancheActiveStations: null,
    };
  }

  try {
    const stoAddress = (await analyticsClient.readContract({
      address: regionStoFactoryAddress,
      abi: regionStoFactoryAbi,
      functionName: 'getRegionToken',
      args: [regionId],
    })) as `0x${string}`;

    if (!stoAddress || stoAddress === zeroAddress) {
      return {
        stoAddress: null,
        trancheCount: 0,
        latestTrancheActiveStations: null,
      };
    }

    const trancheCountRaw = await analyticsClient.readContract({
      address: stoAddress,
      abi: regionStoAbi,
      functionName: 'getTrancheCount',
    });
    const trancheCount = Number(trancheCountRaw);

    const latestTrancheActiveStations = trancheCount > 0
      ? await analyticsClient.readContract({
          address: stoAddress,
          abi: regionStoAbi,
          functionName: 'getTrancheActiveStations',
          args: [BigInt(trancheCount)],
        })
      : null;

    return {
      stoAddress,
      trancheCount,
      latestTrancheActiveStations: latestTrancheActiveStations
        ? {
            activeCount: Number(latestTrancheActiveStations[0]),
            totalCount: Number(latestTrancheActiveStations[1]),
          }
        : null,
    };
  } catch {
    return {
      stoAddress: null,
      trancheCount: 0,
      latestTrancheActiveStations: null,
    };
  }
}

function buildAttention(entry: RegionCatalogEntry, summary: {
  snapshot: ReputationSnapshot | null;
  coverage: RegionOperationalCoverage;
  stoAddress: `0x${string}` | null;
}) {
  const items: string[] = [];

  if (!summary.snapshot) {
    items.push('Monthly snapshot not yet published');
  } else if (Number(summary.snapshot.trust.settlementContinuityBps) < 8500) {
    items.push('Settlement continuity needs review');
  }

  if (summary.coverage.activeChargerRatio != null && summary.coverage.activeChargerRatio < 90) {
    items.push('Active charger ratio is below 90%');
  }

  if (summary.coverage.chipCoverageRatio != null && summary.coverage.chipCoverageRatio < 95) {
    items.push('SE chip coverage is incomplete');
  }

  if (!summary.stoAddress) {
    items.push('Issuance not live');
  }

  return items.slice(0, 3);
}

async function readRegionSummary(entry: RegionCatalogEntry): Promise<RegionEvidenceSummary> {
  const [settlement, coverage, snapshotData, stoReadiness] = await Promise.all([
    readSettlement(entry.regionId),
    readCoverage(entry.regionId),
    readSnapshot(entry.regionId),
    readStoReadiness(entry.regionId),
  ]);

  const attention = buildAttention(entry, {
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
    latestTrancheActiveStations: stoReadiness.latestTrancheActiveStations,
    attention,
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

      const publishedRegions = regions.filter((region) => region.snapshot).length;
      const liveStoRegions = regions.filter((region) => region.stoAddress).length;
      const totalPendingRevenueKrw = regions.reduce((sum, region) => sum + region.settlement.pendingRevenueKrw, 0n);
      const latestAttestationPeriod = regions
        .map((region) => region.settlement.latestAttestation?.period_yyyyMM ?? 0n)
        .sort((a, b) => Number(a - b))
        .pop() ?? 0n;

      const aggregateStations = regions.reduce((sum, region) => sum + region.coverage.stationCount, 0);
      const aggregateActiveStations = regions.reduce((sum, region) => sum + region.coverage.activeStationCount, 0);
      const aggregateChargers = regions.reduce((sum, region) => sum + region.coverage.chargerCount, 0);
      const aggregateActiveChargers = regions.reduce((sum, region) => sum + region.coverage.activeChargerCount, 0);
      const aggregateActiveChipCount = regions.reduce((sum, region) => sum + region.coverage.activeChipCount, 0);

      const nextOverview: AnalyticsOverview = {
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

export function buildSettlementHistoryChart(attestationHistory: RevenueAttestation[]) {
  if (attestationHistory.length === 0) {
    return [];
  }

  return attestationHistory.map((attestation) => ({
    label: attestation.period_yyyyMM.toString().slice(4, 6),
    value: Number(attestation.distributableKrw) / 1_000_000,
    frontColor: colors.sky400,
  }));
}
