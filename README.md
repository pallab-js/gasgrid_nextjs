# GasNext

[![CI](https://github.com/pallab-js/gasgrid_nextjs/actions/workflows/ci.yml/badge.svg)](https://github.com/pallab-js/gasgrid_nextjs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Local, offline operations console for a City Gas Distribution (CGD) gas-grid
company in India — dashboard analytics, network topology graph, schematic map,
alarms, work orders, consumers and reports. Runs on localhost or a private LAN.
No cloud, no Docker.

## Features

- **Dashboard** — KPIs (intake, demand, availability, critical alarms,
  pressure compliance, collections), 24 h demand balance, zone flow, consumer
  mix, alarm trend and revenue charts, live alarm feed
- **Network graph** — every node (CGS/DPRS/IPRS/CNG/valves/junctions) laid out
  over the pipeline topology with zone/status/search filters and a live detail
  drawer (gauge, sparkline, alarms, work orders)
- **Schematic map** — offline Leaflet canvas (no tiles): boundary, pipeline
  segments, status chips with alarm counts, consumer dots that cluster by zoom
- **Stations** — sortable register with sparklines; per-station detail with
  live gauge against the pressure band, 24 h pressure/flow chart, config,
  events and work orders
- **Telemetry explorer** — compare up to 8 assets × pressure/flow/temperature
  over 1 h / 24 h / 7 d / 30 d with min/max/avg statistics
- **Alarms console** — Open / Acknowledged / Resolved tabs, severity, type,
  asset and time filters, role-gated acknowledge & resolve (audited)
- **Work orders** — status board with allowed transitions, create/edit,
  assignment, priorities, due dates and audit trail
- **Consumers** — connection register with search/filters, meter readings,
  invoice history and monthly consumption chart
- **Reports** — monthly energy balance (UFG), category consumption,
  revenue vs collection, SCADA availability, alarm & WO stats — each section
  exports to CSV
- **Settings** (admin) — users & roles, alarm thresholds, telemetry simulator
  on/off + tick interval, inject-test-alarm, DB stats and audit log
- **Live telemetry simulator** — background process (toggleable) producing
  diurnal demand, drift and threshold alarms so every screen stays alive

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 · shadcn/ui (radix-nova) · SQLite 3 (better-sqlite3 + Drizzle) ·
Recharts · React Flow (`@xyflow/react`) · Leaflet (offline, no tiles).

Design language: toned-down **DESIGN.md** (deep-indigo canvas, Blurple primary,
green/magenta status accents) applied to a quiet, data-dense, dark UI.

## Quick start

```bash
npm install
npm run db:setup     # migrate + seed (idempotent)
npm run dev          # http://localhost:3000
```

Demo users (local prototype only):

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `operator` | `ops123` | operator |
| `viewer` | `view123` | viewer |
| `field` | `field123` | operator |
| `supervisor` | `super123` | operator |

A background **telemetry simulator** starts automatically (toggle in Settings) and
keeps dashboards, alarms and gauges live.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run db:setup` | Apply migrations + seed demo data |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:reset` | Drop, re-migrate and re-seed from scratch |

## Smoke tests

Nine Playwright smoke suites cover every screen plus role-gating and actions:

```bash
npx playwright-core install chromium   # once
npm run dev                            # in another terminal
node scripts/smoke.mjs                 # scripts/smoke-*.mjs for the rest
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, a production build and
all smoke suites against the built app on every push and pull request.
Dependabot keeps npm and GitHub Actions dependencies fresh.

## Private LAN use

```bash
npm run dev -- -H 0.0.0.0   # trusted private network only
```

## Backup

The entire state lives in `data/gasnext.db` (WAL). Stop the server and copy the
file to back up. The `data/` directory is git-ignored; a fresh clone
migrates and seeds itself on first run.

## Documentation

- [docs/PRD.md](docs/PRD.md) — product requirements
- [docs/SDA.md](docs/SDA.md) — system design & architecture
- [docs/TRD.md](docs/TRD.md) — technical decisions, tokens, budgets
- [docs/APP-FLOW.md](docs/APP-FLOW.md) — routes, screens, journeys
- [docs/SCHEMA.md](docs/SCHEMA.md) — database schema
- [DESIGN.md](DESIGN.md) — source design language analysis

## License

[MIT](LICENSE)
