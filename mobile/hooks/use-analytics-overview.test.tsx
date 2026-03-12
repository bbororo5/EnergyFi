import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useAnalyticsOverviewQuery } from '@/hooks/use-analytics-overview';

jest.mock('@/lib/chain/analytics', () => ({
  readTotalSessions: jest.fn(async () => 12),
  readSettlement: jest.fn(async () => ({
    pendingRevenueKrw: 1_000n,
    latestAttestation: null,
    attestationPeriods: [],
    attestationHistory: [],
  })),
  readCoverage: jest.fn(async () => ({
    stationCount: 1,
    activeStationCount: 1,
    chargerCount: 2,
    activeChargerCount: 2,
    activeChipCount: 2,
    activeChargerRatio: 100,
    chipCoverageRatio: 100,
  })),
  readSnapshot: jest.fn(async () => ({ snapshot: null, previousSnapshot: null })),
  readStoReadiness: jest.fn(async () => ({
    stoAddress: null,
    trancheCount: 0,
    totalSupply: 0n,
    demoBalance: 0n,
    ownedShareBps: null,
    latestTranche: null,
    latestTrancheActiveStations: null,
  })),
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useAnalyticsOverviewQuery', () => {
  it('returns analytics overview through the shared query cache', async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const { result, unmount } = renderHook(() => useAnalyticsOverviewQuery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.overview).not.toBeNull());
    expect(result.current.overview?.totalSessions).toBe(12);
    expect(result.current.overview?.regions.length).toBeGreaterThan(0);

    unmount();
    client.clear();
  });
});
