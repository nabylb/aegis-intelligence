<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Aegis Oversight — Agent Guide

## Architecture Overview
This is a real-time intelligence dashboard built with Next.js 16 App Router. It aggregates 19 data sources via SSE streaming and renders them on a MapLibre GL map with multiple analysis layers.

## Critical Files
- `src/lib/aggregator.ts` — THE data layer. ~1800 lines, 19 fetcher functions, each with its own in-memory cache. All external API calls happen here.
- `src/app/api/stream/route.ts` — SSE endpoint. Tiered polling (fast 30s / slow 5min). Shared server cache. Fuzzy dedup via Levenshtein.
- `src/app/api/momentum/route.ts` — 6-factor strategic momentum engine. Stores trend history (168 hourly snapshots).
- `src/components/IntelDashboard.tsx` — Main dashboard component. All state lives here. CSS vars for night mode.
- `src/components/Map.tsx` — MapLibre rendering. Markers capped at 200. Heatmap, trajectories, vessel clusters.

## Adding a New Data Source
1. Add fetcher function to `src/lib/aggregator.ts` with cache variables
2. Import and add to fast or slow tier in `src/app/api/stream/route.ts`
3. If new event type: add to `IntelEventType` in `src/lib/types.ts`
4. Add type badge colors in `IntelDashboard.tsx` `typeBadge()` helper
5. Add marker styling + icon in `Map.tsx` locatableEvents rendering
6. Add reliability rating in `src/lib/reliability.ts`

## Performance Rules
- NEVER render more than 200 map markers — use severity-priority sorting + slice
- NEVER render more than 80 SIGINT feed items — slice before .map()
- ALWAYS add in-memory cache to new fetchers (minimum 30s TTL)
- ALWAYS use useMemo for expensive computations (incident resolution, escalation analysis)
- Pre-compute Date.getTime() before loops — never create Date objects inside O(n^2) comparisons
- New fetchers go in slow tier (5min) unless they're time-critical (alerts, OSINT)

## Event Type System
```
aviation  — Aircraft transponder positions
naval     — Vessel AIS tracking
news      — RSS/media reports
conflict  — Armed conflict (ACLED, Liveuamap)
military  — Military operations
strike    — Kinetic strikes (GDELT geocoded)
satellite — Satellite imagery reports
thermal   — NASA FIRMS fire/explosion detection
seismic   — USGS earthquake events
weather   — Meteorological conditions
humanitarian — ReliefWeb crisis reports
notam     — Airspace closures (FAA)
nuclear   — IAEA nuclear program reports
```

## Momentum Engine Factors
| Factor | Weight | Source | Score Range |
|--------|--------|--------|-------------|
| Oil/Energy | 20% | Yahoo Finance WTI | -5 to +5 |
| Kinetic | 25% | GDELT CAMEO events | -5 to +5 |
| Currency | 15% | ILS/USD + VIX | -5 to +5 |
| Shipping | 15% | GDELT article volume | -5 to +5 |
| Diplomatic | 15% | GDELT tone analysis | -5 to +5 |
| Cyber | 10% | GDELT cyber volume | -5 to +5 |

Negative score = US/Israel advantage. Positive = Iran/Proxy advantage. Composite: tanh sigmoid → 0-100%.
