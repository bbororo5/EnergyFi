import type { ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  PieChart as PieChartIcon,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Material3BottomNav } from './Material3BottomNav';
import { CommonHeader } from './CommonHeader';

interface PortfolioProps {
  onNavigateToHome?: () => void;
  onNavigateToExplore?: () => void;
  onNavigateToMore?: () => void;
  onNavigateToDetail?: () => void;
  onNavigateToNotifications?: () => void;
}

function SurfaceCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[20px] bg-[#1C1C1E] p-5 ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  icon,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-0.5 text-[13px] font-medium text-gray-400">
          {eyebrow}
        </p>
        <h3 className="text-[20px] font-semibold tracking-tight text-white">
          {title}
        </h3>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2C2C2E]">
        {icon}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] bg-[#2C2C2E] p-3.5">
      <p className="mb-1 text-[13px] font-medium text-gray-400">
        {label}
      </p>
      <p className="text-[17px] font-semibold tracking-tight text-white tabular-nums">
        {value}
      </p>
    </div>
  );
}

function HeroMetricCard({
  icon,
  eyebrow,
  caption,
  value,
  accent,
}: {
  icon: ReactNode;
  eyebrow: string;
  caption: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[20px] bg-[#2C2C2E] p-4">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#3A3A3C]">
        {icon}
      </div>
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium text-gray-400">
          {eyebrow}
        </p>
        <p className="text-[12px] text-gray-500">{caption}</p>
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-[22px] font-semibold tracking-tight text-white tabular-nums">
          {value}
        </p>
        {accent ? (
          <p className="text-[13px] font-medium text-[#30D158]">{accent}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Portfolio({
  onNavigateToHome,
  onNavigateToExplore,
  onNavigateToMore,
  onNavigateToDetail,
  onNavigateToNotifications,
}: PortfolioProps) {
  const allocationData = [
    { id: 'alloc-1', name: 'Seoul', value: 45, color: '#0A84FF' }, // Apple Blue
    { id: 'alloc-2', name: 'Busan', value: 30, color: '#5E5CE6' }, // Apple Indigo
    { id: 'alloc-3', name: 'Gyeonggi', value: 15, color: '#30D158' }, // Apple Green
    { id: 'alloc-4', name: 'Incheon', value: 10, color: '#FF9F0A' }, // Apple Orange
  ];

  const holdings = [
    {
      id: 'holding-1',
      name: 'Seoul',
      amount: 45000,
      shares: 45,
      currentValue: 47250,
      change: 5.0,
      utilization: 68.5,
      status: 'Active',
    },
    {
      id: 'holding-2',
      name: 'Busan',
      amount: 30000,
      shares: 30,
      currentValue: 31500,
      change: 5.0,
      utilization: 72.3,
      status: 'Active',
    },
    {
      id: 'holding-3',
      name: 'Gyeonggi',
      amount: 15000,
      shares: 15,
      currentValue: 15750,
      change: 5.0,
      utilization: 64.8,
      status: 'Active',
    },
  ];

  const operationalAlerts = [
    {
      id: 'alert-1',
      portfolio: 'Seoul',
      message: 'Seoul maintenance completed.',
      time: '2h ago',
      type: 'success',
    },
    {
      id: 'alert-2',
      portfolio: 'Busan',
      message: 'Yield increased 3.2% MoM.',
      time: '1d ago',
      type: 'info',
    },
    {
      id: 'alert-3',
      portfolio: 'Gyeonggi',
      message: 'Two new stations scheduled.',
      time: '2d ago',
      type: 'info',
    },
  ];

  const appleFont =
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

  const totalInvested = 100000;
  const expectedMonthlyDividend = 685;
  const cumulativeDividend = 4120;
  const avgChange = 2.3;

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-black text-white"
      style={{ fontFamily: appleFont }}
    >
      <div className="pointer-events-none absolute inset-0">
      </div>

      <CommonHeader
        title="Analytics"
        onNotificationClick={onNavigateToNotifications}
      />

      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
        <div className="space-y-5 px-5 pb-8 pt-4">
          <section className="relative overflow-hidden rounded-[24px] bg-[#1C1C1E] px-6 py-6">
            <div className="relative z-10 space-y-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-0.5 text-[13px] font-medium text-gray-400">
                    Investor Pulse
                  </p>
                  <h2 className="text-[22px] font-semibold tracking-tight text-white">
                    Performance snapshot
                  </h2>
                </div>

                <div className="shrink-0 rounded-full bg-[#2C2C2E] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#30D158]" />
                    <span className="text-[13px] font-medium text-white">
                      Monthly live
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[13px] font-medium text-gray-400">
                  Total Invested
                </p>
                <div className="flex items-end gap-1.5">
                  <span className="pb-1 text-[20px] font-medium text-white">
                    $
                  </span>
                  <p className="text-[40px] font-semibold tracking-tight text-white tabular-nums">
                    {totalInvested.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <HeroMetricCard
                  icon={<DollarSign className="h-5 w-5 text-emerald-400" strokeWidth={2.2} />}
                  eyebrow="Dividend"
                  caption="Expected monthly payout"
                  value={`$${expectedMonthlyDividend.toFixed(2)}`}
                  accent={`+${avgChange}%`}
                />
                <HeroMetricCard
                  icon={<TrendingUp className="h-5 w-5 text-indigo-400" strokeWidth={2.2} />}
                  eyebrow="Cumulative"
                  caption="Six-month total"
                  value={`$${cumulativeDividend.toLocaleString()}`}
                />
              </div>
            </div>
          </section>

          <SurfaceCard>
            <SectionHeader
              eyebrow="Utilization Summary"
              title="Network activity quality"
              icon={<Activity className="h-4.5 w-4.5 text-sky-400" strokeWidth={2.2} />}
            />

            <div className="space-y-4">
              <div className="rounded-[16px] bg-[#2C2C2E] p-4">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mb-1 text-[13px] font-medium text-gray-400">
                      Overall Utilization
                    </p>
                    <p className="text-[14px] text-gray-300">
                      Portfolio-wide charging demand
                    </p>
                  </div>
                  <p className="shrink-0 text-[22px] font-semibold tracking-tight text-white tabular-nums">
                    68.2%
                  </p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#1A1E2B]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400"
                    style={{ width: '68.2%' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <StatTile label="Avg Sessions" value="2,190" />
                <StatTile label="Uptime" value="98.8%" />
                <StatTile label="Peak Time" value="6-9PM" />
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeader
              eyebrow="Portfolio Allocation"
              title="Regional weighting"
              icon={<PieChartIcon className="h-4.5 w-4.5 text-indigo-400" strokeWidth={2.2} />}
            />

            <div className="space-y-4">
              <div className="rounded-[16px] bg-[#2C2C2E] py-3">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {allocationData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2.5">
                {allocationData.map((item) => (
                  <div
                    key={`legend-${item.id}`}
                    className="flex items-center gap-3 rounded-[12px] bg-[#2C2C2E] px-4 py-3"
                  >
                    <div
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-[15px] font-semibold text-white tabular-nums">
                      {item.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </SurfaceCard>

          <div className="space-y-4">
            <div>
              <p className="mb-0.5 text-[13px] font-medium text-gray-400">
                Holdings
              </p>
              <h3 className="text-[20px] font-semibold tracking-tight text-white">
                Active regional positions
              </h3>
            </div>

            <div className="space-y-3">
              {holdings.map((holding) => (
                <SurfaceCard key={holding.id} className="p-4">
                  <button
                    type="button"
                    onClick={onNavigateToDetail}
                    className="group block w-full text-left"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#2C2C2E]">
                          <Zap className="h-5 w-5 text-sky-400" strokeWidth={2.4} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-[17px] font-semibold tracking-tight text-white">
                            {holding.name}
                          </h4>
                          <p className="text-[13px] text-gray-400">
                            {holding.shares} shares
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-start gap-2">
                        <div className="text-right">
                          <p className="text-[20px] font-semibold tracking-tight text-white tabular-nums">
                            ${holding.currentValue.toLocaleString()}
                          </p>
                          <p className="mt-0.5 text-[13px] font-medium text-[#30D158]">
                            +{holding.change}%
                          </p>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 text-gray-500 transition-colors group-hover:text-white" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 border-t border-white/10 pt-4">
                      <StatTile label="Invested" value={`$${holding.amount.toLocaleString()}`} />
                      <StatTile label="Utilization" value={`${holding.utilization}%`} />
                      <div className="rounded-[16px] bg-[#2C2C2E] p-3.5">
                        <p className="mb-1 text-[13px] font-medium text-gray-400">
                          Status
                        </p>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-[#30D158]" strokeWidth={2.5} />
                          <span className="text-[14px] font-medium text-[#30D158]">
                            {holding.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </SurfaceCard>
              ))}
            </div>
          </div>

          <SurfaceCard>
            <SectionHeader
              eyebrow="Recent Updates"
              title="Operational highlights"
              icon={<Clock className="h-4.5 w-4.5 text-sky-400" strokeWidth={2.2} />}
            />

            <div className="space-y-3">
              {operationalAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-[16px] bg-[#2C2C2E] p-4"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3A3A3C]"
                  >
                    {alert.type === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-[#30D158]" strokeWidth={2.3} />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-sky-400" strokeWidth={2.3} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <p className="truncate text-[15px] font-semibold text-white">
                        {alert.portfolio}
                      </p>
                      <div className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-gray-500">
                        <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                        <span>{alert.time}</span>
                      </div>
                    </div>
                    <p className="text-[14px] text-gray-400">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>

      <Material3BottomNav
        activeTab="portfolio"
        onNavigateToHome={onNavigateToHome}
        onNavigateToExplore={onNavigateToExplore}
        onNavigateToPortfolio={() => { }}
        onNavigateToMore={onNavigateToMore}
      />
    </div>
  );
}
