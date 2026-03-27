"use client";

import React, { useState } from 'react';
import {
  X, ChevronDown, RadioTower, Plane, Anchor, Flame, Satellite, Thermometer, Mountain,
  CloudRain, HeartHandshake, ShieldOff, Radiation, Globe, AlertCircle, Shield, Activity,
  Zap, LineChart, ClipboardCopy, Link2, Layers, MapPin
} from 'lucide-react';

type Section = 'overview' | 'sources' | 'events' | 'momentum' | 'escalation' | 'features' | 'reliability';

export default function DocsOverlay({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Globe className="w-3.5 h-3.5" /> },
    { key: 'sources', label: 'Data Sources', icon: <RadioTower className="w-3.5 h-3.5" /> },
    { key: 'events', label: 'Event Types', icon: <AlertCircle className="w-3.5 h-3.5" /> },
    { key: 'momentum', label: 'Momentum Engine', icon: <LineChart className="w-3.5 h-3.5" /> },
    { key: 'escalation', label: 'Threat Analysis', icon: <Zap className="w-3.5 h-3.5" /> },
    { key: 'features', label: 'Features', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'reliability', label: 'Reliability', icon: <Shield className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-neutral-950/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="w-4 h-4 text-neutral-300" />
          <h1 className="text-sm font-bold text-white uppercase tracking-widest">Aegis Documentation</h1>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <nav className="hidden md:flex flex-col w-56 border-r border-white/10 bg-black/20 py-4 px-3 shrink-0 overflow-y-auto">
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition mb-0.5 ${
                activeSection === s.key ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}>
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>

        {/* Mobile section selector */}
        <div className="md:hidden absolute top-[53px] left-0 right-0 z-10 bg-black/60 backdrop-blur-md border-b border-white/10 overflow-x-auto">
          <div className="flex px-2 py-1.5 gap-1">
            {sections.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition shrink-0 ${
                  activeSection === s.key ? 'bg-white/10 text-white' : 'text-neutral-400'
                }`}>
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pt-12 md:pt-0">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">

            {activeSection === 'overview' && (
              <>
                <DocHeading>What is Aegis?</DocHeading>
                <DocText>
                  Aegis Oversight is a real-time geopolitical intelligence dashboard that aggregates 19+ open-source data feeds
                  into a unified operational picture. It provides live mapping, SIGINT feed, incident threading, threat tempo analysis,
                  and strategic momentum scoring focused on the Middle East theater.
                </DocText>

                <DocHeading>How it works</DocHeading>
                <DocText>
                  The server polls data sources on two tiers: a fast tier (every 30 seconds) for time-critical feeds like aviation
                  transponders, rocket alerts, and OSINT, and a slow tier (every 5 minutes) for heavier APIs like GDELT, ACLED,
                  and NASA FIRMS. Events are deduplicated using fuzzy title matching (Levenshtein distance), cached in server memory,
                  and pushed to clients. There is no database -- all state is in-memory with source-specific TTL caching.
                </DocText>

                <DocHeading>Architecture</DocHeading>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <DocCard title="SSE Streaming" text="Server-Sent Events push new intelligence to clients in real-time. After initial load, only delta updates (new events) are sent." />
                  <DocCard title="Tiered Polling" text="Fast tier (30s): aviation, alerts, OSINT. Slow tier (5min): GDELT, ACLED, NASA, USGS, weather, humanitarian." />
                  <DocCard title="Fuzzy Dedup" text="Levenshtein distance matching catches duplicate events reported across multiple sources." />
                  <DocCard title="Client Analysis" text="Escalation pulse, incident threading, and reliability scoring are computed client-side for responsiveness." />
                </div>

                <DocHeading>Performance limits</DocHeading>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <DocStat label="Map Markers" value="200 max" />
                  <DocStat label="SIGINT Feed" value="80 items" />
                  <DocStat label="Client Events" value="1,500 max" />
                  <DocStat label="Server Cache" value="3,000 max" />
                </div>
              </>
            )}

            {activeSection === 'sources' && (
              <>
                <DocHeading>Data Sources (19+)</DocHeading>
                <DocText>
                  Each source is independently fetched, cached, and scored. Sources marked with a reliability grade follow NATO Admiralty coding.
                </DocText>

                <DocSubHeading>News &amp; OSINT</DocSubHeading>
                <div className="space-y-2">
                  <SourceRow name="RSS News Feeds" api="Reuters, AP, BBC, NYT, Guardian, Al Jazeera" desc="Major wire services and regional outlets. Headlines are scored for strategic impact and classified by severity." grade="B2-C3" />
                  <SourceRow name="GDELT Project" api="api.gdeltproject.org (Doc API + Events 2.0)" desc="Global event database. Provides article-level data with tone analysis and geocoded CAMEO-coded military events from 15-minute CSV exports." grade="C3" />
                  <SourceRow name="ACLED" api="acleddata.com/api" desc="Armed Conflict Location & Event Data. Academic-grade conflict tracking with actor types, fatalities, and event classification. 180-day lookback." grade="B2" />
                  <SourceRow name="Liveuamap" api="liveuamap.com/rss" desc="Editorially verified, geocoded conflict events with precise coordinates from GeoRSS feed." grade="B3" />
                  <SourceRow name="OSINT Twitter/X" api="Nitter mirrors + RSSHub bridges" desc="Curated OSINT accounts (analysts, monitors). Filtered for regional relevance using keyword matching." grade="D4" />
                  <SourceRow name="Telegram OSINT" api="t.me/s/ (public previews)" desc="War Monitor, Conflict Intel Group, Iran Intel, and other public Telegram channels." grade="D5" />
                  <SourceRow name="Think Tanks" api="CSIS, INSS RSS" desc="Strategic analysis from Center for Strategic and International Studies and Israel's Institute for National Security Studies." grade="B2" />
                </div>

                <DocSubHeading>Aviation &amp; Maritime</DocSubHeading>
                <div className="space-y-2">
                  <SourceRow name="OpenSky Network" api="opensky-network.org/api" desc="Real-time ADS-B transponder data for aircraft in Middle East airspace. Callsign, altitude, heading, speed, ICAO24 hex." grade="A1" />
                  <SourceRow name="Global AIS" api="GitHub AIS snapshot" desc="10,000 global vessel positions with military classification, MMSI, speed, destination, and vessel type." grade="B3" />
                </div>

                <DocSubHeading>Alerts &amp; Sensors</DocSubHeading>
                <div className="space-y-2">
                  <SourceRow name="Tzeva Adom" api="api.tzevaadom.co.il" desc="Israeli civil defense rocket/missile alerts in real-time with area geocoding." grade="A1" />
                  <SourceRow name="NASA FIRMS" api="firms.modaps.eosdis.nasa.gov" desc="VIIRS satellite thermal anomalies -- detects fires, explosions, and potential airstrikes within hours." grade="A2" />
                  <SourceRow name="USGS Earthquakes" api="earthquake.usgs.gov" desc="Global seismic events with nuclear facility proximity detection (flags events near Natanz, Fordow, Dimona, etc)." grade="A1" />
                </div>

                <DocSubHeading>Environment &amp; Humanitarian</DocSubHeading>
                <div className="space-y-2">
                  <SourceRow name="Open-Meteo" api="api.open-meteo.com" desc="Military-relevant weather for 10 key locations: dust storms, visibility, extreme heat, wind conditions." grade="A2" />
                  <SourceRow name="ReliefWeb" api="api.reliefweb.int" desc="UN OCHA humanitarian reports: crisis assessments, disaster and conflict impact, population displacement." grade="A2" />
                  <SourceRow name="FAA NOTAMs" api="external-api.faa.gov" desc="Flight restrictions and airspace closures for 7 Middle East Flight Information Regions." grade="A1" />
                  <SourceRow name="IAEA" api="iaea.org RSS" desc="Nuclear safeguards reports, Iran enrichment updates, inspector access status." grade="A1" />
                </div>

                <DocSubHeading>Satellite &amp; Imagery</DocSubHeading>
                <div className="space-y-2">
                  <SourceRow name="NASA GIBS" api="gibs.earthdata.nasa.gov (WMTS)" desc="VIIRS true-color satellite base layer. Imagery has ~2 day processing lag. Toggleable from the map controls." grade="A1" />
                  <SourceRow name="Satellite OSINT" api="Synthetic tactical data" desc="Simulated multi-spectral satellite reconnaissance for key facilities (Natanz, Hodeidah, Nevatim). Placeholder for future real imagery integration." grade="E5" />
                </div>
              </>
            )}

            {activeSection === 'events' && (
              <>
                <DocHeading>Event Types</DocHeading>
                <DocText>
                  Every intelligence intercept is classified into one of 13 event types. Each type has its own icon, color, and display behavior on the map and SIGINT feed.
                </DocText>
                <div className="space-y-2">
                  <EventTypeRow icon={<Plane className="w-4 h-4 text-blue-400" />} type="aviation" label="Aviation" desc="Aircraft transponder positions from ADS-B. Shows callsign, altitude, speed, origin/destination. Clicking opens aircraft card with photo lookup from Planespotters.net." />
                  <EventTypeRow icon={<Anchor className="w-4 h-4 text-cyan-400" />} type="naval" label="Naval" desc="Vessel AIS tracking data. Military vessels are distinguished from civilian. Clicking opens vessel card with MarineTraffic link." />
                  <EventTypeRow icon={<Globe className="w-4 h-4 text-neutral-400" />} type="news" label="News" desc="Wire service and media reports. Scored for strategic impact on a 0-10 scale. High/critical severity news triggers Flash Override alerts." />
                  <EventTypeRow icon={<AlertCircle className="w-4 h-4 text-orange-400" />} type="conflict" label="Conflict" desc="Armed conflict events from ACLED, GDELT, and Liveuamap. Includes actor identification, fatality counts, and event sub-types." />
                  <EventTypeRow icon={<Shield className="w-4 h-4 text-blue-400" />} type="military" label="Military" desc="Military operations, deployments, and exercises. Distinguished from conflict by operational rather than kinetic nature." />
                  <EventTypeRow icon={<Flame className="w-4 h-4 text-red-400" />} type="strike" label="Strike" desc="Kinetic strikes from GDELT geocoded events. CAMEO codes 18x/19x/20x (assault, fight, use unconventional mass violence). Shows ballistic trajectory arcs on map." />
                  <EventTypeRow icon={<Satellite className="w-4 h-4 text-violet-400" />} type="satellite" label="Satellite" desc="Satellite imagery analysis reports. Currently synthetic data -- placeholder for future commercial imagery integration." />
                  <EventTypeRow icon={<Thermometer className="w-4 h-4 text-amber-400" />} type="thermal" label="Thermal" desc="NASA FIRMS thermal anomalies detected by VIIRS satellite. Brightness and fire radiative power indicate intensity. Can reveal airstrikes and explosions." />
                  <EventTypeRow icon={<Mountain className="w-4 h-4 text-yellow-400" />} type="seismic" label="Seismic" desc="USGS earthquake events. Automatically flags events near nuclear facilities (Natanz, Fordow, Dimona, Bushehr, Parchin) as potential underground tests." />
                  <EventTypeRow icon={<CloudRain className="w-4 h-4 text-sky-400" />} type="weather" label="Weather" desc="Military-relevant weather conditions: dust storms (reduce air ops), extreme wind (affect maritime), low visibility, and extreme heat." />
                  <EventTypeRow icon={<HeartHandshake className="w-4 h-4 text-pink-400" />} type="humanitarian" label="Humanitarian" desc="UN ReliefWeb crisis reports covering displacement, food security, medical emergencies, and conflict impact assessments." />
                  <EventTypeRow icon={<ShieldOff className="w-4 h-4 text-indigo-400" />} type="notam" label="NOTAM" desc="FAA Notices to Air Missions. Flags airspace closures, military exercise zones, and flight restrictions across 7 Middle East FIRs." />
                  <EventTypeRow icon={<Radiation className="w-4 h-4 text-fuchsia-400" />} type="nuclear" label="Nuclear" desc="IAEA reports on nuclear programs. Tracks enrichment levels, inspector access, facility construction, and safeguards compliance." />
                </div>

                <DocHeading>Severity Levels</DocHeading>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    <div>
                      <div className="text-[10px] font-bold text-white">CRITICAL</div>
                      <div className="text-[9px] text-neutral-400">Immediate threat</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <div>
                      <div className="text-[10px] font-bold text-white">HIGH</div>
                      <div className="text-[9px] text-neutral-400">Significant event</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div>
                      <div className="text-[10px] font-bold text-white">MEDIUM</div>
                      <div className="text-[9px] text-neutral-400">Notable activity</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <div>
                      <div className="text-[10px] font-bold text-white">LOW</div>
                      <div className="text-[9px] text-neutral-400">Routine/monitor</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'momentum' && (
              <>
                <DocHeading>Strategic Momentum Engine</DocHeading>
                <DocText>
                  A 6-factor weighted composite that measures the balance of strategic advantage between US/Israel and Iran/Proxy
                  forces. The score ranges from 0-100%, where 50% is a stalemate. Below 50% favors US/Israel, above 50% favors
                  Iran/Proxy. The composite uses a tanh sigmoid to compress extremes and prevent 100% one-sided results.
                </DocText>
                <DocText>
                  Scores of 0 or ±1 on individual factors are normal and indicate stable/baseline conditions. Scores of ±3 to ±5
                  indicate a genuine crisis-level shift in that factor. The engine refreshes every 10 minutes and stores hourly trend
                  snapshots for up to 7 days.
                </DocText>

                <DocSubHeading>Factors</DocSubHeading>
                <div className="space-y-2">
                  <FactorRow label="OIL" weight="20%" range="-5 to +5" source="Yahoo Finance (WTI Crude)" desc="Compares current WTI crude price to 7-day moving average. >2% rise = disruption signal (Iran advantage). >2% drop = stabilization (US advantage). Oil spikes often accompany Hormuz/shipping threats." />
                  <FactorRow label="KIN" weight="25%" range="-5 to +5" source="GDELT Events 2.0 (CAMEO codes 18-20)" desc="Counts military assault/fight events by actor country code. Iran/Yemen/Lebanon/Syria/Iraq events vs US/Israel/UK events. The ratio determines who has kinetic initiative." />
                  <FactorRow label="FX" weight="15%" range="-5 to +5" source="Currency API + Yahoo Finance (VIX)" desc="Tracks ILS/USD exchange rate change over 7 days plus VIX fear index overlay. Shekel weakening + high VIX = market stress (Iran advantage). VIX >40 adds +2 bonus." />
                  <FactorRow label="SHIP" weight="15%" range="-2 to +5" source="GDELT Doc API (article volume)" desc="Measures article volume for Red Sea/Hormuz/Houthi shipping keywords over 30 days. Recent 7-day average vs baseline. Spikes above 1.5x baseline signal active disruption." />
                  <FactorRow label="DIP" weight="15%" range="-5 to +4" source="GDELT Doc API (article counts)" desc="Compares escalation articles (UN emergency sessions, sanctions, severed relations) vs de-escalation articles (ceasefire, peace talks, agreements) over 7 days." />
                  <FactorRow label="CYB" weight="10%" range="-5 to +4" source="GDELT Doc API (article volume)" desc="Tracks cyber attack, DDoS, hack, and info-warfare article volume. 3-day average vs 14-day baseline. Cyber spikes often precede kinetic operations by 24-48 hours." />
                </div>

                <DocSubHeading>Composite Calculation</DocSubHeading>
                <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10 font-mono text-[10px] text-neutral-300 space-y-1">
                  <div>weighted = OIL*0.20 + KIN*0.25 + FX*0.15 + SHIP*0.15 + DIP*0.15 + CYB*0.10</div>
                  <div>composite = 50 + tanh(weighted / 3) * 50</div>
                  <div className="text-neutral-500">// tanh sigmoid compresses extremes, prevents 0% or 100%</div>
                </div>
              </>
            )}

            {activeSection === 'escalation' && (
              <>
                <DocHeading>Threat Tempo Analysis</DocHeading>
                <DocText>
                  The Escalation Pulse system analyzes event patterns to classify the current threat tempo into four levels.
                  It runs client-side on all loaded events.
                </DocText>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 border border-white/10">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <div className="text-[11px] font-bold text-emerald-400">CALM</div>
                      <div className="text-[10px] text-neutral-400">Acceleration &lt;0.8x. Baseline activity, no escalation pattern detected.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 border border-white/10">
                    <span className="w-3 h-3 rounded-full bg-yellow-500 shrink-0" />
                    <div>
                      <div className="text-[11px] font-bold text-yellow-400">ELEVATED</div>
                      <div className="text-[10px] text-neutral-400">Acceleration 0.8-1.5x. Above-baseline event rate but no clustering pattern.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 border border-white/10">
                    <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
                    <div>
                      <div className="text-[11px] font-bold text-orange-400">SURGE</div>
                      <div className="text-[10px] text-neutral-400">Acceleration 1.5-2.5x. Rapid increase in kinetic events, possible coordinated operation.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 border border-white/10">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <div>
                      <div className="text-[11px] font-bold text-red-400">CRITICAL</div>
                      <div className="text-[10px] text-neutral-400">Acceleration &gt;2.5x. Massive event surge, likely active military campaign or major incident.</div>
                    </div>
                  </div>
                </div>

                <DocSubHeading>Acceleration</DocSubHeading>
                <DocText>
                  Ratio of the event rate in the last 2 hours compared to the 6-hour rolling average. Values above 1.5x indicate
                  surging activity, below 0.7x indicate de-escalation.
                </DocText>

                <DocSubHeading>Event Clustering</DocSubHeading>
                <DocText>
                  Groups 3+ kinetic events occurring within 6 hours and 100km of each other into clusters. Clusters
                  indicate coordinated operations rather than isolated incidents.
                </DocText>

                <DocSubHeading>Hotspot Detection</DocSubHeading>
                <DocText>
                  Divides the theater into 50km grid cells and identifies the 5 highest-density cells.
                  Hotspots reveal geographic concentration of activity.
                </DocText>
              </>
            )}

            {activeSection === 'features' && (
              <>
                <DocHeading>Dashboard Features</DocHeading>

                <DocSubHeading>Map</DocSubHeading>
                <DocText>
                  MapLibre GL map with severity-prioritized markers (capped at 200). Supports dark and satellite base layers,
                  NASA GIBS VIIRS overlay (2-day lag), heatmap mode, and ballistic trajectory arcs for strike events.
                  Click any marker to open a detail card.
                </DocText>

                <DocSubHeading>SIGINT Feed</DocSubHeading>
                <DocText>
                  Scrolling intelligence feed showing the latest 80 non-aviation events. Each card shows event type badge,
                  time, NATO reliability grade, title, source link, and fly-to location button. Events are filtered by
                  active layer toggles.
                </DocText>

                <DocSubHeading>Flash Override Alerts</DocSubHeading>
                <DocText>
                  High/critical severity news events from the last 15 minutes trigger a breaking news toast at the top
                  of the screen. All alerts are logged in the Flash Override History (bell icon in header) with source
                  links and fly-to capability.
                </DocText>

                <DocSubHeading>Incident Threading (LINKS tab)</DocSubHeading>
                <DocText>
                  Uses union-find clustering to group related events into incident threads. Events are linked by spatial
                  proximity (50km), temporal proximity (4 hours), keyword overlap (3+ shared tokens), and entity matching.
                  Each thread gets a confidence score (0-1) with multi-source bonuses. Actors (IDF, IRGC, Hezbollah, Hamas,
                  Houthi, US Forces) are extracted via regex.
                </DocText>

                <DocSubHeading>SITREP Export</DocSubHeading>
                <DocText>
                  Generates a NATO-format Situation Report and copies it to clipboard. Includes threat assessment,
                  momentum breakdown, top critical/high events with reliability grades, geographic concentration,
                  active source registry, and casualty statistics.
                </DocText>

                <DocSubHeading>Layer Controls</DocSubHeading>
                <DocText>
                  Toggle visibility of event categories: Bases, Aviation, Naval (Military/Civilian sub-toggle), Satellite,
                  Strikes, KIA markers, Heatmap, FIRMS thermal, Seismic, Weather, Humanitarian, and Finance. The "US/IL Only"
                  filter restricts to US and Israeli assets.
                </DocText>

                <DocSubHeading>Theater Presets</DocSubHeading>
                <DocText>
                  Quick-switch between geographic theaters: Middle East/Persian Gulf, Indo-Pacific, Black Sea/Ukraine,
                  and Sahel/Horn of Africa. Each preset adjusts the map viewport and filters events by bounding box
                  and keyword relevance.
                </DocText>

                <DocSubHeading>Timeline Filter</DocSubHeading>
                <DocText>
                  Filter satellite and historical events by recency: OFF (show all), 24H, 7D, or 30D lookback.
                  Affects satellite imagery events and historical conflict data display.
                </DocText>

                <DocSubHeading>Night Mode</DocSubHeading>
                <DocText>
                  Red-on-black color scheme designed for low-light environments. Activated via the moon/sun icon in the header.
                  Uses CSS custom properties to retheme all panels without re-rendering.
                </DocText>
              </>
            )}

            {activeSection === 'reliability' && (
              <>
                <DocHeading>NATO Admiralty Reliability System</DocHeading>
                <DocText>
                  Every event source is rated using the NATO Admiralty Code (also known as the NATO System for Evaluating
                  Sources and Information). This is a two-character grade combining source reliability and information credibility.
                </DocText>

                <DocSubHeading>Source Reliability (A-F)</DocSubHeading>
                <div className="space-y-1">
                  <GradeRow grade="A" label="Completely Reliable" confidence="1.0" desc="Government sensors, official military systems (USGS, FAA, OpenSky)" />
                  <GradeRow grade="B" label="Usually Reliable" confidence="0.8" desc="Established academic/institutional sources (ACLED, CSIS, ReliefWeb)" />
                  <GradeRow grade="C" label="Fairly Reliable" confidence="0.6" desc="Major media organizations with editorial standards (Reuters, BBC, GDELT)" />
                  <GradeRow grade="D" label="Not Usually Reliable" confidence="0.4" desc="Social media OSINT, unverified reports (Twitter/X feeds)" />
                  <GradeRow grade="E" label="Unreliable" confidence="0.2" desc="Single-source claims, known biased outlets" />
                  <GradeRow grade="F" label="Cannot Be Judged" confidence="0.1" desc="New or unknown sources with no track record" />
                </div>

                <DocSubHeading>Information Credibility (1-6)</DocSubHeading>
                <div className="space-y-1">
                  <GradeRow grade="1" label="Confirmed" confidence="1.0" desc="Verified by independent sources or direct observation" />
                  <GradeRow grade="2" label="Probably True" confidence="0.8" desc="Consistent with known patterns, partially corroborated" />
                  <GradeRow grade="3" label="Possibly True" confidence="0.6" desc="Plausible but not confirmed, single credible source" />
                  <GradeRow grade="4" label="Doubtfully True" confidence="0.4" desc="Possible but contradicts some known information" />
                  <GradeRow grade="5" label="Improbable" confidence="0.2" desc="Unlikely based on known conditions" />
                  <GradeRow grade="6" label="Cannot Be Judged" confidence="0.1" desc="No basis for evaluation" />
                </div>

                <DocSubHeading>How it affects display</DocSubHeading>
                <DocText>
                  The combined confidence score (source * info) determines the color of the reliability badge in the SIGINT feed:
                  green (0.8+), blue (0.6+), yellow (0.4+), orange (0.2+), red (&lt;0.2). Low-confidence sources have their
                  severity automatically downgraded (critical to high, high to medium) to prevent false alarm fatigue.
                </DocText>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function DocHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">{children}</h2>;
}

function DocSubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold text-neutral-200 uppercase tracking-wider mt-4 mb-1">{children}</h3>;
}

function DocText({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-neutral-300 leading-relaxed">{children}</p>;
}

function DocCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
      <div className="text-[10px] font-bold text-neutral-200 mb-1">{title}</div>
      <div className="text-[10px] text-neutral-400 leading-relaxed">{text}</div>
    </div>
  );
}

function DocStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-center">
      <div className="text-[9px] text-neutral-400 uppercase tracking-wider">{label}</div>
      <div className="text-[11px] font-bold text-white">{value}</div>
    </div>
  );
}

function SourceRow({ name, api, desc, grade }: { name: string; api: string; desc: string; grade: string }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-neutral-200">{name}</span>
        <span className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{grade}</span>
      </div>
      <div className="text-[9px] text-neutral-500 font-mono mb-1 truncate">{api}</div>
      <div className="text-[10px] text-neutral-400 leading-relaxed">{desc}</div>
    </div>
  );
}

function EventTypeRow({ icon, type, label, desc }: { icon: React.ReactNode; type: string; label: string; desc: string }) {
  return (
    <div className="flex gap-3 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-bold text-neutral-200">{label}</span>
          <span className="text-[8px] font-mono text-neutral-500">{type}</span>
        </div>
        <div className="text-[10px] text-neutral-400 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

function FactorRow({ label, weight, range, source, desc }: { label: string; weight: string; range: string; source: string; desc: string }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-neutral-200">{label}</span>
          <span className="text-[9px] text-neutral-400">{weight}</span>
        </div>
        <span className="text-[9px] font-mono text-neutral-400">{range}</span>
      </div>
      <div className="text-[9px] text-neutral-500 font-mono mb-1">{source}</div>
      <div className="text-[10px] text-neutral-400 leading-relaxed">{desc}</div>
    </div>
  );
}

function GradeRow({ grade, label, confidence, desc }: { grade: string; label: string; confidence: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
      <span className="text-[12px] font-mono font-bold text-white bg-white/10 w-6 h-6 rounded flex items-center justify-center shrink-0">{grade}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-neutral-200">{label}</span>
          <span className="text-[8px] text-neutral-500">{confidence}</span>
        </div>
        <div className="text-[9px] text-neutral-400">{desc}</div>
      </div>
    </div>
  );
}
