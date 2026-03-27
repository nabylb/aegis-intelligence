"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { IntelEvent } from '@/lib/types';
import IntelMap from './Map';
import MarketWidget from './MarketWidget';
import EscalationPulse from './EscalationPulse';
import IncidentThreads from './IncidentThreads';
import { Activity, ShieldAlert, RadioTower, History, MapPin, Anchor, Plane, Shield, LineChart, Flame, Camera, Satellite, ExternalLink, Thermometer, Mountain, CloudRain, HeartHandshake, Layers, ChevronDown, Link2, Settings2, Zap, Globe2, Moon, Sun, ClipboardCopy, Check, Menu, X, Map as MapIcon, HelpCircle } from 'lucide-react';
import DocsOverlay from './DocsOverlay';
import { formatDistanceToNow } from 'date-fns';
import { useMap } from 'react-map-gl/maplibre';
import { analyzeEscalation } from '@/lib/escalation';
import { getReliability } from '@/lib/reliability';
import { generateSitrep } from '@/lib/sitrep';
import { THEATERS, filterEventsByTheater, type TheaterPreset } from '@/lib/theaters';

// ─── Layer toggle type ──────────────────────────────────────────────────────
type LayerKey = 'bases' | 'aviation' | 'boats' | 'military' | 'civilian' | 'satellite' | 'strikes' | 'casualties' | 'thermal' | 'seismic' | 'weather' | 'humanitarian' | 'heatmap' | 'usOnly';

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  bases: true, aviation: true, boats: true, military: true, civilian: true,
  satellite: true, strikes: true, casualties: true, thermal: true,
  seismic: true, weather: true, humanitarian: true, heatmap: false,
  usOnly: false,
};

// ─── Panel tabs ─────────────────────────────────────────────────────────────
type LeftTab = 'sigint' | 'tempo';
type RightTab = 'aviation' | 'threads' | 'finance';

export default function IntelDashboard() {
  const [events, setEvents] = useState<IntelEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [historicalFilterDays, setHistoricalFilterDays] = useState<number>(1);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [breakingNews, setBreakingNews] = useState<IntelEvent | null>(null);
  const [breakingHistory, setBreakingHistory] = useState<IntelEvent[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isSigintExpanded, setIsSigintExpanded] = useState(true);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>('sigint');
  const [rightTab, setRightTab] = useState<RightTab>('aviation');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeTheater, setActiveTheater] = useState<string>('middle-east');
  const [showTheaterMenu, setShowTheaterMenu] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [sitrepCopied, setSitrepCopied] = useState(false);
  const [showMomentumDetail, setShowMomentumDetail] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  // Mobile: 'map' | 'sigint' | 'air' | 'status' — controls which view is active on small screens
  const [mobilePanel, setMobilePanel] = useState<'map' | 'sigint' | 'air' | 'status'>('map');

  const mapContext = (() => { try { return useMap(); } catch { return {}; } })();
  const mainMap = (mapContext as any)?.mainMap ?? null;

  const toggle = useCallback((key: LayerKey) => {
    setLayers(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Naval master toggle syncs both sub-layers
      if (key === 'boats') { next.military = next.boats; next.civilian = next.boats; }
      return next;
    });
  }, []);

  // ─── Hydrate cache ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('aegis-breaking-history');
      if (savedHistory) setBreakingHistory(JSON.parse(savedHistory));
      const savedEvents = localStorage.getItem('aegis-events-v3');
      if (savedEvents) {
        const parsed: IntelEvent[] = JSON.parse(savedEvents);
        if (Array.isArray(parsed) && parsed.length > 0) setEvents(dedup(parsed));
      }
    } catch (e) { console.error('Failed to hydrate cache', e); }
  }, []);

  const dedup = useCallback((arr: IntelEvent[]) => {
    const seen = new Map<string, IntelEvent>();
    for (const e of arr) {
      if (e?.id == null) continue;
      const id = typeof e.id === 'string' ? e.id : String(e.id);
      if (id && id !== '[object Object]') seen.set(id, { ...e, id });
    }
    return Array.from(seen.values());
  }, []);

  const aviationEvents = useMemo(() => events.filter(e => e.type === 'aviation'), [events]);

  const sigintFeedEvents = useMemo(() => {
    return events.filter(e => {
      if (e.type === 'aviation') return false;
      if (e.source === 'Global AIS Satellite' && !e.entity?.isMilitary) return false;
      if (e.type === 'satellite' && !layers.satellite) return false;
      if (e.type === 'thermal' && !layers.thermal) return false;
      if (e.type === 'seismic' && !layers.seismic) return false;
      if (e.type === 'weather' && !layers.weather) return false;
      if (e.type === 'humanitarian' && !layers.humanitarian) return false;
      if (e.type === 'satellite' && historicalFilterDays > 0) {
        const cutoff = new Date(Date.now() - historicalFilterDays * 86400000);
        if (new Date(e.timestamp) < cutoff) return false;
      }
      return true;
    });
  }, [events, layers.satellite, layers.thermal, layers.seismic, layers.weather, layers.humanitarian, historicalFilterDays]);

  // ─── Polling connection (Vercel-compatible, replaces SSE) ──────────────────
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Connecting to intelligence sources...');

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;
    let lastServerTime = 0;

    const loadingMessages = [
      'Connecting to intelligence sources...',
      'Scanning RSS & OSINT feeds...',
      'Querying GDELT event database...',
      'Fetching aviation transponders...',
      'Loading conflict & thermal data...',
      'Aggregating 19 intelligence sources...',
    ];
    let msgIdx = 0;
    const msgTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[msgIdx]);
    }, 2500);

    const processBreakingNews = (incoming: IntelEvent[]) => {
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
          const dupe = historic.find(h => h.id === candidate.id || h.title?.toLowerCase().trim() === normalTitle);
          if (dupe) return historic;
          const newHist = [candidate, ...historic].slice(0, 50);
          try { localStorage.setItem('aegis-breaking-history', JSON.stringify(newHist)); } catch {}
          setBreakingNews(p => p?.title?.toLowerCase().trim() === normalTitle ? p : candidate);
          return newHist;
        });
      }
    };

    const poll = async () => {
      try {
        const url = lastServerTime
          ? `/api/stream?since=${lastServerTime}`
          : '/api/stream';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        lastServerTime = data.serverTime || Date.now();

        if (data.type === 'init') {
          const clean = dedup(data.events);
          setEvents(clean);
          setConnectionStatus('connected');
          setIsInitialLoad(false);
          clearInterval(msgTimer);
          try { localStorage.setItem('aegis-events-v3', JSON.stringify(clean.slice(0, 2500))); } catch {}
        } else if (data.type === 'update') {
          setEvents((prev) => {
            const prevIds = new Set(prev.map((e: IntelEvent) => e.id));
            const incoming = data.events.filter((e: IntelEvent) => e?.id && !prevIds.has(e.id));
            // Skip re-render if no new events
            if (incoming.length === 0) return prev;
            const merged = dedup([...incoming, ...prev]);
            processBreakingNews(incoming);
            return merged.slice(0, 2500);
          });
          setConnectionStatus('connected');
        }
      } catch (err) {
        console.error('[Poll] Fetch error:', err);
        if (!cancelled) setConnectionStatus('error');
      }

      if (!cancelled) {
        pollTimer = setTimeout(poll, 30000);
      }
    };

    // Start first poll immediately
    poll();

    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
      clearInterval(msgTimer);
    };
  }, []);

  // ─── Computed ──────────────────────────────────────────────────────────────
  const highSeverityCount = events.filter(e => e.severity === 'high' || e.severity === 'critical').length;
  const flightsCount = aviationEvents.length;

  // Momentum
  const [momentumData, setMomentumData] = useState<{
    composite: number;
    factors: Record<string, { score: number; detail: string }>;
    trend?: Array<{ composite: number; timestamp: number }>;
  } | null>(null);

  useEffect(() => {
    const fetchMomentum = () => {
      fetch('/api/momentum').then(r => r.ok ? r.json() : null).then(data => { if (data) setMomentumData(data); }).catch(() => {});
    };
    fetchMomentum();
    const interval = setInterval(fetchMomentum, 600000);
    return () => clearInterval(interval);
  }, []);

  const clampedPercent = momentumData?.composite ?? 50;
  const momentumColor = clampedPercent < 45 ? 'text-blue-400' : clampedPercent > 55 ? 'text-red-400' : 'text-yellow-400';
  const momentumLabel = clampedPercent < 45 ? 'US/IL' : clampedPercent > 55 ? 'IRAN' : 'CONTESTED';

  // Escalation analysis for bottom bar
  const escalation = useMemo(() => analyzeEscalation(events), [events]);
  const tempoColor = escalation.threatTempo === 'CRITICAL' ? 'text-red-400' : escalation.threatTempo === 'SURGE' ? 'text-orange-400' : escalation.threatTempo === 'ELEVATED' ? 'text-yellow-400' : 'text-emerald-400';
  const tempoDot = escalation.threatTempo === 'CRITICAL' ? 'bg-red-500 animate-pulse' : escalation.threatTempo === 'SURGE' ? 'bg-orange-500' : escalation.threatTempo === 'ELEVATED' ? 'bg-yellow-500' : 'bg-emerald-500';

  // Theater
  const theater = THEATERS.find(t => t.id === activeTheater) || THEATERS[0];

  const handleFlyTo = (lng: number, lat: number) => {
    if (mainMap) mainMap.flyTo({ center: [lng, lat], zoom: 8, duration: 1500 });
  };

  const handleTheaterChange = (t: TheaterPreset) => {
    setActiveTheater(t.id);
    setShowTheaterMenu(false);
    if (mainMap) mainMap.flyTo({ center: [t.viewport.longitude, t.viewport.latitude], zoom: t.viewport.zoom, pitch: t.viewport.pitch, bearing: t.viewport.bearing, duration: 2000 });
  };

  const handleCopySitrep = () => {
    const report = generateSitrep({ events, escalation, momentum: momentumData });
    navigator.clipboard.writeText(report).then(() => {
      setSitrepCopied(true);
      setTimeout(() => setSitrepCopied(false), 2000);
    });
  };

  // Active layer count for badge
  const activeLayerCount = Object.entries(layers).filter(([k, v]) => v && k !== 'usOnly').length;

  // ─── SIGINT feed type badge helpers ────────────────────────────────────────
  const typeBadge = (type: string) => {
    const map: Record<string, { bg: string; label: string }> = {
      satellite: { bg: 'bg-violet-500/20 text-violet-400', label: 'SAT' },
      strike: { bg: 'bg-red-500/20 text-red-400', label: 'STRIKE' },
      conflict: { bg: 'bg-orange-500/20 text-orange-400', label: 'CONFLICT' },
      naval: { bg: 'bg-cyan-500/20 text-cyan-400', label: 'NAVAL' },
      military: { bg: 'bg-blue-500/20 text-blue-400', label: 'MIL' },
      thermal: { bg: 'bg-amber-500/20 text-amber-400', label: 'THERMAL' },
      seismic: { bg: 'bg-yellow-500/20 text-yellow-400', label: 'SEISMIC' },
      weather: { bg: 'bg-sky-500/20 text-sky-400', label: 'WX' },
      humanitarian: { bg: 'bg-pink-500/20 text-pink-400', label: 'HUMINT' },
      notam: { bg: 'bg-indigo-500/20 text-indigo-400', label: 'NOTAM' },
      nuclear: { bg: 'bg-fuchsia-500/20 text-fuchsia-400', label: 'NUKE' },
    };
    return map[type] || { bg: 'bg-white/5 text-neutral-500', label: 'INTEL' };
  };

  const severityDot = (severity: string) =>
    severity === 'critical' ? 'bg-red-600 outline outline-1 outline-red-600/50' :
    severity === 'high' ? 'bg-orange-500' :
    'bg-neutral-500';

  // CSS vars needed by the nav (outside the root div) — mirrors the root div's inline styles
  const cssVars = nightMode
    ? { '--panel-bg': 'rgba(20,0,0,0.7)', '--panel-border': 'rgba(127,29,29,0.2)', '--panel-text': 'rgba(252,165,165,0.8)', '--panel-muted': 'rgba(127,29,29,0.5)', '--header-bg': 'rgba(10,0,0,0.8)' } as React.CSSProperties
    : { '--panel-bg': 'rgba(0,0,0,0.6)', '--panel-border': 'rgba(255,255,255,0.08)', '--panel-text': 'rgba(212,212,216,1)', '--panel-muted': 'rgba(115,115,115,1)', '--header-bg': 'rgba(10,10,10,0.6)' } as React.CSSProperties;

  return (
    <>
    <div className={`relative w-screen h-dvh overflow-hidden font-mono selection:bg-neutral-800 ${nightMode ? 'aegis-night bg-black text-red-300/80' : 'bg-neutral-950 text-neutral-300'}`} style={cssVars}>

      {/* Loading Overlay — shown on first load before any data arrives */}
      {isInitialLoad && events.length === 0 && (
        <div className="absolute inset-0 z-[99998] flex items-center justify-center bg-neutral-950/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-neutral-800" />
              <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-bold tracking-widest uppercase text-neutral-300">Initializing Feed</p>
              <p className="text-[10px] text-neutral-500 animate-pulse">{loadingMessage}</p>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="w-1 h-1 rounded-full bg-emerald-500/60 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Background Map */}
      <IntelMap
        events={events}
        historicalFilterDays={historicalFilterDays}
        showBases={layers.bases}
        showBoats={layers.boats}
        showMilitary={layers.military}
        showCivilian={layers.civilian}
        showAviation={layers.aviation}
        showStrikes={layers.strikes}
        showCasualties={layers.casualties}
        showSatellite={layers.satellite}
        showThermal={layers.thermal}
        showSeismic={layers.seismic}
        showWeather={layers.weather}
        showHumanitarian={layers.humanitarian}
        showHeatmap={layers.heatmap}
        usOnly={layers.usOnly}
      />

      {/* Flash Override History Modal */}
      {showHistoryModal && (
        <>
          <div className="fixed inset-0 z-[99990] bg-black/40 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)} />
          <div className="fixed top-14 inset-x-3 md:inset-x-auto md:left-[72px] md:w-[400px] max-h-[calc(100vh-80px)] bg-black/95 backdrop-blur-3xl border border-white/10 rounded-xl shadow-2xl z-[99999] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
              <h3 className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Flash Override History</h3>
              <div className="flex items-center gap-2">
                {breakingHistory.length > 0 && (
                  <button onClick={() => { setBreakingHistory([]); localStorage.removeItem('aegis-breaking-history'); }}
                    className="text-[9px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded transition">Clear</button>
                )}
                <button onClick={() => setShowHistoryModal(false)} className="text-neutral-500 hover:text-white text-xs transition">x</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/20">
              {breakingHistory.length === 0 ? (
                <div className="text-center text-neutral-600 text-[10px] py-8">No alerts logged.</div>
              ) : breakingHistory.map((evt, i) => (
                <div key={`bh-${String(evt?.id ?? '')}-${i}`}
                  onClick={() => { if (evt.location) { handleFlyTo(evt.location.lng, evt.location.lat); setShowHistoryModal(false); } }}
                  className="px-2.5 py-2 bg-red-950/30 border border-red-900/50 hover:bg-red-900/50 transition rounded-lg cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-0.5">
                    <span className="text-[8px] font-bold text-red-400 tracking-wider">CRITICAL</span>
                    <span className="text-[9px] text-neutral-400">{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-[11px] font-bold text-white leading-snug">{evt.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {evt.sourceUrl && (
                      <a href={evt.sourceUrl} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[9px] text-blue-400 hover:text-blue-300 transition">
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate max-w-[160px]">{evt.source || 'Source'}</span>
                      </a>
                    )}
                    {!evt.sourceUrl && evt.source && (
                      <span className="text-[9px] text-neutral-400">{evt.source}</span>
                    )}
                    {evt.location && (
                      <span className="ml-auto text-[8px] text-neutral-400 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {evt.location.name || `${evt.location.lat.toFixed(2)}, ${evt.location.lng.toFixed(2)}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Breaking News Toast */}
      {breakingNews && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-500 w-[calc(100vw-1.5rem)] md:w-auto">
          <div className="bg-red-950/90 border border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] backdrop-blur-xl rounded-lg flex items-start gap-3 px-3 md:px-4 py-3 max-w-xl cursor-pointer hover:bg-red-900/90 transition"
               onClick={() => {
                 if (breakingNews.location) handleFlyTo(breakingNews.location.lng, breakingNews.location.lat);
                 setBreakingNews(null);
               }}>
            <div className="bg-red-500 text-white p-1.5 rounded-full animate-pulse mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="bg-red-500 text-white text-[8px] uppercase font-bold px-1.5 py-0.5 rounded tracking-widest">FLASH OVERRIDE</span>
                <span className="text-red-300 text-[10px] font-mono">{formatDistanceToNow(new Date(breakingNews.timestamp))} ago</span>
              </div>
              <h3 className="text-white font-bold text-sm leading-tight">{breakingNews.title}</h3>
            </div>
          </div>
        </div>
      )}

      {/* ─── HEADER: Single Row ──────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 h-11 backdrop-blur-md border-b z-30 flex items-center justify-between px-2 md:px-4" style={{ background: 'var(--header-bg)', borderColor: 'var(--panel-border)' }}>
        {/* Left: Brand + Status */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="p-1 bg-white/5 rounded-lg border border-white/10">
            <ShieldAlert className="w-3.5 h-3.5 text-neutral-100" />
          </div>
          <h1 className="text-neutral-100 font-bold tracking-widest text-[11px] uppercase">Aegis</h1>
          <div className="text-[9px] text-neutral-500 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            {connectionStatus === 'connected' ? 'LIVE' : 'RECON'}
          </div>
          <div className="relative">
            <button onClick={() => setShowHistoryModal(!showHistoryModal)} title="Flash Override history — critical alerts log"
              className={`p-1 rounded-full transition ${breakingHistory.length > 0 ? 'bg-red-500/20 text-red-500 hover:bg-red-500/40' : 'text-neutral-500 hover:bg-white/10'}`}>
              <Activity className="w-3 h-3" />
            </button>
            {breakingHistory.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 text-white rounded-full text-[6px] font-bold flex items-center justify-center border border-black pointer-events-none">
                {breakingHistory.length > 9 ? '9+' : breakingHistory.length}
              </span>
            )}
          </div>
        </div>

        {/* Center: Quick Stats — hidden on mobile */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-3 text-[10px] bg-black/40 px-2.5 py-0.5 rounded border border-white/5">
            <span className="text-neutral-500 cursor-help" title="High & Critical severity threats">THREATS <span className={`font-bold ${highSeverityCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{highSeverityCount}</span></span>
            <span className="text-neutral-500 cursor-help" title="Active aviation transponders tracked">FLIGHTS <span className="font-bold text-blue-400">{flightsCount}</span></span>
            <span className="text-neutral-500 cursor-help" title="Total intelligence intercepts across all sources">INTEL <span className="font-bold text-neutral-300">{events.length}</span></span>
          </div>
        </div>

        {/* Right: Timeline + Layers — simplified on mobile */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Timeline selector — hidden on mobile */}
          <div className="hidden md:flex items-center bg-black/40 rounded border border-white/5 overflow-hidden text-[9px]">
            <div className="px-1.5 py-0.5 bg-white/5 border-r border-white/10 text-orange-400">
              <History className="w-3 h-3" />
            </div>
            {['OFF', '24H', '7D', '30D'].map((lbl) => {
              const val = lbl === 'OFF' ? 0 : lbl === '24H' ? 1 : lbl === '7D' ? 7 : 30;
              return (
                <button key={lbl} onClick={() => setHistoricalFilterDays(val)}
                  className={`px-1.5 py-0.5 border-r border-white/5 last:border-0 transition font-bold ${
                    historicalFilterDays === val ? 'bg-orange-500/20 text-orange-300' : 'text-neutral-500 hover:text-neutral-300'
                  }`}>
                  {lbl}
                </button>
              );
            })}
          </div>

          {/* Layer menu trigger */}
          <div className="relative">
            <button onClick={() => setShowLayerMenu(!showLayerMenu)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition border ${showLayerMenu ? 'bg-white/10 text-white border-white/20' : 'bg-black/40 text-neutral-400 border-white/5 hover:text-white'}`}>
              <Settings2 className="w-3 h-3" />
              <span className="hidden md:inline">LAYERS</span>
              <span className="text-[8px] bg-white/10 px-1 rounded">{activeLayerCount}</span>
            </button>

            {/* Layer dropdown */}
            {showLayerMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLayerMenu(false)} />
                <div className="absolute top-full right-0 mt-1 w-56 max-h-[70vh] overflow-y-auto bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 py-1">
                  <LayerGroup label="ISR" items={[
                    { key: 'bases' as LayerKey, label: 'Bases', icon: <Shield className="w-3 h-3" />, color: 'blue' },
                    { key: 'aviation' as LayerKey, label: 'Aviation', icon: <Plane className="w-3 h-3" />, color: 'blue' },
                    { key: 'boats' as LayerKey, label: 'Naval', icon: <Anchor className="w-3 h-3" />, color: 'blue' },
                  ]} layers={layers} toggle={toggle} />
                  {layers.boats && (
                    <div className="flex items-center gap-1 px-4 pb-1">
                      <button onClick={() => toggle('military' as LayerKey)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition ${layers.military ? 'bg-blue-500/30 text-blue-200' : 'bg-white/5 text-neutral-600 hover:text-neutral-400'}`}>
                        MIL
                      </button>
                      <button onClick={() => toggle('civilian' as LayerKey)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition ${layers.civilian ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/5 text-neutral-600 hover:text-neutral-400'}`}>
                        CIV
                      </button>
                    </div>
                  )}
                  <LayerGroup label="" items={[
                    { key: 'satellite' as LayerKey, label: 'Satellite', icon: <Satellite className="w-3 h-3" />, color: 'violet' },
                  ]} layers={layers} toggle={toggle} />
                  <LayerGroup label="KINETIC" items={[
                    { key: 'strikes' as LayerKey, label: 'Strikes', icon: <Flame className="w-3 h-3" />, color: 'orange' },
                    { key: 'heatmap' as LayerKey, label: 'Heatmap', icon: <Layers className="w-3 h-3" />, color: 'rose' },
                  ]} layers={layers} toggle={toggle} />
                  <LayerGroup label="EARTH" items={[
                    { key: 'thermal' as LayerKey, label: 'FIRMS', icon: <Thermometer className="w-3 h-3" />, color: 'amber' },
                    { key: 'seismic' as LayerKey, label: 'Seismic', icon: <Mountain className="w-3 h-3" />, color: 'yellow' },
                    { key: 'weather' as LayerKey, label: 'Weather', icon: <CloudRain className="w-3 h-3" />, color: 'sky' },
                  ]} layers={layers} toggle={toggle} />
                  <LayerGroup label="INTEL" items={[
                    { key: 'humanitarian' as LayerKey, label: 'HUMINT', icon: <HeartHandshake className="w-3 h-3" />, color: 'pink' },
                  ]} layers={layers} toggle={toggle} />
                  {/* Timeline selector — mobile only, inside layers menu */}
                  <div className="md:hidden border-t border-white/5 mt-1 pt-1 px-2">
                    <div className="text-[7px] font-bold text-neutral-600 uppercase tracking-widest px-1 py-1">TIMELINE</div>
                    <div className="flex items-center bg-black/40 rounded border border-white/5 overflow-hidden text-[9px] mb-1">
                      {['OFF', '24H', '7D', '30D'].map((lbl) => {
                        const val = lbl === 'OFF' ? 0 : lbl === '24H' ? 1 : lbl === '7D' ? 7 : 30;
                        return (
                          <button key={lbl} onClick={() => setHistoricalFilterDays(val)}
                            className={`flex-1 px-1.5 py-1 border-r border-white/5 last:border-0 transition font-bold ${
                              historicalFilterDays === val ? 'bg-orange-500/20 text-orange-300' : 'text-neutral-500 hover:text-neutral-300'
                            }`}>
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border-t border-white/5 mt-1 pt-1 px-1">
                    <button onClick={() => toggle('usOnly')}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[9px] font-bold transition ${layers.usOnly ? 'bg-white text-black' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}>
                      US / IL Only
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Theater selector */}
          <div className="relative">
            <button onClick={() => setShowTheaterMenu(!showTheaterMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition border bg-black/40 text-neutral-400 border-white/5 hover:text-white">
              <Globe2 className="w-3 h-3" />
              <span className="hidden sm:inline">{theater.shortName}</span>
            </button>
            {showTheaterMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTheaterMenu(false)} />
                <div className="absolute top-full right-0 mt-1 w-48 bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 py-1">
                  {THEATERS.map(t => (
                    <button key={t.id} onClick={() => handleTheaterChange(t)}
                      className={`w-full text-left px-3 py-1.5 text-[9px] font-bold transition ${
                        activeTheater === t.id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}>
                      <div>{t.name}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Night mode toggle */}
          <button onClick={() => setNightMode(!nightMode)} title={nightMode ? 'Switch to day mode' : 'Night shift mode — red-on-black for low-light environments'}
            className={`p-1 rounded transition border ${nightMode ? 'bg-red-950/50 border-red-900/50 text-red-400' : 'bg-black/40 border-white/5 text-neutral-500 hover:text-white'}`}>
            {nightMode ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
          </button>

          {/* Documentation */}
          <button onClick={() => setShowDocs(true)} title="Documentation — how Aegis works"
            className="p-1 rounded transition border bg-black/40 border-white/5 text-neutral-500 hover:text-white">
            <HelpCircle className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* ─── Documentation Overlay ─────────────────────────────────────────── */}
      {showDocs && <DocsOverlay onClose={() => setShowDocs(false)} />}

      {/* ─── LEFT: Tabbed Panel (SIGINT + Threat Tempo) ──────────────────────── */}
      <aside className={`absolute top-12 z-20 flex flex-col overflow-hidden shadow-2xl transition-all duration-300
        ${mobilePanel === 'sigint' ? 'inset-x-0 bottom-14 md:inset-x-auto md:left-3 md:right-auto md:bottom-14 rounded-none md:rounded-xl' : 'hidden md:flex left-3 bottom-14 rounded-xl'}
        backdrop-blur-xl
        ${isSigintExpanded ? 'md:w-80 w-full' : 'md:w-12 w-12'}`} style={{ background: 'var(--panel-bg)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--panel-border)' }}>
        {/* Tab bar / collapsed icon */}
        {isSigintExpanded ? (
          <div className="flex items-center border-b border-white/[0.08] bg-white/[0.03] shrink-0">
            <button onClick={() => setLeftTab('sigint')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[9px] font-bold uppercase tracking-wider transition border-b-2 ${
                leftTab === 'sigint' ? 'border-amber-500/50 text-amber-400 bg-white/[0.03]' : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}>
              <RadioTower className="w-3 h-3" />
              SIGINT
              <span className="text-[8px] bg-white/10 px-1 rounded">{sigintFeedEvents.length}</span>
            </button>
            <button onClick={() => setLeftTab('tempo')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[9px] font-bold uppercase tracking-wider transition border-b-2 ${
                leftTab === 'tempo' ? 'border-orange-500/50 text-orange-400 bg-white/[0.03]' : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}>
              <Zap className="w-3 h-3" />
              TEMPO
              <span className={`w-1.5 h-1.5 rounded-full ${tempoDot}`} />
            </button>
            <button onClick={() => setIsSigintExpanded(false)} className="px-2 text-neutral-600 hover:text-white transition">
              <ChevronDown className="w-3 h-3 rotate-90" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-3 gap-3 border-b border-white/[0.08] bg-white/[0.03] cursor-pointer" onClick={() => setIsSigintExpanded(true)}>
            <RadioTower className="w-4 h-4 text-amber-500 hover:text-amber-400 transition" />
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {/* SIGINT Feed */}
          {leftTab === 'sigint' && isSigintExpanded && (
            <div className="px-2 py-1.5 space-y-0.5">
              {sigintFeedEvents.slice(0, 80).map((evt, i) => {
                const rel = getReliability(evt.source);
                return (
                  <div key={`sig-${String(evt?.id ?? '')}-${i}`} className="group rounded-lg hover:bg-white/[0.04] transition px-2 py-1.5">
                    {/* Row 1: type + time + reliability */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[7px] uppercase tracking-widest font-bold px-1 py-px rounded ${typeBadge(evt.type).bg}`}>
                        {typeBadge(evt.type).label}
                      </span>
                      <span className="text-[9px] text-neutral-400">
                        {formatDistanceToNow(new Date(evt.timestamp), { addSuffix: true })}
                      </span>
                      <span className={`ml-auto text-[7px] font-mono font-bold cursor-help ${rel.color}`} title={`Source: ${evt.source}\nReliability: ${rel.label} (${Math.round(rel.confidence * 100)}%)\n${rel.source}-grade source, ${rel.info}-grade information`}>
                        {rel.label}
                      </span>
                    </div>
                    {/* Title */}
                    <h3 className={`text-[11px] font-medium leading-snug ${
                      evt.severity === 'critical' || evt.severity === 'high' ? 'text-neutral-100' : 'text-neutral-300'
                    }`}>
                      {evt.title}
                    </h3>
                    {/* Image */}
                    {evt.payloadImage && (
                      <div className="mt-1 relative w-full h-24 rounded overflow-hidden border border-white/5 bg-neutral-900">
                        <img src={evt.payloadImage} className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer"
                          onError={(e: any) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                      </div>
                    )}
                    {/* Fatalities */}
                    {evt.fatalities && evt.fatalities > 0 && (
                      <div className="mt-0.5 text-[9px] text-red-400 font-bold">{evt.fatalities.toLocaleString()} KIA</div>
                    )}
                    {/* Action row: source link + location fly-to */}
                    <div className="flex items-center gap-1.5 mt-1">
                      {evt.sourceUrl && (
                        <a href={evt.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[8px] text-blue-400 hover:text-blue-300 transition truncate max-w-[140px]"
                          onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{evt.source}</span>
                        </a>
                      )}
                      {!evt.sourceUrl && (
                        <span className="text-[8px] text-neutral-400 truncate max-w-[140px]">{evt.source}</span>
                      )}
                      {evt.location && (
                        <button onClick={() => handleFlyTo(evt.location!.lng, evt.location!.lat)}
                          className="ml-auto flex items-center gap-1 text-[8px] text-neutral-300 hover:text-white transition shrink-0" title={`Fly to ${evt.location.name || `${evt.location.lat.toFixed(2)}, ${evt.location.lng.toFixed(2)}`}`}>
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[80px]">{evt.location.name || `${evt.location.lat.toFixed(2)}, ${evt.location.lng.toFixed(2)}`}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && (
                <div className="text-center text-neutral-600 text-[10px] py-10 animate-pulse">
                  {connectionStatus === 'connecting' ? 'Connecting to sources...' : connectionStatus === 'error' ? 'Connection error — retrying...' : 'Awaiting transmissions...'}
                </div>
              )}
            </div>
          )}

          {/* Threat Tempo (Escalation Pulse) */}
          {leftTab === 'tempo' && isSigintExpanded && (
            <div className="p-2">
              <EscalationPulse events={events} onFlyTo={handleFlyTo} />
            </div>
          )}

          {/* Collapsed: severity dots */}
          {!isSigintExpanded && (
            <div className="px-2 py-1.5 space-y-1">
              {sigintFeedEvents.slice(0, 30).map((evt, i) => (
                <div key={`dot-${i}`} className="flex justify-center py-0.5 cursor-pointer" onClick={() => setIsSigintExpanded(true)}>
                  <div className={`w-2 h-2 rounded-full ${severityDot(evt.severity)}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ─── RIGHT: Tabbed Panel ─────────────────────────────────────────────── */}
      {rightPanelOpen ? (
        <aside className={`absolute top-12 z-20 flex flex-col overflow-hidden shadow-2xl backdrop-blur-xl
          ${mobilePanel === 'air' ? 'inset-x-0 bottom-14 rounded-none md:rounded-xl md:inset-x-auto md:right-3 md:left-auto md:bottom-14 w-full md:w-80' : 'hidden md:flex right-3 bottom-14 w-80 rounded-xl'}`} style={{ background: 'var(--panel-bg)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--panel-border)' }}>
          {/* Tab bar */}
          <div className="flex items-center border-b border-white/[0.08] bg-white/[0.03] shrink-0">
            {([
              { key: 'aviation' as RightTab, label: 'AIR', icon: <Plane className="w-3 h-3" />, count: aviationEvents.length },
              { key: 'threads' as RightTab, label: 'LINKS', icon: <Link2 className="w-3 h-3" /> },
              { key: 'finance' as RightTab, label: 'MKT', icon: <LineChart className="w-3 h-3" /> },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setRightTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-bold uppercase tracking-wider transition border-b-2 ${
                  rightTab === tab.key
                    ? 'border-white/30 text-white bg-white/[0.03]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}>
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && (
                  <span className="text-[8px] bg-white/10 px-1 rounded">{tab.count}</span>
                )}
              </button>
            ))}
            <button onClick={() => setRightPanelOpen(false)} className="px-2 text-neutral-600 hover:text-white transition">
              <ChevronDown className="w-3 h-3 rotate-90" />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {rightTab === 'aviation' && (
              <div className="p-1.5 space-y-0.5">
                {aviationEvents.map((flight, i) => (
                  <div key={`av-${String(flight?.id ?? '')}-${i}`}
                    className="px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition text-[10px] flex justify-between items-center cursor-pointer"
                    onClick={() => flight.location && handleFlyTo(flight.location.lng, flight.location.lat)}>
                    <div className="min-w-0">
                      <div className="font-bold text-blue-100 text-[11px]">{flight.entity?.callsign || 'UNKNOWN'}</div>
                      <div className="text-neutral-500 font-mono">
                        {flight.entity?.origin || '???'} <span className="text-blue-500/50">→</span> {flight.entity?.destination || '???'}
                      </div>
                      <div className="text-[9px] text-neutral-600">{flight.entity?.type || ''}</div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-neutral-300 font-mono text-[10px]">FL{flight.entity?.altitude ? Math.floor(flight.entity.altitude / 100) : '--'}</div>
                      <div className="text-[9px] text-neutral-500 font-mono">{flight.entity?.speed ? Math.floor(flight.entity.speed) : '--'} kts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rightTab === 'threads' && (
              <div className="p-2">
                <IncidentThreads events={events} onFlyTo={handleFlyTo} />
              </div>
            )}

            {rightTab === 'finance' && (
              <div className="p-2">
                <MarketWidget />
              </div>
            )}
          </div>
        </aside>
      ) : (
        <button onClick={() => setRightPanelOpen(true)}
          className="hidden md:block absolute top-12 right-3 z-20 px-2 py-4 bg-black/60 backdrop-blur-xl border border-white/[0.08] rounded-lg text-[9px] font-bold text-neutral-400 hover:text-white transition shadow-lg">
          <ChevronDown className="w-3 h-3 -rotate-90" />
        </button>
      )}

      {/* ─── BOTTOM: Unified Status Bar (SITREP + Tempo + Momentum) — desktop ── */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 hidden md:block">
        <div className="flex items-center gap-2 md:gap-3 backdrop-blur-xl rounded-lg px-3 md:px-4 py-2 shadow-2xl max-w-[calc(100vw-1.5rem)] overflow-x-auto" style={{ background: 'var(--panel-bg)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--panel-border)' }}>
          {/* Threat Tempo */}
          <div className="flex items-center gap-2 pr-3 border-r border-white/10 cursor-help shrink-0" title="Threat Tempo — rate of escalation based on event clustering and acceleration. CALM < ELEVATED < SURGE < CRITICAL">
            <span className={`w-2 h-2 rounded-full ${tempoDot}`} />
            <div>
              <div className="text-[7px] text-neutral-400 uppercase tracking-widest">TEMPO</div>
              <div className={`text-[11px] font-bold tracking-tight ${tempoColor}`}>{escalation.threatTempo}</div>
            </div>
          </div>

          {/* Momentum — clickable for detail */}
          <div className="relative flex items-center gap-2 pr-3 border-r border-white/10 shrink-0">
            <div className="cursor-pointer" onClick={() => setShowMomentumDetail(!showMomentumDetail)}>
              <div className="text-[7px] text-neutral-400 uppercase tracking-widest">MOMENTUM</div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-bold font-mono ${momentumColor}`}>{clampedPercent.toFixed(0)}%</span>
                <span className={`text-[9px] ${momentumColor}`}>{momentumLabel}</span>
                <ChevronDown className={`w-2.5 h-2.5 text-neutral-500 transition ${showMomentumDetail ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {/* Momentum detail popover */}
            {showMomentumDetail && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMomentumDetail(false)} />
                <div className="absolute bottom-full left-0 mb-2 w-[340px] bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-bold text-neutral-200 uppercase tracking-widest">Strategic Momentum</h4>
                    <button onClick={() => setShowMomentumDetail(false)} className="text-neutral-500 hover:text-white text-xs transition">x</button>
                  </div>
                  <p className="text-[9px] text-neutral-400 mb-3 leading-relaxed">6-factor weighted score. 50% = stalemate. Below 50% = US/IL advantage. Above 50% = Iran/Proxy advantage. Scores of 0 or ±1 indicate stable/baseline conditions.</p>
                  {momentumData?.factors && (
                    <div className="space-y-1.5">
                      {[
                        { key: 'oil', label: 'OIL', weight: '20%' },
                        { key: 'kinetic', label: 'KIN', weight: '25%' },
                        { key: 'currency', label: 'FX', weight: '15%' },
                        { key: 'shipping', label: 'SHIP', weight: '15%' },
                        { key: 'diplomatic', label: 'DIP', weight: '15%' },
                        { key: 'cyber', label: 'CYB', weight: '10%' },
                      ].map(f => {
                        const factor = momentumData.factors[f.key] || { score: 0, detail: 'Awaiting data...' };
                        const s = factor.score;
                        const c = s > 1 ? 'text-red-400' : s < -1 ? 'text-blue-400' : 'text-neutral-200';
                        return (
                          <div key={f.key} className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-neutral-200 font-bold">{f.label}</span>
                                <span className="text-[8px] text-neutral-400">{f.weight}</span>
                              </div>
                              <span className={`font-mono text-[11px] font-bold ${c}`}>{s > 0 ? '+' : ''}{s}</span>
                            </div>
                            <div className="text-[9px] text-neutral-400 leading-snug">{factor.detail}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Factor pills — compact inline view */}
          {momentumData?.factors && (
            <div className="hidden sm:flex items-center gap-1.5 pr-3 border-r border-white/10 shrink-0">
              {[
                { key: 'oil', label: 'OIL', tip: 'Oil/Energy disruption factor (WTI crude vs 7-day average)' },
                { key: 'kinetic', label: 'KIN', tip: 'Kinetic balance (GDELT military events by actor)' },
                { key: 'currency', label: 'FX', tip: 'Currency stress (ILS weakening + VIX fear gauge)' },
                { key: 'shipping', label: 'SHIP', tip: 'Shipping disruption (Red Sea / Hormuz article volume)' },
                { key: 'diplomatic', label: 'DIP', tip: 'Diplomatic signals (UN sessions, sanctions vs ceasefire talks)' },
                { key: 'cyber', label: 'CYB', tip: 'Cyber/info warfare volume (DDoS, hacks, disinfo campaigns — precursor to kinetic ops)' },
              ].map(f => {
                const factor = momentumData.factors[f.key] || { score: 0, detail: 'Awaiting data...' };
                const s = factor.score;
                const c = s > 1 ? 'text-red-400' : s < -1 ? 'text-blue-400' : 'text-neutral-400';
                return (
                  <span key={f.key} className={`font-mono text-[8px] cursor-help ${c}`} title={`${f.tip}\n${factor.detail}`}>
                    {f.label}:{s > 0 ? '+' : ''}{s}
                  </span>
                );
              })}
            </div>
          )}

          {/* Momentum Trend Sparkline — hidden on small mobile */}
          {momentumData?.trend && momentumData.trend.length > 1 && (
            <div className="hidden sm:block pr-3 border-r border-white/10 cursor-help shrink-0" title="Momentum trend — each point is a 10-minute snapshot. Blue = US/IL advantage, Red = Iran/Proxy advantage">
              <div className="text-[7px] text-neutral-400 uppercase tracking-widest mb-0.5">TREND</div>
              <svg width="60" height="16" viewBox="0 0 60 16" className="overflow-visible">
                {(() => {
                  const points = momentumData.trend!;
                  const vals = points.map(p => p.composite);
                  const min = Math.min(...vals, 30);
                  const max = Math.max(...vals, 70);
                  const range = max - min || 1;
                  const polyline = vals.map((v, i) => {
                    const x = (i / (vals.length - 1)) * 60;
                    const y = 16 - ((v - min) / range) * 14;
                    return `${x},${y}`;
                  }).join(' ');
                  const last = vals[vals.length - 1];
                  const color = last < 45 ? '#60a5fa' : last > 55 ? '#f87171' : '#facc15';
                  return (
                    <>
                      <line x1="0" y1="8" x2="60" y2="8" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
                      <circle cx="60" cy={16 - ((last - min) / range) * 14} r="2" fill={color} />
                    </>
                  );
                })()}
              </svg>
            </div>
          )}

          {/* Acceleration */}
          <div className="pr-3 border-r border-white/10 cursor-help shrink-0" title="Acceleration — ratio of event rate in last 2 hours vs 6-hour average. >1.5x = surging, <0.7x = de-escalating">
            <div className="text-[7px] text-neutral-400 uppercase tracking-widest">ACCEL</div>
            <div className={`text-[11px] font-bold font-mono ${escalation.acceleration > 1.5 ? 'text-red-400' : escalation.acceleration < 0.7 ? 'text-emerald-400' : 'text-neutral-400'}`}>
              {escalation.acceleration > 0 ? '+' : ''}{escalation.acceleration.toFixed(1)}x
            </div>
          </div>

          {/* SITREP Export */}
          <button onClick={handleCopySitrep} title="Generate NATO-format Situation Report and copy to clipboard"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded transition text-[9px] font-bold uppercase tracking-wider border border-white/10 hover:bg-white/5 text-neutral-300 hover:text-white shrink-0">
            {sitrepCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <ClipboardCopy className="w-3 h-3" />}
            {sitrepCopied ? 'COPIED' : 'SITREP'}
          </button>
        </div>
      </div>

      {/* ─── MOBILE: Status Panel Overlay ─────────────────────────────────── */}
      {mobilePanel === 'status' && (
        <div className="md:hidden absolute top-12 inset-x-0 bottom-14 z-20 overflow-y-auto backdrop-blur-xl" style={{ background: 'var(--panel-bg)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--panel-border)' }}>
          <div className="p-4 space-y-4">
            {/* Threat Tempo */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <span className={`w-3 h-3 rounded-full shrink-0 ${tempoDot}`} />
              <div className="flex-1">
                <div className="text-[9px] text-neutral-300 uppercase tracking-widest mb-0.5">THREAT TEMPO</div>
                <div className={`text-sm font-bold tracking-tight ${tempoColor}`}>{escalation.threatTempo}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-neutral-300 uppercase tracking-widest mb-0.5">ACCEL</div>
                <div className={`text-sm font-bold font-mono ${escalation.acceleration > 1.5 ? 'text-red-400' : escalation.acceleration < 0.7 ? 'text-emerald-400' : 'text-neutral-200'}`}>
                  {escalation.acceleration > 0 ? '+' : ''}{escalation.acceleration.toFixed(1)}x
                </div>
              </div>
            </div>

            {/* Momentum */}
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-[9px] text-neutral-300 uppercase tracking-widest mb-1">STRATEGIC MOMENTUM</div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-lg font-bold font-mono ${momentumColor}`}>{clampedPercent.toFixed(0)}%</span>
                <span className={`text-[10px] font-bold ${momentumColor}`}>{momentumLabel}</span>
              </div>
              <p className="text-[9px] text-neutral-400 mb-3 leading-relaxed">6-factor weighted score. 50% = stalemate. Below 50% = US/IL advantage. Above 50% = Iran/Proxy advantage. Scores of 0 or ±1 indicate stable/baseline conditions.</p>
              {/* Factor cards with detail */}
              {momentumData?.factors && (
                <div className="space-y-1.5">
                  {[
                    { key: 'oil', label: 'OIL', weight: '20%' },
                    { key: 'kinetic', label: 'KIN', weight: '25%' },
                    { key: 'currency', label: 'FX', weight: '15%' },
                    { key: 'shipping', label: 'SHIP', weight: '15%' },
                    { key: 'diplomatic', label: 'DIP', weight: '15%' },
                    { key: 'cyber', label: 'CYB', weight: '10%' },
                  ].map(f => {
                    const factor = momentumData.factors[f.key] || { score: 0, detail: 'Awaiting data...' };
                    const s = factor.score;
                    const c = s > 1 ? 'text-red-400' : s < -1 ? 'text-blue-400' : 'text-neutral-200';
                    return (
                      <div key={f.key} className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-neutral-200 font-bold">{f.label}</span>
                            <span className="text-[8px] text-neutral-400">{f.weight}</span>
                          </div>
                          <span className={`font-mono text-[11px] font-bold ${c}`}>{s > 0 ? '+' : ''}{s}</span>
                        </div>
                        <div className="text-[9px] text-neutral-400 leading-snug">{factor.detail}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Trend Sparkline */}
              {momentumData?.trend && momentumData.trend.length > 1 && (
                <div className="mt-3">
                  <div className="text-[9px] text-neutral-300 uppercase tracking-widest mb-1">TREND</div>
                  <svg width="100%" height="32" viewBox="0 0 120 32" preserveAspectRatio="none" className="overflow-visible">
                    {(() => {
                      const points = momentumData.trend!;
                      const vals = points.map(p => p.composite);
                      const min = Math.min(...vals, 30);
                      const max = Math.max(...vals, 70);
                      const range = max - min || 1;
                      const polyline = vals.map((v, i) => {
                        const x = (i / (vals.length - 1)) * 120;
                        const y = 30 - ((v - min) / range) * 28;
                        return `${x},${y}`;
                      }).join(' ');
                      const last = vals[vals.length - 1];
                      const color = last < 45 ? '#60a5fa' : last > 55 ? '#f87171' : '#facc15';
                      return (
                        <>
                          <line x1="0" y1="16" x2="120" y2="16" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                          <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                          <circle cx="120" cy={30 - ((last - min) / range) * 28} r="3" fill={color} />
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>

            {/* SITREP Export */}
            <button onClick={handleCopySitrep}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition text-[10px] font-bold uppercase tracking-wider border border-white/10 hover:bg-white/10 text-white bg-white/5">
              {sitrepCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <ClipboardCopy className="w-4 h-4" />}
              {sitrepCopied ? 'SITREP COPIED TO CLIPBOARD' : 'COPY SITREP REPORT'}
            </button>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
                <div className="text-[9px] text-neutral-300 uppercase tracking-widest">THREATS</div>
                <div className={`text-sm font-bold ${highSeverityCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{highSeverityCount}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
                <div className="text-[9px] text-neutral-300 uppercase tracking-widest">FLIGHTS</div>
                <div className="text-sm font-bold text-blue-400">{flightsCount}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-center">
                <div className="text-[9px] text-neutral-300 uppercase tracking-widest">INTEL</div>
                <div className="text-sm font-bold text-neutral-200">{events.length}</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>

      {/* ─── MOBILE: Bottom Tab Navigation ──────────────────────────────────── */}
      {/* NOTE: Rendered OUTSIDE the overflow-hidden root div to prevent GPU compositing
          clipping on Android Chrome. MapLibre's WebGL canvas promotes the root div to a
          compositing layer, which causes overflow:hidden to clip position:fixed children. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 z-30 flex items-stretch backdrop-blur-xl border-t safe-bottom" style={{ background: 'var(--header-bg)', borderColor: 'var(--panel-border)', ...cssVars }}>
        {([
          { key: 'map' as const, label: 'MAP', icon: <MapIcon className="w-4 h-4" /> },
          { key: 'sigint' as const, label: 'SIGINT', icon: <RadioTower className="w-4 h-4" />, badge: sigintFeedEvents.length },
          { key: 'air' as const, label: 'AIR', icon: <Plane className="w-4 h-4" />, badge: aviationEvents.length },
          { key: 'status' as const, label: 'STATUS', icon: <Activity className="w-4 h-4" /> },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setMobilePanel(tab.key)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition ${
              mobilePanel === tab.key ? 'text-white' : 'text-neutral-400'
            }`}>
            {tab.icon}
            <span className="text-[8px] font-bold uppercase tracking-wider">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute top-1.5 ml-6 min-w-[14px] h-3.5 bg-white/10 text-[7px] font-bold text-neutral-300 rounded-full flex items-center justify-center px-1">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </>
  );
}

// ─── Layer Group Sub-component ─────────────────────────────────────────────
const LAYER_COLORS: Record<string, { active: string; dot: string }> = {
  blue:    { active: 'bg-blue-500/15 text-blue-300',     dot: 'bg-blue-400' },
  violet:  { active: 'bg-violet-500/15 text-violet-300', dot: 'bg-violet-400' },
  orange:  { active: 'bg-orange-500/15 text-orange-300', dot: 'bg-orange-400' },
  red:     { active: 'bg-red-500/15 text-red-300',       dot: 'bg-red-400' },
  rose:    { active: 'bg-rose-500/15 text-rose-300',     dot: 'bg-rose-400' },
  amber:   { active: 'bg-amber-500/15 text-amber-300',   dot: 'bg-amber-400' },
  yellow:  { active: 'bg-yellow-500/15 text-yellow-300', dot: 'bg-yellow-400' },
  sky:     { active: 'bg-sky-500/15 text-sky-300',       dot: 'bg-sky-400' },
  pink:    { active: 'bg-pink-500/15 text-pink-300',     dot: 'bg-pink-400' },
  emerald: { active: 'bg-emerald-500/15 text-emerald-300', dot: 'bg-emerald-400' },
};

function LayerGroup({ label, items, layers, toggle }: {
  label: string;
  items: { key: LayerKey; label: string; icon: React.ReactNode; color: string }[];
  layers: Record<LayerKey, boolean>;
  toggle: (key: LayerKey) => void;
}) {
  return (
    <div className="px-1 py-0.5">
      <div className="text-[7px] font-bold text-neutral-600 uppercase tracking-widest px-2 py-1 select-none">{label}</div>
      {items.map(item => {
        const colors = LAYER_COLORS[item.color] || LAYER_COLORS.blue;
        return (
          <button key={item.key} onClick={() => toggle(item.key)}
            className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[9px] font-bold transition ${
              layers[item.key] ? colors.active : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
            }`}>
            {item.icon}
            {item.label}
            <span className={`ml-auto w-1.5 h-1.5 rounded-full transition ${layers[item.key] ? colors.dot : 'bg-neutral-700'}`} />
          </button>
        );
      })}
    </div>
  );
}
