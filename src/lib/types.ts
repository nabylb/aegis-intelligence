export type IntelSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IntelEventType = 'aviation' | 'naval' | 'news' | 'conflict' | 'military' | 'strike' | 'satellite' | 'thermal' | 'seismic' | 'weather' | 'humanitarian' | 'notam' | 'nuclear';

export interface IntelEvent {
  id: string;             // Unique identifier for the event
  timestamp: string;      // ISO 8601 string
  title: string;          // Headline or summary
  summary?: string;       // Detailed description if available
  payloadImage?: string;  // Satellite image URL if available
  source: string;         // e.g., "Reuters", "GDELT", "OpenSky"
  sourceUrl?: string;     // Link to original report
  type: IntelEventType;
  severity: IntelSeverity;
  
  // Tactical score: negative means good for US/IL allies, positive means good for Iran/Proxies
  strategicScore?: number; 
  
  // Geospatial data (optional if not provided by source)
  location?: {
    lat: number;
    lng: number;
    name?: string;
  };

  // Conflict Data (ACLED)
  fatalities?: number;

  // Aviation/Maritime specific
  entity?: {
    callsign?: string;
    altitude?: number;
    heading?: number;
    speed?: number;
    country?: string;
    origin?: string;
    destination?: string;
    mmsi?: string;
    imo?: string;
    vesselType?: string;
    icao24?: string; // For aviation photo fetching
    type?: string;   // For aviation platform type (e.g., F-35, C-17)
    isMilitary?: boolean;
  };
}
