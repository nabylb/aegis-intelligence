"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { IntelEvent } from '@/lib/types';
import IntelMap from './Map';
import MarketWidget from './MarketWidget';
import StrikeTimeline from './StrikeTimeline';
import { Activity, ShieldAlert, Cpu, RadioTower, Database, History, MapPin, Anchor, Plane, Shield, LineChart, Flame, Camera, Satellite, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useMap } from 'react-map-gl/maplibre';

export default function IntelDashboard() {
  const [events, setEvents] = useState<IntelEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [historicalFilterDays, setHistoricalFilterDays] = useState<number>(1); // Default to 24h
  const [showBases, setShowBases] = useState<boolean>(true);
  const [showBoats, setShowBoats] = useState<boolean>(true);
  const [showMilitary, setShowMilitary] = useState<boolean>(true);
  const [showCivilian, setShowCivilian] = useState<boolean>(true);
  const [showAviation, setShowAviation] = useState<boolean>(true);
  const [showCasualties, setShowCasualties] = useState<boolean>(true);
  const [showStrikes, setShowStrikes] = useState<boolean>(true);
  const [showFinance, setShowFinance] = useState<boolean>(false);
  const [showSatellite, setShowSatellite] = useState<boolean>(true);
  const [usOnly, setUsOnly] = useState<boolean>(false);
  const [breakingNews, setBreakingNews] = useState<IntelEvent | null>(null);
  const [breakingHistory, setBreakingHistory] = useState<IntelEvent[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isSigintExpanded, setIsSigintExpanded] = useState(true);
  const mapContext = (() => { try { return useMap(); } catch { return {}; } })();
  const mainMap = (mapContext as any)?.mainMap ?? null;

  useEffect(() => {
    try {
      // Hydrate Flash Override history
      const savedHistory = localStorage.getItem('aegis-breaking-history');
      if (savedHistory) setBreakingHistory(JSON.parse(savedHistory));
      // Hydrate cached events (casualties, GDELT, AIS) for instant map population on reload
      // Hydrate cached events (casualties, GDELT, AIS) for instant map population on reload
      // Use versioned key so stale broken-ID caches are automatically ignored
      const savedEvents = localStorage.getItem('aegis-events-v3');
      if (savedEvents) {
        const parsed: IntelEvent[] = JSON.parse(savedEvents);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEvents(dedup(parsed));
        }
      }
    } catch (e) {
      console.error('Failed to hydrate cache', e);
    }
  }, []);

  // Global dedup gate — coerces IDs to string (guards against object IDs from old cache/feeds)
  const dedup = (arr: IntelEvent[]) => {
    const normalized = arr
      .filter(e => e?.id != null)
      .map(e => ({ ...e, id: typeof e.id === 'string' ? e.id : String(e.id) }))
      .filter(e => e.id && e.id !== '[object Object]');
    return Array.from(new Map(normalized.map(e => [e.id, e])).values());
  };

  const aviationEvents = useMemo(() => events.filter(e => e.type === 'aviation'), [events]);

  // SIGINT feed: exclude aviation (separate panel) and bulk AIS vessels (map-only).
  // Keep AIS military vessels and vessels with interesting activity.
  const sigintFeedEvents = useMemo(() => {
    return events.filter(e => {
      if (e.type === 'aviation') return false;
      // Filter AIS civilian noise — only show military or named vessels with destinations
      if (e.source === 'Global AIS Satellite' && !e.entity?.isMilitary) return false;
      // Apply satellite layer filter to satellite events based on strikes timeline
      if (e.type === 'satellite' && !showSatellite) return false;
      if (e.type === 'satellite' && historicalFilterDays > 0) {
        const cutoff = new Date(Date.now() - historicalFilterDays * 86400000);
        if (new Date(e.timestamp) < cutoff) return false;
      }
      return true;
    });
  }, [events, showSatellite, historicalFilterDays]);

  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.onopen = () => {
      setConnectionStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          const clean = dedup(data.events);
          setEvents(clean);
          // Persist using versioned key
          try { localStorage.setItem('aegis-events-v3', JSON.stringify(clean.slice(0, 1200))); } catch {}
        } else if (data.type === 'update') {
          // Merge and keep the latest 200 events to prevent memory leaks
          setEvents((prev) => {
            // ADDITIVE ONLY: only add genuinely new events, never remove existing ones
            // This prevents the 60s update tick from wiping data accumulated since init
            const prevIds = new Set(prev.map((e: IntelEvent) => e.id));
            const incoming = data.events.filter((e: IntelEvent) => e?.id && !prevIds.has(e.id));
            const merged = dedup([...incoming, ...prev]);

            // Detect Breaking News from INCOMING new events only (not re-check stale ones)
            const fifteenMinsAgo = Date.now() - 15 * 60000;
            const recentCriticals = incoming.filter((e: IntelEvent) => {
              if (!e?.timestamp) return false;
              return (e.severity === 'high' || e.severity === 'critical') &&
                     e.type === 'news' &&
                     new Date(e.timestamp).getTime() > fifteenMinsAgo;
            });
            if (recentCriticals.length > 0) {
              const candidate = recentCriticals[0];
              setBreakingHistory(historic => {
                const normalTitle = candidate.title?.toLowerCase().trim() || '';
                const dupe = historic.find(
                  h => h.id === candidate.id || h.title?.toLowerCase().trim() === normalTitle
                );
                if (dupe) return historic;
                const newHist = [candidate, ...historic].slice(0, 50);
                try { localStorage.setItem('aegis-breaking-history', JSON.stringify(newHist)); } catch {}
                setBreakingNews(p => p?.title?.toLowerCase().trim() === normalTitle ? p : candidate);
                return newHist;
              });
            }

            return merged.slice(0, 2500);
          });
        }
      } catch (err) {
        console.error("Failed to parse SSE message", err);
      }
    };

    eventSource.onerror = () => {
      // Browsers natively drop SSE connections periodically or during Next.js hot reloads.
      // We silently set connection status to error so the UI shows "RECONNECTING..."
      setConnectionStatus('error');
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Compute stats for SITREP
  const highSeverityCount = events.filter(e => e.severity === 'high' || e.severity === 'critical').length;
  const flightsCount = events.filter(e => e.type === 'aviation').length;
  
  // Calculate Strategic Momentum % based on rolling impact
  // Sigmoid-like scaling maps the score to a 0-100% range, where 50% is pure neutral.
  const momentumScore = events.reduce((acc, evt) => acc + (evt.strategicScore || 0), 0);
  
  // Base 50% with constraints. If negative, US leads. If positive, Iran leads.
  const basePercent = 50 + (momentumScore * 1.5); 
  const clampedPercent = Math.max(0, Math.min(100, basePercent));

  let momentumText = "NEUTRAL (50%)";
  let momentumColor = "text-neutral-400";
  if (clampedPercent < 45) {
    momentumText = `US/ISRAEL ADVANTAGE (${(100 - clampedPercent).toFixed(1)}%) - Geopol/Econ Dominance`;
    momentumColor = "text-blue-400";
  } else if (clampedPercent > 55) {
    momentumText = `IRAN/PROXY ADVANTAGE (${clampedPercent.toFixed(1)}%) - Geopol/Econ Disruptions`;
    momentumColor = "text-red-400";
  } else {
    momentumText = `STALEMATE (${clampedPercent.toFixed(1)}%) - Negligible Asymmetry`;
    momentumColor = "text-neutral-400";
  }

  const sitrepSummary = useMemo(() => {
    if (events.length === 0) return "Awaiting initial datalink...";
    if (highSeverityCount > 5) return "CRITICAL: Multiple high-severity kinetic events detected across theater. Heightened aviation activity.";
    if (highSeverityCount > 0) return "WARNING: Isolated kinetic events detected. Aviation vectors maintaining standard patrols.";
    return "NOMINAL: Routine SIGINT chatter. No immediate kinetic threats detected.";
  }, [events, highSeverityCount]);

  const handleFlyTo = (lng: number, lat: number) => {
    if (mainMap) {
      mainMap.flyTo({ center: [lng, lat], zoom: 8, duration: 1500 });
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 text-neutral-300 font-mono selection:bg-neutral-800">
      
      {/* Background Map layer */}
      <IntelMap
        events={events}
        historicalFilterDays={historicalFilterDays}
        showBases={showBases}
        showBoats={showBoats}
        showMilitary={showMilitary}
        showCivilian={showCivilian}
        showAviation={showAviation}
        showStrikes={showStrikes}
        showCasualties={showCasualties}
        showSatellite={showSatellite}
        usOnly={usOnly}
      />

      {/* Flash Override History — rendered at ROOT level, outside any stacking context */}
      {showHistoryModal && (
        <>
          <div className="fixed inset-0 z-[99990] bg-black/40 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)} />
          <div className="fixed top-20 left-[72px] w-[420px] max-h-[calc(100vh-120px)] bg-black/95 backdrop-blur-3xl border border-white/10 rounded-xl shadow-2xl z-[99999] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest">⚡ Flash Override History</h3>
              <div className="flex items-center gap-2">
                {breakingHistory.length > 0 && (
                  <button onClick={() => { setBreakingHistory([]); localStorage.removeItem('aegis-breaking-history'); }}
                    className="text-[10px] text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-500/50 px-2 py-0.5 rounded transition">
                    Clear All
                  </button>
                )}
                <button onClick={() => setShowHistoryModal(false)} className="text-neutral-500 hover:text-white text-xs transition">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/20">
              {breakingHistory.length === 0 ? (
                <div className="text-center text-neutral-600 text-xs mt-10">No critical alerts logged.</div>
              ) : breakingHistory.map((evt, i) => (
                <div key={`bh-${String(evt?.id ?? '')}-${i}`}
                  onClick={() => { if (evt.location) { handleFlyTo(evt.location.lng, evt.location.lat); setShowHistoryModal(false); } }}
                  className="p-3 bg-red-950/30 border border-red-900/50 hover:bg-red-900/50 transition rounded-lg cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-bold text-red-400 tracking-wider">CRITICAL UPDATE</span>
                    <span className="text-[10px] text-neutral-500">{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-sm font-bold text-white mb-1 leading-snug group-hover:text-red-100 transition">{evt.title}</div>
                  <div className="text-xs text-neutral-400 line-clamp-2">{evt.summary || evt.source}</div>
                  {evt.location && <div className="text-[9px] text-blue-400 mt-1">📍 Click to fly to location</div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Breaking News Toast */}
      {breakingNews && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-500">
          <div className="bg-red-950/90 border border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] backdrop-blur-xl rounded-lg flex items-start gap-4 p-4 max-w-2xl cursor-pointer hover:bg-red-900/90 transition"
               onClick={() => {
                 if (breakingNews.location) handleFlyTo(breakingNews.location.lng, breakingNews.location.lat);
                 setBreakingNews(null);
               }}>
            <div className="bg-red-500 text-white p-2 rounded-full animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-red-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-widest">FLASH OVERRIDE</span>
                <span className="text-red-300 text-xs font-mono">{formatDistanceToNow(new Date(breakingNews.timestamp))} ago</span>
              </div>
              <h3 className="text-white font-bold text-lg leading-tight mb-1">{breakingNews.title}</h3>
              <p className="text-red-200/80 text-sm line-clamp-2">{breakingNews.summary || breakingNews.source}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation / Status Bar */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-neutral-950/40 backdrop-blur-md border-b border-white/5 z-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 rounded-lg border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <ShieldAlert className="w-5 h-5 text-neutral-100" />
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-neutral-100 font-bold tracking-widest text-sm uppercase">Aegis Oversight</h1>
              
              {/* Notification Bell */}
              <div className="relative">
                <button 
                  onClick={() => setShowHistoryModal(!showHistoryModal)}
                  className={`p-1.5 rounded-full transition ${breakingHistory.length > 0 ? 'bg-red-500/20 text-red-500 hover:bg-red-500/40' : 'text-neutral-500 hover:bg-white/10'}`}
                >
                  <Activity className="w-4 h-4" />
                </button>
                {/* Bell badge */}
                {breakingHistory.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center border border-black pointer-events-none">
                    {breakingHistory.length > 9 ? '9+' : breakingHistory.length}
                  </span>
                )}
              </div>
            </div>
            <div className="text-[10px] text-neutral-500 tracking-wider flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {connectionStatus === 'connected' ? 'LIVE SATCOM LINK: ACTIVE' : 'RECONNECTING...'}
            </div>
          </div>
        </div>

        {/* Global Layer Controls */}
        <div className="flex gap-4 items-center">
          
          <div className="flex items-center bg-black/40 rounded-lg border border-white/5 p-1 gap-1 text-[10px] font-bold">
            <button onClick={() => setShowBases(!showBases)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${showBases ? 'bg-blue-500/20 text-blue-300' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <Shield className="w-3.5 h-3.5" /> BASES
            </button>
            <div className="flex flex-col gap-0.5">
              <button 
                onClick={() => {
                  const newState = !showBoats;
                  setShowBoats(newState);
                  setShowMilitary(newState);
                  setShowCivilian(newState);
                }} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${showBoats ? 'bg-blue-500/20 text-blue-300' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <Anchor className="w-3.5 h-3.5" /> NAVAL
              </button>
              {showBoats && (
                <div className="flex gap-1 px-1">
                  <button 
                    onClick={() => setShowMilitary(!showMilitary)} 
                    className={`px-1.5 py-0.5 rounded text-[8px] transition ${showMilitary ? 'bg-blue-500/30 text-blue-200' : 'bg-white/5 text-neutral-600 hover:text-neutral-400'}`}
                  >
                    MIL
                  </button>
                  <button 
                    onClick={() => setShowCivilian(!showCivilian)} 
                    className={`px-1.5 py-0.5 rounded text-[8px] transition ${showCivilian ? 'bg-blue-500/30 text-blue-200' : 'bg-white/5 text-neutral-600 hover:text-neutral-400'}`}
                  >
                    CIV
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setShowAviation(!showAviation)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${showAviation ? 'bg-blue-500/20 text-blue-300' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <Plane className="w-3.5 h-3.5" /> AVIATION
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button onClick={() => setShowStrikes(!showStrikes)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${showStrikes ? 'bg-orange-500/20 text-orange-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <Flame className="w-3.5 h-3.5" /> KINETIC STRIKES
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button onClick={() => setShowCasualties(!showCasualties)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${showCasualties ? 'bg-red-500/20 text-red-300' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <ShieldAlert className="w-3.5 h-3.5" /> CASUALTIES
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button onClick={() => setShowSatellite(!showSatellite)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${showSatellite ? 'bg-violet-500/20 text-violet-300' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <Satellite className="w-3.5 h-3.5" /> SATELLITE
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button onClick={() => setShowFinance(!showFinance)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${showFinance ? 'bg-emerald-500/20 text-emerald-300' : 'text-neutral-500 hover:text-neutral-300'}`}>
              <LineChart className="w-3.5 h-3.5" /> FINANCE
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button onClick={() => setUsOnly(!usOnly)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${usOnly ? 'bg-white text-black' : 'text-neutral-500 hover:text-neutral-300'}`}>
              US / ISRAEL ONLY
            </button>
          </div>
          
          <div className="flex items-center bg-black/40 rounded-lg border border-white/5 overflow-hidden text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border-r border-white/10 text-orange-400 font-medium">
              <History className="w-3.5 h-3.5" /> TIMELINE:
            </div>
            {['OFF', '24H', '7D', '30D', '6M'].map((lbl, i) => {
              const val = lbl === 'OFF' ? 0 : lbl === '24H' ? 1 : lbl === '7D' ? 7 : lbl === '30D' ? 30 : 180;
              return (
                <button 
                  key={lbl}
                  onClick={() => setHistoricalFilterDays(val)}
                  className={`px-3 py-1.5 border-r border-white/5 last:border-0 transition ${
                    historicalFilterDays === val ? 'bg-orange-500/20 text-orange-300 font-bold' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-6 text-xs bg-black/40 px-4 py-2 rounded-lg border border-white/5">
          <div className="flex flex-col items-end">
            <span className="text-neutral-500">THREATS DETECTED</span>
            <span className={`font-bold ${highSeverityCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {highSeverityCount}
            </span>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex flex-col items-end">
            <span className="text-neutral-500">TRACKED FLIGHTS</span>
            <span className="font-bold text-blue-400">{flightsCount}</span>
          </div>
        </div>
      </header>

      {/* Bottom Panel: 24H SITREP SUMMARY */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[600px] bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl z-20 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
        <div className="p-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-200">24H Automated SITREP</h2>
          </div>
        </div>
        <div className="p-4 text-xs leading-relaxed text-neutral-300">
          <p className="mb-2"><span className="text-emerald-400 font-bold">STATUS:</span> {sitrepSummary}</p>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
            <div>
              <div className="text-neutral-500 mb-1">Total Intercepts</div>
              <div className="font-mono text-lg">{events.length}</div>
            </div>
            <div>
              <div className="text-neutral-500 mb-1">Critical Threats</div>
              <div className="font-mono text-lg text-red-400">{highSeverityCount}</div>
            </div>
            <div>
              <div className="text-neutral-500 mb-1">Active Vectors</div>
              <div className="font-mono text-lg text-blue-400">{flightsCount}</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex gap-2 items-center">
             <span className="text-neutral-500 font-bold tracking-widest text-[10px]">STRATEGIC MOMENTUM:</span>
             <span className={`font-mono text-xs ${momentumColor}`}>{momentumText}</span>
          </div>
        </div>
      </div>

      {/* Global Financial Markets Overlay */}
      <div className={`absolute top-20 z-20 transition-all duration-500 ease-in-out ${
        showFinance ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[120%] pointer-events-none'
      } ${showAviation ? 'right-[310px]' : 'right-4'}`}>
        <MarketWidget />
      </div>

      {/* Left Sidebar: Live Intel Feed */}
      <aside className={`absolute top-20 left-4 bottom-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl z-20 flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ${isSigintExpanded ? 'w-96' : 'w-14'}`}>
        <div className={`p-4 border-b border-white/10 bg-white/5 flex ${isSigintExpanded ? 'items-center gap-2 justify-between' : 'justify-center py-4 px-2'}`}>
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsSigintExpanded(!isSigintExpanded)}>
            <RadioTower className={`w-4 h-4 text-amber-500 group-hover:text-amber-400 ${!isSigintExpanded ? 'w-5 h-5' : ''}`} />
            {isSigintExpanded && <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-200">Live Sigint Feed</h2>}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {sigintFeedEvents.map((evt, i) => (
            <div
              key={`sig-${String(evt?.id ?? '')}-${i}`}
              className={`relative group ${isSigintExpanded ? 'pl-4' : 'pl-0 flex justify-center'} cursor-pointer transition rounded-r-lg`}
              onClick={() => {
                if (!isSigintExpanded) setIsSigintExpanded(true);
                else if (evt.location) handleFlyTo(evt.location.lng, evt.location.lat);
              }}
            >
              <div className={`absolute ${isSigintExpanded ? 'left-[3px]' : 'left-1/2 -translate-x-1/2'} top-2 bottom-[-1rem] w-px bg-white/10 group-last:hidden`} />
              <div className={`absolute ${isSigintExpanded ? 'left-0' : 'left-1/2 -translate-x-1/2'} top-1.5 w-2 h-2 rounded-full border border-black z-10 ${
                evt.severity === 'critical' ? 'bg-red-600 outline outline-1 outline-red-600/50' :
                evt.severity === 'high' ? 'bg-orange-500' :
                evt.type === 'satellite' ? 'bg-violet-500' :
                evt.type === 'naval' ? 'bg-cyan-500' :
                'bg-neutral-500'
              }`} />

              {isSigintExpanded && (
                <div className="pl-4 pb-2 hover:bg-white/5 rounded-r-lg p-2 -mt-2">
                  {/* Type badge + timestamp row */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${
                        evt.type === 'satellite' ? 'bg-violet-500/20 text-violet-400' :
                        evt.type === 'strike' ? 'bg-red-500/20 text-red-400' :
                        evt.type === 'conflict' ? 'bg-orange-500/20 text-orange-400' :
                        evt.type === 'naval' ? 'bg-cyan-500/20 text-cyan-400' :
                        evt.type === 'military' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-white/5 text-neutral-500'
                      }`}>
                        {evt.type === 'satellite' ? 'SAT' : evt.type === 'naval' ? 'NAVAL' : evt.type === 'strike' ? 'STRIKE' : evt.type === 'conflict' ? 'CONFLICT' : evt.type === 'military' ? 'MIL' : 'INTEL'}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-medium">
                        {formatDistanceToNow(new Date(evt.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    {evt.sourceUrl ? (
                      <a
                        href={evt.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[9px] uppercase tracking-wider bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/5 text-neutral-400 hover:text-white transition-colors group/link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {evt.source.length > 20 ? evt.source.slice(0, 18) + '...' : evt.source}
                        <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover/link:opacity-100 transition-opacity" />
                      </a>
                    ) : (
                      <span className="text-[9px] uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded border border-white/5 text-neutral-400">
                        {evt.source.length > 20 ? evt.source.slice(0, 18) + '...' : evt.source}
                      </span>
                    )}
                  </div>
                  {/* Title */}
                  <h3 className={`text-sm font-medium leading-snug mb-1 ${
                    evt.severity === 'critical' || evt.severity === 'high' ? 'text-neutral-100' : 'text-neutral-300'
                  }`}>
                    {evt.title}
                  </h3>
                  {/* Summary snippet for non-trivial summaries */}
                  {evt.summary && evt.summary.length > 10 && evt.summary !== evt.title && (
                    <p className="text-[11px] text-neutral-500 leading-relaxed line-clamp-2 mb-1.5">{evt.summary}</p>
                  )}
                  {/* Hero / payload image */}
                  {evt.payloadImage && (
                    <div className="mt-1.5 relative w-full h-36 rounded-lg overflow-hidden border border-white/5 bg-neutral-900 group/img">
                      <img
                        src={evt.payloadImage}
                        className="w-full h-full object-cover grayscale-[0.3] group-hover/img:grayscale-0 transition-all duration-500"
                        referrerPolicy="no-referrer"
                        onError={(e: any) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                      />
                      <div className={`absolute top-2 right-2 px-1.5 py-0.5 text-white text-[8px] font-bold rounded uppercase tracking-tighter flex items-center gap-1 shadow-lg ${
                        evt.type === 'satellite' ? 'bg-violet-600' : evt.type === 'naval' ? 'bg-cyan-600' : 'bg-neutral-700'
                      }`}>
                        <Camera className="w-2.5 h-2.5" /> {evt.type === 'satellite' ? 'SAT IMAGERY' : evt.type === 'naval' ? 'VESSEL' : 'MEDIA'}
                      </div>
                    </div>
                  )}
                  {/* Entity details for naval/military */}
                  {evt.entity?.isMilitary && evt.type === 'naval' && (
                    <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                      {evt.entity.speed !== undefined && evt.entity.speed > 0 && (
                        <span className="text-cyan-400">{evt.entity.speed.toFixed(1)} kn</span>
                      )}
                      {evt.entity.destination && evt.entity.destination !== 'Unknown' && (
                        <span className="text-neutral-500">→ {evt.entity.destination}</span>
                      )}
                      {evt.entity.mmsi && (
                        <span className="text-neutral-600">MMSI: {evt.entity.mmsi}</span>
                      )}
                    </div>
                  )}
                  {/* Fatalities badge */}
                  {evt.fatalities && evt.fatalities > 0 && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-400 font-bold">
                      <ShieldAlert className="w-3 h-3" /> {evt.fatalities.toLocaleString()} fatalities reported
                    </div>
                  )}
                  {/* Location coordinates */}
                  {evt.location && (
                    <div className="text-[10px] text-neutral-500 flex items-center gap-1 mt-1.5">
                      <MapPin className="w-3 h-3" />
                      {evt.location.name || `${evt.location.lat.toFixed(4)}, ${evt.location.lng.toFixed(4)}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {events.length === 0 && connectionStatus === 'connected' && (
            <div className="text-center text-neutral-600 text-xs py-10 animate-pulse">
              Awaiting transmissions...
            </div>
          )}
        </div>
      </aside>

      {/* Right Sidebar: Aviation Vectors */}
      <aside className={`absolute top-20 right-4 bottom-4 w-72 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl z-20 flex flex-col overflow-hidden shadow-2xl transition-all duration-500 ease-in-out ${showAviation ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'}`}>
         <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RadioTower className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-200">Aviation Vectors</h2>
          </div>
          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
            {aviationEvents.length} LIVE
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {aviationEvents.map((flight, i) => (
            <div 
              key={`av-${String(flight?.id ?? '')}-${i}`} 
              className="p-3 rounded-lg hover:bg-white/5 transition border border-transparent hover:border-white/5 text-xs flex justify-between items-center group cursor-pointer"
              onClick={() => flight.location && handleFlyTo(flight.location.lng, flight.location.lat)}
            >
              <div>
                <div className="font-bold text-blue-100 group-hover:text-white transition">{flight.entity?.callsign || 'UNKNOWN'}</div>
                <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                  {flight.entity?.origin} <span className="text-blue-500/50">→</span> {flight.entity?.destination}
                </div>
                <div className="text-[9px] text-neutral-600 mt-1 italic">Updated {formatDistanceToNow(new Date(flight.timestamp))} ago</div>
              </div>
              <div className="text-right">
                <div className="text-neutral-300">{flight.entity?.altitude ? Math.floor(flight.entity.altitude) : '--'}m</div>
                <div className="text-[10px] text-neutral-500 font-mono">SPD: {flight.entity?.speed ? Math.floor(flight.entity.speed) : '--'}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Kinetic Strike Timeline */}
      {showStrikes && (
        <StrikeTimeline
          events={events}
          onFlyTo={handleFlyTo}
          historicalFilterDays={historicalFilterDays}
        />
      )}

    </div>
  );
}
