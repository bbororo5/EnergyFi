// Temporary mock data for the React Native migration pass.
// Explore will move to region snapshots after the ReputationRegistry-backed redesign.
export interface Portfolio {
  id: number;
  name: string;
  subtitle: string;
  chargers: number;
  utilization: number;
  demandStrength: number;
  stability: number;
  volatility: 'Low' | 'Medium' | 'High';
  diversification: number;
  apy: number;
  tokensMinted: string;
  status: 'Live' | 'Pre-IPO';
  badge: 'FEATURED' | 'NEW' | 'UPCOMING';
  invested?: number;
  shares?: number;
  currentValue?: number;
  change?: number;
}

export const portfolios: Portfolio[] = [
  {
    id: 1,
    name: 'Seoul',
    subtitle: 'Residential Night Demand Portfolio',
    chargers: 24,
    utilization: 68.5,
    demandStrength: 85,
    stability: 92,
    volatility: 'Low',
    diversification: 78,
    apy: 8.2,
    tokensMinted: '6.2M',
    status: 'Live',
    badge: 'FEATURED',
    invested: 45000,
    shares: 45,
    currentValue: 47250,
    change: 5.0,
  },
  {
    id: 2,
    name: 'Busan',
    subtitle: 'Port District EV Hub',
    chargers: 18,
    utilization: 72.3,
    demandStrength: 78,
    stability: 88,
    volatility: 'Low',
    diversification: 65,
    apy: 7.5,
    tokensMinted: '4.8M',
    status: 'Live',
    badge: 'NEW',
    invested: 30000,
    shares: 30,
    currentValue: 31500,
    change: 5.0,
  },
  {
    id: 3,
    name: 'Jeju',
    subtitle: 'Green Island Clean Energy',
    chargers: 32,
    utilization: 64.8,
    demandStrength: 72,
    stability: 85,
    volatility: 'Medium',
    diversification: 82,
    apy: 9.1,
    tokensMinted: '-',
    status: 'Pre-IPO',
    badge: 'UPCOMING',
    invested: 15000,
    shares: 15,
    currentValue: 15750,
    change: 5.0,
  },
  {
    id: 4,
    name: 'Gyeonggi',
    subtitle: 'Suburban Commuter Network',
    chargers: 14,
    utilization: 64.8,
    demandStrength: 70,
    stability: 80,
    volatility: 'Medium',
    diversification: 60,
    apy: 6.8,
    tokensMinted: '2.1M',
    status: 'Live',
    badge: 'NEW',
  },
];

export const allocation = [
  { name: 'Seoul', value: 45, color: '#0A84FF' },
  { name: 'Busan', value: 30, color: '#5E5CE6' },
  { name: 'Gyeonggi', value: 15, color: '#30D158' },
  { name: 'Incheon', value: 10, color: '#FF9F0A' },
];

export const operationalAlerts = [
  { id: 1, portfolio: 'Seoul', message: 'Maintenance completed.', time: '2h ago', type: 'success' as const },
  { id: 2, portfolio: 'Busan', message: 'Yield increased 3.2% MoM.', time: '1d ago', type: 'info' as const },
  { id: 3, portfolio: 'Gyeonggi', message: 'Two new stations scheduled.', time: '2d ago', type: 'info' as const },
];
