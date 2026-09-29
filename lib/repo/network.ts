import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { alarms, nodes, segments, telemetry } from "@/lib/schema";
import type { NodeKind, NodeStatus, Zone } from "@/lib/schema";

export type NetworkNode = {
  id: number;
  code: string;
  name: string;
  kind: NodeKind;
  zone: Zone;
  status: NodeStatus;
  gx: number;
  gy: number;
  p: number | null;
  f: number | null;
  ts: number | null;
  openAlarms: number;
};

export type NetworkEdge = {
  id: number;
  code: string;
  from: number;
  to: number;
  zone: Zone;
  status: NodeStatus;
  diameterMm: number;
};

export type NetworkGraph = {
  ts: number;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
};

export function getNetwork(): NetworkGraph {
  const db = getDb();

  const nodeRows = db.select().from(nodes).all();

  const liveRows = db
    .select({
      nodeId: telemetry.nodeId,
      p: telemetry.pressureBar,
      f: telemetry.flowSm3h,
      ts: telemetry.ts,
    })
    .from(telemetry)
    .where(inArray(telemetry.nodeId, nodeRows.map((n) => n.id)))
    .orderBy(desc(telemetry.ts))
    .limit(nodeRows.length * 4)
    .all();
  const latest = new Map<number, { p: number; f: number; ts: number }>();
  for (const r of liveRows) {
    if (!latest.has(r.nodeId)) latest.set(r.nodeId, r);
  }

  const alarmCounts = db
    .select({ nodeId: alarms.nodeId, n: sql<number>`count(*)` })
    .from(alarms)
    .where(eq(alarms.status, "open"))
    .groupBy(alarms.nodeId)
    .all();
  const alarmMap = new Map(alarmCounts.map((r) => [r.nodeId, r.n]));

  const segRows = db
    .select({
      id: segments.id,
      code: segments.code,
      fromNode: segments.fromNode,
      toNode: segments.toNode,
      zone: segments.zone,
      status: segments.status,
      diameterMm: segments.diameterMm,
    })
    .from(segments)
    .all();

  return {
    ts: Date.now(),
    nodes: nodeRows.map((n) => {
      const l = latest.get(n.id);
      return {
        id: n.id,
        code: n.code,
        name: n.name,
        kind: n.kind,
        zone: n.zone,
        status: n.status,
        gx: n.gx,
        gy: n.gy,
        p: l?.p ?? null,
        f: l?.f ?? null,
        ts: l?.ts ?? null,
        openAlarms: alarmMap.get(n.id) ?? 0,
      };
    }),
    edges: segRows.map((s) => ({
      id: s.id,
      code: s.code,
      from: s.fromNode,
      to: s.toNode,
      zone: s.zone,
      status: s.status,
      diameterMm: s.diameterMm,
    })),
  };
}

/** Live node list only — cheap poll payload for graph/map badges. */
export function getLiveNodes(): Pick<NetworkGraph, "ts" | "nodes"> {
  const db = getDb();
  const nodeRows = db
    .select({
      id: nodes.id,
      status: nodes.status,
    })
    .from(nodes)
    .all();

  const liveRows = db
    .select({
      nodeId: telemetry.nodeId,
      p: telemetry.pressureBar,
      f: telemetry.flowSm3h,
      ts: telemetry.ts,
    })
    .from(telemetry)
    .orderBy(desc(telemetry.ts))
    .limit(nodeRows.length * 4)
    .all();
  const latest = new Map<number, { p: number; f: number; ts: number }>();
  for (const r of liveRows) {
    if (!latest.has(r.nodeId)) latest.set(r.nodeId, r);
  }

  const alarmCounts = db
    .select({ nodeId: alarms.nodeId, n: sql<number>`count(*)` })
    .from(alarms)
    .where(eq(alarms.status, "open"))
    .groupBy(alarms.nodeId)
    .all();
  const alarmMap = new Map(alarmCounts.map((r) => [r.nodeId, r.n]));

  const full = db.select().from(nodes).all();
  return {
    ts: Date.now(),
    nodes: full.map((n) => {
      const l = latest.get(n.id);
      return {
        id: n.id,
        code: n.code,
        name: n.name,
        kind: n.kind,
        zone: n.zone,
        status: n.status,
        gx: n.gx,
        gy: n.gy,
        p: l?.p ?? null,
        f: l?.f ?? null,
        ts: l?.ts ?? null,
        openAlarms: alarmMap.get(n.id) ?? 0,
      };
    }),
  };
}
