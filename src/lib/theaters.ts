export interface TheaterPreset {
  id: string;
  name: string;
  shortName: string;
  viewport: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
  bounds: {
    latMin: number;
    latMax: number;
    lngMin: number;
    lngMax: number;
  };
  keywords: string[]; // For filtering events by relevance
  color: string; // Tailwind accent color name
}

export const THEATERS: TheaterPreset[] = [
  {
    id: 'middle-east',
    name: 'Middle East / Persian Gulf',
    shortName: 'ME/PG',
    viewport: {
      longitude: 48.389,
      latitude: 31.689,
      zoom: 4.2,
      pitch: 55,
      bearing: -10,
    },
    bounds: { latMin: 12, latMax: 42, lngMin: 25, lngMax: 63 },
    keywords: ['iran', 'israel', 'yemen', 'houthi', 'hezbollah', 'hamas', 'gaza', 'lebanon', 'syria', 'iraq', 'irgc', 'idf', 'hormuz', 'red sea', 'gulf', 'saudi', 'uae', 'qatar', 'bahrain'],
    color: 'orange',
  },
  {
    id: 'indo-pacific',
    name: 'Indo-Pacific',
    shortName: 'INDPAC',
    viewport: {
      longitude: 121.5,
      latitude: 23.5,
      zoom: 3.8,
      pitch: 45,
      bearing: 0,
    },
    bounds: { latMin: -10, latMax: 50, lngMin: 90, lngMax: 180 },
    keywords: ['taiwan', 'china', 'pla', 'south china sea', 'scs', 'taiwan strait', 'philippines', 'japan', 'korea', 'dprk', 'pyongyang', 'guam', 'okinawa', 'spratly', 'paracel', 'aukus', 'quad'],
    color: 'cyan',
  },
  {
    id: 'black-sea',
    name: 'Black Sea / Ukraine',
    shortName: 'UKSEA',
    viewport: {
      longitude: 35.0,
      latitude: 48.5,
      zoom: 4.5,
      pitch: 45,
      bearing: 0,
    },
    bounds: { latMin: 40, latMax: 56, lngMin: 22, lngMax: 45 },
    keywords: ['ukraine', 'russia', 'crimea', 'donbas', 'kyiv', 'moscow', 'black sea', 'nato', 'wagner', 'kherson', 'zaporizhzhia', 'odesa', 'kharkiv', 'bakhmut', 'avdiivka'],
    color: 'blue',
  },
  {
    id: 'sahel',
    name: 'Sahel / Horn of Africa',
    shortName: 'SAHEL',
    viewport: {
      longitude: 20.0,
      latitude: 12.0,
      zoom: 3.8,
      pitch: 40,
      bearing: 0,
    },
    bounds: { latMin: -5, latMax: 25, lngMin: -20, lngMax: 55 },
    keywords: ['sahel', 'niger', 'mali', 'burkina', 'chad', 'sudan', 'ethiopia', 'eritrea', 'somalia', 'al-shabaab', 'boko haram', 'jnim', 'isgs', 'wagner', 'rsf', 'darfur', 'tigray'],
    color: 'amber',
  },
];

export function getTheater(id: string): TheaterPreset | undefined {
  return THEATERS.find(t => t.id === id);
}

export function filterEventsByTheater(events: any[], theater: TheaterPreset): any[] {
  return events.filter(e => {
    // Location-based filter
    if (e.location) {
      const { lat, lng } = e.location;
      if (lat >= theater.bounds.latMin && lat <= theater.bounds.latMax &&
          lng >= theater.bounds.lngMin && lng <= theater.bounds.lngMax) {
        return true;
      }
    }
    // Keyword-based filter (for events without location)
    const text = `${e.title || ''} ${e.summary || ''}`.toLowerCase();
    return theater.keywords.some(kw => text.includes(kw));
  });
}
