# GasNext — System Design Document (SDA)

## 1. Architecture overview

```
┌─ Browser (localhost or private LAN) ─────────────────────────────┐
│  Client components: Recharts dashboards, React Flow topology,    │
│  Leaflet schematic map, forms/dialogs, 5 s live polling          │
└──────────────────────────┬───────────────────────────────────────┘
                           │ same-origin HTTP
┌──────────────────────────▼───────────────────────────────────────┐
│ Next.js server (Node runtime, App Router)                        │
│  • RSC pages (server-rendered, dynamic via session cookie)       │
│  • Route handlers /api/* (live reads; not cached by default)     │
│  • Server Actions (mutations: zod validation → role check →      │
│    write → audit log → refresh)                                  │
│  • Auth guard in app/(app)/layout.tsx (requireSession)           │
│  ──────────────────────────────────────────────────────────────  │
│  lib/db        Drizzle singleton over better-sqlite3 (WAL)       │
│  lib/repo      typed query functions (reads/aggregations)        │
│  lib/simulator lazy background daemon (telemetry + alarms)       │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                  data/gasnext.db  (SQLite 3 file, local disk)
```

## 2. Technology choices & rationale

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TS strict | RSC for fast dashboard SSR + server actions for simple mutations; single process |
| Styling | Tailwind CSS v4 (`@theme` CSS config) + shadcn/ui (radix-nova) | Design tokens mapped from DESIGN.md; owned component source |
| DB | SQLite 3 via `better-sqlite3` + Drizzle ORM | Zero-config local file, synchronous & fast, type-safe queries, drizzle-kit migrations |
| Charts | Recharts via shadcn `chart` wrappers | Native fit for shadcn styling; area/bar/donut/line |
| Topology | `@xyflow/react` (MIT) | Production-grade pan/zoom/select canvas with custom node/edge types |
| Map | `leaflet` + `react-leaflet`, **no tile layer** | CRS.Simple grid + GeoJSON boundary + polylines → offline by construction |
| Auth | `node:crypto` scrypt + SQLite `sessions` + httpOnly cookie | No native deps, LAN multi-user, no external service |
| Validation | zod (v4) | Shared client/server schemas for server actions |
| Icons | lucide-react | shadcn default |

## 3. Key design decisions

### 3.1 Data flow
- **Reads (live):** client hooks poll `/api/live/*` every 5 s (`useLivePoll`),
  responses are tiny JSON aggregates computed by `lib/repo`.
- **Reads (pages):** server components query SQLite directly at request time.
  The `(app)` layout reads `cookies()` → whole authenticated tree is dynamic.
- **Writes:** server actions in `lib/actions/*.ts`; each performs
  zod-parse → `requireRole()` → DB write → `audit()` → `refresh()` (Next 16) so the UI
  shows read-your-writes immediately.
- **Charts data:** hourly rollups (`telemetry_hourly`) for ≥ 24 h ranges; raw
  `telemetry` only for ≤ 24 h windows with bucketed SQL aggregation.

### 3.2 Telemetry simulator
- Singleton daemon in `lib/simulator.ts` guarded by `globalThis.__gasnext_simulator`,
  started once from the `(app)` server layout (works in dev with HMR and in `next start`).
- Every 3–5 s: writes pressure/flow/temperature for ~35 monitored nodes with
  zone-based setpoints, diurnal demand curves and bounded noise.
- Probabilistic alarm generation (pressure excursions, comm loss, high flow);
  auto-resolve of transient conditions.
- Hourly rollup job + 90-day raw retention pruning.
- Toggleable from Settings (persisted in `settings` table).

### 3.3 Topology & map coordinates
- Nodes carry **both** `lat/lng` (map) and `gx/gy` (graph layout) — seeded once,
  deterministic, no auto-layout dependency.
- Segments store `shape` JSON: map polyline `[[lat,lng]…]` and graph path points.

### 3.4 Security (local deployment posture)
- scrypt-hashed passwords (per-user salt), 128-bit session tokens, httpOnly+samesite
  cookies, session expiry (14 d) + revocation on logout.
- Role checks enforced server-side in every mutating action (UI hiding is secondary).
- Binding: `localhost` by default; LAN use documented as `npm run dev -- -H 0.0.0.0`
  for trusted private networks only.
- Audit trail for every control action.

### 3.5 Availability & robustness
- Single Node process; SQLite WAL allows concurrent reads while simulator writes.
- DB bootstrap (mkdir, migrate, auto-seed if empty) runs idempotently at server start,
  so a fresh checkout “just works”.
- Simulated failures are bounded: telemetry noise never exceeds physical limits;
  alarms deduplicated per node+type within a cooldown window.

## 4. Deployment

Local only: `npm run build && npm start` (or `npm run dev`). Data lives in
`data/gasnext.db` (gitignored; backup = copy the file). No cloud, no Docker.

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Native `better-sqlite3` under Turbopack | `serverExternalPackages: ['better-sqlite3']` in next.config |
| Leaflet SSR crash | `next/dynamic` with `ssr: false`, container rendered client-side |
| HMR duplicating simulator | `globalThis` singleton guard |
| Telemetry table growth | 90-day prune + hourly rollups (charts use rollups ≥ 24 h) |
| Build without network (fonts) | `next/font/google` downloads once at build, self-hosts thereafter |
