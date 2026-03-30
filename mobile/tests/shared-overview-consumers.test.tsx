/* eslint-disable import/first */
import { renderHook, waitFor } from '@testing-library/react-native';
import { createSeoulRegion, createTestOverview } from '@/tests/support/analytics-fixtures';
import { createTestQueryClient, createQueryWrapper } from '@/tests/support/query-client';
import { applyAnalyticsOverviewMocks } from '@/tests/support/analytics-chain-mocks';

jest.mock('@/lib/chain/analytics', () => ({
  readTotalSessions: jest.fn(),
  readSettlement: jest.fn(),
  readCoverage: jest.fn(),
  readSnapshot: jest.fn(),
  readStoReadiness: jest.fn(),
}));

jest.mock('@/lib/home-ownership', () => {
  const actual = jest.requireActual('@/lib/home-ownership');
  return {
    ...actual,
    fetchOwnershipOverlay: jest.fn(async () => ({
      source: 'unavailable',
      shareBps: null,
      estimatedPortfolioValueKrw: null,
      holderLabel: 'Ownership input pending',
      holderAddress: null,
      heldRegionCount: 0,
      totalTokenUnits: null,
    })),
  };
});

jest.mock('@/lib/chain/home-session-derived', () => ({
  fetchHomeSessionDerivedData: jest.fn(async () => ({
    impact: {
      estimatedCo2Kg: 12,
      deliveredEnergyKwh: 34,
      treeEquivalent: 1,
      methodologyLabel: 'Mock impact',
    },
    liveSessions: [{
      id: 'session-1',
      station: 'Seoul Station',
      regionName: 'Seoul',
      kwh: '15.6',
      revenue: 4446,
      time: 'Just now',
      deviceType: 'AC Slow',
    }],
  })),
}));

jest.mock('@/hooks/use-recent-sessions-query', () => ({
  useRecentSessionsQuery: jest.fn(() => ({
    data: [{
      station: 'Seoul Station',
      regionCode: 'KR11',
      distributableKrw: 4_446n,
      endTimestamp: 1_717_500_900n,
    }],
    isPending: false,
  })),
}));

import * as analyticsChain from '@/lib/chain/analytics';
import { useDemoInvestorPortfolio } from '@/hooks/use-demo-investor-portfolio';
import { useDemoNotifications } from '@/hooks/use-demo-notifications';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';
import { useRegionAnalytics } from '@/hooks/use-region-analytics';

describe('shared overview consumers', () => {
  it('shares a single overview fetch across home, portfolio, notifications, and region detail consumers', async () => {
    const seoul = createSeoulRegion({
      latestTranche: {
        trancheId: 1,
        tokenAmount: 1_000n,
        issuedAt: 1_717_100_000n,
        stationCount: 2,
      },
    });
    const overview = createTestOverview([seoul], { totalSessions: 12 });

    applyAnalyticsOverviewMocks(
      {
        readTotalSessions: analyticsChain.readTotalSessions as jest.Mock,
        readSettlement: analyticsChain.readSettlement as jest.Mock,
        readCoverage: analyticsChain.readCoverage as jest.Mock,
        readSnapshot: analyticsChain.readSnapshot as jest.Mock,
        readStoReadiness: analyticsChain.readStoReadiness as jest.Mock,
      },
      overview,
    );

    const client = createTestQueryClient();
    const { result, unmount } = renderHook(
      () => ({
        home: useHomeDashboard(),
        portfolio: useDemoInvestorPortfolio(),
        notifications: useDemoNotifications(),
        region: useRegionAnalytics('KR11'),
      }),
      {
        wrapper: createQueryWrapper(client),
      },
    );

    await waitFor(() => expect(result.current.home.dashboard).not.toBeNull());
    await waitFor(() => expect(result.current.home.isFeedLoading).toBe(false));
    await waitFor(() => expect(result.current.portfolio.portfolio).not.toBeNull());
    await waitFor(() => expect(result.current.region.detail).not.toBeNull());
    await waitFor(() => expect(result.current.notifications.notifications.length).toBeGreaterThan(0));

    expect((analyticsChain.readTotalSessions as jest.Mock)).toHaveBeenCalledTimes(1);
    expect(result.current.home.dashboard?.heroChart.length).toBeGreaterThan(0);
    expect(result.current.portfolio.portfolio?.heldRegions).toBe(1);
    expect(result.current.region.detail?.code).toBe('KR11');
    expect(result.current.notifications.notifications.some((item) => item.title.includes('KR11 live session recorded'))).toBe(true);

    unmount();
    client.clear();
  });
});
