import { startTransition, useEffect, useState } from 'react';
import { useAnalyticsOverview, type RegionEvidenceSummary } from '@/hooks/use-analytics-overview';
import { regionCatalog } from '@/data/regions';

export interface RegionAnalyticsDetail extends RegionEvidenceSummary {}

export function useRegionAnalytics(regionCode: string | undefined) {
  const { overview, isLoading, isRefreshing, errorMessage, refresh } = useAnalyticsOverview();
  const [detail, setDetail] = useState<RegionAnalyticsDetail | null>(null);

  useEffect(() => {
    const normalized = regionCode?.toUpperCase();
    if (!normalized || !overview) {
      setDetail(null);
      return;
    }

    const nextDetail = overview.regions.find((region) => region.code === normalized) ?? null;
    startTransition(() => {
      setDetail(nextDetail);
    });
  }, [overview, regionCode]);

  const regionMeta = regionCatalog.find((region) => region.code === regionCode?.toUpperCase()) ?? null;

  return {
    detail,
    regionMeta,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  };
}
