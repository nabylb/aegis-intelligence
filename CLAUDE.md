@AGENTS.md

# Aegis Oversight — Project Context

## What This Is
Real-time geopolitical intelligence dashboard (Palantir-inspired). Aggregates 19+ data sources into a unified operational picture with live map, SIGINT feed, incident threading, and strategic momentum analysis.

## Tech Stack
- Next.js 16.2 (App Router), React 19, TypeScript 5
- Tailwind CSS 4 (no shadcn/ui in this project)
- MapLibre GL + react-map-gl for mapping
- Recharts + inline SVG for charts
- Lucide React for icons
- SSE (Server-Sent Events) for real-time streaming
- No database — all in-memory caching with source-specific TTLs

## Project Structure
```
src/
  app/
    api/
      stream/route.ts    — SSE endpoint, tiered polling (fast 30s / slow 5min), fuzzy dedup
      momentum/route.ts  — 6-factor strategic momentum engine + trend history
      markets/route.ts   — Yahoo Finance market data
    page.tsx             — Root page (dynamic import of IntelDashboard)
    layout.tsx           — Root layout
  components/
    IntelDashboard.tsx   — Main dashboard shell (panels, header, status bar, state)
    Map.tsx              — MapLibre map with markers, heatmap, trajectories, tooltips
    EscalationPulse.tsx  — Threat tempo analysis widget (clusters, hotspots, sparkline)
    IncidentThreads.tsx  — Entity resolution incident cards
    MarketWidget.tsx     — Financial market sparklines
    StrikeTimeline.tsx   — Kinetic strike timeline sidebar
  lib/
    aggregator.ts        — 19 data source fetchers (~1800 lines, each with cache)
    types.ts             — IntelEvent, IntelSeverity, IntelEventType
    escalation.ts        — Cluster detection, threat tempo, acceleration analysis
    incidents.ts         — Union-find entity resolution for incident threading
    reliability.ts       — NATO Admiralty source reliability ratings
    sitrep.ts            — SITREP report generator
    theaters.ts          — Multi-theater geographic presets
    staticData.ts        — Strategic assets and historical strikes
    airlines.ts          — ICAO airline code lookup
```

## Key Architectural Decisions
- SSE (not WebSocket) for simplicity — server pushes, client receives
- Tiered polling: fast tier (30s) for real-time sources, slow tier (5min) for heavy APIs
- Shared server-side `masterEvents` cache across all SSE connections
- Delta-only updates — only new events sent to client after init
- Fuzzy title deduplication (Levenshtein) to catch multi-source duplicates
- Client-side analysis: escalation pulse, incident threading, reliability scoring
- CSS custom properties for night mode theming (var(--panel-bg), etc.)
- No external state management — React useState + useMemo

## Performance Constraints
- Map markers capped at 200 (severity-prioritized)
- SIGINT feed renders max 80 items
- Event memory: 1500 client, 3000 server
- Incident resolution: 300 candidates max, pre-computed timestamps, early-exit matching
- Heatmap: 500 points max
- Aviation flight lines: 100 max

## Environment Variables
- `ACLED_EMAIL`, `ACLED_PASSWORD` — optional, for ACLED conflict data
- `ACLED_API_KEY` — optional legacy fallback
- All other sources are public/free

## Conventions
- Event types: aviation, naval, news, conflict, military, strike, satellite, thermal, seismic, weather, humanitarian, notam, nuclear
- Severity: low, medium, high, critical
- Source reliability: NATO A1 (best) to F6 (unknown)
- Momentum: 0-100%, <50% = US/IL advantage, >50% = Iran/Proxy advantage
- Night mode: CSS vars `--panel-bg`, `--panel-border`, `--header-bg`
