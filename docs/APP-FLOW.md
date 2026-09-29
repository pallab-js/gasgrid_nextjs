# GasNext — Application Flow

## 1. Information architecture

```
/login                          public
└─ (auth success) → redirect to `/`

(app) shell                     authenticated (session cookie required)
├─ /                Overview dashboard
├─ /network         Topology graph view
├─ /map             Offline schematic map
├─ /stations        Asset register
│   └─ /stations/[id]
├─ /telemetry       Trends explorer
├─ /alarms          Alarm console
├─ /work-orders     Work order board
├─ /consumers       Consumer register
│   └─ /consumers/[id]
├─ /reports         Monthly ops reports
└─ /settings        Admin: users, thresholds, simulator, system   [admin]
```

**Sidebar sections:** Monitor (Overview, Network, Map, Telemetry) · Operations
(Alarms, Work orders, Stations) · Commercial (Consumers, Reports) · System (Settings).

**Topbar:** page title/breadcrumb · live status pill (poll state + open critical
count) · clock · user menu (role badge, logout).

## 2. Page-level flows

### 2.1 Login
1. Enter username/password → server action validates (scrypt) → session row + cookie.
2. `viewer/operator` → `/`; `admin` → `/` (Settings gated by nav visibility).
3. Invalid credentials → inline error; expired session → redirect `/login?next=…`.

### 2.2 Overview dashboard (F1)
- KPI cards: gas intake today (SCMD), consumption today, network availability %,
  open critical alarms, pressure compliance %, collections (₹, MTD) — each with delta
  vs yesterday/last period.
- Charts: 24 h intake vs consumption (area), zone-wise flow (bar), consumer mix
  (donut), 14-day alarm trend (stacked bar), revenue vs collection (bar).
- Right rail: live alarm feed (severity-sorted, click → alarm page with filter).
- Client polls `/api/live/overview` every 5 s; charts re-render smoothly.

### 2.3 Network graph (F2)
- React Flow canvas: nodes (kind icon, code, name, status ring, zone tint), edges
  (zone color; dashed if segment under maintenance; red if isolated).
- Toolbar: zone filter (primary/secondary/tertiary), status filter, search node,
  fit-view, legend.
- Click node → right drawer: live gauge (current pressure + setpoints), 1 h
  sparkline, open alarms (ack button if permitted), linked work orders, quick links
  (station detail, center on map).
- Drawer polls `/api/live/nodes/[id]` every 3 s while open.

### 2.4 Map (F3)
- Leaflet CRS.Simple canvas with grid background, city boundary polygon, pipeline
  polylines (zone colors, width by diameter), markers per asset (status colors),
  consumer dots (clustered by zoom).
- Layer toggles: pipelines · stations · consumers · boundaries.
- Marker click → same drawer as graph view (shared component).

### 2.5 Stations (F4)
- Register: search, filters (kind, zone, status), sortable table with status badge,
  last reading, mini trend.
- Detail: header (status, zone, commissioned) · gauge row (inlet/outlet/setpoint) ·
  24 h pressure/flow chart · station config (capacity, regulators, slam-shut) ·
  events (alarms) tab · work orders tab.

### 2.6 Telemetry explorer (F5)
- Node multi-select (searchable), metric toggles (pressure/flow/temp),
  range buttons 1 h / 24 h / 7 d / 30 d, crosshair tooltip, table of min/max/avg.

### 2.7 Alarms (F6)
- Tabs: Open · Acknowledged · Resolved. Filters: severity, type, node, date range.
- Row: severity dot + type, node code, message, value/threshold, time, actions.
- Actions (operator+): Acknowledge → `acknowledged`; Resolve (note) → `resolved`;
  both audited. Viewer sees actions disabled with tooltip “Operator role required”.

### 2.8 Work orders (F7)
- List/board grouped by status; create dialog (title, type, priority, asset,
  assignee, due date, description); status transitions: open → assigned →
  in_progress → done (or cancelled); edit + close audited.

### 2.9 Consumers (F8)
- Register: category/status filters, search by name/code/meter, pagination.
- Detail: connection info, meter + latest reading, 12-month consumption bar chart,
  invoice table with paid/unpaid/overdue badges.

### 2.10 Reports (F9)
- Period picker (month) → sections: energy balance, category consumption, revenue vs
  collection, network availability, alarm & WO stats. CSV export per section.

### 2.11 Settings (F10, admin)
- Users: create/edit/deactivate, role select, reset password.
- Thresholds: per alarm-type limits (over/under pressure, high flow).
- Simulator: enable/disable, tick interval, “inject test alarm” button.
- System: DB path/size, row counts, last migration, app version.

## 3. Cross-cutting states

- **Loading:** route-level `loading.tsx` skeletons for each section.
- **Empty:** shadcn `empty` with explanatory copy + primary action where applicable.
- **Error:** `error.tsx` boundaries per segment with retry; action failures → sonner
  toast (destructive) + field-level errors on forms.
- **Permission denied:** read-only UI + server-side rejection (toast on attempt).
- **Offline/local:** live pill shows polling health; degraded polling still renders
  last-known data with stale badge.

## 4. Key user journey (happy path)

Operator logs in → dashboard shows critical alarm badge → clicks alarm in feed →
lands on Alarms (open tab) → “View asset” → station detail shows pressure spike →
Acknowledge → Create work order (urgent, assigned to field team) → supervisor sees
it on Work orders board → status moves to in progress → done → audit log records
every step → monthly report reflects downtime.
