import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPublicClient, http } from 'viem';
import {
  chargeTransactionAddress,
  energyfiChain,
  energyfiRpcUrl,
  stationRegistryAddress,
} from '@/constants/contracts';
import { type Notification } from '@/data/notifications';
import { chargeTransactionAbi, stationRegistryAbi } from '@/lib/analytics-contracts';
import { formatKrwShort, formatPeriodLabel, useAnalyticsOverview } from '@/hooks/use-analytics-overview';
import { buildDemoInvestorPortfolio } from '@/hooks/use-demo-investor-portfolio';

const notificationClient = createPublicClient({
  chain: energyfiChain,
  transport: http(energyfiRpcUrl),
});

type RecentSession = {
  station: string;
  regionCode: string;
  distributableKrw: bigint;
  endTimestamp: bigint;
};

function decodeRegionCode(regionId: `0x${string}`) {
  let code = '';
  for (let index = 2; index < regionId.length; index += 2) {
    const slice = regionId.slice(index, index + 2);
    if (slice === '00') {
      break;
    }
    code += String.fromCharCode(Number.parseInt(slice, 16));
  }
  return code;
}

function formatRelativeTime(timestamp: bigint | number) {
  const epochSeconds = typeof timestamp === 'number' ? timestamp : Number(timestamp);
  const diffSeconds = Math.max(0, Math.round(Date.now() / 1000 - epochSeconds));
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

async function readRecentSessions(limit = 2): Promise<RecentSession[]> {
  const totalSessionsRaw = await notificationClient.readContract({
    address: chargeTransactionAddress,
    abi: chargeTransactionAbi,
    functionName: 'totalSessions',
  });
  const totalSessions = Number(totalSessionsRaw);

  if (totalSessions <= 0) {
    return [];
  }

  const start = Math.max(1, totalSessions - limit + 1);
  const tokenIds = Array.from({ length: totalSessions - start + 1 }, (_, index) => BigInt(start + index));
  const sessions = await Promise.all(tokenIds.map((tokenId) => (
    notificationClient.readContract({
      address: chargeTransactionAddress,
      abi: chargeTransactionAbi,
      functionName: 'getSession',
      args: [tokenId],
    })
  )));

  const stations = await Promise.all(sessions.map(async (session) => {
    try {
      return await notificationClient.readContract({
        address: stationRegistryAddress,
        abi: stationRegistryAbi,
        functionName: 'getStation',
        args: [session.stationId],
      });
    } catch {
      return null;
    }
  }));

  return sessions
    .map((session, index) => ({
      station: stations[index]?.location ?? session.stationId,
      regionCode: decodeRegionCode(session.gridRegionCode),
      distributableKrw: session.distributableKrw,
      endTimestamp: session.endTimestamp,
    }))
    .reverse();
}

export function useDemoNotifications() {
  const analytics = useAnalyticsOverview();
  const portfolio = useMemo(() => buildDemoInvestorPortfolio(analytics.overview), [analytics.overview]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  const loadRecentSessions = useCallback(async () => {
    try {
      const next = await readRecentSessions();
      setRecentSessions(next);
    } catch (error) {
      console.warn('Failed to read recent sessions for notifications', error);
      setRecentSessions([]);
    }
  }, []);

  useEffect(() => {
    void loadRecentSessions();
    const interval = setInterval(() => {
      void loadRecentSessions();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [loadRecentSessions]);

  const notifications = useMemo<Notification[]>(() => {
    if (!analytics.overview || !portfolio) {
      return [];
    }

    const latestFinalization = analytics.overview.regions
      .map((region) => region.settlement.latestAttestation)
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((left, right) => Number(right.finalizedAt - left.finalizedAt))[0];

    const latestIssuedHolding = portfolio.holdings
      .filter((holding) => holding.latestTrancheIssuedAt != null)
      .sort((left, right) => Number((right.latestTrancheIssuedAt ?? 0n) - (left.latestTrancheIssuedAt ?? 0n)))[0];

    const chipCoverageRegions = analytics.overview.regions
      .filter((region) => region.coverage.chipCoverageRatio != null && region.coverage.chipCoverageRatio < 95)
      .map((region) => region.code);

    const next: Notification[] = [];

    if (recentSessions[0]) {
      next.push({
        id: 1,
        type: 'info',
        title: `${recentSessions[0].regionCode} live session recorded`,
        message: `${recentSessions[0].station} added ${formatKrwShort(recentSessions[0].distributableKrw)} in distributable revenue.`,
        time: formatRelativeTime(recentSessions[0].endTimestamp),
        unread: true,
      });
    }

    if (latestFinalization) {
      next.push({
        id: 2,
        type: 'success',
        title: `${formatPeriodLabel(latestFinalization.period_yyyyMM)} settlement finalized`,
        message: `${analytics.overview.liveStoRegions} STO-live regions now read from finalized network evidence.`,
        time: formatRelativeTime(latestFinalization.finalizedAt),
        unread: true,
      });
    }

    if (latestIssuedHolding) {
      next.push({
        id: 3,
        type: 'success',
        title: `${latestIssuedHolding.name} tranche is live`,
        message: `${latestIssuedHolding.latestTrancheTokenAmount?.toLocaleString() ?? '0'} token units were issued in the latest tranche.`,
        time: formatRelativeTime(latestIssuedHolding.latestTrancheIssuedAt ?? 0n),
        unread: true,
      });
    }

    if (chipCoverageRegions.length > 0) {
      next.push({
        id: 4,
        type: 'alert',
        title: 'SE chip coverage watchlist',
        message: `${chipCoverageRegions.join(', ')} show incomplete chip coverage in the live read.`,
        time: 'Live read',
        unread: false,
      });
    }

    next.push({
      id: 5,
      type: 'info',
      title: 'All 7 region STOs are live',
      message: `Demo investor holds ${portfolio.totalTokenUnits.toLocaleString()} token units across ${portfolio.heldRegions} regions.`,
      time: 'Live read',
      unread: false,
    });

    return next;
  }, [analytics.overview, portfolio, recentSessions]);

  return {
    notifications,
    unreadCount: notifications.filter((item) => item.unread).length,
    isLoading: analytics.isLoading && notifications.length === 0,
  };
}
