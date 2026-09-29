"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "cn";
import { fmtDec } from "@/lib/format";
import {
  METRIC_META,
  type Metric,
  type RangeKey,
  type TelemetrySeries,
} from "@/lib/telemetry-meta";

const METRICS: Metric[] = ["p", "f", "t"];
const RANGES: RangeKey[] = ["1h", "24h", "7d", "30d"];
const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function fmtAxis(ts: number, bucketMs: number) {
  const d = new Date(ts);
  if (bucketMs >= 86_400_000 || (bucketMs >= 3_600_000 && bucketMs % 86_400_000 !== 0)) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (ts - bucketMs < Date.now() - 3_600_000) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function fmtTooltip(ts: number) {
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

export type ExplorerNode = {
  id: number;
  code: string;
  name: string;
  kind: string;
};

export function TelemetryExplorer({
  nodes,
  initial,
}: {
  nodes: ExplorerNode[];
  initial: TelemetrySeries;
}) {
  const [selected, setSelected] = useState<number[]>(initial.nodeIds);
  const [metric, setMetric] = useState<Metric>(initial.metric);
  const [range, setRange] = useState<RangeKey>(initial.range);
  const [data, setData] = useState<TelemetrySeries>(initial);
  const [loading, setLoading] = useState(false);
  const [nodeQuery, setNodeQuery] = useState("");

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const reload = useCallback(
    async (ids: number[], m: Metric, r: RangeKey) => {
      if (!ids.length) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/telemetry?nodeIds=${ids.join(",")}&metric=${m}&range=${r}`,
          { cache: "no-store" }
        );
        if (res.ok) setData((await res.json()) as TelemetrySeries);
      } catch {
        /* transient */
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (selected.length) reload(selected, metric, range);
    }, 0);
    return () => clearTimeout(t);
  }, [selected, metric, range, reload]);

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 8
          ? prev
          : [...prev, id]
    );
  };

  const visibleNodes = useMemo(() => {
    const q = nodeQuery.trim().toLowerCase();
    return nodes.filter(
      (n) =>
        !q ||
        n.code.toLowerCase().includes(q) ||
        n.name.toLowerCase().includes(q)
    );
  }, [nodes, nodeQuery]);

  const meta = METRIC_META[metric];
  const rows = useMemo(() => {
    const points = data.points;
    const lastIdx = points.length ? points.length - 1 : -1;
    const cur =
      lastIdx >= 0
        ? points[lastIdx].values.map((v) => (v == null ? null : v))
        : [];
    const prevWindow =
      lastIdx >= 12 ? points.slice(Math.max(0, lastIdx - 12), lastIdx) : [];
    return data.nodeIds.map((id, i) => {
      const series = points.map((p) => p.values[i]);
      const numeric = series.filter((v): v is number => v != null);
      const prev = prevWindow
        .map((p) => p.values[i])
        .filter((v): v is number => v != null);
      const prevAvg = prev.length
        ? prev.reduce((a, b) => a + b, 0) / prev.length
        : null;
      const curV = cur[i] ?? null;
      const delta =
        prevAvg != null && curV != null && prevAvg !== 0
          ? ((curV - prevAvg) / Math.abs(prevAvg)) * 100
          : null;
      return { id, i, cur: curV, delta, n: numeric.length };
    });
  }, [data]);

  const chart = data.points.map((p) => {
    const row: Record<string, number | null> = { t: p.ts };
    p.values.forEach((v, i) => (row[`n${data.nodeIds[i]}`] = v));
    return row;
  });

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            {METRICS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  metric === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {METRIC_META[m].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  range === r
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto gap-2">
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Assets ({selected.length}/8)
                <ChevronDown className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-2">
              <Input
                value={nodeQuery}
                onChange={(e) => setNodeQuery(e.target.value)}
                placeholder="Filter assets…"
                className="mb-2 h-8 text-xs"
              />
              <div className="max-h-72 overflow-y-auto">
                {visibleNodes.map((n) => {
                  const checked = selected.includes(n.id);
                  return (
                    <label
                      key={n.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-secondary"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && selected.length >= 8}
                        onChange={() => toggle(n.id)}
                        className="accent-primary"
                      />
                      <span className="font-mono text-muted-foreground">{n.code}</span>
                      <span className="truncate">{n.name}</span>
                    </label>
                  );
                })}
                {visibleNodes.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">No matches.</p>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* selected badges */}
      <div className="flex flex-wrap gap-1.5">
        {selected.map((id) => {
          const n = nodeById.get(id);
          const idx = data.nodeIds.indexOf(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                "border-border bg-secondary hover:border-destructive/50"
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background:
                    idx >= 0 ? SERIES_COLORS[idx % SERIES_COLORS.length] : "var(--border)",
                }}
              />
              <span className="font-mono">{n?.code ?? `#${id}`}</span>
              <X className="size-3 text-muted-foreground" />
            </button>
          );
        })}
        {selected.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Select at least one asset to plot.
          </p>
        ) : null}
      </div>

      {/* chart */}
      <Card>
        <CardHeader>
          <CardTitle>
            {meta.label} · {data.range.toUpperCase()}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {meta.unit}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            {selected.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ left: -8, right: 8, top: 6 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v: number) => fmtAxis(v, data.bucketMs)}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={48}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v: number) =>
                      Math.abs(v) >= 1000
                        ? `${(v / 1000).toFixed(1)}k`
                        : `${v}`
                    }
                  />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "4 4" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => fmtTooltip(Number(v))}
                    formatter={(value, name) => {
                      const id = String(name).replace("n", "");
                      const n = nodeById.get(Number(id));
                      return [
                        `${Number(value).toLocaleString("en-IN")} ${meta.unit}`,
                        n ? `${n.code} ${n.name}` : id,
                      ];
                    }}
                  />
                  {data.nodeIds.map((id, i) => (
                    <Line
                      key={id}
                      dataKey={`n${id}`}
                      type="monotone"
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No assets selected.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* stats */}
      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Asset</th>
                  <th className="py-2 pr-4 text-right font-medium">Now</th>
                  <th className="py-2 pr-4 text-right font-medium">Min</th>
                  <th className="py-2 pr-4 text-right font-medium">Max</th>
                  <th className="py-2 pr-4 text-right font-medium">Avg</th>
                  <th className="py-2 text-right font-medium">Samples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const n = nodeById.get(r.id);
                  const s = data.stats.find((x) => x.nodeId === r.id);
                  const idx = data.nodeIds.indexOf(r.id);
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-4">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                          style={{
                            background:
                              idx >= 0
                                ? SERIES_COLORS[idx % SERIES_COLORS.length]
                                : "var(--border)",
                          }}
                        />
                        <span className="font-mono">{n?.code}</span>{" "}
                        <span className="text-muted-foreground">{n?.name}</span>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono tnum">
                        {r.cur != null ? fmtDec(r.cur) : "—"}
                        {r.delta != null ? (
                          <span
                            className={cn(
                              "ml-1.5 text-[10px]",
                              r.delta >= 0 ? "text-success" : "text-warning"
                            )}
                          >
                            {r.delta >= 0 ? "▲" : "▼"}
                            {Math.abs(r.delta).toFixed(1)}%
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono tnum">
                        {s?.min != null ? fmtDec(s.min) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono tnum">
                        {s?.max != null ? fmtDec(s.max) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono tnum">
                        {s?.avg != null ? fmtDec(s.avg) : "—"}
                      </td>
                      <td className="py-2 text-right font-mono tnum text-muted-foreground">
                        {s?.n.toLocaleString("en-IN") ?? 0}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No data for this selection.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {data.points.length} points at {data.bucketMs >= 3_600_000 ? `${Math.round(data.bucketMs / 3_600_000)}h` : `${Math.round(data.bucketMs / 60000)}m`} resolution
            {" · "}
            pressure &amp; flow beyond 24 h come from hourly rollups
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
