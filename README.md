# GasNext

Offline-first City Gas Distribution (CGD) operations console — live telemetry, network topology, schematic map, alarms, work orders, consumers, and reports. Runs entirely on localhost or a private LAN; no cloud or Docker required.

> Demo dataset: **Aurum Gas Grid** — Guwahati & Brahmaputra Valley, Assam (Northeast India).

## Features

| Area | What it does |
|------|--------------|
| **Dashboard** | KPIs, demand balance, zone flow, consumer mix, alarm trend, live feed |
| **Network** | Pipeline topology graph with zone/status/search filters and a live node drawer |
| **Map** | Offline Leaflet schematic (no tiles) with pipelines, status chips, clustered consumers |
| **Stations** | Register with sparklines and per-station pressure/flow detail |
| **Telemetry** | Compare up to 8 assets × pressure/flow/temperature across 1 h–30 d |
| **Alarms** | Open/acknowledged/resolved console with role-gated actions and audit |
| **Work orders** | Status board, transitions, assignment, priorities, due dates |
| **Consumers** | Connection register, readings, invoices, consumption history |
| **Reports** | Energy balance/UFG, category consumption, revenue, SCADA availability, CSV export |
| **Settings** | Users/roles, thresholds, simulator controls, test alarms, DB stats, audit log |

A background telemetry simulator produces diurnal demand, drift, and threshold alarms; toggle it in Settings.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · SQLite (better-sqlite3 + Drizzle) · Recharts · React Flow · Leaflet

## Quick start

```bash
npm install
npm run db:setup   # migrate + seed demo data
npm run dev        # http://localhost:3000
```

### Demo users

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | admin |
| `operator` | `ops123` | operator |
| `viewer` | `view123` | viewer |
| `field` | `field123` | operator |
| `supervisor` | `super123` | operator |

> Local prototype credentials only — change before any real deployment.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check |
| `npm run db:setup` | Apply migrations and seed demo data |
| `npm run db:generate` | Generate a Drizzle migration |
| `npm run db:reset` | Drop, re-migrate, and re-seed |

## Smoke tests

```bash
npx playwright-core install chromium   # once
npm run dev                            # in another terminal
node scripts/smoke.mjs                 # runs all suites
```

CI runs lint, typecheck, production build, and all smoke suites on every push/PR.

## Private LAN

```bash
npm run dev -- -H 0.0.0.0   # trusted private networks only
```

## Data & backup

State lives in `data/gasnext.db` (WAL mode). Stop the server and copy that file to back up. `data/` is git-ignored; a fresh clone migrates and seeds itself.

## Documentation

- [PRD](docs/PRD.md) — product requirements
- [SDA](docs/SDA.md) — system design & architecture
- [TRD](docs/TRD.md) — technical decisions
- [App flow](docs/APP-FLOW.md) — routes, screens, journeys
- [Schema](docs/SCHEMA.md) — database schema

## License

[MIT](LICENSE)
