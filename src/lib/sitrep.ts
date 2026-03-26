import type { IntelEvent } from './types';
import type { EscalationAnalysis } from './escalation';
import { getReliability } from './reliability';

interface SitrepInput {
  events: IntelEvent[];
  escalation: EscalationAnalysis;
  momentum: {
    composite: number;
    factors: Record<string, { score: number; detail: string }>;
  } | null;
}

export function generateSitrep(input: SitrepInput): string {
  const { events, escalation, momentum } = input;
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').split('.')[0] + 'Z';

  const criticalEvents = events.filter(e => e.severity === 'critical').slice(0, 5);
  const highEvents = events.filter(e => e.severity === 'high').slice(0, 10);
  const totalFatalities = events.reduce((sum, e) => sum + (e.fatalities || 0), 0);
  const sources = [...new Set(events.map(e => e.source))];
  const geoEvents = events.filter(e => e.location);

  // Top locations by event count
  const locationCounts: Record<string, number> = {};
  for (const e of geoEvents) {
    const name = e.location?.name || 'Unknown';
    locationCounts[name] = (locationCounts[name] || 0) + 1;
  }
  const topLocations = Object.entries(locationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Momentum status
  const comp = momentum?.composite ?? 50;
  const momentumStatus = comp < 45 ? 'US/ISRAEL ADVANTAGE' : comp > 55 ? 'IRAN/PROXY ADVANTAGE' : 'CONTESTED';

  let report = `AEGIS OVERSIGHT — SITUATION REPORT
${'═'.repeat(50)}
Generated: ${dateStr}
Classification: UNCLASSIFIED // OSINT

1. THREAT ASSESSMENT
─────────────────────────────
Threat Tempo: ${escalation.threatTempo}
Acceleration: ${escalation.acceleration.toFixed(1)}x (${escalation.acceleration > 1.5 ? 'SURGING' : escalation.acceleration < 0.7 ? 'DE-ESCALATING' : 'STABLE'})
Active Clusters: ${escalation.clusters.length}
Hotspots: ${escalation.hotspots.length}

2. STRATEGIC MOMENTUM
─────────────────────────────
Overall: ${momentumStatus} (${comp.toFixed(0)}%)`;

  if (momentum?.factors) {
    const labels: Record<string, string> = {
      oil: 'Oil/Energy', kinetic: 'Kinetic', currency: 'Currency',
      shipping: 'Shipping', diplomatic: 'Diplomatic', cyber: 'Cyber/InfoWar',
    };
    for (const [key, factor] of Object.entries(momentum.factors)) {
      const label = (labels[key] || key).padEnd(12);
      report += `\n  ${label} ${factor.detail} (score: ${factor.score > 0 ? '+' : ''}${factor.score})`;
    }
  }

  report += `

3. CRITICAL EVENTS (${criticalEvents.length})
─────────────────────────────`;

  if (criticalEvents.length === 0) {
    report += '\nNo critical events in current window.';
  } else {
    for (const evt of criticalEvents) {
      const rel = getReliability(evt.source);
      report += `\n• [${rel.label}] ${evt.title}`;
      report += `\n  Source: ${evt.source} | ${new Date(evt.timestamp).toISOString().split('T')[0]}`;
      if (evt.location?.name) report += ` | ${evt.location.name}`;
      if (evt.fatalities) report += ` | ${evt.fatalities} KIA`;
    }
  }

  report += `

4. HIGH-PRIORITY EVENTS (${highEvents.length})
─────────────────────────────`;

  for (const evt of highEvents.slice(0, 5)) {
    const rel = getReliability(evt.source);
    report += `\n• [${rel.label}] ${evt.title.slice(0, 80)}`;
    if (evt.location?.name) report += ` (${evt.location.name})`;
  }
  if (highEvents.length > 5) report += `\n  ... and ${highEvents.length - 5} more`;

  report += `

5. GEOGRAPHIC CONCENTRATION
─────────────────────────────`;

  for (const [loc, count] of topLocations) {
    report += `\n  ${loc}: ${count} events`;
  }

  report += `

6. DATA SOURCES (${sources.length} active)
─────────────────────────────`;

  for (const src of sources.slice(0, 15)) {
    const rel = getReliability(src);
    const count = events.filter(e => e.source === src).length;
    report += `\n  ${rel.label} ${src} (${count})`;
  }
  if (sources.length > 15) report += `\n  ... and ${sources.length - 15} more`;

  report += `

7. SUMMARY
─────────────────────────────
Total Intercepts: ${events.length}
Total Fatalities: ${totalFatalities.toLocaleString()}
Critical Events: ${criticalEvents.length}
High Events: ${highEvents.length}
Active Sources: ${sources.length}

${'═'.repeat(50)}
END SITREP — AEGIS OVERSIGHT
`;

  return report;
}
