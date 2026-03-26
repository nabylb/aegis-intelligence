# Aegis Oversight

Real-time geopolitical intelligence dashboard that aggregates multi-source conflict data, military operations, and strategic assets across the Middle East. Features live streaming events, interactive mapping with ballistic trajectory visualization, market data, and OSINT feed aggregation.

## Features

- **Live Intelligence Feed** — Server-Sent Events stream from 11+ data sources with 60-second refresh
- **Interactive Map** — Maplibre GL map with strategic assets, aviation tracks, naval vessels, strike markers, and animated ballistic trajectories
- **Breaking News Alerts** — Auto-detected high/critical severity events from the last 15 minutes
- **Strike Timeline** — Chronological view of conflict and kinetic events with fatality data
- **Market Widget** — S&P 500, Crude Oil WTI, FTSE 100, Nikkei 225, EURO STOXX 50 sparkline charts
- **Strategic Momentum Gauge** — Aggregated scoring of geopolitical posture shifts
- **Layer Toggles** — Filter by bases, naval, aviation, kinetic strikes, casualties, satellite, finance
- **Historical Filters** — View events from the last 24 hours, 7 days, 30 days, or 6 months

## Data Sources

### Conflict & Event Data
| Source | Type | Auth Required |
|--------|------|---------------|
| [ACLED](https://acleddata.com) | Armed conflict events, fatalities, actors (180-day window) | Yes (free account) |
| [GDELT Doc API](https://www.gdeltproject.org) | 250 news articles with NLP casualty extraction | No |
| [GDELT Geo API](https://www.gdeltproject.org) | Geocoded strike/conflict points (14-day window, 150 max) | No |

### News & Analysis (RSS)
| Source | Coverage |
|--------|----------|
| BBC Middle East | Regional news |
| Al Jazeera English | Regional news |
| New York Times Middle East | Regional news |
| Reuters World | Global news |
| The Guardian Middle East | Regional news |
| Bellingcat | OSINT investigations |
| War on the Rocks | Defense analysis |
| Responsible Statecraft | Foreign policy |
| The Intercept | Investigative journalism |
| Drop Site News | Conflict reporting |

### Think Tank Analysis
| Source | Coverage |
|--------|----------|
| CSIS | Iran conflict analysis |
| INSS (Israel) | Strategic assessments |

### OSINT / Social Media
| Source | Method |
|--------|--------|
| X/Twitter accounts (sentdefender, clashreport, spectatorindex, iranintl_en, etc.) | Nitter RSS + RSSHub |

### Aviation & Maritime
| Source | Type | Auth Required |
|--------|------|---------------|
| [FlightRadar24](https://www.flightradar24.com) | Live aircraft positions (Middle East bounding box) | No |
| [OpenSky Network](https://opensky-network.org) | Aircraft photos/metadata | No |
| [AIS Data](https://github.com/tayljordan/ais) | Global vessel tracking (filtered to Med/Red Sea/Persian Gulf) | No |
| [MarineTraffic](https://www.marinetraffic.com) | Vessel photos | No |

### Alerts & Satellite
| Source | Type | Auth Required |
|--------|------|---------------|
| [Tzeva Adom API](https://api.tzevaadom.co.il) | Israel civil defense missile/rocket alerts (15s polling) | No |
| Satellite OSINT | Synthetic imagery reports for key facilities | No (bundled) |

### Financial Markets
| Source | Type | Auth Required |
|--------|------|---------------|
| Yahoo Finance API | S&P 500, WTI Crude, FTSE 100, Nikkei 225, EURO STOXX 50 | No |

## Tech Stack

- **Framework:** Next.js 16 (App Router, SSE streaming)
- **UI:** React 19, Tailwind CSS 4, Framer Motion
- **Maps:** Maplibre GL + React Map GL
- **Charts:** Recharts
- **Icons:** Lucide React
- **Data:** RSS Parser, native Fetch API
- **Language:** TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ (or Bun)
- npm, yarn, pnpm, or bun

### Installation

```bash
git clone https://github.com/your-username/aegis.git
cd aegis
npm install
```

### Environment Variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `ACLED_EMAIL` | Optional | Your ACLED account email ([register free](https://acleddata.com/register/)) |
| `ACLED_PASSWORD` | Optional | Your ACLED account password |
| `ACLED_API_KEY` | Optional | Legacy ACLED API key (fallback if OAuth fails) |

> **Note:** All other data sources are public and require no API keys. The app works without ACLED credentials — it will skip ACLED data and rely on GDELT and other sources.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

## Architecture

```
Client (React + SSE)
    │
    ├── EventSource → /api/stream (SSE)
    │       │
    │       ├── RSS Feeds (10 sources)
    │       ├── GDELT Doc + Geo APIs
    │       ├── ACLED Conflict API
    │       ├── FlightRadar24 Aviation
    │       ├── Global AIS Maritime
    │       ├── Tzeva Adom Alerts
    │       ├── X/Twitter OSINT
    │       ├── Think Tank Scraping
    │       └── Satellite OSINT
    │
    └── Fetch → /api/markets (REST)
            └── Yahoo Finance
```

- **/api/stream** — SSE endpoint that fetches all 11 data sources on connection, then polls every 60 seconds. Sends `init` (full batch) and `update` (delta) events.
- **/api/markets** — REST endpoint for market data with 5-minute cache. Supports `?range=1d|1mo|1y`.
- **No database** — All data is fetched on-demand and cached in-memory with source-specific TTLs (15 seconds to 12 hours).

## Deployment

### Vercel

Works on Vercel with the caveat that SSE connections may timeout after 10-60 seconds on serverless functions. The client handles reconnection gracefully.

### Self-Hosted (Recommended)

For long-lived SSE connections, deploy on a standard Node.js server (Docker, VPS, Railway, etc.):

```bash
npm run build
npm start
```

## License

MIT
