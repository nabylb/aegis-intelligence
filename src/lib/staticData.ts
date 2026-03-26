// Static intelligence data for map overlays

export type StrategicAsset = {
  id: string;
  name: string;
  type: 'base' | 'oil_field' | 'carrier' | 'chokepoint' | 'boat';
  faction: 'us' | 'israel' | 'iran' | 'yemen' | 'neutral';
  lat: number;
  lng: number;
  description: string;
  mmsi?: string; // For real-world photo fetching
  photoUrl?: string; // Hardcoded fallback for military assets
};

export type HistoricalStrike = {
  id: string;
  targetName: string;
  attacker: 'israel' | 'iran' | 'us' | 'yemen' | 'unknown';
  lat: number;
  lng: number;
  date: string; // ISO string
  description: string;
};

export const STRATEGIC_ASSETS: StrategicAsset[] = [
  // US Bases
  { id: 'al-udeid', name: 'Al Udeid Air Base', type: 'base', faction: 'us', lat: 25.1186, lng: 51.3148, description: 'Forward headquarters of US Central Command (CENTCOM) in Qatar.' },
  { id: 'nsa-bahrain', name: 'NSA Bahrain / 5th Fleet', type: 'base', faction: 'us', lat: 26.2056, lng: 50.6053, description: 'Headquarters for US Naval Forces Central Command.' },
  { id: 'al-asad', name: 'Al Asad Airbase', type: 'base', faction: 'us', lat: 33.7845, lng: 42.4384, description: 'Major US-operated airbase in Al Anbar, Iraq.' },
  { id: 'muwaffaq-salti', name: 'Muwaffaq Salti Air Base', type: 'base', faction: 'us', lat: 31.8340, lng: 36.7865, description: 'Key operations base in Jordan.' },
  { id: 'camp-lemonnier', name: 'Camp Lemonnier', type: 'base', faction: 'us', lat: 11.5492, lng: 43.1481, description: 'Primary US base operations in Djibouti / Red Sea.' },
  { id: 'erbil-ab', name: 'Erbil Air Base', type: 'base', faction: 'us', lat: 36.2366, lng: 43.9631, description: 'US Coalition base in Kurdistan Region, Iraq. Frequent proxy target.' },
  { id: 'al-dhafra', name: 'Al Dhafra Air Base', type: 'base', faction: 'us', lat: 24.2483, lng: 54.5475, description: 'US/UAE joint forces air base housing F-35s.' },
  { id: 'ali-al-salem', name: 'Ali Al Salem Air Base', type: 'base', faction: 'us', lat: 29.3466, lng: 47.5208, description: 'USAF base in Kuwait, primary logistics hub.' },
  { id: 'tower-22', name: 'Tower 22 Outpost', type: 'base', faction: 'us', lat: 33.3218, lng: 38.6816, description: 'Remote logistics outpost near Syria/Jordan border.' },
  
  // Israeli Assets
  { id: 'nevatim', name: 'Nevatim Airbase', type: 'base', faction: 'israel', lat: 31.2069, lng: 35.0118, description: 'Israeli F-35 fighter base.' },
  { id: 'tel-nof', name: 'Tel Nof Base', type: 'base', faction: 'israel', lat: 31.8398, lng: 34.8239, description: 'Key IAF base housing specialized squadrons.' },
  { id: 'ramat-david', name: 'Ramat David Airbase', type: 'base', faction: 'israel', lat: 32.6653, lng: 35.1794, description: 'Northernmost IAF primary base.' },

  // Iranian Assets
  { id: 'kharg-island', name: 'Kharg Island Oil Terminal', type: 'oil_field', faction: 'iran', lat: 29.2389, lng: 50.3168, description: 'Handles 90% of Iranian oil exports.' },
  { id: 'abadan-refinery', name: 'Abadan Oil Refinery', type: 'oil_field', faction: 'iran', lat: 30.3444, lng: 48.2831, description: 'Major oil processing facility near Iraqi border.' },
  { id: 'fordow', name: 'Fordow Enrichment Plant', type: 'base', faction: 'iran', lat: 34.8841, lng: 50.9959, description: 'Underground uranium enrichment facility.' },
  { id: 'natanz', name: 'Natanz Nuclear Facility', type: 'base', faction: 'iran', lat: 33.7258, lng: 51.7289, description: 'Primary Iranian uranium enrichment center.' },
  { id: 'khatam-al-anbiya', name: 'Khatam al-Anbiya HQ', type: 'base', faction: 'iran', lat: 35.6961, lng: 51.4231, description: 'Air Defense Headquarters in Tehran.' },

  // Chokepoints / Regional
  { id: 'bab-el-mandeb', name: 'Bab el-Mandeb Strait', type: 'chokepoint', faction: 'yemen', lat: 12.5833, lng: 43.3333, description: 'Critical maritime chokepoint controlled by Houthi proximity.' },
  { id: 'strait-of-hormuz', name: 'Strait of Hormuz', type: 'chokepoint', faction: 'iran', lat: 26.5667, lng: 56.2500, description: 'Primary global oil transit chokepoint.' },
  { id: 'suez-canal', name: 'Suez Canal (South Entry)', type: 'chokepoint', faction: 'neutral', lat: 29.9328, lng: 32.5594, description: 'Global maritime choke point heavily impacted by Red Sea rerouting.' },

  // US Aircraft Carriers (Live Deployments March 2026)
  { id: 'cvn-72', name: 'USS Abraham Lincoln (CVN-72)', type: 'carrier', faction: 'us', lat: 16.5, lng: 54.5, mmsi: '338827000', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/USS_Abraham_Lincoln_%28CVN-72%29_in_the_Atlantic_Ocean.jpg', description: 'Carrier Strike Group operating in Arabian Sea near Salalah, Oman.' },
  { id: 'cvn-78', name: 'USS Gerald R. Ford (CVN-78)', type: 'carrier', faction: 'us', lat: 21.5, lng: 38.0, mmsi: '338945000', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/28/USS_Gerald_R._Ford_%28CVN-78%29_underway_in_the_Atlantic_Ocean_on_8_April_2017.jpg', description: 'Carrier Strike Group components in Red Sea (Op Epic Fury).' },
  { id: 'lhd-4', name: 'USS Boxer Amphibious Readiness', type: 'boat', faction: 'us', lat: 13.5, lng: 48.0, mmsi: '369408000', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/USS_Boxer_%28LHD-4%29_underway_in_the_Pacific_Ocean_on_15_February_2019.jpg', description: 'Amphibious assault ship deployed with MEU in Gulf of Aden.' },

  // Targeted / Active Boats
  { id: 'mkd-vyom', name: 'Tanker MKD VYOM', type: 'boat', faction: 'neutral', lat: 24.4, lng: 58.6, description: 'Struck by projectile north of Muscat.' },
  { id: 'safeen-prestige', name: 'Safeen Prestige Container', type: 'boat', faction: 'neutral', lat: 26.3, lng: 56.5, description: 'Damaged by missile attack in Strait of Hormuz.' },
  { id: 'galaxy-leader', name: 'Galaxy Leader (Hijacked)', type: 'boat', faction: 'yemen', lat: 15.3, lng: 42.6, description: 'Vehicle carrier hijacked by Houthi forces, held off coast of Yemen.' },
  { id: 'rubymar', name: 'M/V Rubymar (Sunk)', type: 'boat', faction: 'neutral', lat: 13.3, lng: 43.2, description: 'Fertilizer carrier sunk by Houthi ballistic missiles in the Red Sea.' },
  { id: 'true-confidence', name: 'True Confidence', type: 'boat', faction: 'neutral', lat: 12.0, lng: 44.5, description: 'Bulk carrier struck in Gulf of Aden, fatal casualties reported.' },
  { id: 'stena-imperative', name: 'Stena Imperative', type: 'boat', faction: 'neutral', lat: 26.2, lng: 50.6, description: 'US-flagged products tanker struck by projectiles in Bahrain port.' }
];

// Historical major kinetic events spanning the last 180+ days for filtering
export const HISTORICAL_STRIKES: HistoricalStrike[] = [
  // Israel / US Strikes
  { id: 'hs-1', targetName: 'Hodeidah Port', attacker: 'israel', lat: 14.8238, lng: 42.9268, date: new Date(Date.now() - 15 * 86400000).toISOString(), description: 'IAF airstrikes on Houthi oil and power infrastructure.' }, 
  { id: 'hs-2', targetName: 'Beirut Southern Suburbs', attacker: 'israel', lat: 33.8471, lng: 35.5134, date: new Date(Date.now() - 10 * 86400000).toISOString(), description: 'Targeted airstrike on Hezbollah command structures.' }, 
  { id: 'hs-3', targetName: 'Isfahan Air Defense', attacker: 'israel', lat: 32.7483, lng: 51.7588, date: new Date(Date.now() - 8 * 86400000).toISOString(), description: 'Israeli retaliatory drone strike on radar system.' },
  { id: 'hs-4', targetName: 'South Pars Gas Field', attacker: 'israel', lat: 27.5, lng: 52.5, date: new Date(Date.now() - 3 * 86400000).toISOString(), description: 'Strike on Iranian energy infrastructure.' },

  // Iranian / Proxy Strikes
  { id: 'hs-5', targetName: 'Nevatim Airbase', attacker: 'iran', lat: 31.2069, lng: 35.0118, date: new Date(Date.now() - 2 * 86400000).toISOString(), description: 'Ballistic missile barrage targeting IAF bases.' },
  { id: 'hs-6', targetName: 'US Base Tower 22', attacker: 'iran', lat: 33.3218, lng: 38.6816, date: new Date(Date.now() - 25 * 86400000).toISOString(), description: 'Drone strike by Iran-backed militia in Jordan.' }, 
  { id: 'hs-7', targetName: 'Red Sea Com. Vessel', attacker: 'yemen', lat: 13.5, lng: 42.5, date: new Date(Date.now() - 1 * 86400000).toISOString(), description: 'Houthi anti-ship ballistic missile strike.' }, 
  { id: 'hs-8', targetName: 'Port of Salalah Fuel Tanks', attacker: 'iran', lat: 16.94, lng: 54.01, date: new Date(Date.now() - 11 * 86400000).toISOString(), description: 'Iranian drones struck fuel storage tanks.' },
  { id: 'hs-9', targetName: 'Stena Imperative', attacker: 'iran', lat: 26.2, lng: 50.6, date: new Date(Date.now() - 21 * 86400000).toISOString(), description: 'US-flagged products tanker struck by projectiles in Bahrain port.' },
  { id: 'hs-10', targetName: 'SAMREF Refinery', attacker: 'iran', lat: 24.03, lng: 38.05, date: new Date(Date.now() - 3 * 86400000).toISOString(), description: 'Iranian drone attack on Saudi Red Sea refinery in Yanbu.' },
  
  // Older historical
  { id: 'hs-11', targetName: 'Damascus Consulate', attacker: 'israel', lat: 33.5138, lng: 36.2765, date: new Date(Date.now() - 120 * 86400000).toISOString(), description: 'Targeted airstrike against IRGC commanders.' },
  { id: 'hs-12', targetName: 'USS Gravely Intercept', attacker: 'yemen', lat: 14.5, lng: 42.0, date: new Date(Date.now() - 150 * 86400000).toISOString(), description: 'Naval interception of Houthi cruise missiles.' }
];
