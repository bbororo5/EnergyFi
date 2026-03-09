import {
  Search,
  Home,
  TrendingUp,
  User,
  SlidersHorizontal,
  MapPin,
  List,
  ChevronDown,
  Zap,
  Activity,
  BarChart3,
  Shield,
  TrendingDown,
  Grid3X3
} from 'lucide-react';
import React, { useState, useRef } from 'react';
import { Material3BottomNav } from './Material3BottomNav';
import { CommonHeader } from './CommonHeader';

interface ExploreProps {
  onNavigateToHome?: () => void;
  onNavigateToDetail?: () => void;
  onNavigateToPortfolio?: () => void;
  onNavigateToMore?: () => void;
  onNavigateToLearn?: () => void;
  onNavigateToNotifications?: () => void;
}

export function Explore({ onNavigateToHome, onNavigateToDetail, onNavigateToPortfolio, onNavigateToMore, onNavigateToLearn, onNavigateToNotifications }: ExploreProps) {
  const [activeFilters, setActiveFilters] = useState<string[]>(['All Regions']);
  const [sheetPosition, setSheetPosition] = useState<'collapsed' | 'half' | 'full'>('half');

  const filterChips = [
    'All Regions',
    'Seoul',
    'Highest APY',
    'Low Volatility',
    'Night Demand',
    'Growth'
  ];

  const toggleFilter = (filter: string) => {
    if (activeFilters.includes(filter)) {
      setActiveFilters(activeFilters.filter(f => f !== filter));
    } else {
      setActiveFilters([...activeFilters, filter]);
    }
  };

  const portfolios = [
    {
      id: 1,
      name: 'Seoul',
      subtitle: 'Premium Residential Network',
      region: 'Seoul',
      chargers: 24,
      utilization: 68.5,
      demandStrength: 85,
      stability: 92,
      volatility: 'Low',
      diversification: 78,
      apy: 8.2
    },
    {
      id: 2,
      name: 'Busan',
      subtitle: 'Marine Commercial Network',
      region: 'Busan',
      chargers: 18,
      utilization: 72.3,
      demandStrength: 78,
      stability: 88,
      volatility: 'Medium',
      diversification: 65,
      apy: 9.1
    },
    {
      id: 3,
      name: 'Gyeonggi',
      subtitle: 'Suburban Distribution Network',
      region: 'Gyeonggi',
      chargers: 32,
      utilization: 64.8,
      demandStrength: 72,
      stability: 85,
      volatility: 'Low',
      diversification: 88,
      apy: 7.5
    },
    {
      id: 4,
      name: 'Incheon',
      subtitle: 'Industrial Logistics Hub',
      region: 'Incheon',
      chargers: 16,
      utilization: 75.2,
      demandStrength: 82,
      stability: 79,
      volatility: 'Medium',
      diversification: 58,
      apy: 8.8
    }
  ];

  // Horizontal drag-to-scroll logic for chips
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  // Bottom Sheet Drag Logic
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetDragStart, setSheetDragStart] = useState<number | null>(null);

  const handleSheetDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const clientY = e.clientY;
    setSheetDragStart(clientY);
  };

  const handleSheetDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sheetDragStart === null) return;
    const clientY = e.clientY;
    const deltaY = clientY - sheetDragStart;

    if (deltaY > 50) {
      // Swiped down
      if (sheetPosition === 'full') setSheetPosition('half');
      else if (sheetPosition === 'half') setSheetPosition('collapsed');
    } else if (deltaY < -50) {
      // Swiped up
      if (sheetPosition === 'collapsed') setSheetPosition('half');
      else if (sheetPosition === 'half') setSheetPosition('full');
    }
    setSheetDragStart(null);
  };

  const handleSheetDragCancel = () => {
    setSheetDragStart(null);
  };

  const appleFont = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

  return (
    <div className="h-full flex flex-col bg-[#090B11] text-white overflow-hidden relative" style={{ fontFamily: appleFont }}>
      {/* Absolute Map Base Layer */}
      <div className="absolute inset-0 z-0 bg-[#0B0C10] flex flex-col items-center justify-center overflow-hidden">
        {/* Map Placeholder Grid Lines */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#2A3143 1px, transparent 1px), linear-gradient(90deg, #2A3143 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

        {/* Simulated Data Points */}
        <div className="absolute top-[20%] left-[30%] w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.5)] border-2 border-[#12151D] animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
        <div className="absolute top-[45%] left-[60%] w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)] border-2 border-[#12151D] animate-pulse" style={{ animationDelay: '0.5s' }}>
          <div className="w-3 h-3 bg-white rounded-full"></div>
        </div>
        <div className="absolute top-[65%] left-[35%] w-5 h-5 bg-sky-500/80 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.3)] border-2 border-[#12151D] animate-pulse" style={{ animationDelay: '1s' }}>
          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
        </div>
      </div>

      {/* Floating Header UI */}
      <div className="relative z-10 bg-gradient-to-b from-[#0B0C10] via-[#0B0C10]/80 to-transparent pb-6 pt-2 pointer-events-none">
        <div className="pointer-events-auto">
          <CommonHeader
            title="Explore"
            onNotificationClick={onNavigateToNotifications}
          />
        </div>

        {/* Sub Header with Search and Filters */}
        <div className="px-5 mt-4 pointer-events-auto">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search by region or asset..."
              className="w-full bg-[#0B0E14]/70 backdrop-blur-md rounded-2xl pl-12 pr-4 py-3.5 text-[15px] font-medium text-white placeholder:text-slate-500 border border-white/5 focus:outline-none focus:ring-2 focus:ring-sky-500/30 shadow-lg"
            />
          </div>

          {/* Filter Chips */}
          <div
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className="flex gap-2.5 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide select-none cursor-grab active:cursor-grabbing"
          >
            {filterChips.map((filter) => (
              <button
                key={filter}
                onClick={() => toggleFilter(filter)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-bold tracking-wide transition-all border shadow-lg backdrop-blur-md ${activeFilters.includes(filter)
                  ? 'bg-sky-500 text-white border-sky-400'
                  : 'bg-[#0B0E14]/70 text-slate-300 border-white/10 hover:border-white/20 hover:bg-[#151924]/80'
                  }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Draggable Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-[#0B0E14] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 transition-transform duration-300 ease-out flex flex-col z-20 ${sheetPosition === 'collapsed' ? 'translate-y-[calc(100%-188px)] h-[85vh]' :
          sheetPosition === 'half' ? 'translate-y-[45vh] h-[85vh]' :
            'translate-y-[5vh] h-[95vh]'
          }`}
      >
        {/* Drag Handle area */}
        <div
          className="w-full pt-4 pb-3 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={handleSheetDragStart}
          onPointerUp={handleSheetDragEnd}
          onPointerCancel={handleSheetDragCancel}
        >
          <div className="w-12 h-1.5 bg-[#2A3143] rounded-full mb-2" />
          <span className={`text-[12px] font-medium text-slate-500 transition-opacity duration-300 ${sheetPosition === 'collapsed' ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
            Swipe up to view 18 portfolios
          </span>
        </div>

        {/* Portfolio List */}
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-32 scrollbar-hide">
          <div className="space-y-4">
            {portfolios.map((portfolio) => (
              <div
                key={portfolio.id}
                onClick={onNavigateToDetail}
                className="bg-gradient-to-br from-[#1E2235] to-[#0B0E14] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.2)] border border-[#2A3143] active:scale-[0.99] transition-transform cursor-pointer relative overflow-hidden group"
              >
                {/* Background Subtlety */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-sky-500/5 rounded-full blur-[30px] pointer-events-none group-hover:bg-sky-500/10 transition-colors"></div>

                {/* Header */}
                <div className="flex items-start justify-between mb-3 relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 bg-sky-500/10 rounded-lg flex items-center justify-center">
                        <Zap className="w-4 h-4 text-sky-400" strokeWidth={2.5} />
                      </div>
                      <h3 className="text-[18px] font-semibold text-white">
                        {portfolio.name}
                      </h3>
                    </div>
                    <p className="text-[14px] text-slate-400 leading-relaxed">
                      {portfolio.subtitle}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-[20px] font-semibold text-emerald-400">
                      {portfolio.apy}%
                    </p>
                    <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">APY</p>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                  <div className="bg-[#12151D] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
                      <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Chargers</p>
                    </div>
                    <p className="text-[16px] font-semibold text-white">
                      {portfolio.chargers} units
                    </p>
                  </div>

                  <div className="bg-[#12151D] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
                      <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Utilization</p>
                    </div>
                    <p className="text-[16px] font-semibold text-white">
                      {portfolio.utilization}%
                    </p>
                  </div>
                </div>

                {/* Detailed Metrics */}
                <div className="space-y-3 mb-4 relative z-10">
                  {/* Demand Strength */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
                        <span className="text-[13px] font-medium text-slate-400">Demand Strength</span>
                      </div>
                      <span className="text-[13px] font-bold text-sky-400">
                        {portfolio.demandStrength}%
                      </span>
                    </div>
                    <div className="w-full bg-[#12151D] border border-white/5 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-sky-400 h-full rounded-full"
                        style={{ width: `${portfolio.demandStrength}%` }}
                      />
                    </div>
                  </div>

                  {/* Operational Stability */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
                        <span className="text-[13px] font-medium text-slate-400">Operational Stability</span>
                      </div>
                      <span className="text-[13px] font-bold text-emerald-400">
                        {portfolio.stability}%
                      </span>
                    </div>
                    <div className="w-full bg-[#12151D] border border-white/5 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full"
                        style={{ width: `${portfolio.stability}%` }}
                      />
                    </div>
                  </div>

                  {/* Diversification */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Grid3X3 className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
                        <span className="text-[13px] font-medium text-slate-400">Diversification</span>
                      </div>
                      <span className="text-[13px] font-bold text-emerald-400">
                        {portfolio.diversification}%
                      </span>
                    </div>
                    <div className="w-full bg-[#12151D] border border-white/5 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${portfolio.diversification}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Volatility Badge */}
                <div className="flex items-center gap-2 relative z-10 pt-2 border-t border-white/5 mt-2">
                  <TrendingDown className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
                  <span className="text-[12px] font-medium text-slate-400">Volatility:</span>
                  <span className={`text-[11px] font-bold tracking-wider px-2.5 py-1 rounded-md uppercase ${portfolio.volatility === 'Low'
                    ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}>
                    {portfolio.volatility}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <Material3BottomNav
        activeTab="explore"
        onNavigateToHome={onNavigateToHome}
        onNavigateToExplore={() => { }}
        onNavigateToPortfolio={onNavigateToPortfolio}
        onNavigateToMore={onNavigateToMore}
      />
    </div>
  );
}
