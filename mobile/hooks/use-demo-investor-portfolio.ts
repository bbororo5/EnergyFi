import { useMemo } from 'react';
import { useAnalyticsOverviewQuery } from '@/hooks/use-analytics-overview';
import {
  buildDemoInvestorPortfolio,
  type DemoInvestorPortfolioSummary,
  type AccountPayoutRecord,
} from '@/lib/domain/demo-investor-portfolio';

export type { DemoInvestorPortfolioSummary, AccountPayoutRecord };

export function useDemoInvestorPortfolio() {
  const analytics = useAnalyticsOverviewQuery();
  const portfolio = useMemo<DemoInvestorPortfolioSummary | null>(() => buildDemoInvestorPortfolio(analytics.overview), [analytics.overview]);

  return {
    ...analytics,
    portfolio,
  };
}
