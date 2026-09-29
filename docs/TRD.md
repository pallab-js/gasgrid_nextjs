# GasNext — Technical Requirements Document (TRD)

## 1. Runtime & toolchain

| Item | Version / value |
|---|---|
| Node.js | ≥ 20.9 (tested on 20.20) |
| Next.js | 16.x (App Router, Turbopack dev+build) |
| React | 19.x |
| TypeScript | 5.x, `strict: true` |
| Tailwind CSS | 4.x (CSS-first `@theme`; no tailwind.config.js) |
| ESLint | 9 flat config (`eslint-config-next`), script `npm run lint` |
| Package manager | npm |
| SQLite | better-sqlite3 12.x, WAL mode |

## 2. Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (localhost:3000) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate migration from Drizzle schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:setup` | Migrate + seed (idempotent) |

## 3. Next.js 16 conventions used (version-matched)

- **Async request APIs only:** `await cookies()`, `await headers()`, `await params`,
  `await searchParams`. No synchronous access (removed in 16).
- **`LayoutProps<'/'>` / `PageProps<'/route'>`** generated type helpers for props.
- **Route handlers are not cached by default** — `/api/live/*` served fresh each hit.
- **Server actions** use `refresh()` from `next/cache` for read-your-writes UI updates.
- **`serverExternalPackages: ['better-sqlite3']`** at top level of `next.config.ts`.
- **ESLint via CLI** (`next lint` removed in 16); `next build` does not lint.
- **`middleware.ts` → `proxy.ts`** rename not needed (no proxy used).
- Fonts via `next/font` (self-hosted output; download happens once at build).

## 4. Design tokens (from DESIGN.md, toned down for ops UI)

Dark-only theme. `.dark` values are authoritative; `:root` mirrors them.

| Token | Value | Source |
|---|---|---|
| `--background` | `#0a0d3a` | canvas |
| `--card` | `#12164b` | raised indigo (derived) |
| `--popover` / `--secondary` / `--muted` / `--accent` | `#1e2353` | surface-indigo |
| `--primary` | `#5865f2` | Blurple |
| `--destructive` | `#ec48bd` | magenta (critical) |
| `--success` | `#35ed7e` | electric green (healthy/OK) |
| `--warning` | `#f0b429` | functional amber (severity semantics only) |
| `--link` / info | `#00b0f4` | link cyan |
| `--border` | `rgba(255,255,255,0.10)` | hairline, lifted for indigo canvas |
| radius | `--radius: 12px` → sm 6px, md ~10px, lg 12px | DESIGN.md rounded scale |
| Chart palette | blurple, green, magenta, cyan, amber | brand chord + functional amber |

Typography: **Geist Sans** (UI/body) + **Geist Mono** (numerals, codes, telemetry)
via `next/font` — self-hosted; substitutes for DESIGN.md's proprietary faces.
Sentence-case headings; display weight reserved for KPI numerals.

Spacing: 8 px base grid (4/8/12/16/20/24/32/40) — DESIGN.md spacing scale.

## 5. Component & state conventions

- shadcn components owned in `components/ui/` (radix-nova style); app components in
  `components/{shell,dashboard,network,map,ops,shared}`.
- Server components by default; `"use client"` only for interactivity (charts, graph,
  map, dialogs, polling hooks).
- Mutations exclusively through server actions (`lib/actions/*`), typed with zod.
- Live data via `useLivePoll(fetcher, intervalMs)` hook; SWR-like local cache in state.
- Toasts via sonner; loading via skeletons; empty states via shadcn `empty`.

## 6. Database requirements

- File: `data/gasnext.db`, `PRAGMA journal_mode=WAL`, `foreign_keys=ON`.
- Migrations: Drizzle Kit, committed in `drizzle/`; applied idempotently at boot.
- Indexes: `telemetry(node_id, ts)`, `telemetry_hourly(node_id, hour_ts)`,
  `alarms(status, ts)`, `alarms(node_id, ts)`, `readings(consumer_id, period)`.
- Retention: raw telemetry pruned after 90 days; rollups kept.

## 7. Performance budgets

| Metric | Budget |
|---|---|
| Authenticated dashboard TTFB (local) | < 400 ms |
| Dashboard fully interactive | < 1.5 s |
| `/api/live/overview` response | < 100 ms (indexed aggregates, capped scans) |
| Graph/map initial render (≈80 nodes, ≈45 edges) | < 1 s |
| Live poll interval | 5 s (dashboard), 3 s (node drawer) |

## 8. Testing & verification

- `npm run lint` — clean.
- `npm run typecheck` — clean.
- `npm run build` — clean production build.
- Manual smoke script (README): login (each role) → dashboard charts → graph node
  select → map marker → station detail → trend ranges → alarm ack → WO create →
  consumer detail → report → settings (admin) → logout; role-denial checks.

## 9. Known constraints

- `drizzle-kit` bundles an esbuild version with a *dev-only* moderate advisory
  (`npm audit`); runtime code is unaffected. Acceptable for local tooling.
- Telemetry is simulated; integration with real SCADA would replace
  `lib/simulator.ts` with a protocol adapter — schema stays unchanged.
