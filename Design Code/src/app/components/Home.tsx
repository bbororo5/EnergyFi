import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Home as HomeIcon,
  Search,
  User,
  TrendingUp,
  Shield,
  BookOpen,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Clock,
  Database,
  Building2,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  RotateCw,
  Info,
  Activity,
  Banknote,
  Coins,
  Leaf,
  Wind,
} from 'lucide-react';
import { Material3BottomNav } from './Material3BottomNav';
import { CommonHeader } from './CommonHeader';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) =>
    Math.floor(current).toLocaleString('en-US')
  );

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}

function SmoothDigit({ digit, h, color = '#ffffff' }: { digit: string; h: number; color?: string }) {
  return (
    <div
      style={{
        height: h,
        width: 'auto',
        minWidth: Math.round(h * 0.45),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'visible',
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={digit}
          initial={{ y: 15, opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: -15, opacity: 0, filter: 'blur(4px)' }}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 25,
            opacity: { duration: 0.2 },
          }}
          style={{
            fontSize: h,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color,
            lineHeight: 1,
            position: 'relative',
          }}
        >
          {digit}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const portfolioData = [
  {
    id: 'kr-11-seoul-central',
    name: 'Seoul',
    stations: 24,
    activeStations: 21,
    tokensMinted: '6.2M',
    stoStatus: 'Live',
    tranches: 3,
    badge: 'FEATURED',
    chartData: [
      { date: '03/01', value: 2200 },
      { date: '03/02', value: 2280 },
      { date: '03/03', value: 2150 },
      { date: '03/04', value: 2320 },
      { date: '03/05', value: 2290 },
      { date: '03/06', value: 2450 },
      { date: '03/07', value: 2380 },
      { date: '03/08', value: 2400 },
    ],
  },
  {
    id: 'kr-26-busan-port',
    name: 'Busan',
    stations: 18,
    activeStations: 18,
    tokensMinted: '4.8M',
    stoStatus: 'Live',
    tranches: 2,
    badge: 'NEW',
    chartData: [
      { date: '03/01', value: 1650 },
      { date: '03/02', value: 1720 },
      { date: '03/03', value: 1680 },
      { date: '03/04', value: 1750 },
      { date: '03/05', value: 1790 },
      { date: '03/06', value: 1820 },
      { date: '03/07', value: 1780 },
      { date: '03/08', value: 1800 },
    ],
  },
  {
    id: 'kr-49-jeju-coastal',
    name: 'Jeju',
    stations: 32,
    activeStations: 28,
    tokensMinted: '0',
    stoStatus: 'Pre-IPO',
    tranches: 0,
    badge: 'UPCOMING',
    chartData: [
      { date: '03/01', value: 2950 },
      { date: '03/02', value: 3020 },
      { date: '03/03', value: 2980 },
      { date: '03/04', value: 3100 },
      { date: '03/05', value: 3150 },
      { date: '03/06', value: 3180 },
      { date: '03/07', value: 3160 },
      { date: '03/08', value: 3200 },
    ],
  },
];

function PortfolioCard({
  portfolio,
  onNavigateToPortfolioDetail,
}: {
  portfolio: any;
  onNavigateToPortfolioDetail: any;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const appleFont =
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

  return (
    <div style={{ perspective: '1000px', fontFamily: appleFont }}>
      <div
        className="relative w-full rounded-[28px] transition-transform duration-700"
        style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)' }}
      >
        <div
          className="relative w-full p-6 rounded-[28px] border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          style={{
            backfaceVisibility: 'hidden',
            background: 'linear-gradient(135deg, #1E2235 0%, #0B0E14 100%)',
            width: '280px',
            margin: '0 auto',
          }}
          onClick={() => setIsFlipped(true)}
        >
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-[50px] pointer-events-none z-0" />

          <div className="flex items-center justify-between mb-4 relative z-10 pointer-events-none">
            <div className="px-3 py-1 rounded-full bg-[#1A1E2B] border border-[#2A3143] flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="text-[10px] font-bold tracking-wider text-slate-300">
                {portfolio.stations} STATIONS
              </span>
            </div>
            <div
              className={`px-3 py-1 rounded-full ${portfolio.badge === 'FEATURED'
                ? 'bg-amber-500/10 border border-amber-500/20'
                : portfolio.badge === 'NEW'
                  ? 'bg-sky-500/10 border border-sky-500/20'
                  : 'bg-indigo-500/10 border border-indigo-500/20'
                }`}
            >
              <span
                className={`text-[10px] font-extrabold tracking-wider ${portfolio.badge === 'FEATURED'
                  ? 'text-amber-500'
                  : portfolio.badge === 'NEW'
                    ? 'text-sky-500'
                    : 'text-indigo-400'
                  }`}
              >
                {portfolio.badge}
              </span>
            </div>
          </div>

          <div className="text-center mb-6 relative z-10">
            <h2 className="text-xl font-bold text-white mb-1">{portfolio.name}</h2>
            <p className="text-[10px] text-slate-400">South Korea · Featured Grid Region</p>
          </div>

          <div className="flex justify-between items-center px-4 mb-6 relative z-10">
            <div className="text-center">
              <p className="text-[9px] font-bold tracking-widest text-slate-500 mb-1 uppercase">Tokens Minted</p>
              <p className="text-lg font-bold text-white">{portfolio.tokensMinted}</p>
            </div>
            <div className="w-[1px] h-8 bg-[#1E293B]" />
            <div className="text-center">
              <p className="text-[9px] font-bold tracking-widest text-slate-500 mb-1 uppercase">Active Stations</p>
              <div className="flex items-baseline gap-1 justify-center">
                <p className="text-lg font-bold text-emerald-400">{portfolio.activeStations}</p>
                <p className="text-xs font-semibold text-slate-500">/{portfolio.stations}</p>
              </div>
            </div>
            <div className="w-[1px] h-8 bg-[#1E293B]" />
            <div className="text-center">
              <p className="text-[9px] font-bold tracking-widest text-slate-500 mb-1 uppercase">STO Status</p>
              <p className={`text-lg font-bold ${portfolio.stoStatus === 'Live' ? 'text-emerald-400' : 'text-amber-400'}`}>{portfolio.stoStatus}</p>
            </div>
          </div>

          <div className="w-full mb-4 relative z-20" style={{ height: '140px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={portfolio.chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <YAxis domain={['dataMin * 0.9', 'auto']} hide />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{
                    backgroundColor: '#1A1E2B',
                    border: '1px solid #2A3143',
                    borderRadius: '12px',
                    fontSize: '10px',
                    color: '#FFFFFF',
                  }}
                  itemStyle={{ color: '#10B981', fontWeight: 'bold' }}
                  labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                  formatter={(val: number) => [`₩${val.toLocaleString()}`, 'Volume']}
                  labelFormatter={(label) => `Date: ${label || 'Recent'}`}
                />
                <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="relative z-10 flex flex-col items-center pointer-events-none">
            <div className="flex items-center gap-1.5 text-slate-400 opacity-60">
              <RotateCw className="w-3 h-3" />
              <span className="text-[10px] font-medium tracking-wide">Tap to flip</span>
            </div>
          </div>
        </div>

        <div
          className="absolute inset-0 p-6 rounded-[28px] border border-white/5 shadow-[0_12px_48px_rgba(0,0,0,0.5)] flex flex-col items-center justify-between cursor-pointer"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(135deg, #2A3042 0%, #151A26 100%)',
            width: '280px',
            margin: '0 auto',
            left: '50%',
            marginLeft: '-140px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFlipped(false);
          }}
        >
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-sky-500/15 rounded-full blur-[70px] pointer-events-none" />

          <div className="w-full relative z-10 flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Key Metrics</h3>
            <div
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center cursor-help group relative border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <Info className="w-3.5 h-3.5 text-sky-400 group-hover:text-white transition-colors" />
              <div className="absolute top-full right-0 mt-3 w-56 p-4 bg-[#1A1E2B] border border-[#2A3143] rounded-2xl text-[11px] text-slate-300 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 backdrop-blur-2xl">
                Real-time operational health, revenue stability, and regional risk assessment.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full flex-1 mt-2">
            {[
              { label: 'Total Stations', val: portfolio.stations, color: 'text-white' },
              { label: 'Active Stations', val: portfolio.activeStations, color: 'text-emerald-400' },
              { label: 'Total Tranches', val: portfolio.tranches, color: 'text-sky-400' },
              { label: 'STO Status', val: portfolio.stoStatus, color: portfolio.stoStatus === 'Live' ? 'text-emerald-400' : 'text-amber-400' },
            ].map((metric, i) => (
              <div
                key={i}
                className="bg-[#12151D] p-3 rounded-2xl border border-white/5 flex flex-col justify-center items-center text-center shadow-inner relative overflow-hidden"
              >
                {i === 1 && <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />}
                {i === 2 && <div className="absolute inset-0 bg-sky-500/5 pointer-events-none" />}
                <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1 relative z-10">
                  {metric.label}
                </span>
                <span className={`text-[15px] font-bold tracking-tight relative z-10 ${metric.color}`}>
                  {metric.val}
                </span>
              </div>
            ))}
          </div>

          <button
            className="w-[180px] mt-4 mb-1 py-3.5 rounded-full bg-sky-500 hover:brightness-110 active:scale-[0.95] text-white font-bold text-[10px] tracking-[0.1em] transition-all shadow-[0_4px_15px_rgba(14,165,233,0.3)] relative z-20 uppercase"
            onClick={(e) => {
              e.stopPropagation();
              if (onNavigateToPortfolioDetail) onNavigateToPortfolioDetail();
            }}
          >
            Explore Station
          </button>
        </div>
      </div>
    </div>
  );
}

interface HomeProps {
  onNavigateToExplore?: () => void;
  onNavigateToPortfolio?: () => void;
  onNavigateToMore?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToPortfolioDetail?: () => void;
  onNavigateToLearn?: () => void;
}

export function Home({
  onNavigateToExplore,
  onNavigateToPortfolio,
  onNavigateToMore,
  onNavigateToNotifications,
  onNavigateToPortfolioDetail,
  onNavigateToLearn,
}: HomeProps) {
  const [portfolioValue, setPortfolioValue] = useState(15450000);
  const [monthlyGain, setMonthlyGain] = useState(345120);
  const [lastTx, setLastTx] = useState<number | null>(null);
  const [liveSessions, setLiveSessions] = useState([
    {
      id: 'tx1',
      station: 'Seoul',
      kwh: '45.2',
      revenue: 14200,
      time: '2m ago',
      deviceType: 'DC Fast'
    },
    {
      id: 'tx2',
      station: 'Busan',
      kwh: '62.4',
      revenue: 18500,
      time: '6m ago',
      deviceType: 'DC Fast'
    },
    {
      id: 'tx3',
      station: 'Jeju',
      kwh: '15.8',
      revenue: 4100,
      time: '12m ago',
      deviceType: 'L2 Slow'
    },
  ]);
  const actualRef = useRef(15450000);
  const monthlyRef = useRef(345120);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const doTransaction = () => {
      const gain = Math.floor(50 + Math.random() * 2950);
      const newTotal = actualRef.current + gain;
      actualRef.current = newTotal;
      monthlyRef.current = monthlyRef.current + gain;
      setPortfolioValue(newTotal);
      setMonthlyGain(monthlyRef.current);
      setLastTx(gain);

      const regions = ['Seoul', 'Busan', 'Jeju', 'Gyeonggi', 'Incheon'];
      const randomRegion = regions[Math.floor(Math.random() * regions.length)];

      const newSession = {
        id: `tx-${Date.now()}`,
        station: randomRegion,
        kwh: (Math.random() * 40 + 10).toFixed(1),
        revenue: gain,
        time: 'Just now',
        deviceType: Math.random() > 0.5 ? 'DC Fast' : 'L2 Slow'
      };

      setLiveSessions(prev => [newSession, ...prev].slice(0, 4));

      setTimeout(() => setLastTx(null), 2000);
      timeout = setTimeout(doTransaction, 2000 + Math.random() * 5000);
    };

    timeout = setTimeout(doTransaction, 1500);
    return () => clearTimeout(timeout);
  }, []);

  const intStr = Math.floor(portfolioValue).toLocaleString('en-US');
  const gainPct = ((monthlyGain / (actualRef.current - monthlyGain)) * 100).toFixed(1);

  const appleFont =
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

  return (
    <div className="flex flex-col h-full bg-[#090B11] text-white overflow-hidden shadow-2xl relative" style={{ fontFamily: appleFont }}>
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[-5%] w-[35%] h-[35%] bg-indigo-600/5 rounded-full blur-[100px]" />
      </div>

      <CommonHeader
        title="Home"
        onNotificationClick={onNavigateToNotifications}
      />

      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
        <div className="px-5 pt-5 pb-5 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#161B26]/40 backdrop-blur-2xl rounded-[32px] border border-white/5 p-5 relative overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
          >
            <div className="flex items-center justify-between w-full mb-4 relative z-10">
              <div className="flex flex-col gap-0.5">
                <motion.h2 className="text-[11px] font-medium tracking-wide text-slate-400 capitalize">
                  Dashboard Hub
                </motion.h2>
                <h3 className="text-base font-semibold text-white tracking-tight">Monthly Earnings</h3>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span className="text-[10px] font-medium text-slate-300 tracking-tight">Live Network</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center text-center relative z-10 py-0">
              <div className="relative mb-2">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-0.5"
                >
                  <span className={`font-semibold self-center text-slate-400 mr-2 ${monthlyGain > 100000000 ? 'text-base' : 'text-xl'}`}>
                    ₩
                  </span>
                  <div className="flex items-center relative py-2">
                    {monthlyGain.toLocaleString('en-US').split('').map((char, i, chars) => {
                      const keyFromEnd = chars.length - i;
                      const fontSize = monthlyGain > 100000000 ? 32 : 40;
                      return /[0-9]/.test(char) ? (
                        <motion.div key={keyFromEnd} layout transition={{ type: 'spring', stiffness: 100, damping: 20 }}>
                          <SmoothDigit digit={char} h={fontSize} color="#FFFFFF" />
                        </motion.div>
                      ) : (
                        <motion.span
                          key={keyFromEnd}
                          layout
                          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                          className="font-bold text-slate-500 self-end mb-1"
                          style={{ fontSize: fontSize * 0.7 }}
                        >
                          {char}
                        </motion.span>
                      );
                    })}
                  </div>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="w-full flex flex-col items-center gap-2"
              >
                <div className="w-full h-16 my-4 px-2 relative z-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[
                        { month: 'Oct', v: 285000 },
                        { month: 'Nov', v: 310000 },
                        { month: 'Dec', v: 295000 },
                        { month: 'Jan', v: 338000 },
                        { month: 'Feb', v: 345000 },
                        { month: 'Mar', v: 376611 },
                      ]}
                    >
                      <XAxis dataKey="month" hide />
                      <YAxis domain={['dataMin - 2000', 'dataMax + 5000']} hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1A1E2B',
                          border: '1px solid #2A3143',
                          borderRadius: '12px',
                          fontSize: '10px',
                          color: '#FFFFFF',
                        }}
                        itemStyle={{ color: '#0EA5E9', fontWeight: 'bold' }}
                        labelStyle={{ color: '#94A3B8', marginBottom: '2px', fontWeight: '600' }}
                        cursor={{ stroke: '#0EA5E9', strokeWidth: 1, strokeDasharray: '3 3' }}
                        formatter={(val: number) => [`₩${val.toLocaleString()}`, 'Revenue']}
                        labelFormatter={(label) => `${label} Earnings`}
                      />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="#0EA5E9"
                        strokeWidth={2}
                        fill="none"
                        isAnimationActive
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full h-[1px] bg-white/5 mb-1" />

                <div className="flex flex-col items-start w-full px-2">
                  <p className="text-[10px] font-medium text-slate-500 capitalize tracking-tight mb-1">Total Portfolio</p>
                  <div className="flex items-baseline gap-3">
                    <p className="text-xl font-semibold text-white tabular-nums tracking-tight">
                      ₩<AnimatedNumber value={portfolioValue} />
                    </p>
                    <div className="flex items-center gap-1 text-sky-400 bg-sky-400/5 px-2 py-0.5 rounded-full">
                      <ArrowUpRight className="w-2.5 h-2.5" />
                      <span className="text-[11px] font-medium tabular-nums">+{gainPct}%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        <div className="mb-8">
          <Slider
            dots
            infinite
            speed={500}
            slidesToShow={1}
            slidesToScroll={1}
            centerMode
            centerPadding="40px"
            arrows={false}
            className="portfolio-slider"
            dotsClass="slick-dots !bottom-[-30px]"
          >
            {portfolioData.map((portfolio) => (
              <div key={portfolio.id} className="px-2" style={{ outline: 'none' }}>
                <PortfolioCard
                  portfolio={portfolio}
                  onNavigateToPortfolioDetail={onNavigateToPortfolioDetail}
                />
              </div>
            ))}
          </Slider>
        </div>

        <div className="px-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold tracking-wider text-white uppercase">Real-World Impact</h2>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Leaf className="w-2.5 h-2.5 text-emerald-400" />
              <span className="text-[9px] font-extrabold text-emerald-400 tracking-wider">ECO</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#161B26] rounded-2xl p-4 flex flex-col justify-between border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-[20px] pointer-events-none group-hover:bg-emerald-500/20 transition-colors" />
              <div className="flex items-center gap-2 mb-3 z-10">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Wind className="w-3 h-3 text-emerald-400" />
                </div>
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">CO2 Prevented</p>
              </div>
              <div className="flex items-baseline gap-1 z-10">
                <p className="text-[28px] font-bold text-white tabular-nums tracking-tight">3,420</p>
                <span className="text-sm font-bold text-emerald-400">kg</span>
              </div>
            </div>

            <div className="bg-[#161B26] rounded-2xl p-4 flex flex-col justify-between border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-sky-500/10 rounded-full blur-[20px] pointer-events-none group-hover:bg-sky-500/20 transition-colors" />
              <div className="flex items-center gap-2 mb-3 z-10">
                <div className="w-6 h-6 rounded-full bg-sky-500/10 flex items-center justify-center">
                  <Zap className="w-3 h-3 text-sky-400" />
                </div>
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Clean Energy</p>
              </div>
              <div className="flex items-baseline gap-1 z-10">
                <p className="text-[28px] font-bold text-white tabular-nums tracking-tight">12.8</p>
                <span className="text-sm font-bold text-sky-400">MWh</span>
              </div>
            </div>

            <div className="col-span-2 bg-[#161B26] rounded-2xl p-5 flex items-center justify-between border border-white/5 relative overflow-hidden group mt-1 hover:border-white/10 transition-colors">
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-[30px] pointer-events-none group-hover:bg-emerald-500/20 transition-colors" />
              <div className="flex items-center gap-3 z-10">
                <div className="w-10 h-10 rounded-full bg-[#1A1E2B] border border-[#2A3143] flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">Environmental Equivalent</p>
                  <p className="text-xs font-semibold text-slate-500">Your Portfolio's Impact</p>
                </div>
              </div>
              <div className="flex flex-col items-end z-10">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-emerald-400">+</span>
                  <p className="text-[22px] font-bold text-white tabular-nums tracking-tight">142</p>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Trees Planted</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold tracking-wider text-white uppercase">Live Network Revenue</h2>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1C1C1E] border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-pulse" />
              <span className="text-[10px] font-bold text-gray-300 tracking-wider">REAL-TIME</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {liveSessions.map((session) => (
                <motion.div
                  key={session.id}
                  layout
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="flex items-center justify-between p-4 rounded-[20px] bg-[#1C1C1E] border border-white/5 shadow-sm relative overflow-hidden group hover:border-[#30D158]/30 transition-colors"
                >
                  <div className="absolute top-0 right-0 w-24 h-full bg-[#30D158]/5 blur-[20px] pointer-events-none" />

                  <div className="flex items-center gap-4 relative z-10 w-full">
                    <div className="w-10 h-10 rounded-full bg-[#2C2C2E] flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-[#30D158]" />
                    </div>

                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 pr-2">
                          <h3 className="text-[15px] font-semibold text-white tracking-tight truncate">
                            {session.station}
                          </h3>
                        </div>
                        <p className="text-[15px] font-semibold text-[#30D158] tracking-tight shrink-0 tabular-nums">
                          +₩{session.revenue.toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[12px] text-gray-400 font-medium truncate">{session.kwh} kWh • {session.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Shield className="w-3 h-3 text-[#30D158]" />
                          <span className="text-[10px] text-[#30D158] font-bold tracking-wider uppercase">SE Verified</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Material3BottomNav
        activeTab="home"
        onNavigateToHome={() => { }}
        onNavigateToExplore={onNavigateToExplore}
        onNavigateToPortfolio={onNavigateToPortfolio}
        onNavigateToMore={onNavigateToMore}
      />
    </div>
  );
}
