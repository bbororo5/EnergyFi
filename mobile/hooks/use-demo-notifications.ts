import { useMemo } from 'react';
import {
  type Notification,
} from '@/data/notifications';
import { buildDemoNotifications } from '@/lib/domain/demo-notifications';
import { buildDemoInvestorPortfolio } from '@/lib/domain/demo-investor-portfolio';
import { useAnalyticsOverviewQuery } from '@/hooks/use-analytics-overview';
import { useRecentSessionsQuery } from '@/hooks/use-recent-sessions-query';

export function useDemoNotifications() {
  const analytics = useAnalyticsOverviewQuery();
  const portfolio = useMemo(() => buildDemoInvestorPortfolio(analytics.overview), [analytics.overview]);
  const recentSessionsQuery = useRecentSessionsQuery();

  const notifications = useMemo<Notification[]>(
    () => buildDemoNotifications({
      overview: analytics.overview,
      portfolio,
      recentSessions: recentSessionsQuery.data ?? [],
    }),
    [analytics.overview, portfolio, recentSessionsQuery.data],
  );

  return {
    notifications,
    unreadCount: notifications.filter((item) => item.unread).length,
    isLoading: (analytics.isLoading || recentSessionsQuery.isPending) && notifications.length === 0,
  };
}
