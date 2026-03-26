"use client";

import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';

interface MarketData {
  id: string;
  name: string;
  region: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  history: { date: string, price: number }[];
}

export default function MarketWidget() {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1d' | '1mo' | '1y'>('1mo');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/markets?range=${timeRange}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMarkets(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load market data', err);
        setLoading(false);
      });
  }, [timeRange]);

  if (loading) {
     return (
       <div className="w-80 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-xs text-neutral-500 animate-pulse">
         <Activity className="w-5 h-5 mb-2 text-emerald-500/50" />
         Syncing Global Markets...
       </div>
     );
  }

  if (!markets.length) return null;

  return (
    <div className="w-80 h-auto max-h-[calc(100vh-120px)] overflow-y-auto bg-black/80 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      <div className="sticky top-0 p-4 border-b border-white/10 bg-black/80 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-200">Global Markets</h2>
        </div>
        <div className="flex bg-white/5 rounded border border-white/10 overflow-hidden text-[9px]">
          <button 
            onClick={() => setTimeRange('1d')} 
            className={`px-2 py-0.5 transition ${timeRange === '1d' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/10'}`}
          >
            1D
          </button>
          <button 
            onClick={() => setTimeRange('1mo')} 
            className={`px-2 py-0.5 border-l border-white/10 transition ${timeRange === '1mo' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/10'}`}
          >
            1M
          </button>
          <button 
            onClick={() => setTimeRange('1y')} 
            className={`px-2 py-0.5 border-l border-white/10 transition ${timeRange === '1y' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/10'}`}
          >
            1Y
          </button>
        </div>
      </div>
      
      <div className="p-2 space-y-2">
        {markets.map((m) => {
          const isPositive = m.change >= 0;
          return (
            <div key={m.id} className="p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-sm text-neutral-100">{m.name}</div>
                  <div className="text-[10px] text-neutral-500">{m.region}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-white">
                    {m.id === 'CL=F' ? '$' : ''}{m.currentPrice.toFixed(2)}
                  </div>
                  <div className={`flex items-center justify-end gap-1 text-[10px] font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isPositive ? '+' : ''}{m.change.toFixed(2)} ({isPositive ? '+' : ''}{m.changePercent.toFixed(2)}%)
                  </div>
                </div>
              </div>

              {/* Sparkline Chart */}
              <div style={{ width: '100%', height: 64, minHeight: 64 }} className="mt-2 opacity-60 group-hover:opacity-100 transition duration-500">
                <ResponsiveContainer width="100%" height={64}>
                  <AreaChart data={m.history}>
                    <defs>
                      <linearGradient id={`color-${m.id}`}x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <YAxis domain={['auto', 'auto']} hide />
                    <XAxis dataKey="date" hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }}
                      itemStyle={{ color: '#fff' }}
                      labelFormatter={(label) => {
                        const d = new Date(label);
                        if (timeRange === '1d') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        if (timeRange === '1mo') return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        return d.getFullYear().toString();
                      }}
                      formatter={(val: any) => [val?.toFixed(2) || '0.00', 'Price']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke={isPositive ? '#10b981' : '#ef4444'} 
                      strokeWidth={1.5}
                      fillOpacity={1} 
                      fill={`url(#color-${m.id})`} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
