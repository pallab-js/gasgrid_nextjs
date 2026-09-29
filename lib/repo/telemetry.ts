import { and, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { telemetry, telemetryHourly } from "@/lib/schema";
import {
  RANGES,
  type Metric,
  type RangeKey,
  type TelemetrySeries,
} from "@/lib/telemetry-meta";

export {
  METRIC_META,
  RANGES,
  type Metric,
  type RangeKey,
  type TelemetrySeries,
} from "@/lib/telemetry-meta";

const HOUR = 3_600_000;
const MIN = 60_000;

export function getTelemetrySeries(
  nodeIds: number[],
  metric: Metric,
  range: RangeKey
): TelemetrySeries {
  const db = getDb();
  const hours = RANGES[range];
  const now = Date.now();
  const since = now - hours * HOUR;
  const ids = nodeIds.slice(0, 8);

  const bucketMs = hours <= 1 ? MIN : hours <= 24 ? 5 * MIN : HOUR;

  const col =
    metric === "p"
      ? telemetry.pressureBar
      : metric === "f"
        ? telemetry.flowSm3h
        : telemetry.tempC;

  // pressure/flow over long ranges come from the hourly rollup (temp has none)
  const useHourly = hours > 24 && metric !== "t";
  const start = useHourly
    ? Math.floor(since / HOUR) * HOUR
    : Math.floor(since / bucketMs) * bucketMs;

  type Row = { nodeId: number; bucket: number; v: number };
  let rows: Row[];
  let stats: TelemetrySeries["stats"];

  if (useHourly) {
    const agg = metric === "p" ? telemetryHourly.pAvg : telemetryHourly.fAvg;
    rows = db
      .select({
        nodeId: telemetryHourly.nodeId,
        bucket: telemetryHourly.hourTs,
        v: agg,
      })
      .from(telemetryHourly)
      .where(
        and(
          inArray(telemetryHourly.nodeId, ids),
          gte(telemetryHourly.hourTs, start)
        )
      )
      .all();

    const statRows = db
      .select({
        nodeId: telemetryHourly.nodeId,
        min:
          metric === "p"
            ? sql<number | null>`min(${telemetryHourly.pMin})`
            : sql<number | null>`min(${telemetryHourly.fAvg})`,
        max:
          metric === "p"
            ? sql<number | null>`max(${telemetryHourly.pMax})`
            : sql<number | null>`max(${telemetryHourly.fMax})`,
        avg: sql<number | null>`avg(${agg})`,
        n: sql<number>`sum(${telemetryHourly.samples})`,
      })
      .from(telemetryHourly)
      .where(
        and(
          inArray(telemetryHourly.nodeId, ids),
          gte(telemetryHourly.hourTs, start)
        )
      )
      .groupBy(telemetryHourly.nodeId)
      .all();
    stats = statRows.map((s) => ({
      nodeId: s.nodeId,
      min: s.min != null ? Math.round(s.min * 100) / 100 : null,
      max: s.max != null ? Math.round(s.max * 100) / 100 : null,
      avg: s.avg != null ? Math.round(s.avg * 100) / 100 : null,
      n: s.n,
    }));
  } else {
    const where = and(
      inArray(telemetry.nodeId, ids),
      gte(telemetry.ts, start)
    )!;
    rows = db
      .select({
        nodeId: telemetry.nodeId,
        bucket: sql<number>`${telemetry.ts} / ${bucketMs} * ${bucketMs}`.as(
          "bucket"
        ),
        v: sql<number>`avg(${col})`,
      })
      .from(telemetry)
      .where(where)
      .groupBy(telemetry.nodeId, sql`${telemetry.ts} / ${bucketMs}`)
      .all() as Row[];

    const statRows = db
      .select({
        nodeId: telemetry.nodeId,
        min: sql<number | null>`min(${col})`,
        max: sql<number | null>`max(${col})`,
        avg: sql<number | null>`avg(${col})`,
        n: sql<number>`count(*)`,
      })
      .from(telemetry)
      .where(where)
      .groupBy(telemetry.nodeId)
      .all();
    stats = statRows.map((s) => ({
      nodeId: s.nodeId,
      min: s.min != null ? Math.round(s.min * 100) / 100 : null,
      max: s.max != null ? Math.round(s.max * 100) / 100 : null,
      avg: s.avg != null ? Math.round(s.avg * 100) / 100 : null,
      n: s.n,
    }));
  }

  /* align into fixed buckets */
  const bucketStart = Math.floor(start / bucketMs) * bucketMs;
  const end = Math.floor(now / bucketMs) * bucketMs;
  const seriesMap = ids.map(() => new Map<number, number>());
  for (const r of rows) {
    const idx = ids.indexOf(r.nodeId);
    if (idx >= 0)
      seriesMap[idx].set(Math.floor(r.bucket / bucketMs) * bucketMs, r.v);
  }

  const points: TelemetrySeries["points"] = [];
  for (let t = bucketStart; t <= end; t += bucketMs) {
    points.push({
      ts: t,
      values: seriesMap.map((m) => {
        const v = m.get(t);
        return v == null ? null : Math.round(v * 100) / 100;
      }),
    });
  }

  return {
    bucketMs,
    nodeIds: ids,
    metric,
    range,
    points,
    stats: ids.map(
      (id) =>
        stats.find((s) => s.nodeId === id) ?? {
          nodeId: id,
          min: null,
          max: null,
          avg: null,
          n: 0,
        }
    ),
  };
}
