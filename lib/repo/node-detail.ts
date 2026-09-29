import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  alarms,
  nodes,
  settings,
  stationDetail,
  telemetry,
  users,
  valves,
  workOrders,
} from "@/lib/schema";
import type { AlarmStatus, AlarmType, Severity, WoStatus } from "@/lib/schema";

const HOUR = 3_600_000;

export type NodeDetailPayload = {
  node: {
    id: number;
    code: string;
    name: string;
    kind: string;
    zone: string;
    status: string;
    lat: number;
    lng: number;
    address: string | null;
    commissionedOn: number | null;
    notes: string | null;
  } | null;
  detail: {
    capacityMmscfd: number | null;
    inletSetBar: number | null;
    outletSetBar: number | null;
    slamShut: boolean;
    odorizer: boolean;
    scadaRtu: boolean;
    lastInspectionOn: number | null;
  } | null;
  valve: {
    type: string;
    state: string;
    lastExercisedOn: number | null;
  } | null;
  band: { over: number; under: number } | null;
  latest: { p: number; f: number; tempC: number; ts: number } | null;
  series: { ts: number; p: number; f: number }[];
  alarms: {
    id: number;
    ts: number;
    type: AlarmType;
    severity: Severity;
    message: string;
    status: AlarmStatus;
    value: number | null;
    threshold: number | null;
  }[];
  workOrders: {
    id: number;
    code: string;
    title: string;
    type: string;
    priority: string;
    status: WoStatus;
    dueOn: number | null;
    assignee: string | null;
  }[];
};

export function getNodeDetail(id: number): NodeDetailPayload | null {
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

  const now = Date.now();
  const since = Math.max(now - HOUR, (last?.ts ?? now) - HOUR);
  const series = db
    .select({
      bucket: sql<number>`${telemetry.ts} / 60000 * 60000`.as("bucket"),
      p: sql<number>`avg(${telemetry.pressureBar})`,
      f: sql<number>`avg(${telemetry.flowSm3h})`,
    })
    .from(telemetry)
    .where(and(eq(telemetry.nodeId, id), gte(telemetry.ts, since)))
    .groupBy(sql`${telemetry.ts} / 60000`)
    .orderBy(asc(sql`bucket`))
    .all()
    .map((r) => ({
      ts: r.bucket,
      p: Math.round(r.p * 100) / 100,
      f: Math.round(r.f),
    }));

  const nodeAlarms = db
    .select()
    .from(alarms)
    .where(eq(alarms.nodeId, id))
    .orderBy(desc(alarms.ts))
    .limit(8)
    .all()
    .filter((a) => a.status !== "resolved");

  const wos = db
    .select({
      id: workOrders.id,
      code: workOrders.code,
      title: workOrders.title,
      type: workOrders.type,
      priority: workOrders.priority,
      status: workOrders.status,
      dueOn: workOrders.dueOn,
      assignee: users.fullName,
    })
    .from(workOrders)
    .leftJoin(users, eq(users.id, workOrders.assignedTo))
    .where(eq(workOrders.nodeId, id))
    .orderBy(desc(workOrders.createdAt))
    .limit(5)
    .all();

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
          slamShut: det.slamShut ?? false,
          odorizer: det.odorizer ?? false,
          scadaRtu: det.scadaRtu ?? false,
          lastInspectionOn: det.lastInspectionOn,
        }
      : null,
    valve: valve
      ? {
          type: valve.type,
          state: valve.state,
          lastExercisedOn: valve.lastExercisedOn,
        }
      : null,
    band: th[n.zone] ?? null,
    latest: last
      ? { p: last.pressureBar, f: last.flowSm3h, tempC: last.tempC, ts: last.ts }
      : null,
    series,
    alarms: nodeAlarms.map((a) => ({
      id: a.id,
      ts: a.ts,
      type: a.type,
      severity: a.severity,
      message: a.message,
      status: a.status,
      value: a.value,
      threshold: a.threshold,
    })),
    workOrders: wos.map((w) => ({
      id: w.id,
      code: w.code,
      title: w.title,
      type: w.type,
      priority: w.priority,
      status: w.status,
      dueOn: w.dueOn,
      assignee: w.assignee,
    })),
  };
}
