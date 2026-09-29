import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  alarms,
  consumers,
  nodes,
  readings,
  stationDetail,
  telemetryHourly,
  workOrders,
} from "@/lib/schema";
import type { ConsumerCategory } from "@/lib/schema";

export type ReportPayload = {
  period: string;
  periods: string[];
  energy: {
    intakeSm3: number;
    deliveredSm3: number;
    ufgPct: number | null;
    avgDailySm3: number;
    avgDemandMmscfd: number;
  };
  categories: {
    category: ConsumerCategory;
    consumers: number;
    consumptionSm3: number;
    amount: number;
    sharePct: number;
  }[];
  revenue: {
    invoiced: number;
    collected: number;
    outstanding: number;
    collectionPct: number | null;
  };
  availability: {
    overallPct: number;
    nodes: {
      nodeId: number;
      code: string;
      name: string;
      hoursWithData: number;
      expectedHours: number;
      pct: number;
    }[];
  };
  alarmStats: {
    total: number;
    open: number;
    acknowledged: number;
    resolved: number;
    critical: number;
    warning: number;
    info: number;
    topNodes: { nodeId: number; code: string; count: number }[];
  };
  woStats: {
    created: number;
    done: number;
    cancelled: number;
    inFlight: number;
    byPriority: { priority: string; count: number }[];
  };
  generatedAt: number;
};

const HOUR = 3_600_000;
const DAY = 86_400_000;

function monthBounds(period: string): { from: number; to: number } {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(y, m - 1, 1).getTime();
  const to = new Date(y, m, 1).getTime();
  return { from, to };
}

export function availablePeriods(): string[] {
  const db = getDb();
  const rows = db
    .selectDistinct({ period: readings.period })
    .from(readings)
    .orderBy(desc(readings.period))
    .all();
  return rows.map((r) => r.period);
}

export function getReport(period: string): ReportPayload {
  const db = getDb();
  const { from, to } = monthBounds(period);
  const now = Date.now();
  const effectiveTo = Math.min(to, now);
  const elapsedDays = Math.max(1, Math.round((effectiveTo - from) / DAY));

  /* ── energy ── */
  const rRows = db
    .select({
      consumption: readings.consumptionSm3,
      amount: readings.amount,
      status: readings.status,
      category: consumers.category,
    })
    .from(readings)
    .innerJoin(consumers, eq(readings.consumerId, consumers.id))
    .where(eq(readings.period, period))
    .all();

  const flowByKind = db
    .select({
      kind: nodes.kind,
      sm3: sql<number>`sum(${telemetryHourly.fAvg})`,
    })
    .from(telemetryHourly)
    .innerJoin(nodes, eq(telemetryHourly.nodeId, nodes.id))
    .where(
      and(gte(telemetryHourly.hourTs, from), lt(telemetryHourly.hourTs, effectiveTo))
    )
    .groupBy(nodes.kind)
    .all();

  const consumptionSm3 = rRows.reduce((a, r) => a + r.consumption, 0);
  const intakeSm3 =
    flowByKind.find((f) => f.kind === "CGS")?.sm3 ?? 0;
  const deliveredSm3 = flowByKind
    .filter((f) => f.kind !== "CGS")
    .reduce((a, f) => a + f.sm3, 0);

  /* ── categories ── */
  const catMap = new Map<
    string,
    { consumers: number; consumptionSm3: number; amount: number }
  >();
  for (const r of rRows) {
    const e = catMap.get(r.category) ?? {
      consumers: 0,
      consumptionSm3: 0,
      amount: 0,
    };
    e.consumers += 1;
    e.consumptionSm3 += r.consumption;
    e.amount += r.amount;
    catMap.set(r.category, e);
  }
  const categories = [...catMap.entries()]
    .map(([cat, v]) => ({
      category: cat as ConsumerCategory,
      consumers: v.consumers,
      consumptionSm3: Math.round(v.consumptionSm3),
      amount: Math.round(v.amount),
      sharePct:
        consumptionSm3 > 0 ? (v.consumptionSm3 / consumptionSm3) * 100 : 0,
    }))
    .sort((a, b) => b.consumptionSm3 - a.consumptionSm3);

  /* ── revenue ── */
  const invoiced = rRows.reduce((a, r) => a + r.amount, 0);
  const collected = rRows.reduce(
    (a, r) => (r.status === "paid" ? a + r.amount : a),
    0
  );

  /* ── availability (RTU telemetry coverage) ── */
  const rtuNodes = db
    .select({ id: nodes.id, code: nodes.code, name: nodes.name })
    .from(nodes)
    .innerJoin(stationDetail, eq(stationDetail.nodeId, nodes.id))
    .where(eq(stationDetail.scadaRtu, true))
    .all();
  const hoursRows = db
    .select({
      nodeId: telemetryHourly.nodeId,
      hours: sql<number>`count(*)`,
    })
    .from(telemetryHourly)
    .where(
      and(gte(telemetryHourly.hourTs, from), lt(telemetryHourly.hourTs, effectiveTo))
    )
    .groupBy(telemetryHourly.nodeId)
    .all();
  const hoursMap = new Map(hoursRows.map((h) => [h.nodeId, h.hours]));
  const expectedHours = Math.max(1, Math.round((effectiveTo - from) / HOUR));
  const availNodes = rtuNodes.map((n) => {
    const hoursWithData = Math.min(hoursMap.get(n.id) ?? 0, expectedHours);
    return {
      nodeId: n.id,
      code: n.code,
      name: n.name,
      hoursWithData,
      expectedHours,
      pct: (hoursWithData / expectedHours) * 100,
    };
  });
  const overallPct =
    availNodes.length > 0
      ? availNodes.reduce((a, n) => a + n.pct, 0) / availNodes.length
      : 100;

  /* ── alarms ── */
  const aRows = db
    .select({
      nodeId: alarms.nodeId,
      severity: alarms.severity,
      status: alarms.status,
      code: nodes.code,
    })
    .from(alarms)
    .innerJoin(nodes, eq(alarms.nodeId, nodes.id))
    .where(and(gte(alarms.ts, from), lt(alarms.ts, to)))
    .all();

  const alarmStats = {
    total: aRows.length,
    open: aRows.filter((a) => a.status === "open").length,
    acknowledged: aRows.filter((a) => a.status === "acknowledged").length,
    resolved: aRows.filter((a) => a.status === "resolved").length,
    critical: aRows.filter((a) => a.severity === "critical").length,
    warning: aRows.filter((a) => a.severity === "warning").length,
    info: aRows.filter((a) => a.severity === "info").length,
    topNodes: [] as { nodeId: number; code: string; count: number }[],
  };
  const byNode = new Map<number, { code: string; count: number }>();
  for (const a of aRows) {
    const e = byNode.get(a.nodeId) ?? { code: a.code, count: 0 };
    e.count += 1;
    byNode.set(a.nodeId, e);
  }
  alarmStats.topNodes = [...byNode.entries()]
    .map(([nodeId, v]) => ({ nodeId, code: v.code, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  /* ── work orders ── */
  const wRows = db
    .select({ status: workOrders.status, priority: workOrders.priority })
    .from(workOrders)
    .where(and(gte(workOrders.createdAt, from), lt(workOrders.createdAt, to)))
    .all();

  const byPriorityMap = new Map<string, number>();
  for (const w of wRows)
    byPriorityMap.set(w.priority, (byPriorityMap.get(w.priority) ?? 0) + 1);

  const woStats = {
    created: wRows.length,
    done: wRows.filter((w) => w.status === "done").length,
    cancelled: wRows.filter((w) => w.status === "cancelled").length,
    inFlight: wRows.filter(
      (w) => !["done", "cancelled"].includes(w.status)
    ).length,
    byPriority: [...byPriorityMap.entries()]
      .map(([priority, count]) => ({ priority, count }))
      .sort((a, b) => b.count - a.count),
  };

  return {
    period,
    periods: availablePeriods(),
    energy: {
      intakeSm3: Math.round(intakeSm3),
      deliveredSm3: Math.round(deliveredSm3),
      ufgPct:
        intakeSm3 > 0
          ? ((intakeSm3 - deliveredSm3) / intakeSm3) * 100
          : null,
      avgDailySm3: Math.round(deliveredSm3 / elapsedDays),
      avgDemandMmscfd:
        Math.round((deliveredSm3 / elapsedDays / 1_000_000) * 1000) / 1000,
    },
    categories,
    revenue: {
      invoiced: Math.round(invoiced),
      collected: Math.round(collected),
      outstanding: Math.round(invoiced - collected),
      collectionPct: invoiced > 0 ? (collected / invoiced) * 100 : null,
    },
    availability: { overallPct, nodes: availNodes },
    alarmStats,
    woStats,
    generatedAt: now,
  };
}
