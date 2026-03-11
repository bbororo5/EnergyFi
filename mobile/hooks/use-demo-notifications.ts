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
import { buildDemoNotifications, type RecentSessionNotificationInput } from '@/lib/domain/demo-notifications';
import { buildDemoInvestorPortfolio } from '@/hooks/use-demo-investor-portfolio';
import { useAnalyticsOverview } from '@/hooks/use-analytics-overview';

const notificationClient = createPublicClient({
  chain: energyfiChain,
  transport: http(energyfiRpcUrl),
});

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

async function readRecentSessions(limit = 2): Promise<RecentSessionNotificationInput[]> {
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
  const [recentSessions, setRecentSessions] = useState<RecentSessionNotificationInput[]>([]);

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

  const notifications = useMemo<Notification[]>(
    () => buildDemoNotifications({
      overview: analytics.overview,
      portfolio,
      recentSessions,
    }),
    [analytics.overview, portfolio, recentSessions],
  );

  return {
    notifications,
    unreadCount: notifications.filter((item) => item.unread).length,
    isLoading: analytics.isLoading && notifications.length === 0,
  };
}
