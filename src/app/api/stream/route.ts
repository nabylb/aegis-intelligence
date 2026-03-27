import { fetchGDELTData, fetchGDELTGeoData, fetchRSSFeeds, fetchOpenSkyData, fetchACLEDData, fetchThinkTankAnalysis, fetchGlobalAISData, fetchTzevaAdomAlerts, fetchTzevaAdomHistory, fetchOSINTFeeds, fetchXFeeds, fetchSatelliteOSINT, fetchNASAFIRMS, fetchUSGSEarthquakes, fetchWeatherData, fetchReliefWebData, fetchNOTAMData, fetchIAEAData, fetchTelegramOSINT, fetchLiveuamapData, fetchCasualtyAggregates } from '@/lib/aggregator';
import { IntelEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro max

// ─── LEVENSHTEIN DISTANCE (two-row DP, O(min(m,n)) space) ───────────────────
function levenshteinDistance(a: string, b: string): number {
  if (a.length > b.length) { const t = a; a = b; b = t; }
  const m = a.length;
  const n = b.length;
  let prev = new Array(m + 1);
  let curr = new Array(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;
  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      curr[i] = a[i - 1] === b[j - 1]
        ? prev[i - 1]
        : 1 + Math.min(prev[i - 1], prev[i], curr[i - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 60).trim();
}

// ─── SHARED SERVER-SIDE CACHE ────────────────────────────────────────────────
// NOTE: On Vercel serverless, this cache lives per-instance and resets on cold starts.
// Each fetcher in aggregator.ts also has its own in-memory cache with TTLs,
// so repeated calls within the same instance lifetime are cheap.
let masterEvents: IntelEvent[] = [];
let masterEventIds = new Set<string>();
let titleIndex = new Map<string, string>(); // normalized title fragment -> event ID
let lastFullFetch = 0;
let lastFastFetch = 0;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Fast tier: real-time data (aviation, alerts, RSS, OSINT) — every 30s
async function fetchFastTier(): Promise<IntelEvent[]> {
  const results = await Promise.allSettled([
    fetchRSSFeeds(),
    fetchOpenSkyData(),
    fetchTzevaAdomAlerts(),
    fetchTzevaAdomHistory(),
    fetchOSINTFeeds(),
    fetchXFeeds(),
    fetchTelegramOSINT(),
  ]);
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// Slow tier: heavy/infrequent data — every 5 minutes
async function fetchSlowTier(): Promise<IntelEvent[]> {
  const results = await Promise.allSettled([
    fetchGDELTData(),
    fetchGDELTGeoData(),
    fetchACLEDData(),
    fetchThinkTankAnalysis(),
    fetchGlobalAISData(),
    fetchSatelliteOSINT(),
    fetchNASAFIRMS(),
    fetchUSGSEarthquakes(),
    fetchWeatherData(),
    fetchReliefWebData(),
    fetchNOTAMData(),
    fetchIAEAData(),
    fetchLiveuamapData(),
    fetchCasualtyAggregates(),
  ]);
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// Initialize: fetch everything once, build master store.
// Both tiers run in parallel via Promise.allSettled so no single slow
// fetcher blocks the others. maxDuration=60 covers Vercel Pro.
async function initialize() {
  if (isInitialized) return;
  if (initPromise) { await initPromise; return; }

  initPromise = (async () => {
    const [fast, slow] = await Promise.all([fetchFastTier(), fetchSlowTier()]);
    const all = [...fast, ...slow];
    masterEvents = dedupEvents(all);
    masterEventIds = new Set(masterEvents.map(e => e.id));
    titleIndex = new Map();
    for (const e of masterEvents) {
      if (e.title && e.type !== 'aviation') {
        const norm = normalizeTitle(e.title);
        if (norm.length > 0) titleIndex.set(norm, e.id);
      }
    }
    lastFullFetch = Date.now();
    lastFastFetch = Date.now();
    isInitialized = true;
  })();

  await initPromise;
  initPromise = null;
}

// Merge new events into master store, return only NEW events
function mergeAndGetDelta(incoming: IntelEvent[]): IntelEvent[] {
  const newEvents: IntelEvent[] = [];
  for (const evt of incoming) {
    if (!evt?.id || masterEventIds.has(evt.id)) continue;
    // For aviation, replace old positions — remove old flight with same callsign
    if (evt.type === 'aviation' && evt.entity?.callsign) {
      const existingIdx = masterEvents.findIndex(
        e => e.type === 'aviation' && e.entity?.callsign === evt.entity?.callsign
      );
      if (existingIdx !== -1) {
        masterEventIds.delete(masterEvents[existingIdx].id);
        masterEvents.splice(existingIdx, 1);
      }
    } else if (evt.title) {
      // Fuzzy title dedup — catch same event from different sources (BBC, Reuters, etc.)
      const norm = normalizeTitle(evt.title);
      if (norm.length > 0) {
        let isDuplicate = false;
        for (const [existingTitle] of titleIndex) {
          if (levenshteinDistance(norm, existingTitle) < 15) {
            isDuplicate = true;
            break;
          }
        }
        if (isDuplicate) continue;
        titleIndex.set(norm, evt.id);
      }
    }
    masterEvents.push(evt);
    masterEventIds.add(evt.id);
    newEvents.push(evt);
  }
  // Cap at 3000 events (remove oldest)
  if (masterEvents.length > 3000) {
    const removed = masterEvents.splice(0, masterEvents.length - 3000);
    for (const r of removed) {
      masterEventIds.delete(r.id);
      // Clean titleIndex entries for removed events
      for (const [title, id] of titleIndex) {
        if (id === r.id) { titleIndex.delete(title); break; }
      }
    }
  }
  return newEvents;
}

function dedupEvents(arr: IntelEvent[]): IntelEvent[] {
  const seen = new Map<string, IntelEvent>();
  for (const e of arr) {
    if (e?.id && typeof e.id === 'string') seen.set(e.id, e);
  }
  return [...seen.values()].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ─── POLLING REST API ────────────────────────────────────────────────────────
// Client polls this endpoint every ~30s.
// - First call (no ?since param): returns full event list
// - Subsequent calls (?since=<timestamp>): refreshes fast tier, returns delta only
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sinceParam = url.searchParams.get('since');
  const now = Date.now();

  // Initialize master store on first request (shared within this serverless instance)
  await initialize();

  // If `since` is provided, this is a poll — refresh and return updates
  if (sinceParam) {
    // Refresh fast tier on poll
    if (now - lastFastFetch > 25000) {
      try {
        const incoming = await fetchFastTier();
        mergeAndGetDelta(incoming);
        lastFastFetch = now;
      } catch (err) { console.error('[Poll] Fast tier error:', err); }
    }

    // Refresh slow tier if 5+ minutes since last
    if (now - lastFullFetch > 300000) {
      try {
        const incoming = await fetchSlowTier();
        mergeAndGetDelta(incoming);
        lastFullFetch = now;
      } catch (err) { console.error('[Poll] Slow tier error:', err); }
    }

    // Return full event list — client deduplicates
    return Response.json({
      type: 'update',
      events: masterEvents,
      serverTime: now,
    });
  }

  // First request — return full payload
  return Response.json({
    type: 'init',
    events: masterEvents,
    serverTime: now,
  });
}
