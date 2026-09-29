# GasNext — Product Requirements Document (PRD)

**Product:** GasNext — local operations console for a City Gas Distribution (CGD) licensee in India.
**Version:** 0.1 (prototype → production-quality local build)
**Status:** Approved for implementation

## 1. Problem statement

CGD operators need a single, always-available screen that shows how the gas grid is
behaving right now — pressure zones, station health, alarms, field work, consumer
operations — without cloud dependencies, enterprise integration, or SCADA vendor
lock-in. Spreadsheets and disconnected tools make daily control-room work slow and
error-prone.

## 2. Goals

- One dashboard giving a bird's-eye view of the entire distribution network (supply,
  demand, alarms, compliance, commercial health).
- Understand the network as a **graph of physical units** (stations, valves, pipeline
  segments) and as a **geographic map** — both fully offline.
- Operational control loop: detect anomaly → inspect asset → acknowledge alarm →
  raise/track work order — with an audit trail.
- Runs on a single machine or private LAN; no cloud, no Docker, works offline.

## 3. Non-goals (explicitly out of scope)

- Cloud sync, SaaS multi-tenancy, remote access tunnels, Docker/K8s.
- Real SCADA protocol drivers (Modbus/IEC); telemetry is simulated locally.
- Real payment gateways, PNGRB filing/portal integration, GPS tracking.
- Native mobile apps (responsive web only).

## 4. Personas

| Persona | Needs |
|---|---|
| Control-room Operator | Live KPIs, alarm acknowledge/resolve, station detail, quick drill-down |
| Field / Ops Supervisor | Network topology & map, work orders, inspections, valve status |
| Manager / Admin | Analytics, reports, consumer & billing overview, user & threshold management |

## 5. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| F1 | Central dashboard: KPI cards (intake, consumption, availability %, critical alarms, pressure compliance, collections), charts (24 h demand area, zone flow bar, consumer mix donut, alarm trend, revenue vs collection), live alarm feed | P0 |
| F2 | Network graph view: nodes for CGS/DPRS/IPRS/CNG/valves/junctions, edges for pipeline segments colored by pressure zone/status; node click → detail drawer with live telemetry, alarms, work orders | P0 |
| F3 | Map view: offline schematic map (Leaflet, no tiles), pipeline polylines, asset markers, popups, layer toggles, same detail drawer | P0 |
| F4 | Stations: filterable register + detail page (gauges, 24 h trend, config, events, WOs) | P0 |
| F5 | Telemetry trends explorer: multi-node, multi-series (pressure/flow/temp), ranges 1 h / 24 h / 7 d / 30 d | P0 |
| F6 | Alarms: tabs open/acknowledged/resolved, severity filters, acknowledge + resolve actions (role-gated, audited) | P0 |
| F7 | Work orders: create/edit, assign, priority, status workflow, asset link, due dates | P1 |
| F8 | Consumers: connection register by category, meter readings, invoices, collection status | P1 |
| F9 | Reports: monthly ops summary — category-wise consumption, revenue vs collection, uptime, alarm stats; CSV export | P1 |
| F10 | Admin: users & roles CRUD, alarm thresholds, telemetry simulator on/off, DB stats | P1 |
| F11 | Auth: local login, SQLite sessions, roles `admin` / `operator` / `viewer` | P0 |
| F12 | Live telemetry simulator: background process writing readings every few seconds + generating realistic alarms | P0 |
| F13 | Audit log of all control actions (ack, resolve, WO changes, user changes) | P1 |

## 6. Roles & permissions

| Action | viewer | operator | admin |
|---|---|---|---|
| View all pages/charts | ✓ | ✓ | ✓ |
| Acknowledge / resolve alarms | — | ✓ | ✓ |
| Create / update work orders | — | ✓ | ✓ |
| Manage users, thresholds, simulator, settings | — | — | ✓ |

## 7. Data & content

Seeded demo dataset for a fictional licensee **“Aurum Gas Grid”** operating a Nashik
(Maharashtra) licence area: 2 CGS, 6 DPRS, 4 CNG stations, valve/junction nodes,
~45 pipeline segments, ~180 consumers across DOMESTIC/COMMERCIAL/INDUSTRIAL/CNG/
INSTITUTIONAL, 6 months of readings/invoices, 3 months of hourly telemetry history,
historical alarms/work orders, 3 demo users.

## 8. Success criteria

1. Fresh clone → `npm install` → `npm run db:setup` → `npm run dev` → login renders live dashboard < 2 s.
2. Graph and map views render the full seeded network and respond to node selection.
3. Simulator visibly updates telemetry/alarms without a page reload (5 s polling).
4. Role gating enforced (viewer cannot ack alarms; operator cannot manage users).
5. `npm run lint`, `npm run typecheck`, `npm run build` all pass.
6. Fully functional with network disabled (after install/build).

## 9. UX requirements

- Toned-down DESIGN.md design language: deep-indigo canvas, Blurple primary,
  green/magenta status accents, 12–16 px radii, hairline separation — but sentence-case,
  data-dense, quiet (no shouting display type, no loud gradients on operational surfaces).
- Dark-only theme; consistent app shell (sidebar + topbar) across all pages.
- Every list has filter/search, empty states, and loading skeletons; every mutation
  gives immediate feedback (toast + refreshed data).
- Responsive down to 1024 px (control-room first), usable at 768 px.
