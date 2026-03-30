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
import { useRegionAnalytics } from '@/hooks/use-region-analytics';

describe('useRegionAnalytics', () => {
  it('builds a region detail view model from the shared analytics overview query', async () => {
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
    const { result, unmount } = renderHook(() => useRegionAnalytics('KR11'), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.detail).not.toBeNull());

    expect(result.current.detail?.code).toBe('KR11');
    expect(result.current.detail?.narratives.heroRevenueLabel).toBe('Latest monthly revenue');
    expect(result.current.detail?.narratives.heroSupportItems).toHaveLength(3);
    expect(result.current.detail?.narratives.issuanceNarrative).toContain('STO is live');

    unmount();
    client.clear();
  });
});
