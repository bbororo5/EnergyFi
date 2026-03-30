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

import * as analyticsChain from '@/lib/chain/analytics';
import { useAnalyticsOverviewQuery } from '@/hooks/use-analytics-overview';

describe('analytics query cache dedupe', () => {
  it('dedupes concurrent overview consumers inside the same query tree', async () => {
    const overview = createTestOverview([createSeoulRegion()], { totalSessions: 12 });
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
    const mockedReadTotalSessions = analyticsChain.readTotalSessions as jest.Mock;

    const { result, unmount } = renderHook(
      () => ({
        first: useAnalyticsOverviewQuery(),
        second: useAnalyticsOverviewQuery(),
      }),
      {
        wrapper: createQueryWrapper(client),
      },
    );

    await waitFor(() => {
      expect(result.current.first.overview).not.toBeNull();
      expect(result.current.second.overview).not.toBeNull();
    });

    expect(mockedReadTotalSessions).toHaveBeenCalledTimes(1);
    expect(result.current.first.overview?.totalSessions).toBe(12);
    expect(result.current.second.overview?.totalSessions).toBe(12);
    expect(result.current.first.overview?.regions.length).toBeGreaterThan(0);

    unmount();
    client.clear();
  });
});
