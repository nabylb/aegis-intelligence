import { fetchGDELTData, fetchGDELTGeoData, fetchRSSFeeds, fetchOpenSkyData, fetchACLEDData, fetchThinkTankAnalysis, fetchGlobalAISData, fetchTzevaAdomAlerts, fetchOSINTFeeds, fetchXFeeds, fetchSatelliteOSINT, fetchNASAFIRMS, fetchUSGSEarthquakes, fetchWeatherData, fetchReliefWebData, fetchNOTAMData, fetchIAEAData, fetchTelegramOSINT, fetchLiveuamapData } from '@/lib/aggregator';
import { IntelEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

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
// Single aggregated event store, shared across all SSE connections.
// Each fetcher has its own in-memory cache, so calling them is cheap when cached.
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
  ]);
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// Initialize: fetch everything once, build master store
async function initialize() {
  if (isInitialized) return;
  if (initPromise) { await initPromise; return; }

  initPromise = (async () => {
    const [fast, slow] = await Promise.all([fetchFastTier(), fetchSlowTier()]);
    const all = [...fast, ...slow];
    masterEvents = dedup(all);
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

function dedup(arr: IntelEvent[]): IntelEvent[] {
  const seen = new Map<string, IntelEvent>();
  for (const e of arr) {
    if (e?.id && typeof e.id === 'string') seen.set(e.id, e);
  }
  return [...seen.values()].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        if (!req.signal.aborted) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch { /* connection closed */ }
        }
      };

      send({ type: 'connected' });

      // Initialize master store (shared across connections — fast if already done)
      await initialize();

      // Send full initial payload
      send({ type: 'init', events: masterEvents });

      // Fast poll: 30s for real-time data
      const fastInterval = setInterval(async () => {
        try {
          const incoming = await fetchFastTier();
          const delta = mergeAndGetDelta(incoming);
          if (delta.length > 0) send({ type: 'update', events: delta });
        } catch (err) { console.error('[SSE] Fast tick error:', err); }
      }, 30000);

      // Slow poll: 5 min for heavy data
      const slowInterval = setInterval(async () => {
        try {
          const incoming = await fetchSlowTier();
          const delta = mergeAndGetDelta(incoming);
          if (delta.length > 0) send({ type: 'update', events: delta });
        } catch (err) { console.error('[SSE] Slow tick error:', err); }
      }, 300000);

      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(fastInterval);
        clearInterval(slowInterval);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
