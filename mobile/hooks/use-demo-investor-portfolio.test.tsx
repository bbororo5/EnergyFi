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
import { useDemoInvestorPortfolio } from '@/hooks/use-demo-investor-portfolio';

describe('useDemoInvestorPortfolio', () => {
  it('builds investor holdings from the shared analytics overview query', async () => {
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
    const { result, unmount } = renderHook(() => useDemoInvestorPortfolio(), {
      wrapper: createQueryWrapper(client),
    });

    await waitFor(() => expect(result.current.portfolio).not.toBeNull());

    expect(result.current.portfolio?.heldRegions).toBe(1);
    expect(result.current.portfolio?.currentPendingRevenueShareKrw).toBe(12_500n);
    expect(result.current.portfolio?.latestMonthlyShareKrw).toBe(22_500n);
    expect(result.current.portfolio?.latestPayoutStatus).toBe('Scheduled');
    expect(result.current.isLoading).toBe(false);

    unmount();
    client.clear();
  });
});
