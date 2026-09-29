import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  alarms,
  consumers,
  nodes,
  settings,
  stationDetail,
  telemetry,
  telemetryHourly,
  users,
  valves,
  workOrders,
  type AlarmStatus,
  type AlarmType,
  type NodeKind,
  type NodeStatus,
  type Severity,
  type WoStatus,
  type Zone,
} from "@/lib/schema";

const HOUR = 3_600_000;

export type StationRow = {
  id: number;
  code: string;
  name: string;
  kind: NodeKind;
  zone: Zone;
  status: NodeStatus;
  address: string | null;
  commissionedOn: number | null;
  p: number | null;
  f: number | null;
  ts: number | null;
  openAlarms: number;
  trend: number[]; // last 24 h of hourly fAvg (oldest → newest)
};

export type StationsRegister = {
  ts: number;
  rows: StationRow[];
};

export function getStationsRegister(): StationsRegister {
  const db = getDb();
  const nodeRows = db.select().from(nodes).orderBy(asc(nodes.code)).all();

  const latest = new Map<number, { p: number; f: number; ts: number }>();
  for (const r of db
    .select({
      nodeId: telemetry.nodeId,
      p: telemetry.pressureBar,
      f: telemetry.flowSm3h,
      ts: telemetry.ts,
    })
    .from(telemetry)
    .orderBy(desc(telemetry.ts))
    .limit(nodeRows.length * 4)
    .all()) {
    if (!latest.has(r.nodeId)) latest.set(r.nodeId, r);
  }

  const alarmMap = new Map(
    db
      .select({ nodeId: alarms.nodeId, n: sql<number>`count(*)` })
      .from(alarms)
      .where(eq(alarms.status, "open"))
      .groupBy(alarms.nodeId)
      .all()
      .map((r) => [r.nodeId, r.n] as const)
  );

  const since = Math.floor(Date.now() / HOUR) * HOUR - 23 * HOUR;
  const trendMap = new Map<number, number[]>();
  const hourlyRows = db
    .select({
      nodeId: telemetryHourly.nodeId,
      hourTs: telemetryHourly.hourTs,
      fAvg: telemetryHourly.fAvg,
    })
    .from(telemetryHourly)
    .where(gte(telemetryHourly.hourTs, since))
    .all();
  const byNode = new Map<number, Map<number, number>>();
  for (const r of hourlyRows) {
    const m = byNode.get(r.nodeId) ?? new Map<number, number>();
    m.set(r.hourTs, r.fAvg);
    byNode.set(r.nodeId, m);
  }
  for (const n of nodeRows) {
    const m = byNode.get(n.id);
    const arr: number[] = [];
    for (let t = since; t <= since + 23 * HOUR; t += HOUR) {
      arr.push(Math.round(m?.get(t) ?? 0));
    }
    trendMap.set(n.id, arr);
  }

  return {
    ts: Date.now(),
    rows: nodeRows.map((n) => {
      const l = latest.get(n.id);
      return {
        id: n.id,
        code: n.code,
        name: n.name,
        kind: n.kind,
        zone: n.zone,
        status: n.status,
        address: n.address,
        commissionedOn: n.commissionedOn,
        p: l?.p ?? null,
        f: l?.f ?? null,
        ts: l?.ts ?? null,
        openAlarms: alarmMap.get(n.id) ?? 0,
        trend: trendMap.get(n.id) ?? [],
      };
    }),
  };
}

/* ── station detail page ── */

export type StationAlarm = {
  id: number;
  ts: number;
  type: AlarmType;
  severity: Severity;
  message: string;
  status: AlarmStatus;
  value: number | null;
  threshold: number | null;
};

export type StationWo = {
  id: number;
  code: string;
  title: string;
  type: string;
  priority: string;
  status: WoStatus;
  dueOn: number | null;
  createdAt: number;
  assignee: string | null;
};

export type StationPage = {
  node: {
    id: number;
    code: string;
    name: string;
    kind: NodeKind;
    zone: Zone;
    status: NodeStatus;
    lat: number;
    lng: number;
    address: string | null;
    commissionedOn: number | null;
    notes: string | null;
  };
  detail: {
    capacityMmscfd: number | null;
    inletSetBar: number | null;
    outletSetBar: number | null;
    monitorRegulator: boolean;
    slamShut: boolean;
    odorizer: boolean;
    scadaRtu: boolean;
    lastInspectionOn: number | null;
  } | null;
  valve: { type: string; state: string; lastExercisedOn: number | null } | null;
  band: { over: number; under: number } | null;
  latest: { p: number; f: number; tempC: number; ts: number } | null;
  hourly24: { ts: number; p: number; f: number }[];
  alarms: StationAlarm[];
  workOrders: StationWo[];
  consumerCount: number;
};

export function getStationPage(id: number): StationPage | null {
  const db = getDb();
  const n = db.select().from(nodes).where(eq(nodes.id, id)).get();
  if (!n) return null;

  const det = db
    .select()
    .from(stationDetail)
    .where(eq(stationDetail.nodeId, id))
    .get();
  const valve = db.select().from(valves).where(eq(valves.nodeId, id)).get();

  const thRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "alarm_thresholds"))
    .get();
  const th = (thRow?.value ?? {}) as Record<
    string,
    { over: number; under: number } | undefined
  >;

  const last = db
    .select()
    .from(telemetry)
    .where(eq(telemetry.nodeId, id))
    .orderBy(desc(telemetry.ts))
    .limit(1)
    .get();

  const since = Math.floor(Date.now() / HOUR) * HOUR - 23 * HOUR;
  const hourlyRows = db
    .select({
      hourTs: telemetryHourly.hourTs,
      p: telemetryHourly.pAvg,
      f: telemetryHourly.fAvg,
    })
    .from(telemetryHourly)
    .where(and(eq(telemetryHourly.nodeId, id), gte(telemetryHourly.hourTs, since)))
    .orderBy(asc(telemetryHourly.hourTs))
    .all();
  const byHour = new Map(hourlyRows.map((r) => [r.hourTs, r]));
  const hourly24: StationPage["hourly24"] = [];
  for (let t = since; t <= since + 23 * HOUR; t += HOUR) {
    const r = byHour.get(t);
    hourly24.push({ ts: t, p: r ? Math.round(r.p * 100) / 100 : 0, f: r ? Math.round(r.f) : 0 });
  }

  const alarmRows = db
    .select()
    .from(alarms)
    .where(eq(alarms.nodeId, id))
    .orderBy(desc(alarms.ts))
    .limit(30)
    .all();

  const woRows = db
    .select({
      id: workOrders.id,
      code: workOrders.code,
      title: workOrders.title,
      type: workOrders.type,
      priority: workOrders.priority,
      status: workOrders.status,
      dueOn: workOrders.dueOn,
      createdAt: workOrders.createdAt,
      assignee: users.fullName,
    })
    .from(workOrders)
    .leftJoin(users, eq(users.id, workOrders.assignedTo))
    .where(eq(workOrders.nodeId, id))
    .orderBy(desc(workOrders.createdAt))
    .limit(30)
    .all();

  const consumerCount =
    db
      .select({ n: sql<number>`count(*)` })
      .from(consumers)
      .where(eq(consumers.nodeId, id))
      .get()?.n ?? 0;

  return {
    node: {
      id: n.id,
      code: n.code,
      name: n.name,
      kind: n.kind,
      zone: n.zone,
      status: n.status,
      lat: n.lat,
      lng: n.lng,
      address: n.address,
      commissionedOn: n.commissionedOn,
      notes: n.notes,
    },
    detail: det
      ? {
          capacityMmscfd: det.capacityMmscfd,
          inletSetBar: det.inletSetBar,
          outletSetBar: det.outletSetBar,
          monitorRegulator: det.monitorRegulator ?? false,
          slamShut: det.slamShut ?? false,
          odorizer: det.odorizer ?? false,
          scadaRtu: det.scadaRtu ?? false,
          lastInspectionOn: det.lastInspectionOn,
        }
      : null,
    valve: valve
      ? { type: valve.type, state: valve.state, lastExercisedOn: valve.lastExercisedOn }
      : null,
    band: th[n.zone] ?? null,
    latest: last
      ? { p: last.pressureBar, f: last.flowSm3h, tempC: last.tempC, ts: last.ts }
      : null,
    hourly24,
    alarms: alarmRows.map((a) => ({
      id: a.id,
      ts: a.ts,
      type: a.type,
      severity: a.severity,
      message: a.message,
      status: a.status,
      value: a.value,
      threshold: a.threshold,
    })),
    workOrders: woRows.map((w) => ({
      id: w.id,
      code: w.code,
      title: w.title,
      type: w.type,
      priority: w.priority,
      status: w.status,
      dueOn: w.dueOn,
      createdAt: w.createdAt,
      assignee: w.assignee,
    })),
    consumerCount,
  };
}
