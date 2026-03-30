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
import { useDemoNotifications } from '@/hooks/use-demo-notifications';

describe('useDemoNotifications', () => {
  it('builds notifications from shared overview data and recent sessions', async () => {
    const seoul = createSeoulRegion({
      latestTranche: {
        trancheId: 1,
        tokenAmount: 1_000n,
        issuedAt: 1_717_100_000n,
        stationCount: 2,
      },
    });
    const overview = createTestOverview([seoul]);
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
    const { result, unmount } = renderHook(() => useDemoNotifications(), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.notifications.length).toBeGreaterThan(0));

    expect(result.current.unreadCount).toBeGreaterThan(0);
    expect(result.current.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: expect.stringContaining('KR11 live session recorded') }),
        expect.objectContaining({ title: expect.stringContaining('settlement finalized') }),
        expect.objectContaining({ title: expect.stringContaining('All 7 region STOs are live') }),
      ]),
    );

    unmount();
    client.clear();
  });
});
