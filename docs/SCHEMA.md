# GasNext — Database Schema (SQLite / Drizzle)

Single file: `data/gasnext.db`. Managed by Drizzle Kit (`drizzle/` migrations),
enforced by `lib/schema.ts`.

## Entity-relationship overview

```
users ──< sessions
users ──< audit_log
nodes ──1:1 station_detail
nodes ──< segments (from_node / to_node) ──< valves
nodes ──< consumers ──< readings
nodes ──< telemetry ──(rollup)─> telemetry_hourly
nodes ──< alarms
nodes/segments ──< work_orders
settings (key/value)
```

## Tables

### users
| col | type | notes |
|---|---|---|
| id | integer PK | |
| username | text UNIQUE | login id |
| full_name | text | display |
| password_hash | text | scrypt: `salt$hash` |
| role | text | `admin` \| `operator` \| `viewer` |
| active | integer | 1/0 |
| created_at | integer | epoch ms |

### sessions
| col | type | notes |
|---|---|---|
| token | text PK | 128-bit random, httpOnly cookie |
| user_id | integer FK→users | cascade delete |
| created_at / expires_at | integer | expiry 14 d |

### audit_log
`id, ts, user_id, action, entity, entity_id, details(JSON)` — written for every
mutation (login/logout, alarm ack/resolve, WO create/update, user changes, settings).

### nodes — network assets & graph nodes
| col | type | notes |
|---|---|---|
| id | integer PK | |
| code | text UNIQUE | e.g. `CGS-01`, `DPRS-03`, `VLV-12` |
| name | text | |
| kind | text | `CGS` \| `DPRS` \| `IPRS` \| `CNG` \| `MRS` \| `VALVE` \| `JUNCTION` \| `ODORISER` |
| zone | text | `primary` \| `secondary` \| `tertiary` |
| status | text | `operational` \| `maintenance` \| `isolated` \| `faulty` \| `planned` |
| lat / lng | real | map coordinates (Nashik area) |
| gx / gy | real | graph layout coordinates |
| address, commissioned_on, notes | | |
| meta | text JSON | kind-specific attributes |

### station_detail (1:1 station-kind nodes)
`node_id PK, capacity_mmscfd, inlet_set_bar, outlet_set_bar, monitor_regulator,
slam_shut, odorizer, scada_rtu, last_inspection_on`

### segments — pipeline edges
`id, code, from_node FK, to_node FK, zone, material (steel|PE|MDPE|GI|copper),
diameter_mm, length_m, maop_bar, laid_on, status, route_name, shape JSON`
(`shape` = `{ map: [[lat,lng]…], graph: [[x,y]…] }`)

### valves
`id, code, segment_id FK, type (slam_shut|sectionalising|isolation|prv),
state (open|closed|throttled), lat, lng, last_exercised_on`

### consumers
`id, code, name, category (DOMESTIC|COMMERCIAL|INDUSTRIAL|CNG|INSTITUTIONAL),
status (active|pending|disconnected), node_id FK, lat, lng, address,
connected_on, approved_load_sm3h, meter_serial, tariff_group`

### readings — monthly meter billing
`id, consumer_id FK, period 'YYYY-MM', opening_idx, closing_idx, consumption_sm3,
amount, status (unpaid|paid|overdue), due_on, paid_on`
UNIQUE(consumer_id, period)

### telemetry — raw readings (simulator writes; 90-day retention)
`id, node_id FK, ts (epoch ms), pressure_bar, flow_sm3h, temp_c`
IDX(node_id, ts)

### telemetry_hourly — rollups for ≥ 24 h charts
`(node_id, hour_ts) PK, p_avg, p_max, p_min, f_avg, f_max, samples`

### alarms
`id, node_id FK, ts, type (OVER_PRESSURE|UNDER_PRESSURE|LEAK_SUSPECTED|COMM_LOSS|
VALVE_ANOMALY|HIGH_FLOW|LOW_FLOW), severity (info|warning|critical), message,
value, threshold, status (open|acknowledged|resolved), ack_by, ack_at,
resolved_at, note`
IDX(status, ts), IDX(node_id, ts)

### work_orders
`id, code UNIQUE (WO-YYYY-####), title, description, type (preventive|corrective|
inspection|leak_repair|construction), priority (low|medium|high|urgent),
status (open|assigned|in_progress|blocked|done|cancelled), node_id FK NULL,
segment_id FK NULL, assigned_to FK→users NULL, due_on, created_by, created_at,
closed_at`

### settings
`key PK, value JSON` — `company_name`, `simulator_enabled`, `simulator_interval_ms`,
`alarm_thresholds`, …

## Seeded demo data (Aurum Gas Grid, Nashik)

- **Nodes (≈28):** 2 CGS, 6 DPRS, 4 CNG, 1 MRS, 1 odoriser, ~10 valve/junction.
- **Segments (≈45):** steel primary ring (Ø 200–300 mm), PE secondary mains
  (Ø 110–160 mm), tertiary service stubs (Ø 32–63 mm).
- **Consumers (≈180)** across 5 categories with 6 months of readings/invoices.
- **Telemetry:** 90 days hourly history (rollups) + live simulator.
- **Alarms (≈140 historical, some open) · Work orders (≈40).**
- **Users:** `admin/admin123`, `operator/ops123`, `viewer/view123` (demo only).
