export type Metric = "p" | "f" | "t";

export const METRIC_META: Record<Metric, { label: string; unit: string }> = {
  p: { label: "Pressure", unit: "bar" },
  f: { label: "Flow", unit: "sm³/h" },
  t: { label: "Temperature", unit: "°C" },
};

export const RANGES = { "1h": 1, "24h": 24, "7d": 168, "30d": 720 } as const;
export type RangeKey = keyof typeof RANGES;

export type TelemetrySeries = {
  bucketMs: number;
  nodeIds: number[];
  metric: Metric;
  range: RangeKey;
  points: { ts: number; values: (number | null)[] }[];
  stats: {
    nodeId: number;
    min: number | null;
    max: number | null;
    avg: number | null;
    n: number;
  }[];
};
