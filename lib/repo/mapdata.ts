import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { alarms, consumers, nodes, segments, telemetry } from "@/lib/schema";

export type MapNode = {
  id: number;
  code: string;
  name: string;
  kind: string;
  zone: string;
  status: string;
  lat: number;
  lng: number;
  openAlarms: number;
  p: number | null;
};

export type MapSegment = {
  id: number;
  zone: string;
  status: string;
  diameterMm: number;
  path: [number, number][];
};

export type MapConsumer = {
  id: number;
  lat: number;
  lng: number;
  category: string;
  status: string;
};

export type MapData = {
  ts: number;
  boundary: [number, number][];
  nodes: MapNode[];
  segments: MapSegment[];
  consumers: MapConsumer[];
  center: [number, number];
};

/** Deterministic pseudo-random blob around the network bbox — offline "city limit". */
function buildBoundary(
  points: { lat: number; lng: number }[]
): [number, number][] {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  const rLat = (maxLat - minLat) * 0.78;
  const rLng = (maxLng - minLng) * 0.78;

  const ring: [number, number][] = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const theta = (i / N) * Math.PI * 2;
    // stable wobble from integer sin hashes — same shape every request
    const wob =
      1 +
      0.14 * Math.sin(i * 2.7) +
      0.08 * Math.cos(i * 5.1 + 1.3) +
      0.05 * Math.sin(i * 9.7 + 0.6);
    ring.push([
      Math.round((cLat + rLat * wob * Math.sin(theta)) * 1e5) / 1e5,
      Math.round((cLng + rLng * wob * Math.cos(theta)) * 1e5) / 1e5,
    ]);
  }
  return ring;
}

export function getMapData(): MapData {
  const db = getDb();

  const nodeRows = db.select().from(nodes).orderBy(asc(nodes.id)).all();

  const latest = new Map<number, { p: number }>();
  const liveRows = db
    .select({ nodeId: telemetry.nodeId, p: telemetry.pressureBar })
    .from(telemetry)
    .orderBy(desc(telemetry.ts))
    .limit(nodeRows.length * 4)
    .all();
  for (const r of liveRows) if (!latest.has(r.nodeId)) latest.set(r.nodeId, r);

  const alarmCounts = db
    .select({ nodeId: alarms.nodeId, n: sql<number>`count(*)` })
    .from(alarms)
    .where(eq(alarms.status, "open"))
    .groupBy(alarms.nodeId)
    .all();
  const alarmMap = new Map(alarmCounts.map((r) => [r.nodeId, r.n]));

  const segRows = db.select().from(segments).all();
  const consumerRows = db
    .select({
      id: consumers.id,
      lat: consumers.lat,
      lng: consumers.lng,
      category: consumers.category,
      status: consumers.status,
    })
    .from(consumers)
    .where(eq(consumers.status, "active"))
    .all();

  const allPoints = [
    ...nodeRows.map((n) => ({ lat: n.lat, lng: n.lng })),
    ...consumerRows,
  ];

  const mNodes: MapNode[] = nodeRows.map((n) => ({
    id: n.id,
    code: n.code,
    name: n.name,
    kind: n.kind,
    zone: n.zone,
    status: n.status,
    lat: n.lat,
    lng: n.lng,
    openAlarms: alarmMap.get(n.id) ?? 0,
    p: latest.get(n.id)?.p ?? null,
  }));

  const mSegs: MapSegment[] = segRows
    .filter((s) => s.shape?.map?.length)
    .map((s) => ({
      id: s.id,
      zone: s.zone,
      status: s.status,
      diameterMm: s.diameterMm,
      path: s.shape!.map,
    }));

  const centerLat =
    mNodes.reduce((s, n) => s + n.lat, 0) / Math.max(mNodes.length, 1);
  const centerLng =
    mNodes.reduce((s, n) => s + n.lng, 0) / Math.max(mNodes.length, 1);

  return {
    ts: Date.now(),
    boundary: buildBoundary(allPoints),
    nodes: mNodes,
    segments: mSegs,
    consumers: consumerRows,
    center: [
      Math.round(centerLat * 1e5) / 1e5,
      Math.round(centerLng * 1e5) / 1e5,
    ],
  };
}
