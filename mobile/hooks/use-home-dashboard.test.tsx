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

import * as analyticsChain from '@/lib/chain/analytics';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';

describe('useHomeDashboard', () => {
  it('builds the home hero, region cards, and session-derived feed from shared queries', async () => {
    const overview = createTestOverview([createSeoulRegion()]);
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
    const { result, unmount } = renderHook(() => useHomeDashboard(), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.dashboard).not.toBeNull());
    await waitFor(() => expect(result.current.isFeedLoading).toBe(false));

    expect(result.current.dashboard?.heroLabel).toBe('Current month revenue');
    expect(result.current.dashboard?.heroChart.length).toBeGreaterThan(0);
    expect(result.current.dashboard?.regionCards.length).toBeGreaterThan(0);
    expect(result.current.dashboard?.impact).not.toBeNull();
    expect(result.current.dashboard?.liveSessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ station: 'Seoul Station', revenue: 4446 }),
      ]),
    );

    unmount();
    client.clear();
  });
});
