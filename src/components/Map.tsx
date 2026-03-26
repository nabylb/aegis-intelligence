"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { IntelEvent } from '@/lib/types';
import { STRATEGIC_ASSETS, HISTORICAL_STRIKES } from '@/lib/staticData';
import {
  Activity,
  AlertCircle,
  Anchor,
  Flame,
  Plane,
  Radio,
  Shield,
  Ship,
  Satellite,
  Globe,
  Camera,
  Thermometer,
  Mountain,
  CloudRain,
  HeartHandshake,
  Layers,
  ShieldOff,
  Radiation
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ─── BALLISTIC TRAJECTORY PHYSICS ENGINE ────────────────────────────────────
// Known threat launch sites (approximate)
const LAUNCH_SITES: Record<string, { lat: number; lng: number; name: string }> = {
  'Iran':     { lat: 33.5, lng: 53.0,  name: 'Central Iran (IRGC)' },
  'Yemen':    { lat: 15.3, lng: 44.2,  name: 'Sana\'a / Houthi Zone' },
  'Gaza':     { lat: 31.4, lng: 34.35, name: 'Gaza Strip' },
  'Lebanon':  { lat: 33.5, lng: 35.5,  name: 'Southern Lebanon (Hezbollah)' },
  'Iraq':     { lat: 33.3, lng: 44.4,  name: 'Western Iraq (Kata\'ib)' },
};

function detectLaunchSite(event: IntelEvent): { lat: number; lng: number; name: string } {
  const text = `${event.title} ${event.summary || ''}`.toLowerCase();
  if (text.includes('iran') || text.includes('irgc') || text.includes('shahab') || text.includes('kheibar')) return LAUNCH_SITES.Iran;
  if (text.includes('houthi') || text.includes('yemen') || text.includes('ansarallah')) return LAUNCH_SITES.Yemen;
  if (text.includes('lebanon') || text.includes('hezbollah') || text.includes('nasrallah')) return LAUNCH_SITES.Lebanon;
  if (text.includes('iraq') || text.includes('kata\'ib') || text.includes('kataib')) return LAUNCH_SITES.Iraq;
  return LAUNCH_SITES.Gaza;
}

const FlagIcon = ({ countryCode, className = "w-4 h-3" }: { countryCode?: string, className?: string }) => {
  if (!countryCode) return null;
  const code = countryCode.toLowerCase();
  return (
    <img 
      src={`https://flagcdn.com/w20/${code}.png`} 
      className={`${className} object-cover rounded-sm shadow-sm border border-white/10`} 
      alt={countryCode}
      onError={(e: any) => e.target.style.display = 'none'}
    />
  );
};

// Map common regional country names/codes to ISO for flags
const getCountryCode = (input?: any): string | undefined => {
  if (!input) return undefined;
  const s = String(input).toLowerCase();
  if (s.match(/united states|us|usa|america/)) return 'us';
  if (s.match(/israel|isr/)) return 'il';
  if (s.match(/iran/)) return 'ir';
  if (s.match(/yemen/)) return 'ye';
  if (s.match(/lebanon/)) return 'lb';
  if (s.match(/jordan/)) return 'jo';
  if (s.match(/iraq/)) return 'iq';
  if (s.match(/syria/)) return 'sy';
  if (s.match(/emirates|uae|dubai/)) return 'ae';
  if (s.match(/saudi|ksa/)) return 'sa';
  if (s.match(/egypt/)) return 'eg';
  if (s.match(/turkey|turkiye/)) return 'tr';
  if (s.match(/russia/)) return 'ru';
  if (s.match(/united kingdom|uk|gb/)) return 'gb';
  if (s.match(/france/)) return 'fr';
  if (s.match(/germany/)) return 'de';
  if (s.match(/qatar/)) return 'qa';
  if (s.match(/kuwait/)) return 'kw';
  if (s.match(/neutral/)) return undefined;

  // MMSI MID (Maritime Identification Digit) mapping
  if (s.startsWith('338') || s.startsWith('366') || s.startsWith('367') || s.startsWith('368') || s.startsWith('369')) return 'us';
  if (s.startsWith('422')) return 'ir';
  if (s.startsWith('428')) return 'il';
  if (s.startsWith('408')) return 'ye';
  if (s.startsWith('410') || s.startsWith('411')) return 'lb';
  if (s.startsWith('412') || s.startsWith('413')) return 'ae';
  if (s.startsWith('273')) return 'ru';
  if (s.startsWith('232') || s.startsWith('235')) return 'gb';

  // ICAO24 Hex Prefix mapping (First 1-3 chars)
  if (s.startsWith('a')) return 'us'; // USA
  if (s.startsWith('48')) return 'il'; // Israel
  if (s.startsWith('73')) return 'ir'; // Iran
  if (s.startsWith('70')) return 'lb'; // Lebanon
  if (s.startsWith('71')) return 'ye'; // Yemen
  if (s.startsWith('43') || s.startsWith('06')) return 'tr'; // Turkey
  if (s.startsWith('1')) return 'ru'; // Russia
  if (s.startsWith('40')) return 'gb'; // UK

  // If it's already a 2-char code, return it
  if (s.length === 2 && !s.match(/\d/)) return s;
  return undefined;
};

import { ICAO_AIRLINES } from '@/lib/airlines';

function lookupAirline(callsign: string): { name: string; country: string } | null {
  if (!callsign) return null;
  // Strip digits to get the ICAO airline prefix (e.g. "ELY834" → "ELY")
  const prefix = callsign.replace(/[0-9]/g, '').toUpperCase();
  return ICAO_AIRLINES[prefix] || ICAO_AIRLINES[prefix.slice(0, 3)] || null;
}

const AircraftTooltip = ({ icao24, callsign, type, country, pos }: { icao24: string, callsign: string, type?: string, country?: string, pos: { x: number, y: number } }) => {
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!icao24) return;
    setLoading(true);
    // Planespotters.net free API — reliable aircraft photos by ICAO24 hex
    fetch(`https://api.planespotters.net/pub/photos/hex/${icao24.toUpperCase()}`)
      .then(res => res.json())
      .then(data => {
        const photos = data?.photos;
        if (photos && photos.length > 0) {
          // Use thumbnail_large for good quality without being huge
          setPhoto(photos[0]?.thumbnail_large?.src || photos[0]?.thumbnail?.src || null);
        } else {
          setPhoto(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setPhoto(null);
        setLoading(false);
      });
  }, [icao24]);

  const icaoHex = icao24 ? icao24.toUpperCase() : 'N/A';
  const safeCallsign = String(callsign || '');
  const airline = lookupAirline(safeCallsign);
  const isMil = safeCallsign.match(/RCH|CNV|MC|AF|NAVY|MARINES|SAM|VADER|HEX|RRR|IAF/) || (type && type.includes('Mil'));
  // Use airline country, then ICAO hex prefix, then registration prefix
  const countryCode = (airline?.country) || getCountryCode(icao24) || getCountryCode(country || (isMil ? 'US' : undefined));

  return (
    <div className="fixed z-[1100] pointer-events-none p-3 bg-black/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl w-[280px] animate-in fade-in zoom-in duration-200" style={{ left: pos.x + 15, top: pos.y - 120 }}>
      <div className="relative w-full h-[150px] bg-neutral-800 rounded mb-2 overflow-hidden border border-white/5">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center"><Activity className="w-6 h-6 text-blue-500 animate-pulse" /></div>
        ) : photo ? (
          <img src={photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            <Plane className="w-12 h-12 text-neutral-700 mb-2" />
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Registry Photo Unavailable</div>
            <div className="text-[8px] text-neutral-600 mt-1 uppercase italic">Displaying platform type: {type || 'Generic Airframe'}</div>
          </div>
        )}
        <div className={`absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur border border-white/20 rounded text-[9px] font-bold flex items-center gap-1.5 ${isMil ? 'text-red-400' : 'text-sky-400'}`}>
          <FlagIcon countryCode={countryCode} />
          {isMil ? 'MILITARY / STATE' : (airline?.name || 'Unknown Airline')}
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-white font-bold uppercase tracking-tight text-sm truncate">{callsign || 'N/A'}</h3>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div><span className="opacity-40 uppercase block text-[8px]">ICAO24</span><span className="text-blue-300 font-mono">{icaoHex}</span></div>
          <div><span className="opacity-40 uppercase block text-[8px]">Aircraft</span><span className="text-emerald-400 truncate block">{type || 'Unknown'}</span></div>
          <div><span className="opacity-40 uppercase block text-[8px]">Registration</span><span className="text-amber-300 font-mono">{country || 'N/A'}</span></div>
          <div><span className="opacity-40 uppercase block text-[8px]">Airline</span><span className="text-sky-300 truncate block">{airline?.name || (isMil ? 'Military' : 'Unknown')}</span></div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 opacity-30">
        <Radio className="w-3 h-3 text-blue-400" />
        <span className="text-[8px] uppercase font-bold tracking-widest">FR24 ADSB Transponder</span>
      </div>
    </div>
  );
};

// Build a parabolic arc between two geographic points using great-circle interpolation
function buildBallisticArc(
  origin: { lat: number; lng: number },
  target: { lat: number; lng: number },
  steps = 100
): Array<[number, number]> {
  const arc: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Linear interpolation along great circle (simplified)
    const lat = origin.lat + (target.lat - origin.lat) * t;
    const lng = origin.lng + (target.lng - origin.lng) * t;
    arc.push([lng, lat]);
  }
  return arc;
}

interface BallisticTrajectory {
  id: string;
  arc: Array<[number, number]>;
  origin: { lat: number; lng: number; name: string };
  target: { lat: number; lng: number };
  label: string;
  startTime: number;     // ms timestamp when launched
  flightDuration: number; // ms
  phase: 'inflight' | 'impact';
  progress: number;      // 0–1
}

interface IntelMapProps {
  events: IntelEvent[];
  historicalFilterDays: number;
  showBases: boolean;
  showBoats: boolean;
  showMilitary: boolean;
  showCivilian: boolean;
  showAviation: boolean;
  showStrikes: boolean;
  showCasualties: boolean;
  showSatellite: boolean;
  showThermal: boolean;
  showSeismic: boolean;
  showWeather: boolean;
  showHumanitarian: boolean;
  showHeatmap: boolean;
  usOnly: boolean;
}

function SatelliteTooltip({ title, summary, imageUrl, source, timestamp, pos }: { 
  title: string; 
  summary?: string; 
  imageUrl?: string; 
  source: string;
  timestamp: string;
  pos: { x: number, y: number } 
}) {
  return (
    <div 
      className="fixed z-[1001] pointer-events-none p-4 bg-black/90 backdrop-blur-xl border border-violet-500/30 rounded-xl shadow-[0_0_30px_rgba(139,92,246,0.3)] w-[320px] animate-in fade-in zoom-in duration-200" 
      style={{ left: pos.x + 20, top: pos.y - 120 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-violet-500/20 rounded-lg border border-violet-500/40">
          <Satellite className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h3 className="text-white font-bold text-xs uppercase tracking-widest truncate">{title}</h3>
          <p className="text-[9px] text-violet-400/70 font-mono italic">RECON PASS: {formatDistanceToNow(new Date(timestamp))} ago</p>
        </div>
      </div>

      {imageUrl && (
        <div className="relative w-full h-[180px] bg-neutral-900 rounded-lg mb-3 overflow-hidden border border-white/10 group">
          <img 
            src={imageUrl} 
            className="w-full h-full object-cover grayscale-[0.3] hover:grayscale-0 transition-all duration-700 scale-110 hover:scale-100" 
            referrerPolicy="no-referrer"
            onError={(e: any) => { e.target.onerror = null; e.target.src = "https://placehold.co/400x300/0a0a0a/666?text=RECON+DATA+ENCRYPTED"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-violet-600 text-white text-[8px] font-bold rounded uppercase tracking-tighter flex items-center gap-1">
             <Camera className="w-2.5 h-2.5" /> PAYLOAD
          </div>
          <div className="absolute bottom-2 left-2 flex gap-1 items-center">
             <div className="w-1 h-1 bg-red-500 rounded-full animate-ping" />
             <span className="text-[8px] font-mono text-white/50 tracking-widest">SAT-VIEW V4.2</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-[11px] text-neutral-300 leading-relaxed font-medium">
          {summary || 'No detailed analysis provided.'}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">{source}</span>
          <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded text-neutral-400 border border-white/5">TOP SECRET</span>
        </div>
      </div>
    </div>
  );
}

export default function IntelMap({
  events,
  historicalFilterDays,
  showBases,
  showBoats,
  showMilitary,
  showCivilian,
  showAviation,
  showStrikes,
  showCasualties,
  showSatellite,
  showThermal,
  showSeismic,
  showWeather,
  showHumanitarian,
  showHeatmap,
  usOnly
}: IntelMapProps) {
  const [showGIBSLayer, setShowGIBSLayer] = useState(false);
  
  // ─── BALLISTIC TRAJECTORY ANIMATION STATE ───────────────────────────────────
  const [trajectories, setTrajectories] = useState<BallisticTrajectory[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const seenStrikeIds = useRef<Set<string>>(new Set());

  // ─── HOVER STATES ───
  const [hoveredVessel, setHoveredVessel] = useState<any>(null);
  const [hoveredAircraft, setHoveredAircraft] = useState<any>(null);
  const [hoveredSatellite, setHoveredSatellite] = useState<any>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null);

  // Detect new strike events and spawn trajectories
  useEffect(() => {
    const strikeEvents = events.filter(e =>
      e.type === 'strike' && e.location && e.severity === 'critical' &&
      !seenStrikeIds.current.has(e.id)
    );
    if (strikeEvents.length === 0) return;

    const newTrajectories: BallisticTrajectory[] = strikeEvents.map(e => {
      seenStrikeIds.current.add(e.id);
      const origin = detectLaunchSite(e);
      const target = { lat: e.location!.lat, lng: e.location!.lng };
      const dist = Math.sqrt(Math.pow(target.lat - origin.lat, 2) + Math.pow(target.lng - origin.lng, 2));
      const flightDuration = Math.max(30000, Math.min(dist * 18000, 900000));
      return {
        id: `traj-${e.id}`,
        arc: buildBallisticArc(origin, target, 80),
        origin,
        target,
        label: e.title,
        startTime: Date.now(),
        flightDuration,
        phase: 'inflight' as const,
        progress: 0,
      };
    });

    if (newTrajectories.length > 0) {
      setTrajectories(prev => [...prev.slice(-4), ...newTrajectories]);
    }
  }, [events]);

  // Animation loop
  useEffect(() => {
    const tick = () => {
      setTrajectories(prev => {
        const now = Date.now();
        return prev
          .map(t => {
            const elapsed = now - t.startTime;
            if (t.phase === 'inflight') {
              const progress = Math.min(elapsed / t.flightDuration, 1);
              if (progress >= 1) return { ...t, phase: 'impact' as const, progress: 1, startTime: now };
              return { ...t, progress };
            } else {
              if (elapsed > 60000) return null;
              return t;
            }
          })
          .filter(Boolean) as BallisticTrajectory[];
      });
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  const missileGeoJSON = useMemo(() => {
    const arcFeatures = trajectories.map(t => {
      const pointIdx = Math.floor(t.progress * (t.arc.length - 1));
      const trailArc = t.arc.slice(0, pointIdx + 1);
      return {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: trailArc },
        properties: { phase: t.phase, id: t.id }
      };
    });
    const headFeatures = trajectories
      .filter(t => t.phase === 'inflight')
      .map(t => {
        const pointIdx = Math.floor(t.progress * (t.arc.length - 1));
        const pos = t.arc[pointIdx];
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: pos },
          properties: { id: t.id, label: t.label }
        };
      });
    const impactFeatures = trajectories
      .filter(t => t.phase === 'impact')
      .map(t => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [t.target.lng, t.target.lat] },
        properties: { id: t.id, label: t.label, elapsed: Date.now() - t.startTime }
      }));
    return {
      arcs: { type: 'FeatureCollection' as const, features: arcFeatures },
      heads: { type: 'FeatureCollection' as const, features: headFeatures },
      impacts: { type: 'FeatureCollection' as const, features: impactFeatures },
    };
  }, [trajectories]);

  const locatableEvents = useMemo(() => {
    // Exclude the high-volume AIS satellite snapshot from markers (they are handled by GPU layers)
    let locs = events.filter(e => e.location && e.source !== 'Global AIS Satellite');

    if (!showAviation) locs = locs.filter(e => e.type !== 'aviation');
    if (!showStrikes) locs = locs.filter(e => e.type !== 'strike');
    if (!showSatellite) locs = locs.filter(e => e.type !== 'satellite');
    if (!showThermal) locs = locs.filter(e => e.type !== 'thermal');
    if (!showSeismic) locs = locs.filter(e => e.type !== 'seismic');
    if (!showWeather) locs = locs.filter(e => e.type !== 'weather');
    if (!showHumanitarian) locs = locs.filter(e => e.type !== 'humanitarian');

    // Detailed Naval filtering for locatable SIGINT events
    locs = locs.filter(e => {
      if (e.type !== 'naval') return true;
      if (!showBoats) return false;

      const isMil = e.entity?.isMilitary;
      if (isMil && !showMilitary) return false;
      if (!isMil && !showCivilian) return false;

      return true;
    });

    if (historicalFilterDays > 0) {
       const cutoff = new Date(Date.now() - historicalFilterDays * 86400000);
       locs = locs.filter(e => {
          if (e.type === 'strike' || e.type === 'satellite') return new Date(e.timestamp) >= cutoff;
          return true;
       });
    }
    // Cap markers to prevent GPU overload — prioritize high-severity and recent
    if (locs.length > 200) {
      locs.sort((a, b) => {
        const sevOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        const sevDiff = (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
        if (sevDiff !== 0) return sevDiff;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      locs = locs.slice(0, 200);
    }
    return locs;
  }, [events, showAviation, showStrikes, showSatellite, showThermal, showSeismic, showWeather, showHumanitarian, showBoats, showMilitary, showCivilian, historicalFilterDays]);

  const flightLines = useMemo(() => {
    if (!showAviation) return { type: 'FeatureCollection', features: [] };
    const aviationEvts = events.filter(e => e.type === 'aviation' && e.location).slice(0, 100);
    return {
      type: 'FeatureCollection',
      features: aviationEvts.map(evt => {
        const speed = evt.entity?.speed || 250;
        const heading = evt.entity?.heading || 0;
        const dist = speed * 900;
        const rad = (heading + 180) * (Math.PI / 180);
        const dLat = (dist / 111320) * Math.cos(rad);
        const dLng = (dist / (111320 * Math.cos(evt.location!.lat * (Math.PI/180)))) * Math.sin(rad);
        const dLatFwd = (dist / 111320) * Math.cos(heading * (Math.PI / 180));
        const dLngFwd = (dist / (111320 * Math.cos(evt.location!.lat * (Math.PI/180)))) * Math.sin(heading * (Math.PI / 180));
        return {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [evt.location!.lng + dLng, evt.location!.lat + dLat],
              [evt.location!.lng, evt.location!.lat],
              [evt.location!.lng + dLngFwd, evt.location!.lat + dLatFwd]
            ]
          }
        };
      })
    };
  }, [events, showAviation]);

  const filteredStrikes = useMemo(() => {
    if (historicalFilterDays === 0) return [];
    const cutoff = new Date(Date.now() - historicalFilterDays * 86400000);
    let strikes = HISTORICAL_STRIKES.filter(s => new Date(s.date) >= cutoff);
    if (usOnly) strikes = strikes.filter(s => s.attacker === 'israel' || s.attacker === 'us' || s.targetName.includes('US') || s.targetName.includes('Israel'));
    return strikes;
  }, [historicalFilterDays, usOnly]);

  const filteredAssets = useMemo(() => {
    return STRATEGIC_ASSETS.filter(asset => {
      // 1. Faction Filter (Blue/Red team only mode)
      if (usOnly && !(asset.faction === 'us' || asset.faction === 'israel')) return false;

      // 2. Base/Oil/Chokepoint Filter
      const isBaseType = asset.type === 'base' || asset.type === 'oil_field' || asset.type === 'chokepoint';
      if (isBaseType) {
        return showBases;
      }
      
      // 3. Naval Filter (Carriers + Boats)
      const isNavalType = asset.type === 'boat' || asset.type === 'carrier';
      if (isNavalType) {
        if (!showBoats) return false;
        
        // Military vs Civilian Sub-filtering
        const isMilitaryVessel = asset.faction !== 'neutral';
        if (isMilitaryVessel && !showMilitary) return false;
        if (!isMilitaryVessel && !showCivilian) return false;
        
        return true;
      }

      return true;
    });
  }, [showBases, showBoats, showMilitary, showCivilian, usOnly]);

  const navalGeoJSON = useMemo(() => {
    if (!showBoats) return { type: 'FeatureCollection' as const, features: [] };
    const filteredNavalEvents = events.filter(e => {
      if (e.type !== 'naval' || !e.location) return false;
      const isMil = e.entity?.isMilitary;
      if (isMil && !showMilitary) return false;
      if (!isMil && !showCivilian) return false;
      return true;
    });
    return {
      type: 'FeatureCollection' as const,
      features: filteredNavalEvents.map(e => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.location!.lng, e.location!.lat] },
        properties: {
          id: e.id,
          name: e.title,
          callsign: e.entity?.callsign || '',
          speed: e.entity?.speed || 0,
          destination: e.entity?.destination || 'Unknown',
          source: e.source,
          isMilitary: e.entity?.isMilitary || false,
          mmsi: e.entity?.mmsi || '',
          imo: e.entity?.imo || '',
        }
      }))
    };
  }, [events, showBoats, showMilitary, showCivilian]);

  const countryCasualties = useMemo(() => {
    if (!showCasualties) return [];
    const totals: Record<string, { lat: number, lng: number, count: number }> = {
      'Israel': { lat: 31.4, lng: 34.9, count: 0 },
      'Lebanon': { lat: 33.9, lng: 35.9, count: 0 },
      'Syria': { lat: 34.8, lng: 38.9, count: 0 },
      'Iraq': { lat: 33.2, lng: 43.6, count: 0 },
      'Iran': { lat: 32.4, lng: 53.6, count: 0 },
      'Yemen': { lat: 15.5, lng: 48.5, count: 0 },
      'Palestine': { lat: 31.9, lng: 35.2, count: 0 }
    };
    let activeCutoff = 0;
    if (historicalFilterDays > 0) activeCutoff = Date.now() - historicalFilterDays * 86400000;
    events.forEach(e => {
       if (e.fatalities && e.fatalities > 0) {
          if (activeCutoff > 0 && new Date(e.timestamp).getTime() < activeCutoff) return;
          Object.keys(totals).forEach(c => {
             if (e.title.includes(c) || e.summary?.includes(c)) totals[c].count += e.fatalities!;
          });
       }
    });
    return Object.entries(totals).filter(([_, data]) => data.count > 0).map(([name, data]) => ({ name, ...data }));
  }, [events, showCasualties, historicalFilterDays]);

  const heatmapGeoJSON = useMemo(() => {
    if (!showHeatmap) return { type: 'FeatureCollection' as const, features: [] };
    const kinetic = events.filter(e =>
      e.location && (e.type === 'strike' || e.type === 'conflict' || e.type === 'military' || e.type === 'thermal' || e.type === 'seismic')
    ).slice(0, 500);
    return {
      type: 'FeatureCollection' as const,
      features: kinetic.map(e => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.location!.lng, e.location!.lat] },
        properties: {
          weight: e.severity === 'critical' ? 4 : e.severity === 'high' ? 3 : e.severity === 'medium' ? 2 : 1,
          fatalities: e.fatalities || 0,
        }
      }))
    };
  }, [events, showHeatmap]);

  const [isSatellite, setIsSatellite] = useState(true);

  const MAP_STYLES = {
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    satellite: {
      version: 8 as const,
      sources: {
        'satellite-tiles': {
          type: 'raster' as const,
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: 'Esri, Maxar, Earthstar Geographics',
          maxzoom: 19,
        }
      },
      layers: [
        {
          id: 'satellite-layer',
          type: 'raster' as const,
          source: 'satellite-tiles',
          minzoom: 0,
          maxzoom: 19,
        }
      ]
    }
  };

  const mapStyle = isSatellite ? MAP_STYLES.satellite : MAP_STYLES.dark;

  const addVesselImage = (map: any) => {
    const boatSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.2.9 4.3 2.5 6"/><path d="M12 10V4l-2-2"/></svg>`;
    const blob = new Blob([boatSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { if (!map.hasImage('vessel')) map.addImage('vessel', img); };
    img.src = url;
  };

  const onMapLoad = (e: any) => {
    const map = e.target;
    addVesselImage(map);
    // Re-add vessel image on style change (satellite ↔ dark)
    map.on('style.load', () => addVesselImage(map));
  };

  const handleMouseMove = (e: any) => {
    // Prevent the background AIS layer from stealing hover from strategic markers
    if (hoveredVessel && hoveredVessel.photoUrl) return;

    const vessel = e.features && e.features[0];
    if (vessel && (vessel.layer.id === 'vessel-unclustered')) {
      setHoveredVessel(vessel.properties);
      setHoverPos({ x: e.point.x, y: e.point.y });
    } else {
      setHoveredVessel(null);
    }
  };

  return (
    <div className="absolute inset-0 z-0 bg-neutral-950">
      <Map
        id="mainMap"
        initialViewState={{
          longitude: 48.3890,
          latitude: 31.6892,
          zoom: 4.2,
          pitch: 55,
          bearing: -10,
        }}
        mapStyle={mapStyle}
        interactiveLayerIds={['vessel-unclustered']}
        onLoad={onMapLoad}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (!hoveredVessel?.photoUrl) setHoveredVessel(null); }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* NASA GIBS VIIRS True Color Overlay — real-time satellite imagery tiles */}
        {showGIBSLayer && (
          <Source
            id="nasa-gibs"
            type="raster"
            tiles={[
              `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${new Date().toISOString().split('T')[0]}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
            ]}
            tileSize={256}
            attribution="NASA GIBS / VIIRS"
            maxzoom={9}
          >
            <Layer id="nasa-gibs-layer" type="raster" paint={{ 'raster-opacity': 0.7 }} />
          </Source>
        )}

        {showHeatmap && heatmapGeoJSON.features.length > 0 && (
          <Source id="event-heatmap" type="geojson" data={heatmapGeoJSON}>
            <Layer
              id="event-heatmap-layer"
              type="heatmap"
              paint={{
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 1, 0.3, 4, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(0,0,0,0)',
                  0.2, 'rgba(103,169,207,0.6)',
                  0.4, 'rgba(209,229,143,0.7)',
                  0.6, 'rgba(253,219,119,0.8)',
                  0.8, 'rgba(239,138,98,0.9)',
                  1, 'rgba(178,24,43,1)'
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 5, 20, 9, 40],
                'heatmap-opacity': 0.7,
              }}
            />
          </Source>
        )}

        <Source id="missile-arcs" type="geojson" data={missileGeoJSON.arcs}>
          <Layer id="missile-arc-trail" type="line" paint={{ 'line-color': '#ef4444', 'line-width': 2, 'line-dasharray': [4, 3], 'line-opacity': 0.9 }} />
        </Source>
        <Source id="missile-heads" type="geojson" data={missileGeoJSON.heads}>
          <Layer id="missile-head-glow" type="circle" paint={{ 'circle-radius': 9, 'circle-color': '#fca5a5', 'circle-opacity': 0.3, 'circle-blur': 0.8 }} />
          <Layer id="missile-head-core" type="circle" paint={{ 'circle-radius': 4, 'circle-color': '#ef4444', 'circle-opacity': 1, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' }} />
        </Source>
        <Source id="missile-impacts" type="geojson" data={missileGeoJSON.impacts}>
          <Layer id="missile-impact-shockwave" type="circle" paint={{ 'circle-radius': ['interpolate', ['linear'], ['get', 'elapsed'], 0, 10, 60000, 60], 'circle-color': '#f97316', 'circle-opacity': 0.25, 'circle-blur': 0.6, 'circle-stroke-width': 2, 'circle-stroke-color': '#ef4444', 'circle-stroke-opacity': 0.8 }} />
        </Source>

        {showBoats && navalGeoJSON.features.length > 0 && (
          <Source id="vessels" type="geojson" data={navalGeoJSON} cluster={true} clusterMaxZoom={8} clusterRadius={40}>
            <Layer id="vessel-clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-color': ['step', ['get', 'point_count'], '#334155', 20, '#1d4ed8', 80, '#1e3a5f'], 'circle-radius': ['step', ['get', 'point_count'], 12, 20, 18, 80, 24], 'circle-opacity': 0.85, 'circle-stroke-width': 1, 'circle-stroke-color': '#38bdf8', 'circle-stroke-opacity': 0.5 }} />
            <Layer id="vessel-cluster-count" type="symbol" filter={['has', 'point_count']} layout={{ 'text-field': '{point_count_abbreviated}', 'text-font': ['Noto Sans Regular'], 'text-size': 10 }} paint={{ 'text-color': '#bae6fd' }} />
            <Layer id="vessel-unclustered" type="symbol" filter={['!', ['has', 'point_count']]} layout={{ 'icon-image': 'vessel', 'icon-size': 0.5, 'icon-allow-overlap': true }} paint={{ 'icon-color': ['case', ['boolean', ['get', 'isMilitary'], false], '#1d4ed8', '#38bdf8'], 'icon-opacity': 0.9 }} />
          </Source>
        )}

        {showAviation && flightLines.features && flightLines.features.length > 0 && (
          <Source id="trajectories" type="geojson" data={flightLines as any}>
            <Layer id="trajectory-lines" type="line" paint={{ 'line-color': '#3b82f6', 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [2, 2] }} />
          </Source>
        )}

        {filteredAssets.map(asset => {
          const isShip = asset.type === 'boat' || asset.type === 'carrier';
          const isMil = asset.faction !== 'neutral';
          
          let colorClass = 'bg-neutral-600/30 border-neutral-400 text-neutral-300';
          if (asset.faction === 'us' || asset.faction === 'israel') {
            colorClass = 'bg-blue-600/30 border-blue-400 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.3)]';
          } else if (asset.faction === 'iran' || asset.faction === 'yemen') {
            colorClass = 'bg-red-600/30 border-red-400 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
          }

          return (
           <Marker key={asset.id} longitude={asset.lng} latitude={asset.lat} anchor="center">
             <div 
              className="group relative flex flex-col items-center cursor-pointer"
              onMouseEnter={(e) => {
                if (asset.mmsi || asset.photoUrl) {
                  setHoveredVessel({
                    name: asset.name,
                    mmsi: asset.mmsi,
                    photoUrl: asset.photoUrl,
                    faction: asset.faction,
                    isMilitary: asset.faction !== 'neutral',
                    callsign: asset.id.toUpperCase(),
                    destination: asset.description,
                  });
                  setHoverPos({ x: e.clientX, y: e.clientY });
                }
              }}
              onMouseLeave={() => setHoveredVessel(null)}
             >
                <div className={`p-1 rounded-full border shadow-lg transition-transform hover:scale-125 ${colorClass}`}>
                   {asset.type === 'base' ? <Shield className="w-5 h-5" /> : 
                    isShip ? <Ship className="w-4 h-4" /> : <Anchor className="w-4 h-4" />}
                </div>
                <div className="absolute top-full mt-1 px-2 py-0.5 bg-black/80 border border-white/10 rounded-sm text-[8px] font-bold tracking-tighter whitespace-nowrap opacity-0 group-hover:opacity-100 uppercase z-50">
                  {asset.name}
                </div>
             </div>
           </Marker>
          );
        })}

        {locatableEvents.map((evt, idx) => {
          const isAviation = evt.type === 'aviation';
          const isNaval = evt.type === 'naval';
          const isSatelliteEvt = evt.type === 'satellite';
          const isConflict = evt.type === 'conflict';
          const isStrike = evt.type === 'strike';
          const isThermal = evt.type === 'thermal';
          const isSeismic = evt.type === 'seismic';
          const isWeather = evt.type === 'weather';
          const isHumanitarian = evt.type === 'humanitarian';
          const isNOTAM = evt.type === 'notam';
          const isNuclear = evt.type === 'nuclear';
          const hasCasualties = (evt.fatalities || 0) > 0;
          const isHighSeverity = evt.severity === 'high' || evt.severity === 'critical';

          return (
            <Marker key={`${evt.id}-${idx}`} longitude={evt.location!.lng} latitude={evt.location!.lat} anchor="center">
              <div 
                className="group relative"
                onMouseEnter={(e) => {
                  if (evt.type === 'aviation') {
                    setHoveredAircraft({
                      icao24: evt.entity?.icao24 || evt.id.split('-')[1],
                      callsign: evt.entity?.callsign || evt.title,
                      type: evt.entity?.type,
                      country: evt.entity?.country
                    });
                    setHoverPos({ x: e.clientX, y: e.clientY });
                  } else if (evt.type === 'naval') {
                    setHoveredVessel({
                      name: evt.entity?.callsign || evt.title,
                      mmsi: evt.entity?.mmsi,
                      callsign: evt.entity?.callsign,
                      speed: evt.entity?.speed,
                      destination: evt.entity?.destination,
                      isMilitary: evt.entity?.isMilitary,
                      source: evt.source,
                    });
                    setHoverPos({ x: e.clientX, y: e.clientY });
                  } else if (evt.type === 'satellite' || evt.type === 'thermal' || evt.type === 'seismic' || evt.type === 'weather' || evt.type === 'humanitarian' || evt.type === 'notam' || evt.type === 'nuclear') {
                    setHoveredSatellite(evt);
                    setHoverPos({ x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredAircraft(null);
                  setHoveredVessel(null);
                  setHoveredSatellite(null);
                }}
              >
                <div 
                  className={`flex items-center justify-center rounded-full border transition-all duration-300 ${
                    isAviation
                      ? 'w-4 h-4 bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                      : isNaval
                      ? 'w-4 h-4 bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                      : isSatelliteEvt
                      ? 'w-5 h-5 bg-violet-500/20 border-violet-500/50 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.5)] animate-pulse'
                      : isThermal
                      ? `w-4 h-4 border-amber-500/50 text-amber-400 ${isHighSeverity ? 'bg-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse' : 'bg-amber-500/20'}`
                      : isSeismic
                      ? `w-4 h-4 border-yellow-500/50 text-yellow-400 ${isHighSeverity ? 'bg-yellow-500/40 shadow-[0_0_12px_rgba(234,179,8,0.6)]' : 'bg-yellow-500/20'}`
                      : isWeather
                      ? 'w-4 h-4 bg-sky-500/20 border-sky-500/50 text-sky-400'
                      : isHumanitarian
                      ? 'w-4 h-4 bg-pink-500/20 border-pink-500/50 text-pink-400'
                      : isNOTAM
                      ? `w-4 h-4 border-indigo-500/50 text-indigo-400 ${isHighSeverity ? 'bg-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.6)]' : 'bg-indigo-500/20'}`
                      : isNuclear
                      ? `w-5 h-5 border-fuchsia-500/50 text-fuchsia-400 ${isHighSeverity ? 'bg-fuchsia-500/40 shadow-[0_0_15px_rgba(217,70,239,0.6)] animate-pulse' : 'bg-fuchsia-500/20'}`
                      : (isConflict || isStrike)
                        ? hasCasualties ? 'bg-red-600 border-red-400 text-white font-black shadow-[0_0_15px_rgba(220,38,38,0.8)] scale-125' : 'bg-orange-500/40 border-orange-500/80 text-orange-400'
                        : isHighSeverity
                          ? 'bg-red-500/20 border-red-500/50 text-red-500'
                          : 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  }`}
                  style={{
                    transform: isAviation ? `rotate(${evt.entity?.heading || 0}deg)` : 'none'
                  }}
                >
                  {isAviation ? (
                    <Plane className="w-3 h-3 fill-current" />
                  ) : isNaval ? (
                    <Ship className="w-3 h-3 fill-current" />
                  ) : isSatelliteEvt ? (
                    <Satellite className="w-3.5 h-3.5" />
                  ) : isThermal ? (
                    <Thermometer className="w-3 h-3" />
                  ) : isSeismic ? (
                    <Mountain className="w-3 h-3" />
                  ) : isWeather ? (
                    <CloudRain className="w-3 h-3" />
                  ) : isHumanitarian ? (
                    <HeartHandshake className="w-3 h-3" />
                  ) : isNOTAM ? (
                    <ShieldOff className="w-3 h-3" />
                  ) : isNuclear ? (
                    <Radiation className="w-3.5 h-3.5" />
                  ) : (isConflict || isStrike) && hasCasualties ? (
                     <span className="text-[12px]">{evt.fatalities}</span>
                  ) : isStrike ? (
                     <Flame className="w-3 h-3" />
                  ) : isHighSeverity ? (
                     <AlertCircle className="w-4 h-4" />
                  ) : (
                    <Radio className="w-3 h-3" />
                  )}
                </div>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 bg-neutral-900/90 backdrop-blur border border-neutral-700 p-2 rounded text-xs z-50 pointer-events-none text-neutral-200 shadow-xl">
                  <div className="font-semibold text-white mb-1 uppercase tracking-tighter">{evt.entity?.callsign || evt.title}</div>
                  <div className="opacity-70 line-clamp-2">{evt.summary}</div>
                  <div className="mt-1 flex items-center justify-between opacity-50 text-[10px]"><span>{evt.source}</span><span>{formatDistanceToNow(new Date(evt.timestamp))} ago</span></div>
                </div>
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Map Style Toggle — outside <Map> so clicks aren't intercepted */}
      <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={() => setShowGIBSLayer(!showGIBSLayer)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition shadow-lg backdrop-blur-md cursor-pointer ${
            showGIBSLayer
              ? 'bg-orange-500/20 border-orange-500/40 text-orange-300 hover:bg-orange-500/30'
              : 'bg-black/60 border-white/10 text-neutral-400 hover:text-white hover:bg-black/80'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {showGIBSLayer ? 'NASA GIBS ON' : 'NASA GIBS'}
        </button>
        <button
          onClick={() => setIsSatellite(!isSatellite)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition shadow-lg backdrop-blur-md cursor-pointer ${
            isSatellite
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
              : 'bg-black/60 border-white/10 text-neutral-400 hover:text-white hover:bg-black/80'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          {isSatellite ? 'SATELLITE' : 'DARK MAP'}
        </button>
      </div>

      {hoveredVessel && hoverPos && (
        <div className="fixed z-[1000] pointer-events-none p-3 bg-black/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl w-[260px] animate-in fade-in zoom-in duration-200" style={{ left: hoverPos.x + 15, top: hoverPos.y - 100 }}>
          <div className="relative w-full h-[140px] bg-neutral-800 rounded mb-2 overflow-hidden border border-white/5">
            {hoveredVessel.photoUrl || hoveredVessel.mmsi ? (
              <img 
                src={hoveredVessel.photoUrl ? hoveredVessel.photoUrl : `https://photos.marinetraffic.com/ais/showphoto.aspx?mmsi=${hoveredVessel.mmsi}`} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                onError={(e: any) => { e.target.onerror = null; e.target.src = "https://placehold.co/300x200/0a0a0a/666?text=SECURE+INTEL+FEED+ONLY"; }} 
              />
            ) : (<div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500 uppercase tracking-widest font-bold">No Photo Available</div>)}
            <div className={`absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur border border-white/20 rounded text-[9px] font-bold flex items-center gap-1.5 ${hoveredVessel.isMilitary ? 'text-blue-400' : 'text-sky-400'}`}>
              <FlagIcon countryCode={getCountryCode(hoveredVessel.faction || hoveredVessel.mmsi)} />
              {hoveredVessel.isMilitary ? 'MILITARY' : 'CIVILIAN'}
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-white font-bold uppercase tracking-tight text-sm truncate">{hoveredVessel.name || 'UNKNOWN VESSEL'}</h3>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div><span className="opacity-40 uppercase block text-[8px]">Callsign</span><span className="text-blue-300 font-mono">{hoveredVessel.callsign || 'N/A'}</span></div>
              <div><span className="opacity-40 uppercase block text-[8px]">Destination</span><span className="text-emerald-400 truncate block">{hoveredVessel.destination || 'OPEN SEA'}</span></div>
              <div><span className="opacity-40 uppercase block text-[8px]">Speed</span><span className="text-amber-400">{hoveredVessel.speed ? `${hoveredVessel.speed} kn` : '0 kn'}</span></div>
              <div><span className="opacity-40 uppercase block text-[8px]">MMSI</span><span className="text-neutral-500 font-mono">{hoveredVessel.mmsi || 'N/A'}</span></div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-white/5 flex items-center gap-1.5 opacity-30"><Radio className="w-3 h-3 text-sky-400" /><span className="text-[8px] uppercase font-bold tracking-widest">Live Sat-AIS Telemetry</span></div>
        </div>
      )}
      {hoveredAircraft && hoverPos && (
        <AircraftTooltip 
          icao24={hoveredAircraft.icao24} 
          callsign={hoveredAircraft.callsign} 
          type={hoveredAircraft.type} 
          country={hoveredAircraft.country}
           pos={hoverPos} 
        />
      )}
      {hoveredSatellite && hoverPos && (
        <SatelliteTooltip 
          title={hoveredSatellite.title}
          summary={hoveredSatellite.summary}
          imageUrl={hoveredSatellite.payloadImage}
          source={hoveredSatellite.source}
          timestamp={hoveredSatellite.timestamp}
          pos={hoverPos}
        />
      )}
    </div>
  );
}
