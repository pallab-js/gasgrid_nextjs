# Graph Report - gasgrid_nextjs  (2026-10-31)

## Corpus Check
- 140 files · ~57,930 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 889 nodes · 2596 edges · 34 communities (33 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.92)
- Token cost: 10,520 input · 11,822 output

## Community Hubs (Navigation)
- Alarm Console & Network UI
- Consumer & Station Interfaces
- Docs, Design & CI
- App Shell & Navigation
- Database Schema & Domains
- Server Data Loaders
- Next.js Route Pages
- Browser Smoke Tests
- Telemetry Explorer & API
- Dashboard Charts
- Map & Node Visualization
- Simulation Engine
- User Menu & Avatar UI
- Database Access & Settings
- Seed Data & Bootstrap
- API Endpoints & Pages
- shadcn Component Config
- Package Manifest & Dependencies
- Authentication & Sessions
- Runtime Dependencies
- TypeScript Configuration
- Consumers Register Pages
- Development Dependencies
- Network & Map Data Models
- Root Layout & Providers
- NPM Scripts
- Stations Register Pages
- Empty State Components
- Reports Data & API
- Settings Page
- Alarms API Route
- Overview API Route
- ESLint Configuration
- PostCSS Configuration

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 60 edges
2. `cn` - 46 edges
3. `react` - 41 edges
4. `getCurrentUser()` - 34 edges
5. `AlarmsConsole()` - 33 edges
6. `next` - 33 edges
7. `SettingsView()` - 32 edges
8. `Button()` - 32 edges
9. `lucide-react` - 30 edges
10. `Card()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Toned-Down Design Tokens for Ops UI` --conceptually_related_to--> `ABC Ginto Nord Display Type`  [INFERRED]
  docs/TRD.md → DESIGN.md
- `AlarmsPage()` --calls--> `AlarmsConsole()`  [EXTRACTED]
  app/(app)/alarms/page.tsx → components/alarms/console.tsx
- `AlarmsPage()` --calls--> `getAlarmsPage()`  [EXTRACTED]
  app/(app)/alarms/page.tsx → lib/repo/alarms.ts
- `generateMetadata()` --calls--> `getConsumerDetail()`  [EXTRACTED]
  app/(app)/consumers/[id]/page.tsx → lib/repo/consumers.ts
- `ConsumerDetailPage()` --calls--> `getConsumerDetail()`  [EXTRACTED]
  app/(app)/consumers/[id]/page.tsx → lib/repo/consumers.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Live Telemetry Ingestion, Rollup and Polling Pipeline** — docs_sda_telemetry_simulator, docs_schema_telemetry_table, docs_schema_telemetry_hourly_table, docs_sda_telemetry_hourly_rollup, docs_sda_live_polling [EXTRACTED 1.00]
- **Offline-First Single-Machine Deployment Posture** — docs_prd_offline_first, docs_sda_system_design, docs_sda_sqlite_wal, docs_prd_f3_offline_schematic_map, readme_gasnext [EXTRACTED 1.00]
- **Operational Control Loop: Alarm to Work Order to Audit** — docs_prd_f6_alarm_console, docs_prd_f7_work_orders, docs_prd_f13_audit_log, docs_app_flow_operator_journey, docs_schema_alarms_table, docs_schema_work_orders_table [EXTRACTED 1.00]

## Communities (34 total, 1 thin omitted)

### Community 0 - "Alarm Console & Network UI"
Cohesion: 0.05
Nodes (87): AlarmsConsole(), KpiCard(), RANGES, SEV_DOT, SEVERITIES, LoginForm(), buildEdges(), buildNodes() (+79 more)

### Community 1 - "Consumer & Station Interfaces"
Cohesion: 0.07
Nodes (77): ConsumerDetail(), STATUS_TONE, ConsumersRegister(), STATUS_TONE, AlarmFeed(), DOT, KpiCard(), TONES (+69 more)

### Community 2 - "Docs, Design & CI"
Cohesion: 0.06
Nodes (46): Dependabot Configuration, Dependabot Update Groups (react, nextjs, ui, charts), Pinned Major-Version Ignores (typescript, eslint, better-sqlite3), Lint, Build and Smoke Job, CI Smoke Suite Matrix (nine scripts), GitHub Actions CI Workflow, Next.js Agent Rules Block, ABC Ginto Nord Display Type (+38 more)

### Community 3 - "App Shell & Navigation"
Cohesion: 0.07
Nodes (34): Clock(), format(), LivePill(), NAV, NavGroup, NavItem, titleForPath(), visibleNav() (+26 more)

### Community 4 - "Database Schema & Domains"
Cohesion: 0.05
Nodes (36): ALARM_STATUSES, ALARM_TYPES, AlarmRow, alarmsRelations, AuditRow, CONSUMER_CATEGORIES, CONSUMER_STATUSES, ConsumerRow (+28 more)

### Community 5 - "Server Data Loaders"
Cohesion: 0.11
Nodes (25): dynamic, GET(), AlarmConsoleRow, AlarmsPage, STATION_KINDS, Thresholds, StationAlarm, StationPage (+17 more)

### Community 6 - "Next.js Route Pages"
Cohesion: 0.14
Nodes (23): AlarmsPage(), dynamic, metadata, STATUSES, ConsumerDetailPage(), OverviewPage(), dynamic, metadata (+15 more)

### Community 7 - "Browser Smoke Tests"
Cohesion: 0.09
Nodes (17): playwright-core, launchBrowser(), btns, errors, errors, errors, cng01, errors (+9 more)

### Community 8 - "Telemetry Explorer & API"
Cohesion: 0.12
Nodes (20): dynamic, GET(), METRICS, RANGES, ExplorerNode, fmtAxis(), fmtTooltip(), METRICS (+12 more)

### Community 9 - "Dashboard Charts"
Cohesion: 0.18
Nodes (24): AlarmTrendChart(), ChartCard(), ConsumerDonut(), DemandAreaChart(), hourLabel(), RevenueChart(), ZONE_NAMES, ZoneFlowChart() (+16 more)

### Community 10 - "Map & Node Visualization"
Cohesion: 0.09
Nodes (21): dynamic, GET(), MapPage(), metadata, CATEGORY_COLOR, SchematicMap(), STATUS_CHIP, STATUS_DOT (+13 more)

### Community 11 - "Simulation Engine"
Cohesion: 0.19
Nodes (25): AppLayout(), getDb(), NodeRow, alarmMessage(), backfillGap(), balanceCgs(), between(), diurnal() (+17 more)

### Community 12 - "User Menu & Avatar UI"
Cohesion: 0.13
Nodes (11): ROLE_LABEL, UserMenu(), Avatar(), AvatarFallback(), DropdownMenu(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel() (+3 more)

### Community 13 - "Database Access & Settings"
Cohesion: 0.11
Nodes (19): resolveAlarmAction(), setAlarmStatus(), DATA_DIR, DB_FILE, g, MIGRATIONS_DIR, AuditEntry, DEFAULT_THRESHOLDS (+11 more)

### Community 14 - "Seed Data & Bootstrap"
Cohesion: 0.13
Nodes (22): bootstrap(), Db, between(), chunked(), CNG_NAMES, COMMERCIAL_NAMES, diurnal(), DOMESTIC_NAMES (+14 more)

### Community 15 - "API Endpoints & Pages"
Cohesion: 0.13
Nodes (17): dynamic, GET(), dynamic, GET(), dynamic, GET(), dynamic, GET() (+9 more)

### Community 16 - "shadcn Component Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 17 - "Package Manifest & Dependencies"
Cohesion: 0.09
Nodes (20): description, license, name, private, version, better-sqlite3, drizzle-kit, react-dom (+12 more)

### Community 18 - "Authentication & Sessions"
Cohesion: 0.15
Nodes (17): AuthFormState, logoutAction(), Attempt, attempts(), AuthResult, clearFailures(), lockoutRemaining(), login() (+9 more)

### Community 19 - "Runtime Dependencies"
Cohesion: 0.11
Nodes (19): dependencies, better-sqlite3, class-variance-authority, cn, drizzle-orm, leaflet, lucide-react, next (+11 more)

### Community 20 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 21 - "Consumers Register Pages"
Cohesion: 0.21
Nodes (11): dynamic, generateMetadata(), ConsumersPage(), dynamic, metadata, ConsumerDetail, ConsumerRow, ConsumersRegister (+3 more)

### Community 22 - "Development Dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, drizzle-kit, eslint, eslint-config-next, playwright-core, tailwindcss, @tailwindcss/postcss, tsx (+6 more)

### Community 23 - "Network & Map Data Models"
Cohesion: 0.18
Nodes (10): MapConsumer, MapNode, MapSegment, NetworkEdge, NetworkGraph, NetworkNode, consumers, segments (+2 more)

### Community 24 - "Root Layout & Providers"
Cohesion: 0.24
Nodes (8): geistMono, geistSans, metadata, RootLayout(), Toaster(), TooltipProvider(), next-themes, sonner

### Community 25 - "NPM Scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:generate, db:reset, db:setup, dev, lint, start (+2 more)

### Community 26 - "Stations Register Pages"
Cohesion: 0.25
Nodes (7): dynamic, metadata, StationsPage(), getStationsRegister(), StationsRegister, nextConfig, next

### Community 27 - "Empty State Components"
Cohesion: 0.25
Nodes (3): EmptyMedia(), emptyMediaVariants, class-variance-authority

### Community 28 - "Reports Data & API"
Cohesion: 0.46
Nodes (6): dynamic, GET(), availablePeriods(), getReport(), monthBounds(), ReportPayload

### Community 29 - "Settings Page"
Cohesion: 0.50
Nodes (4): dynamic, metadata, SettingsPage(), hasRole()

### Community 30 - "Alarms API Route"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getAlarmsPage()

### Community 31 - "Overview API Route"
Cohesion: 0.67
Nodes (3): dynamic, GET(), getOverview()

### Community 32 - "ESLint Configuration"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

## Knowledge Gaps
- **17 isolated node(s):** `react-dom`, `react-leaflet`, `shadcn`, `tw-animate-css`, `@tailwindcss/postcss` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 339 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn` connect `Alarm Console & Network UI` to `Consumer & Station Interfaces`, `App Shell & Navigation`, `Next.js Route Pages`, `Telemetry Explorer & API`, `Dashboard Charts`, `Map & Node Visualization`, `User Menu & Avatar UI`, `Package Manifest & Dependencies`, `Empty State Components`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `react-dom`, `react-leaflet`, `shadcn` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Alarm Console & Network UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05388961321164711 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Stations Register Pages` to `Alarm Console & Network UI`, `Consumer & Station Interfaces`, `App Shell & Navigation`, `Next.js Route Pages`, `Dashboard Charts`, `Map & Node Visualization`, `Database Access & Settings`, `API Endpoints & Pages`, `Package Manifest & Dependencies`, `Authentication & Sessions`, `Consumers Register Pages`, `Root Layout & Providers`, `Settings Page`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `Consumer & Station Interfaces` be split into smaller, more focused modules?**
  _Cohesion score 0.06777445855115757 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Alarm Console & Network UI` to `Consumer & Station Interfaces`, `App Shell & Navigation`, `Telemetry Explorer & API`, `Dashboard Charts`, `Map & Node Visualization`, `User Menu & Avatar UI`, `Package Manifest & Dependencies`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `Docs, Design & CI` be split into smaller, more focused modules?**
  _Cohesion score 0.05902980713033314 - nodes in this community are weakly interconnected._