import type { IntelEvent, IntelSeverity } from './types';

export type ThreatTempo = 'CALM' | 'ELEVATED' | 'SURGE' | 'CRITICAL';

export interface EventCluster {
  centroid: { lat: number; lng: number };
  count: number;
  name: string;
  peakSeverity: IntelSeverity;
  timeRange: { start: string; end: string };
  eventIds: string[];
}

export interface Hotspot {
  lat: number;
  lng: number;
  name: string | undefined;
  count: number;
  severity: IntelSeverity;
}

export interface EscalationAnalysis {
  threatTempo: ThreatTempo;
  clusters: EventCluster[];
  trend24h: number[];
  trend7d: number[];
  acceleration: number;
  hotspots: Hotspot[];
}

const EARTH_RADIUS_KM = 6371;
const KINETIC_TYPES = new Set(['strike', 'conflict', 'military']);
const SEVERITY_RANK: Record<IntelSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

const ME_BOUNDS = { latMin: 12, latMax: 42, lngMin: 25, lngMax: 63 };
const GRID_SIZE_DEG = 0.45; // ~50km at ~30N latitude

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function maxSeverity(a: IntelSeverity, b: IntelSeverity): IntelSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function detectClusters(events: IntelEvent[]): EventCluster[] {
  const kinetic = events.filter(
    (e) => KINETIC_TYPES.has(e.type) && e.location
  );

  if (kinetic.length < 3) return [];

  const sorted = [...kinetic].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const visited = new Set<string>();
  const clusters: EventCluster[] = [];
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  for (let i = 0; i < sorted.length; i++) {
    if (visited.has(sorted[i].id)) continue;

    const seed = sorted[i];
    const seedLoc = seed.location!;
    const seedTime = new Date(seed.timestamp).getTime();
    const group: IntelEvent[] = [seed];

    for (let j = i + 1; j < sorted.length; j++) {
      if (visited.has(sorted[j].id)) continue;
      const candidate = sorted[j];
      const candTime = new Date(candidate.timestamp).getTime();

      if (candTime - seedTime > SIX_HOURS) break;

      const candLoc = candidate.location!;
      const dist = haversine(seedLoc.lat, seedLoc.lng, candLoc.lat, candLoc.lng);
      if (dist <= 100) {
        group.push(candidate);
      }
    }

    if (group.length >= 3) {
      for (const e of group) visited.add(e.id);

      let latSum = 0;
      let lngSum = 0;
      let peak: IntelSeverity = 'low';
      let name = '';

      for (const e of group) {
        latSum += e.location!.lat;
        lngSum += e.location!.lng;
        peak = maxSeverity(peak, e.severity);
        if (!name && e.location!.name) name = e.location!.name;
      }

      const timestamps = group.map((e) => new Date(e.timestamp).getTime());

      clusters.push({
        centroid: { lat: latSum / group.length, lng: lngSum / group.length },
        count: group.length,
        name: name || 'Unknown',
        peakSeverity: peak,
        timeRange: {
          start: new Date(Math.min(...timestamps)).toISOString(),
          end: new Date(Math.max(...timestamps)).toISOString(),
        },
        eventIds: group.map((e) => e.id),
      });
    }
  }

  return clusters.sort((a, b) => b.count - a.count);
}

function computeTrend24h(events: IntelEvent[], now: number): number[] {
  const hours = new Array<number>(24).fill(0);
  const start = now - 24 * 60 * 60 * 1000;

  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    if (t >= start && t <= now) {
      const hourIndex = Math.floor((t - start) / (60 * 60 * 1000));
      if (hourIndex >= 0 && hourIndex < 24) hours[hourIndex]++;
    }
  }
  return hours;
}

function computeTrend7d(events: IntelEvent[], now: number): number[] {
  const days = new Array<number>(7).fill(0);
  const start = now - 7 * 24 * 60 * 60 * 1000;

  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    if (t >= start && t <= now) {
      const dayIndex = Math.floor((t - start) / (24 * 60 * 60 * 1000));
      if (dayIndex >= 0 && dayIndex < 7) days[dayIndex]++;
    }
  }
  return days;
}

function computeAcceleration(events: IntelEvent[], now: number): number {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  let recent = 0;
  let sixHr = 0;

  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    const age = now - t;
    if (age <= TWO_HOURS) recent++;
    if (age <= SIX_HOURS) sixHr++;
  }

  const recentRate = recent / 2;
  const sixHrRate = sixHr / 6;

  if (sixHrRate === 0) return recentRate > 0 ? 3 : 0;
  return recentRate / sixHrRate;
}

function detectHotspots(events: IntelEvent[]): Hotspot[] {
  const grid = new Map<
    string,
    { lat: number; lng: number; count: number; severity: IntelSeverity; name: string | undefined }
  >();

  for (const e of events) {
    if (!e.location) continue;
    const { lat, lng, name } = e.location;

    if (lat < ME_BOUNDS.latMin || lat > ME_BOUNDS.latMax) continue;
    if (lng < ME_BOUNDS.lngMin || lng > ME_BOUNDS.lngMax) continue;

    const cellLat = Math.floor((lat - ME_BOUNDS.latMin) / GRID_SIZE_DEG);
    const cellLng = Math.floor((lng - ME_BOUNDS.lngMin) / GRID_SIZE_DEG);
    const key = `${cellLat}:${cellLng}`;

    const existing = grid.get(key);
    if (existing) {
      existing.count++;
      existing.severity = maxSeverity(existing.severity, e.severity);
      if (!existing.name && name) existing.name = name;
    } else {
      grid.set(key, {
        lat: ME_BOUNDS.latMin + (cellLat + 0.5) * GRID_SIZE_DEG,
        lng: ME_BOUNDS.lngMin + (cellLng + 0.5) * GRID_SIZE_DEG,
        count: 1,
        severity: e.severity,
        name,
      });
    }
  }

  return [...grid.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function determineTempo(acceleration: number, clusters: EventCluster[]): ThreatTempo {
  const hasCriticalCluster = clusters.some((c) => c.peakSeverity === 'critical');

  if (acceleration > 2.5 || hasCriticalCluster) return 'CRITICAL';
  if (acceleration > 1.5) return 'SURGE';
  if (acceleration > 0.8 || clusters.length > 0) return 'ELEVATED';
  return 'CALM';
}

export function analyzeEscalation(events: IntelEvent[]): EscalationAnalysis {
  const now = Date.now();

  const clusters = detectClusters(events);
  const trend24h = computeTrend24h(events, now);
  const trend7d = computeTrend7d(events, now);
  const acceleration = computeAcceleration(events, now);
  const hotspots = detectHotspots(events);
  const threatTempo = determineTempo(acceleration, clusters);

  return {
    threatTempo,
    clusters,
    trend24h,
    trend7d,
    acceleration: Math.round(acceleration * 100) / 100,
    hotspots,
  };
}
