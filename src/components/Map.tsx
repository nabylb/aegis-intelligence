"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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
  const prefix = callsign.replace(/[0-9]/g, '').toUpperCase();
  return ICAO_AIRLINES[prefix] || ICAO_AIRLINES[prefix.slice(0, 3)] || null;
}

// Image lookup chain: Wikipedia → Wikipedia search → Wikimedia Commons
// Global cache shared across all component instances
const wikiImageCache: Record<string, string | null> = {};

function useWikipediaImage(query: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;
    if (wikiImageCache[query] !== undefined) {
      setImageUrl(wikiImageCache[query]);
      return;
    }
    setImageUrl(null);

    // Wikipedia page summary (fastest)
    const tryWikiSummary = (q: string): Promise<string | null> =>
      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d?.thumbnail?.source || d?.originalimage?.source || null)
        .catch(() => null);

    // Wikipedia search → get summary of top result
    const tryWikiSearch = (q: string): Promise<string | null> =>
      fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=1`)
        .then(r => r.json())
        .then(d => {
          const title = d?.query?.search?.[0]?.title;
          return title ? tryWikiSummary(title) : null;
        })
        .catch(() => null);

    // Wikimedia Commons: search File namespace, then get thumbnail
    const tryCommonsSearch = (q: string): Promise<string | null> =>
      fetch(`https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srnamespace=6&srlimit=1&format=json&origin=*`)
        .then(r => r.json())
        .then(d => {
          const title = d?.query?.search?.[0]?.title;
          if (!title) return null;
          return fetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=500&format=json&origin=*`)
            .then(r2 => r2.json())
            .then(d2 => {
              for (const page of Object.values(d2?.query?.pages || {}) as any[]) {
                const info = page?.imageinfo?.[0];
                if (info?.thumburl) return info.thumburl;
                if (info?.url && /\.(jpg|jpeg|png|webp)/i.test(info.url)) return info.url;
              }
              return null;
            });
        })
        .catch(() => null);

    (async () => {
      let img: string | null = null;

      // 1. Direct Wikipedia summary
      img = await tryWikiSummary(query);

      // 2. Wikipedia search
      if (!img) img = await tryWikiSearch(query);

      // 3. Wikimedia Commons (great for military vessels worldwide)
      if (!img) img = await tryCommonsSearch(query);

      // 4. Strip parentheticals and retry Commons (e.g. "USS Boxer (LHD-4)" → "USS Boxer")
      if (!img && query.includes('(')) {
        const clean = query.replace(/\s*\(.*?\)\s*/g, '').trim();
        img = await tryCommonsSearch(clean);
      }

      // 5. For military vessels, try adding "warship" to Commons search
      if (!img && /^(USS|HMS|INS|ROKS|JS|FNS|TCG|ARA|IRIS|PLANS|ENS|HMCS|HMAS)\s/.test(query)) {
        img = await tryCommonsSearch(query + ' warship');
      }

      // 6. Try Wikidata entity image (covers many military items)
      if (!img) {
        try {
          const wdSearch = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=1&format=json&origin=*`).then(r => r.json());
          const entityId = wdSearch?.search?.[0]?.id;
          if (entityId) {
            const wdEntity = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${entityId}&property=P18&format=json&origin=*`).then(r => r.json());
            const fileName = wdEntity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
            if (fileName) {
              img = `https://commons.wikimedia.org/w/thumb.php?f=${encodeURIComponent(fileName.replace(/ /g, '_'))}&w=500`;
            }
          }
        } catch {}
      }

      // 7. Final fallback: server-side Google Image search
      if (!img) {
        try {
          const res = await fetch(`/api/image-search?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          if (data?.image) img = data.image;
        } catch {}
      }

      wikiImageCache[query] = img;
      setImageUrl(img);
    })();
  }, [query]);

  return imageUrl;
}

const AircraftTooltip = ({ icao24, callsign, type, country, origin, destination, sourceUrl, pos, onClose }: { icao24: string, callsign: string, type?: string, country?: string, origin?: string, destination?: string, sourceUrl?: string, pos: { x: number, y: number }, onClose: () => void }) => {
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
    <div className="fixed z-[1100] p-3 bg-black/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl w-[280px] animate-in fade-in zoom-in duration-200" style={{ left: Math.min(pos.x + 15, window.innerWidth - 300), top: Math.min(pos.y - 120, window.innerHeight - 400) }} onClick={(e) => e.stopPropagation()}>
      <button onClick={onClose} className="absolute top-1.5 right-1.5 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-neutral-500 hover:text-white text-[10px] transition">✕</button>
      <div className="relative w-full h-[150px] bg-neutral-800 rounded mb-2 overflow-hidden border border-white/5">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center"><Activity className="w-6 h-6 text-blue-500 animate-pulse" /></div>
        ) : photo ? (
          <img src={photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            <Plane className="w-12 h-12 text-neutral-700 mb-2" />
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Registry Photo Unavailable</div>
            <div className="text-[8px] text-neutral-600 mt-1 uppercase italic">Platform: {type || 'Generic Airframe'}</div>
          </div>
        )}
        <div className={`absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur border border-white/20 rounded text-[9px] font-bold flex items-center gap-1.5 ${isMil ? 'text-red-400' : 'text-sky-400'}`}>
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
          {origin && <div><span className="opacity-40 uppercase block text-[8px]">Origin</span><span className="text-neutral-300 font-mono">{origin}</span></div>}
          {destination && <div><span className="opacity-40 uppercase block text-[8px]">Dest</span><span className="text-neutral-300 font-mono">{destination}</span></div>}
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[8px] uppercase font-bold tracking-widest text-neutral-600">ADSB Transponder</span>
        <div className="flex gap-2">
          <a href={`https://www.flightradar24.com/${safeCallsign}`} target="_blank" rel="noopener noreferrer" className="text-[8px] text-sky-400 hover:text-sky-300 underline underline-offset-2 font-bold uppercase">FR24</a>
          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[8px] text-sky-400 hover:text-sky-300 underline underline-offset-2 font-bold uppercase">Source</a>}
        </div>
      </div>
    </div>
  );
};

// Vessel modal component with Wikipedia image fallback
const VesselModal = ({ vessel, pos, onClose }: { vessel: any, pos: { x: number, y: number }, onClose: () => void }) => {
  // Build a good search query: military vessels get searched by name directly, civilian vessels add "ship"
  const searchQuery = (() => {
    if (!vessel.name || vessel.name === 'UNKNOWN VESSEL') return undefined;
    const name = vessel.name;
    // Military prefixes — search directly (Wikipedia has articles like "USS Abraham Lincoln")
    if (/^(USS|HMS|INS|ROKS|JS|FNS|TCG|ARA|HMCS|HMAS|KRI|RMN|RSN)\s/.test(name)) return name;
    if (vessel.isMilitary) return name + ' warship';
    return name + ' ship';
  })();
  const wikiImage = useWikipediaImage(searchQuery);
  const [mtFailed, setMtFailed] = useState(false);
  const mtPhotoSrc = vessel.photoUrl || (vessel.mmsi ? `https://photos.marinetraffic.com/ais/showphoto.aspx?mmsi=${vessel.mmsi}` : null);
  const displayImage = (!mtFailed && mtPhotoSrc) ? mtPhotoSrc : wikiImage;

  return (
    <div className="fixed z-[1000] p-3 bg-black/95 backdrop-blur-md border border-cyan-500/20 rounded-xl shadow-2xl w-[280px] animate-in fade-in zoom-in duration-200" style={{ left: Math.min(pos.x + 15, window.innerWidth - 300), top: Math.min(Math.max(pos.y - 100, 10), window.innerHeight - 450) }} onClick={(e) => e.stopPropagation()}>
      <button onClick={onClose} className="absolute top-1.5 right-1.5 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-neutral-500 hover:text-white text-[10px] transition">✕</button>
      <div className="relative w-full h-[140px] bg-neutral-800 rounded-lg mb-2 overflow-hidden border border-white/5">
        {displayImage ? (
          <img src={displayImage} className="w-full h-full object-cover" referrerPolicy="no-referrer"
            onError={() => { if (!mtFailed && mtPhotoSrc) setMtFailed(true); }} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Ship className="w-10 h-10 text-neutral-700" />
            <span className="text-[9px] text-neutral-600 mt-2 uppercase tracking-wider">{wikiImage === null ? 'Photo Unavailable' : 'Loading...'}</span>
          </div>
        )}
        <div className={`absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 backdrop-blur border border-white/20 rounded text-[9px] font-bold flex items-center gap-1.5 ${vessel.isMilitary ? 'text-blue-400' : 'text-cyan-400'}`}>
          <FlagIcon countryCode={getCountryCode(vessel.faction || vessel.mmsi)} />
          {vessel.isMilitary ? 'MILITARY VESSEL' : 'CIVILIAN VESSEL'}
        </div>
      </div>
      <div className="space-y-1.5">
        <h3 className="text-white font-bold uppercase tracking-tight text-sm truncate">{vessel.name || 'UNKNOWN VESSEL'}</h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
          <div><span className="opacity-40 uppercase block text-[8px]">Callsign</span><span className="text-blue-300 font-mono">{vessel.callsign || 'N/A'}</span></div>
          <div><span className="opacity-40 uppercase block text-[8px]">Destination</span><span className="text-emerald-400 truncate block">{vessel.destination || 'Open Sea'}</span></div>
          <div><span className="opacity-40 uppercase block text-[8px]">Speed</span><span className="text-amber-400">{vessel.speed ? `${vessel.speed} kn` : '0 kn'}</span></div>
          <div><span className="opacity-40 uppercase block text-[8px]">MMSI</span><span className="text-neutral-400 font-mono">{vessel.mmsi || 'N/A'}</span></div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[8px] uppercase font-bold tracking-widest text-neutral-600">AIS Transponder</span>
        <div className="flex gap-2">
          {vessel.mmsi && <a href={`https://www.marinetraffic.com/en/ais/details/ships/mmsi:${vessel.mmsi}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 font-bold">MarineTraffic →</a>}
          {vessel.sourceUrl && <a href={vessel.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 font-bold">Source</a>}
        </div>
      </div>
    </div>
  );
};

// Strategic asset modal with Wikipedia image fallback
const AssetModal = ({ asset, pos, onClose }: { asset: typeof STRATEGIC_ASSETS[0], pos: { x: number, y: number }, onClose: () => void }) => {
  const isShip = asset.type === 'boat' || asset.type === 'carrier' || asset.type === 'submarine';
  const isIncident = isShip && asset.faction === 'neutral';
  const isBase = asset.type === 'base' || asset.type === 'oil_field';
  const isChokepoint = asset.type === 'chokepoint';

  // Try Wikipedia for image when no photoUrl
  const wikiQuery = asset.name.replace(/\s*\(.*?\)\s*/g, '').trim();
  const wikiImage = useWikipediaImage(!asset.photoUrl ? wikiQuery : undefined);
  const [photoFailed, setPhotoFailed] = useState(false);
  const displayImage = (!photoFailed && asset.photoUrl) ? asset.photoUrl : wikiImage;

  const factionColors: Record<string, string> = { us: 'border-blue-500/30', israel: 'border-blue-500/30', uk: 'border-blue-400/30', france: 'border-indigo-500/30', turkey: 'border-teal-500/30', saudi: 'border-emerald-500/30', uae: 'border-emerald-500/30', qatar: 'border-emerald-500/30', egypt: 'border-amber-500/30', jordan: 'border-amber-500/30', iraq: 'border-amber-500/30', iran: 'border-red-500/30', yemen: 'border-red-500/30', russia: 'border-red-500/30', china: 'border-rose-500/30', india: 'border-orange-500/30', neutral: 'border-orange-500/30' };
  const factionLabels: Record<string, string> = { us: 'United States', israel: 'Israel', uk: 'United Kingdom', france: 'France', turkey: 'Turkey', saudi: 'Saudi Arabia', uae: 'UAE', qatar: 'Qatar', bahrain: 'Bahrain', oman: 'Oman', egypt: 'Egypt', jordan: 'Jordan', iraq: 'Iraq', iran: 'Iran', yemen: 'Yemen / Houthi', russia: 'Russia', china: 'China', india: 'India', neutral: 'Incident' };
  const factionBadgeColors: Record<string, string> = { us: 'text-blue-400', israel: 'text-blue-400', uk: 'text-blue-300', france: 'text-indigo-400', turkey: 'text-teal-400', saudi: 'text-emerald-400', uae: 'text-emerald-400', qatar: 'text-emerald-400', egypt: 'text-amber-400', jordan: 'text-amber-400', iraq: 'text-amber-400', iran: 'text-red-400', yemen: 'text-red-400', russia: 'text-red-400', china: 'text-rose-400', india: 'text-orange-400', neutral: 'text-orange-400' };
  const mtUrl = asset.mmsi ? `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${asset.mmsi}` : null;

  return (
    <div className={`fixed z-[1001] p-3 bg-black/95 backdrop-blur-xl ${factionColors[asset.faction] || 'border-white/10'} border rounded-xl shadow-2xl w-[300px] animate-in fade-in zoom-in duration-200`}
      style={{ left: Math.min(pos.x + 15, window.innerWidth - 320), top: Math.min(Math.max(pos.y - 120, 10), window.innerHeight - 480) }}
      onClick={(e) => e.stopPropagation()}>
      <button onClick={onClose} className="absolute top-2 right-2 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-neutral-500 hover:text-white text-[10px] transition">✕</button>
      {displayImage && (
        <div className="relative w-full h-[150px] bg-neutral-800 rounded-lg mb-3 overflow-hidden border border-white/5">
          <img src={displayImage} className="w-full h-full object-cover" referrerPolicy="no-referrer"
            onError={() => { if (!photoFailed && asset.photoUrl) setPhotoFailed(true); }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          {isIncident && (
            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-orange-600/90 text-white text-[8px] font-bold rounded flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" /> MARITIME INCIDENT
            </div>
          )}
          {!isIncident && (
            <div className={`absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 backdrop-blur rounded text-[8px] font-bold flex items-center gap-1.5 ${factionBadgeColors[asset.faction]}`}>
              <FlagIcon countryCode={asset.country} />
              {factionLabels[asset.faction] || asset.faction.toUpperCase()}
            </div>
          )}
        </div>
      )}
      {!displayImage && (
        <div className="relative w-full h-[80px] bg-neutral-900 rounded-lg mb-3 overflow-hidden border border-white/5 flex items-center justify-center">
          {isBase ? <Shield className="w-8 h-8 text-neutral-700" /> : isChokepoint ? <Anchor className="w-8 h-8 text-neutral-700" /> : <Ship className="w-8 h-8 text-neutral-700" />}
          <div className={`absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 backdrop-blur rounded text-[8px] font-bold flex items-center gap-1.5 ${factionBadgeColors[asset.faction]}`}>
            <FlagIcon countryCode={asset.country} />
            {factionLabels[asset.faction] || asset.faction.toUpperCase()}
          </div>
        </div>
      )}
      <div className="flex items-start gap-2 mb-2">
        <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${isIncident ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/10'}`}>
          {isIncident ? <AlertCircle className="w-4 h-4 text-orange-400" /> : isBase ? <Shield className="w-4 h-4 text-blue-400" /> : isChokepoint ? <Anchor className="w-4 h-4 text-amber-400" /> : <Ship className="w-4 h-4 text-cyan-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-xs leading-tight">{asset.name}</h3>
          <span className={`text-[9px] font-bold ${factionBadgeColors[asset.faction]}`}>
            {isIncident ? 'Maritime Incident' : isBase ? (asset.type === 'oil_field' ? 'Energy Infrastructure' : 'Military Installation') : isChokepoint ? 'Strategic Chokepoint' : asset.type === 'carrier' ? 'Aircraft Carrier Group' : asset.type === 'submarine' ? 'Submarine' : 'Military Vessel'}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-neutral-400 leading-relaxed mb-2">{asset.description}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mb-2">
        <div><span className="opacity-40 uppercase text-[8px]">Position </span><span className="text-neutral-400 font-mono">{asset.lat.toFixed(2)}°, {asset.lng.toFixed(2)}°</span></div>
        <div><span className="opacity-40 uppercase text-[8px]">Faction </span><span className={factionBadgeColors[asset.faction]}>{factionLabels[asset.faction]}</span></div>
        {asset.mmsi && <div><span className="opacity-40 uppercase text-[8px]">MMSI </span><span className="text-neutral-400 font-mono">{asset.mmsi}</span></div>}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[8px] uppercase font-bold tracking-widest text-neutral-600">{isIncident ? 'Incident' : isBase ? 'Installation' : 'Asset'}</span>
        <div className="flex gap-2">
          {mtUrl && <a href={mtUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 font-bold">MarineTraffic →</a>}
          <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(wikiQuery)}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-sky-400 hover:text-sky-300 underline underline-offset-2 font-bold">Wikipedia →</a>
        </div>
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

// Universal event tooltip — adapts color/icon based on event type
function EventTooltip({ evt, pos, onClose }: {
  evt: IntelEvent;
  pos: { x: number, y: number };
  onClose: () => void;
}) {
  const typeConfig: Record<string, { color: string, border: string, icon: React.ReactNode, label: string }> = {
    satellite: { color: 'text-violet-400', border: 'border-violet-500/30', icon: <Satellite className="w-4 h-4 text-violet-400" />, label: 'Satellite Intelligence' },
    strike: { color: 'text-red-400', border: 'border-red-500/30', icon: <Flame className="w-4 h-4 text-red-400" />, label: 'Strike Event' },
    conflict: { color: 'text-orange-400', border: 'border-orange-500/30', icon: <AlertCircle className="w-4 h-4 text-orange-400" />, label: 'Armed Conflict' },
    thermal: { color: 'text-amber-400', border: 'border-amber-500/30', icon: <Thermometer className="w-4 h-4 text-amber-400" />, label: 'Thermal Detection (NASA FIRMS)' },
    seismic: { color: 'text-yellow-400', border: 'border-yellow-500/30', icon: <Mountain className="w-4 h-4 text-yellow-400" />, label: 'Seismic Event (USGS)' },
    weather: { color: 'text-sky-400', border: 'border-sky-500/30', icon: <CloudRain className="w-4 h-4 text-sky-400" />, label: 'Weather Alert' },
    humanitarian: { color: 'text-pink-400', border: 'border-pink-500/30', icon: <HeartHandshake className="w-4 h-4 text-pink-400" />, label: 'Humanitarian Crisis' },
    notam: { color: 'text-indigo-400', border: 'border-indigo-500/30', icon: <ShieldOff className="w-4 h-4 text-indigo-400" />, label: 'Airspace Notice (NOTAM)' },
    nuclear: { color: 'text-fuchsia-400', border: 'border-fuchsia-500/30', icon: <Radiation className="w-4 h-4 text-fuchsia-400" />, label: 'Nuclear Activity (IAEA)' },
    news: { color: 'text-neutral-300', border: 'border-white/10', icon: <Globe className="w-4 h-4 text-neutral-400" />, label: 'News Report' },
    military: { color: 'text-blue-400', border: 'border-blue-500/30', icon: <Shield className="w-4 h-4 text-blue-400" />, label: 'Military Activity' },
  };
  const cfg = typeConfig[evt.type] || typeConfig.news;
  const sevColors: Record<string, string> = { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-emerald-500' };

  return (
    <div
      className={`fixed z-[1001] p-3 bg-black/95 backdrop-blur-xl ${cfg.border} border rounded-xl shadow-2xl w-[320px] animate-in fade-in zoom-in duration-200`}
      style={{ left: Math.min(pos.x + 20, window.innerWidth - 340), top: Math.min(Math.max(pos.y - 120, 10), window.innerHeight - 500) }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute top-2 right-2 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-neutral-500 hover:text-white text-[10px] transition">✕</button>

      {/* Image */}
      {evt.payloadImage && (
        <div className="relative w-full h-[160px] bg-neutral-900 rounded-lg mb-3 overflow-hidden border border-white/10">
          <img
            src={evt.payloadImage}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e: any) => { e.target.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <div className="p-1.5 bg-white/5 rounded-lg border border-white/10 shrink-0 mt-0.5">
          {cfg.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-xs leading-tight">{evt.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[9px] font-bold ${cfg.color}`}>{cfg.label}</span>
            <div className={`w-1.5 h-1.5 rounded-full ${sevColors[evt.severity] || sevColors.low}`} />
            <span className="text-[9px] text-neutral-500 uppercase">{evt.severity}</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      {evt.summary && (
        <p className="text-[11px] text-neutral-400 leading-relaxed mb-2">{evt.summary}</p>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mb-2">
        {evt.location?.name && (
          <div className="col-span-2"><span className="opacity-40 uppercase text-[8px]">Location </span><span className="text-neutral-300">{evt.location.name}</span></div>
        )}
        {evt.location && (
          <div><span className="opacity-40 uppercase text-[8px]">Coords </span><span className="text-neutral-500 font-mono">{evt.location.lat.toFixed(2)}, {evt.location.lng.toFixed(2)}</span></div>
        )}
        <div><span className="opacity-40 uppercase text-[8px]">Time </span><span className="text-neutral-400">{formatDistanceToNow(new Date(evt.timestamp))} ago</span></div>
        {evt.fatalities != null && evt.fatalities > 0 && (
          <div><span className="opacity-40 uppercase text-[8px]">Fatalities </span><span className="text-red-400 font-bold">{evt.fatalities}</span></div>
        )}
      </div>

      {/* Footer with source */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[9px] text-neutral-600 font-bold uppercase tracking-wider truncate max-w-[150px]">{evt.source}</span>
        {evt.sourceUrl ? (
          <a href={evt.sourceUrl} target="_blank" rel="noopener noreferrer" className={`text-[9px] ${cfg.color} hover:opacity-80 underline underline-offset-2 font-bold`}>View Source →</a>
        ) : (
          <span className="text-[9px] text-neutral-600">No link available</span>
        )}
      </div>
    </div>
  );
}

// ─── EXTRACTED CONSTANTS (avoid re-creation per render) ──────────────────────

const FACTION_COLOR_MAP: Record<string, string> = {
  us: 'bg-blue-600/30 border-blue-400 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.3)]',
  israel: 'bg-blue-600/30 border-blue-400 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.3)]',
  uk: 'bg-blue-700/30 border-blue-300 text-blue-200 shadow-[0_0_10px_rgba(96,165,250,0.3)]',
  france: 'bg-indigo-600/30 border-indigo-400 text-indigo-300 shadow-[0_0_10px_rgba(129,140,248,0.3)]',
  turkey: 'bg-teal-600/30 border-teal-400 text-teal-300 shadow-[0_0_10px_rgba(45,212,191,0.3)]',
  saudi: 'bg-emerald-600/30 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.3)]',
  uae: 'bg-emerald-600/30 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.3)]',
  qatar: 'bg-emerald-600/30 border-emerald-400 text-emerald-300',
  egypt: 'bg-amber-600/30 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.3)]',
  jordan: 'bg-amber-600/30 border-amber-400 text-amber-300',
  iraq: 'bg-amber-600/30 border-amber-400 text-amber-300',
  iran: 'bg-red-600/30 border-red-400 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)]',
  yemen: 'bg-red-600/30 border-red-400 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)]',
  russia: 'bg-red-700/30 border-red-500 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)]',
  china: 'bg-rose-600/30 border-rose-400 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]',
  india: 'bg-orange-600/30 border-orange-400 text-orange-300 shadow-[0_0_10px_rgba(251,146,60,0.3)]',
  neutral: 'bg-neutral-600/30 border-neutral-400 text-neutral-300',
};

const SUBMARINE_ICON = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6v0c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v0z"/>
    <circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>
    <path d="M12 8V5"/><path d="M10 5h4"/>
    <path d="M4 19h16"/>
  </svg>
);

const CARRIER_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 16l3-1h14l3 1"/>
    <path d="M5 15V11l2-3h10l2 3v4"/>
    <path d="M7 8l10 0"/><path d="M9 8V5"/><path d="M12 8V4"/><path d="M15 8V5"/>
    <path d="M2 20c1 0 2-1 3-1s2 1 3 1 2-1 3-1 2 1 3 1 2-1 3-1 2 1 3 1"/>
  </svg>
);

const MILITARY_BOAT_ICON = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l2-1h14l2 1"/><path d="M5 16V10l3-4h8l3 4v6"/>
    <circle cx="12" cy="12" r="1.5"/>
    <path d="M3 21c1 0 2-1 3-1s2 1 3 1 2-1 3-1 2 1 3 1 2-1 3-1 2 1 3 1"/>
  </svg>
);

const BOAT_SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.2.9 4.3 2.5 6"/><path d="M12 10V4l-2-2"/></svg>`;

const MAX_NAVAL_MARKERS = 300;

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

  // ─── MODAL STATES (click-to-open, click-outside-to-dismiss) ───
  const [hoveredVessel, setHoveredVessel] = useState<any>(null);
  const [hoveredAircraft, setHoveredAircraft] = useState<any>(null);
  const [hoveredSatellite, setHoveredSatellite] = useState<any>(null);
  const [pinnedAsset, setPinnedAsset] = useState<(typeof STRATEGIC_ASSETS[0]) | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null);
  const justClickedMarker = useRef(false);

  const clearAllTooltips = () => {
    setHoveredVessel(null);
    setHoveredAircraft(null);
    setHoveredSatellite(null);
    setPinnedAsset(null);
  };

  const pinVessel = (data: any, pos: { x: number, y: number }) => {
    justClickedMarker.current = true;
    clearAllTooltips();
    setHoveredVessel(data);
    setHoverPos(pos);
  };

  const pinAircraft = (data: any, pos: { x: number, y: number }) => {
    justClickedMarker.current = true;
    clearAllTooltips();
    setHoveredAircraft(data);
    setHoverPos(pos);
  };

  const pinSatellite = (data: any, pos: { x: number, y: number }) => {
    justClickedMarker.current = true;
    clearAllTooltips();
    setHoveredSatellite(data);
    setHoverPos(pos);
  };

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
    return locs;
  }, [events, showAviation, showStrikes, showSatellite, showThermal, showSeismic, showWeather, showHumanitarian, showBoats, showMilitary, showCivilian, historicalFilterDays]);

  const flightLines = useMemo(() => {
    if (!showAviation) return { type: 'FeatureCollection', features: [] };
    const aviationEvts = events.filter(e => e.type === 'aviation' && e.location);
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
      
      // 3. Naval Filter (Carriers + Boats + Submarines)
      const isNavalType = asset.type === 'boat' || asset.type === 'carrier' || asset.type === 'submarine';
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
    const filteredNavalEvents = events.filter(e => e.type === 'naval' && e.location);
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
  }, [events, showBoats]);

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

  // Memoized naval vessel list for boat Markers (capped at MAX_NAVAL_MARKERS)
  const navalMarkerEvents = useMemo(() => {
    if (!showBoats) return [];
    return events.filter(e => {
      if (e.type !== 'naval' || !e.location) return false;
      if (e.entity?.isMilitary && !showMilitary) return false;
      if (!e.entity?.isMilitary && !showCivilian) return false;
      return true;
    }).slice(0, MAX_NAVAL_MARKERS);
  }, [events, showBoats, showMilitary, showCivilian]);

  // Stable click handler for naval vessel markers (avoids closure per marker)
  const handleVesselMarkerClick = useCallback((evt: IntelEvent, e: React.MouseEvent) => {
    pinVessel({
      name: evt.title,
      mmsi: evt.entity?.mmsi,
      callsign: evt.entity?.callsign,
      speed: evt.entity?.speed,
      destination: evt.entity?.destination,
      isMilitary: evt.entity?.isMilitary,
      source: evt.source,
      sourceUrl: evt.sourceUrl,
    }, { x: e.clientX, y: e.clientY });
  }, []);

  // Stable click handler for locatableEvents markers (avoids closure per marker)
  const handleEventMarkerClick = useCallback((evt: IntelEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (evt.type === 'aviation') {
      pinAircraft({
        icao24: evt.entity?.icao24 || evt.id.split('-')[1],
        callsign: evt.entity?.callsign || evt.title,
        type: evt.entity?.type,
        country: evt.entity?.country,
        origin: evt.entity?.origin,
        destination: evt.entity?.destination,
        sourceUrl: evt.sourceUrl,
      }, { x: e.clientX, y: e.clientY });
    } else if (evt.type === 'naval') {
      pinVessel({
        name: evt.entity?.callsign || evt.title,
        mmsi: evt.entity?.mmsi,
        callsign: evt.entity?.callsign,
        speed: evt.entity?.speed,
        destination: evt.entity?.destination,
        isMilitary: evt.entity?.isMilitary,
        source: evt.source,
        sourceUrl: evt.sourceUrl,
      }, { x: e.clientX, y: e.clientY });
    } else {
      pinSatellite({ ...evt }, { x: e.clientX, y: e.clientY });
    }
  }, []);

  // Stable click handler for strategic asset markers
  const handleAssetMarkerClick = useCallback((asset: typeof STRATEGIC_ASSETS[0], e: React.MouseEvent) => {
    justClickedMarker.current = true;
    clearAllTooltips();
    setPinnedAsset(asset);
    setHoverPos({ x: e.clientX, y: e.clientY });
  }, []);

  // Pre-compute type flags for locatableEvents to avoid per-render recalculation
  const locatableEventsWithFlags = useMemo(() => {
    return locatableEvents.map(evt => ({
      evt,
      isAviation: evt.type === 'aviation',
      isNaval: evt.type === 'naval',
      isSatelliteEvt: evt.type === 'satellite',
      isConflict: evt.type === 'conflict',
      isStrike: evt.type === 'strike',
      isThermal: evt.type === 'thermal',
      isSeismic: evt.type === 'seismic',
      isWeather: evt.type === 'weather',
      isHumanitarian: evt.type === 'humanitarian',
      isNOTAM: evt.type === 'notam',
      isNuclear: evt.type === 'nuclear',
      hasCasualties: (evt.fatalities || 0) > 0,
      isHighSeverity: evt.severity === 'high' || evt.severity === 'critical',
    }));
  }, [locatableEvents]);

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

  // Create the vessel SVG blob URL once and clean up on unmount
  const vesselBlobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const blob = new Blob([BOAT_SVG_STRING], { type: 'image/svg+xml' });
    vesselBlobUrlRef.current = URL.createObjectURL(blob);
    return () => {
      if (vesselBlobUrlRef.current) {
        URL.revokeObjectURL(vesselBlobUrlRef.current);
        vesselBlobUrlRef.current = null;
      }
    };
  }, []);

  const addVesselImage = useCallback((map: any) => {
    if (!vesselBlobUrlRef.current) return;
    const img = new Image();
    img.onload = () => { if (!map.hasImage('vessel')) map.addImage('vessel', img); };
    img.src = vesselBlobUrlRef.current;
  }, []);

  const onMapLoad = useCallback((e: any) => {
    const map = e.target;
    addVesselImage(map);
    // Re-add vessel image on style change (satellite ↔ dark)
    map.on('style.load', () => addVesselImage(map));
  }, [addVesselImage]);


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
        interactiveLayerIds={[]}
        onLoad={onMapLoad}
        onClick={() => { if (justClickedMarker.current) { justClickedMarker.current = false; return; } clearAllTooltips(); }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* NASA GIBS VIIRS True Color Overlay — real-time satellite imagery tiles */}
        {showGIBSLayer && (
          <Source
            id="nasa-gibs"
            type="raster"
            tiles={[
              `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
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

        {/* AIS vessels — rendered as direct React Markers (capped at MAX_NAVAL_MARKERS) */}
        {navalMarkerEvents.map((evt) => (
          <Marker key={evt.id} longitude={evt.location!.lng} latitude={evt.location!.lat} anchor="center">
            <div
              className="cursor-pointer"
              onClick={(e) => handleVesselMarkerClick(evt, e)}
            >
              <div className={`flex items-center justify-center w-4 h-4 rounded-full border transition-transform hover:scale-150 ${
                evt.entity?.isMilitary
                  ? 'bg-blue-600/40 border-blue-400 text-blue-300'
                  : 'bg-cyan-500/30 border-cyan-400/60 text-cyan-300'
              }`}>
                <Ship className="w-2.5 h-2.5" />
              </div>
            </div>
          </Marker>
        ))}

        {showAviation && flightLines.features && flightLines.features.length > 0 && (
          <Source id="trajectories" type="geojson" data={flightLines as any}>
            <Layer id="trajectory-lines" type="line" paint={{ 'line-color': '#3b82f6', 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [2, 2] }} />
          </Source>
        )}

        {filteredAssets.map(asset => {
          const isShip = asset.type === 'boat' || asset.type === 'carrier' || asset.type === 'submarine';
          const isMil = asset.faction !== 'neutral';
          const colorClass = FACTION_COLOR_MAP[asset.faction] || FACTION_COLOR_MAP.neutral;

          return (
           <Marker key={asset.id} longitude={asset.lng} latitude={asset.lat} anchor="center">
             <div
              className="group relative flex flex-col items-center cursor-pointer"
              onClick={(e) => handleAssetMarkerClick(asset, e)}
             >
                <div className={`p-1 rounded-full border shadow-lg transition-transform hover:scale-125 ${colorClass}`}>
                   {asset.type === 'base' ? <Shield className="w-5 h-5" /> :
                    asset.type === 'chokepoint' ? <Anchor className="w-4 h-4" /> :
                    asset.type === 'submarine' ? SUBMARINE_ICON :
                    asset.type === 'carrier' ? CARRIER_ICON :
                    (isShip && !isMil) ? <AlertCircle className="w-4 h-4" /> :
                    isShip ? MILITARY_BOAT_ICON : <Anchor className="w-4 h-4" />}
                </div>
                <div className="absolute top-full mt-1 px-2 py-0.5 bg-black/80 border border-white/10 rounded-sm text-[8px] font-bold tracking-tighter whitespace-nowrap opacity-0 group-hover:opacity-100 uppercase z-50">
                  {asset.name}
                </div>
             </div>
           </Marker>
          );
        })}

        {locatableEventsWithFlags.map(({ evt, isAviation, isNaval, isSatelliteEvt, isConflict, isStrike, isThermal, isSeismic, isWeather, isHumanitarian, isNOTAM, isNuclear, hasCasualties, isHighSeverity }, idx) => {
          return (
            <Marker key={`${evt.id}-${idx}`} longitude={evt.location!.lng} latitude={evt.location!.lat} anchor="center">
              <div
                className="group relative cursor-pointer"
                onClick={(e) => handleEventMarkerClick(evt, e)}
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
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Map Style Toggle — outside <Map> so clicks aren't intercepted */}
      <div className="absolute bottom-20 md:bottom-6 right-4 z-20 flex flex-col gap-2">
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
        <VesselModal vessel={hoveredVessel} pos={hoverPos} onClose={clearAllTooltips} />
      )}
      {hoveredAircraft && hoverPos && (
        <AircraftTooltip
          icao24={hoveredAircraft.icao24}
          callsign={hoveredAircraft.callsign}
          type={hoveredAircraft.type}
          country={hoveredAircraft.country}
          origin={hoveredAircraft.origin}
          destination={hoveredAircraft.destination}
          sourceUrl={hoveredAircraft.sourceUrl}
          pos={hoverPos}
          onClose={clearAllTooltips}
        />
      )}
      {hoveredSatellite && hoverPos && (
        <EventTooltip
          evt={hoveredSatellite}
          pos={hoverPos}
          onClose={clearAllTooltips}
        />
      )}
      {pinnedAsset && hoverPos && (
        <AssetModal asset={pinnedAsset} pos={hoverPos} onClose={clearAllTooltips} />
      )}
    </div>
  );
}
