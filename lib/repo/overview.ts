import { desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  alarms,
  consumers,
  nodes,
  readings,
  settings,
  telemetry,
  telemetryHourly,
  workOrders,
  type AlarmStatus,
  type NodeStatus,
  type Severity,
  type Zone,
} from "@/lib/schema";
import { currentPeriod } from "@/lib/format";

export type Overview = {
  ts: number;
  kpis: {
    intakeSm3h: number;
    intakeDeltaPct: number | null;
    demandSm3h: number;
    demandDeltaPct: number | null;
    availabilityPct: number;
    nodesTotal: number;
    nodesDown: number;
    compliancePct: number;
    openAlarms: number;
    criticalAlarms: number;
    collectionsMtd: number;
    billedMtd: number;
    collectionPct: number;
    openWorkOrders: number;
  };
  demand24: { ts: number; intake: number; demand: number }[];
  zoneFlow: { zone: Zone; flow: number }[];
  consumerMix: { category: string; count: number }[];
  alarmTrend: { day: number; info: number; warning: number; critical: number }[];
  revenue: { period: string; billed: number; collected: number }[];
  feed: {
    id: number;
    ts: number;
    code: string;
    severity: Severity;
    message: string;
    status: AlarmStatus;
  }[];
  stations: {
    id: number;
    code: string;
    name: string;
    kind: string;
    zone: Zone;
    status: NodeStatus;
    p: number | null;
    f: number | null;
    ts: number | null;
  }[];
};

const STATION_KINDS = ["CGS", "DPRS", "CNG", "MRS"] as const;
const HOUR = 3_600_000;
const DAY = 86_400_000;

type Thresholds = {
  primary?: { over: number; under: number };
  secondary?: { over: number; under: number };
  tertiary?: { over: number; under: number };
};

export function getOverview(): Overview {
  const db = getDb();
  const now = Date.now();

  /* latest telemetry per station */
  const stationNodes = db
    .select()
    .from(nodes)
    .where(inArray(nodes.kind, [...STATION_KINDS]))
    .all();

  const stations: Overview["stations"] = stationNodes.map((n) => {
    const last = db
      .select({ ts: telemetry.ts, p: telemetry.pressureBar, f: telemetry.flowSm3h })
      .from(telemetry)
      .where(eq(telemetry.nodeId, n.id))
      .orderBy(desc(telemetry.ts))
      .limit(1)
      .get();
    return {
      id: n.id,
      code: n.code,
      name: n.name,
      kind: n.kind,
      zone: n.zone,
      status: n.status,
      p: last?.p ?? null,
      f: last?.f ?? null,
      ts: last?.ts ?? null,
    };
  });

  const intakeSm3h = stations
    .filter((s) => s.kind === "CGS")
    .reduce((sum, s) => sum + (s.f ?? 0), 0);
  const demandSm3h = stations
    .filter((s) => s.kind !== "CGS")
    .reduce((sum, s) => sum + (s.f ?? 0), 0);

  /* delta vs same hour yesterday (hourly rollups) */
  const hourTs = Math.floor(now / HOUR) * HOUR;
  const ydayHour = hourTs - 24 * HOUR;
  const ydayRows = db
    .select({ kind: nodes.kind, fAvg: telemetryHourly.fAvg })
    .from(telemetryHourly)
    .innerJoin(nodes, eq(nodes.id, telemetryHourly.nodeId))
    .where(eq(telemetryHourly.hourTs, ydayHour))
    .all();
  const ydayIntake = ydayRows
    .filter((r) => r.kind === "CGS")
    .reduce((s, r) => s + r.fAvg, 0);
  const ydayDemand = ydayRows
    .filter((r) => r.kind !== "CGS")
    .reduce((s, r) => s + r.fAvg, 0);
  const delta = (nowV: number, prev: number) =>
    prev > 0 ? Math.round(((nowV - prev) / prev) * 1000) / 10 : null;

  /* node availability */
  const statusCounts = db
    .select({ status: nodes.status, n: sql<number>`count(*)` })
    .from(nodes)
    .groupBy(nodes.status)
    .all();
  const nodesTotal = statusCounts.reduce((s, r) => s + r.n, 0);
  const nodesDown = statusCounts
    .filter((r) => r.status !== "operational")
    .reduce((s, r) => s + r.n, 0);
  const availabilityPct =
    nodesTotal > 0 ? Math.round(((nodesTotal - nodesDown) / nodesTotal) * 1000) / 10 : 100;

  /* pressure compliance against configured bands */
  const thRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "alarm_thresholds"))
    .get();
  const th = (thRow?.value ?? {}) as Thresholds;
  const measured = stations.filter((s) => s.p != null);
  const compliant = measured.filter((s) => {
    const band = th[s.zone];
    if (!band) return true;
    return s.p! >= band.under && s.p! <= band.over;
  });
  const compliancePct =
    measured.length > 0
      ? Math.round((compliant.length / measured.length) * 1000) / 10
      : 100;

  /* alarms */
  const alarmCounts = db
    .select({ status: alarms.status, severity: alarms.severity, n: sql<number>`count(*)` })
    .from(alarms)
    .where(inArray(alarms.status, ["open", "acknowledged"]))
    .groupBy(alarms.status, alarms.severity)
    .all();
  const openAlarms = alarmCounts
    .filter((r) => r.status === "open")
    .reduce((s, r) => s + r.n, 0);
  const criticalAlarms = alarmCounts
    .filter((r) => r.severity === "critical")
    .reduce((s, r) => s + r.n, 0);

  /* work orders open */
  const openWorkOrders =
    db
      .select({ n: sql<number>`count(*)` })
      .from(workOrders)
      .where(inArray(workOrders.status, ["open", "assigned", "in_progress", "blocked"]))
      .get()?.n ?? 0;

  /* collections this month */
  const period = currentPeriod();
  const billing = db
    .select({
      amount: readings.amount,
      status: readings.status,
    })
    .from(readings)
    .where(eq(readings.period, period))
    .all();
  const billedMtd = billing.reduce((s, r) => s + r.amount, 0);
  const collectionsMtd = billing
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amount, 0);
  const collectionPct =
    billedMtd > 0 ? Math.round((collectionsMtd / billedMtd) * 1000) / 10 : 0;

  /* 24 h demand / intake curve */
  const since = hourTs - 23 * HOUR;
  const hourly = db
    .select({
      hourTs: telemetryHourly.hourTs,
      kind: nodes.kind,
      fAvg: telemetryHourly.fAvg,
    })
    .from(telemetryHourly)
    .innerJoin(nodes, eq(nodes.id, telemetryHourly.nodeId))
    .where(gte(telemetryHourly.hourTs, since))
    .all();
  const byHour = new Map<number, { intake: number; demand: number }>();
  for (const r of hourly) {
    const cur = byHour.get(r.hourTs) ?? { intake: 0, demand: 0 };
    if (r.kind === "CGS") cur.intake += r.fAvg;
    else cur.demand += r.fAvg;
    byHour.set(r.hourTs, cur);
  }
  const demand24: Overview["demand24"] = [];
  for (let t = since; t <= hourTs; t += HOUR) {
    const v = byHour.get(t) ?? { intake: 0, demand: 0 };
    demand24.push({ ts: t, intake: Math.round(v.intake), demand: Math.round(v.demand) });
  }

  /* zone flow snapshot */
  const zoneMap = new Map<Zone, number>();
  for (const s of stations) {
    if (s.kind === "CGS") continue; // intake isn't "in" a downstream zone
    zoneMap.set(s.zone, (zoneMap.get(s.zone) ?? 0) + (s.f ?? 0));
  }
  const zoneFlow = [...zoneMap.entries()]
    .map(([zone, flow]) => ({ zone, flow: Math.round(flow) }))
    .sort((a, b) => b.flow - a.flow);

  /* active consumer mix */
  const consumerMix = db
    .select({ category: consumers.category, n: sql<number>`count(*)` })
    .from(consumers)
    .where(eq(consumers.status, "active"))
    .groupBy(consumers.category)
    .orderBy(desc(sql`count(*)`))
    .all()
    .map((r) => ({ category: r.category, count: r.n }));

  /* alarm trend last 14 days */
  const trendStart = Math.floor((now - 13 * DAY) / DAY) * DAY;
  const trendRows = db
    .select({
      day: sql<number>`${alarms.ts} / 86400000 * 86400000`,
      severity: alarms.severity,
      n: sql<number>`count(*)`,
    })
    .from(alarms)
    .where(gte(alarms.ts, trendStart))
    .groupBy(sql`${alarms.ts} / 86400000`, alarms.severity)
    .all();
  const trendMap = new Map<number, { info: number; warning: number; critical: number }>();
  for (let d = trendStart; d <= Math.floor(now / DAY) * DAY; d += DAY) {
    trendMap.set(d, { info: 0, warning: 0, critical: 0 });
  }
  for (const r of trendRows) {
    const bucket = trendMap.get(r.day);
    if (bucket) bucket[r.severity] += r.n;
  }
  const alarmTrend = [...trendMap.entries()]
    .map(([day, counts]) => ({ day, ...counts }))
    .sort((a, b) => a.day - b.day);

  /* revenue last 6 billing periods */
  const periods = db
    .selectDistinct({ period: readings.period })
    .from(readings)
    .orderBy(desc(readings.period))
    .limit(6)
    .all()
    .map((r) => r.period)
    .sort();
  const revenue: Overview["revenue"] = periods.map((p) => {
    const rows = db
      .select({ amount: readings.amount, status: readings.status })
      .from(readings)
      .where(eq(readings.period, p))
      .all();
    return {
      period: p,
      billed: Math.round(rows.reduce((s, r) => s + r.amount, 0)),
      collected: Math.round(
        rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0)
      ),
    };
  });

  /* alarm feed */
  const feedRows = db
    .select({
      id: alarms.id,
      ts: alarms.ts,
      code: nodes.code,
      severity: alarms.severity,
      message: alarms.message,
      status: alarms.status,
    })
    .from(alarms)
    .innerJoin(nodes, eq(nodes.id, alarms.nodeId))
    .where(inArray(alarms.status, ["open", "acknowledged"]))
    .orderBy(desc(alarms.ts))
    .limit(8)
    .all();

  return {
    ts: now,
    kpis: {
      intakeSm3h: Math.round(intakeSm3h),
      intakeDeltaPct: delta(intakeSm3h, ydayIntake),
      demandSm3h: Math.round(demandSm3h),
      demandDeltaPct: delta(demandSm3h, ydayDemand),
      availabilityPct,
      nodesTotal,
      nodesDown,
      compliancePct,
      openAlarms,
      criticalAlarms,
      collectionsMtd: Math.round(collectionsMtd),
      billedMtd: Math.round(billedMtd),
      collectionPct,
      openWorkOrders,
    },
    demand24,
    zoneFlow,
    consumerMix,
    alarmTrend,
    revenue,
    feed: feedRows,
    stations,
  };
}
