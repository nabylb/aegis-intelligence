import type { IntelEvent, IntelSeverity } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IncidentThread {
  id: string;
  title: string;
  summary: string;
  eventTypes: string[];
  events: IntelEvent[];
  sources: string[];
  severity: IntelSeverity;
  location: { lat: number; lng: number; name?: string };
  timeRange: { start: string; end: string };
  totalFatalities: number;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPATIAL_THRESHOLD_KM = 50;
const TEMPORAL_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours
const KEYWORD_OVERLAP_MIN = 3;
const LINK_CRITERIA_MIN = 2;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'in', 'of', 'to', 'for', 'and', 'or', 'is', 'at', 'by',
  'on', 'with', 'from', 'as', 'that', 'this', 'it', 'was', 'are', 'be', 'has',
  'had', 'have', 'but', 'not', 'they', 'will', 'can', 'if', 'do', 'its', 'we',
  'he', 'she', 'their', 'no', 'about', 'would', 'could', 'up', 'over', 'into',
  'than', 'then', 'when', 'where', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'which', 'who', 'what', 'after',
  'before', 'between', 'during', 'since', 'until', 'while',
]);

const SEVERITY_RANK: Record<IntelSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// ---------------------------------------------------------------------------
// Haversine distance (km)
// ---------------------------------------------------------------------------

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

function significantTokens(title: string): Set<string> {
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return new Set(tokens);
}

// ---------------------------------------------------------------------------
// Union-Find
// ---------------------------------------------------------------------------

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
  }
}

// ---------------------------------------------------------------------------
// Linking criteria checks
// ---------------------------------------------------------------------------

function spatialMatch(a: IntelEvent, b: IntelEvent): boolean {
  if (!a.location || !b.location) return false;
  return haversineKm(a.location.lat, a.location.lng, b.location.lat, b.location.lng) <= SPATIAL_THRESHOLD_KM;
}

function temporalMatch(a: IntelEvent, b: IntelEvent): boolean {
  const diff = Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return diff <= TEMPORAL_THRESHOLD_MS;
}

function keywordMatch(a: IntelEvent, b: IntelEvent): boolean {
  const tokensA = significantTokens(a.title);
  const tokensB = significantTokens(b.title);
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
    if (overlap >= KEYWORD_OVERLAP_MIN) return true;
  }
  return false;
}

function entityMatch(a: IntelEvent, b: IntelEvent): boolean {
  // Callsign
  if (a.entity?.callsign && b.entity?.callsign && a.entity.callsign === b.entity.callsign) return true;
  // MMSI
  if (a.entity?.mmsi && b.entity?.mmsi && a.entity.mmsi === b.entity.mmsi) return true;
  // Location name
  if (a.location?.name && b.location?.name && a.location.name.toLowerCase() === b.location.name.toLowerCase()) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Count matching criteria between two events (also returns the count for confidence)
// ---------------------------------------------------------------------------

function matchingCriteria(a: IntelEvent, b: IntelEvent): number {
  let count = 0;
  if (spatialMatch(a, b)) count++;
  if (temporalMatch(a, b)) count++;
  if (keywordMatch(a, b)) count++;
  if (entityMatch(a, b)) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Resolve incidents
// ---------------------------------------------------------------------------

export function resolveIncidents(events: IntelEvent[]): IncidentThread[] {
  if (events.length === 0) return [];

  // Pre-filter: only consider geolocated, non-aviation events from the last 48h
  // This reduces O(n^2) from ~2500 to ~200-400 candidates
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const candidates = events.filter(e =>
    e.type !== 'aviation' &&
    e.location &&
    new Date(e.timestamp).getTime() > cutoff
  );

  if (candidates.length === 0) return [];

  // Pre-compute timestamps to avoid repeated Date parsing in sort + pairwise loop
  const timeCache = new Map<string, number>();
  for (const e of candidates) {
    timeCache.set(e.id, new Date(e.timestamp).getTime());
  }

  // Cap at 300 most recent to keep O(n^2) manageable (~45k comparisons max)
  const sorted = candidates
    .sort((a, b) => timeCache.get(b.id)! - timeCache.get(a.id)!)
    .slice(0, 300);

  const n = sorted.length;
  const uf = new UnionFind(n);

  // Pairwise criteria matrix (stored for confidence scoring later)
  const pairCriteria = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const timeI = timeCache.get(sorted[i].id)!;
    for (let j = i + 1; j < n; j++) {
      const timeJ = timeCache.get(sorted[j].id)!;
      const timeDiff = Math.abs(timeI - timeJ);
      if (timeDiff > TEMPORAL_THRESHOLD_MS) continue;

      // Count criteria manually with early exit
      let count = 0;
      count++; // temporal — already known from timeDiff check above
      if (spatialMatch(sorted[i], sorted[j])) count++;
      if (count < LINK_CRITERIA_MIN && count + 2 < LINK_CRITERIA_MIN) continue; // can't reach minimum
      if (keywordMatch(sorted[i], sorted[j])) count++;
      if (count >= LINK_CRITERIA_MIN) { uf.union(i, j); pairCriteria.set(`${i}:${j}`, count); continue; }
      if (entityMatch(sorted[i], sorted[j])) count++;
      if (count >= LINK_CRITERIA_MIN) { uf.union(i, j); pairCriteria.set(`${i}:${j}`, count); }
    }
  }

  // Group events by root
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  // Build threads (only groups with 2+ events)
  const threads: IncidentThread[] = [];

  for (const indices of groups.values()) {
    if (indices.length < 2) continue;

    const groupEvents = indices.map((i) => sorted[i]);

    // Sort by timestamp (use pre-computed cache)
    groupEvents.sort((a, b) => timeCache.get(a.id)! - timeCache.get(b.id)!);

    // Highest severity
    let highestSeverity: IntelSeverity = 'low';
    for (const ev of groupEvents) {
      if (SEVERITY_RANK[ev.severity] > SEVERITY_RANK[highestSeverity]) {
        highestSeverity = ev.severity;
      }
    }

    // Pick best title: prefer news/conflict/strike/military titles (descriptive)
    // over naval/aviation (often just vessel names like "Jewel" or callsigns)
    const TITLE_PRIORITY: Record<string, number> = {
      news: 5, conflict: 5, strike: 5, military: 4, humanitarian: 3,
      nuclear: 4, notam: 3, thermal: 2, seismic: 2, weather: 1,
      satellite: 1, naval: 0, aviation: 0,
    };
    const titleEvent = [...groupEvents].sort((a, b) => {
      const priDiff = (TITLE_PRIORITY[b.type] ?? 0) - (TITLE_PRIORITY[a.type] ?? 0);
      if (priDiff !== 0) return priDiff;
      return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    })[0];
    const bestTitle = titleEvent.title;

    // Unique sources and event types
    const sources = [...new Set(groupEvents.map((e) => e.source))];
    const eventTypes = [...new Set(groupEvents.map((e) => e.type))];

    // Total fatalities (computed early for summary)
    const totalFatalities = groupEvents.reduce((s, e) => s + (e.fatalities ?? 0), 0);

    // Generate summary: what happened, where, involving what
    const locationName = groupEvents.find(e => e.location?.name)?.location?.name;
    const actors = groupEvents
      .flatMap(e => {
        const text = `${e.title} ${e.summary || ''}`;
        const found: string[] = [];
        if (/\bidf\b/i.test(text)) found.push('IDF');
        if (/\birgc\b/i.test(text)) found.push('IRGC');
        if (/\bhezbollah\b/i.test(text)) found.push('Hezbollah');
        if (/\bhamas\b/i.test(text)) found.push('Hamas');
        if (/\bhouthi\b/i.test(text)) found.push('Houthi');
        if (/\bus (military|navy|forces)\b/i.test(text)) found.push('US Forces');
        return found;
      });
    const uniqueActors = [...new Set(actors)];

    const typeLabels: Record<string, string> = {
      strike: 'kinetic strike', conflict: 'armed conflict', news: 'media reports',
      naval: 'naval activity', aviation: 'air traffic', military: 'military ops',
      thermal: 'thermal anomaly', seismic: 'seismic event', nuclear: 'nuclear intel',
      notam: 'airspace closure', satellite: 'satellite imagery', humanitarian: 'humanitarian',
      weather: 'weather',
    };
    const typeStr = eventTypes.slice(0, 3).map(t => typeLabels[t] || t).join(', ');

    let summary = `${groupEvents.length} correlated events`;
    if (typeStr) summary += ` involving ${typeStr}`;
    if (locationName) summary += ` near ${locationName}`;
    if (uniqueActors.length > 0) summary += `. Actors: ${uniqueActors.join(', ')}`;
    if (totalFatalities > 0) summary += `. ${totalFatalities} fatalities reported`;

    // Centroid of geolocated events
    const geoEvents = groupEvents.filter((e) => e.location);
    let location: { lat: number; lng: number; name?: string } = { lat: 0, lng: 0 };
    if (geoEvents.length > 0) {
      const sumLat = geoEvents.reduce((s, e) => s + e.location!.lat, 0);
      const sumLng = geoEvents.reduce((s, e) => s + e.location!.lng, 0);
      location = {
        lat: sumLat / geoEvents.length,
        lng: sumLng / geoEvents.length,
        name: geoEvents.find((e) => e.location?.name)?.location?.name,
      };
    }

    // Time range
    const timeRange = {
      start: groupEvents[0].timestamp,
      end: groupEvents[groupEvents.length - 1].timestamp,
    };

    // Confidence scoring
    // Base: average criteria match across all linked pairs in this group
    let totalPairCriteria = 0;
    let pairCount = 0;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const key1 = `${Math.min(indices[i], indices[j])}:${Math.max(indices[i], indices[j])}`;
        const c = pairCriteria.get(key1);
        if (c !== undefined) {
          totalPairCriteria += c;
          pairCount++;
        }
      }
    }

    let confidence = pairCount > 0 ? (totalPairCriteria / pairCount) * 0.25 : 0.25;

    // Multi-source bonus
    if (sources.length >= 3) confidence += 0.15;

    // Fatalities data bonus
    if (groupEvents.some((e) => e.fatalities !== undefined && e.fatalities > 0)) {
      confidence += 0.1;
    }

    // Clamp to [0, 1]
    confidence = Math.min(1, Math.max(0, confidence));
    // Round to 2 decimal places
    confidence = Math.round(confidence * 100) / 100;

    threads.push({
      id: `incident-${indices[0]}-${Date.now().toString(36)}`,
      title: bestTitle,
      summary,
      eventTypes,
      events: groupEvents,
      sources,
      severity: highestSeverity,
      location,
      timeRange,
      totalFatalities,
      confidence,
    });
  }

  // Sort: severity descending, then event count descending
  threads.sort((a, b) => {
    const sevDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.events.length - a.events.length;
  });

  return threads;
}
