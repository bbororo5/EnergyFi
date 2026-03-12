import { useState, useEffect, useRef } from 'react';
import { createPublicClient, http, parseAbi, hexToString } from 'viem';
export interface LiveSession {
  id: string;
  station: string;
  kwh: string;
  revenue: number;
  time: string;
  deviceType: string;
}

// Local Anvil node (make sure it's running via `npm run node` in contracts)
const client = createPublicClient({
  chain: {
    id: 31337,
    name: 'Localhost',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
  },
  transport: http('http://127.0.0.1:8545')
});

const CHARGE_TRANSACTION_ADDRESS = '0xad54760b6c7Af14a39d6C16B2c94E03883e78156';

const abi = parseAbi([
  'function totalSessions() external view returns (uint256)',
  'function getSession(uint256 tokenId) external view returns ((bytes32 sessionId, bytes32 chargerId, uint8 chargerType, uint256 energyKwh, uint256 startTimestamp, uint256 endTimestamp, uint8 vehicleCategory, bytes4 gridRegionCode, bytes32 stationId, uint256 distributableKrw, bytes seSignature))'
]);

const initialEarningsData = [
  { value: 285000, label: 'Oct' },
  { value: 310000, label: 'Nov' },
  { value: 295000, label: 'Dec' },
  { value: 340000, label: 'Jan' },
  { value: 358000, label: 'Feb' },
  { value: 376000, label: 'Mar' },
];

const regions = ['Seoul', 'Busan', 'Jeju', 'Gyeonggi', 'Incheon'];

const initialSessions: LiveSession[] = [
  { id: 'tx1', station: 'Seoul', kwh: '45.2', revenue: 14200, time: '2m ago', deviceType: 'DC Fast' },
  { id: 'tx2', station: 'Busan', kwh: '62.4', revenue: 18500, time: '6m ago', deviceType: 'DC Fast' },
  { id: 'tx3', station: 'Jeju', kwh: '15.8', revenue: 4100, time: '12m ago', deviceType: 'L2 Slow' },
];

export function useLiveNetworkData() {
  const [portfolioValue, setPortfolioValue] = useState(15450000);
  const [monthlyGain, setMonthlyGain] = useState(345120);
  const [lastTx, setLastTx] = useState<number | null>(null);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>(initialSessions);
  const [earningsData, setEarningsData] = useState(initialEarningsData);

  const actualRef = useRef(15450000);
  const monthlyRef = useRef(345120);

  // Poll for the latest minted token IDs
  useEffect(() => {
    let timerId: any;
    let lastKnownTotal = 0n;

    const fetchLatest = async () => {
      try {
        const total = await client.readContract({
          address: CHARGE_TRANSACTION_ADDRESS,
          abi,
          functionName: 'totalSessions',
        });

        if (total > lastKnownTotal) {
          // New sessions found!
          const newTxCount = Number(total - lastKnownTotal);
          const fetchCount = Math.min(newTxCount, 4); // fetch up to last 4

          let fetched: LiveSession[] = [];

          for (let i = 0; i < fetchCount; i++) {
            const tokenId = total - BigInt(i);
            const session = await client.readContract({
              address: CHARGE_TRANSACTION_ADDRESS,
              abi,
              functionName: 'getSession',
              args: [tokenId],
            });

            const kwhStr = (Number(session.energyKwh) / 100).toFixed(1);
            const gain = Number(session.distributableKrw);

            fetched.push({
              id: `tx-${tokenId.toString()}`,
              station: hexToString(session.gridRegionCode, { size: 4 }).replace(/\x00/g, '') || regions[Math.floor(Math.random() * regions.length)],
              kwh: kwhStr,
              revenue: gain,
              time: 'Just now',
              deviceType: session.chargerType === 2 ? 'DC Fast' : 'L2 Slow',
            });

            // Update portfolio values
            actualRef.current += gain;
            monthlyRef.current += gain;
          }

          if (fetched.length > 0) {
            setPortfolioValue(actualRef.current);
            setMonthlyGain(monthlyRef.current);
            setLastTx(fetched[0].revenue);
            setLiveSessions((prev) => [...fetched, ...prev].slice(0, 4));

            // Clear highlight
            setTimeout(() => setLastTx(null), 3000);
          }

          lastKnownTotal = total;
        }

        // Keep simulating some random events for the demo if there's no chain traffic
        if (lastKnownTotal === 0n) {
          simulateTraffic();
        }

      } catch (err) {
        console.warn("Failed to fetch from contracts, falling back to mock.", err);
        simulateTraffic();
      }

      timerId = setTimeout(fetchLatest, 7000);
    };

    const simulateTraffic = () => {
      const gain = Math.floor(120 + Math.random() * 850);
      actualRef.current += gain;
      monthlyRef.current += gain;

      setPortfolioValue(actualRef.current);
      setMonthlyGain(monthlyRef.current);
      setLastTx(gain);

      const newSession: LiveSession = {
        id: `tx-${Date.now()}`,
        station: regions[Math.floor(Math.random() * regions.length)],
        kwh: (Math.random() * 40 + 10).toFixed(1),
        revenue: gain,
        time: 'Just now',
        deviceType: Math.random() > 0.5 ? 'DC Fast' : 'L2 Slow',
      };

      setLiveSessions((prev) => [newSession, ...prev].slice(0, 4));
      setTimeout(() => setLastTx(null), 3000);
    };

    // Initial timeout before starting poll
    timerId = setTimeout(fetchLatest, 3000);

    return () => clearTimeout(timerId);
  }, []);

  return { portfolioValue, monthlyGain, lastTx, liveSessions, earningsData };
}
