import type { IntelEvent, IntelSeverity } from './types';

// NATO Admiralty System:
// Source reliability: A (completely reliable) to F (reliability cannot be judged)
// Information credibility: 1 (confirmed) to 6 (truth cannot be judged)

export type SourceGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type InfoGrade = 1 | 2 | 3 | 4 | 5 | 6;

export interface ReliabilityRating {
  source: SourceGrade;
  info: InfoGrade;
  label: string; // e.g. "A2"
  confidence: number; // 0-1 numeric score for weighting
  color: string; // tailwind text color class
}

// Known source ratings
const SOURCE_RATINGS: Record<string, { source: SourceGrade; info: InfoGrade }> = {
  // Wire services — professional editorial standards, multi-source verification
  'Reuters World': { source: 'A', info: 2 },
  'AP News': { source: 'A', info: 2 },
  'BBC Middle East': { source: 'A', info: 2 },
  'NYT Middle East': { source: 'A', info: 2 },
  'The Guardian ME': { source: 'B', info: 2 },
  'Al Jazeera English': { source: 'B', info: 3 },

  // Investigative / OSINT — high quality but may have bias
  'Bellingcat OSINT': { source: 'A', info: 2 },
  'War on the Rocks': { source: 'B', info: 2 },
  'Responsible Statecraft': { source: 'B', info: 3 },
  'The Intercept': { source: 'B', info: 3 },
  'Drop Site News': { source: 'C', info: 3 },

  // Government / institutional data feeds
  'ACLED Conflict Data': { source: 'A', info: 1 },
  'FAA NOTAM': { source: 'A', info: 1 },
  'IAEA': { source: 'A', info: 1 },
  'USGS Seismic': { source: 'A', info: 1 },
  'NASA FIRMS': { source: 'A', info: 1 },

  // Structured data — machine-generated, reliable within scope
  'Aviation Transponder': { source: 'A', info: 1 },
  'Global AIS Satellite': { source: 'B', info: 2 },
  'GDELT': { source: 'B', info: 3 },
  'GDELT Events 2.0': { source: 'B', info: 3 },

  // Think tanks — expert analysis but may lag
  'CSIS Intelligence': { source: 'B', info: 2 },
  'INSS Intelligence': { source: 'B', info: 2 },

  // OSINT social media — unverified, fast but unreliable
  'X via RSSHub': { source: 'D', info: 4 },
  'Sentinel Hub': { source: 'B', info: 2 },

  // Liveuamap — editorial verified but crowd-sourced
  'Liveuamap (Middle East)': { source: 'C', info: 3 },
  'Liveuamap (Israel)': { source: 'C', info: 3 },

  // Alerts — official government systems
  'Tzeva Adom': { source: 'A', info: 1 },

  // Weather
  'Open-Meteo': { source: 'A', info: 1 },

  // Humanitarian
  'ReliefWeb': { source: 'A', info: 2 },
};

// Confidence score from rating (A1=1.0, F6=0.1)
const SOURCE_WEIGHT: Record<SourceGrade, number> = { A: 1.0, B: 0.8, C: 0.6, D: 0.4, E: 0.2, F: 0.1 };
const INFO_WEIGHT: Record<InfoGrade, number> = { 1: 1.0, 2: 0.85, 3: 0.65, 4: 0.45, 5: 0.25, 6: 0.1 };

function gradeColor(source: SourceGrade, info: InfoGrade): string {
  const score = SOURCE_WEIGHT[source] * INFO_WEIGHT[info];
  if (score >= 0.8) return 'text-emerald-400';
  if (score >= 0.6) return 'text-blue-400';
  if (score >= 0.4) return 'text-yellow-400';
  if (score >= 0.2) return 'text-orange-400';
  return 'text-red-400';
}

export function getReliability(sourceName: string): ReliabilityRating {
  // Try exact match first
  let rating = SOURCE_RATINGS[sourceName];

  // Fuzzy match: check if source contains a known key
  if (!rating) {
    for (const [key, val] of Object.entries(SOURCE_RATINGS)) {
      if (sourceName.includes(key) || key.includes(sourceName)) {
        rating = val;
        break;
      }
    }
  }

  // Match by prefix patterns
  if (!rating) {
    const lower = sourceName.toLowerCase();
    if (lower.includes('nitter') || lower.includes('x via')) rating = { source: 'D', info: 4 };
    else if (lower.includes('telegram')) rating = { source: 'D', info: 5 };
    else if (lower.includes('osint')) rating = { source: 'C', info: 4 };
    else if (lower.includes('gdelt')) rating = { source: 'B', info: 3 };
    else if (lower.includes('nasa') || lower.includes('usgs')) rating = { source: 'A', info: 1 };
    else if (lower.includes('reliefweb')) rating = { source: 'A', info: 2 };
    else rating = { source: 'F', info: 6 }; // Unknown source
  }

  const confidence = SOURCE_WEIGHT[rating.source] * INFO_WEIGHT[rating.info];

  return {
    source: rating.source,
    info: rating.info,
    label: `${rating.source}${rating.info}`,
    confidence: Math.round(confidence * 100) / 100,
    color: gradeColor(rating.source, rating.info),
  };
}

// Apply reliability weighting to event severity
// High-reliability sources keep their severity; low-reliability sources get downgraded
export function adjustedSeverity(event: IntelEvent): IntelSeverity {
  const rating = getReliability(event.source);
  if (rating.confidence >= 0.6) return event.severity; // Trusted — keep as is
  if (event.severity === 'critical' && rating.confidence < 0.4) return 'high'; // Downgrade unverified critical
  if (event.severity === 'high' && rating.confidence < 0.3) return 'medium';
  return event.severity;
}
