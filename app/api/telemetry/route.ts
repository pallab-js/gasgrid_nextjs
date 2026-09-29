import { getCurrentUser } from "@/lib/auth";
import {
  getTelemetrySeries,
  type Metric,
  type RangeKey,
} from "@/lib/repo/telemetry";

export const dynamic = "force-dynamic";

const METRICS: Metric[] = ["p", "f", "t"];
const RANGES: RangeKey[] = ["1h", "24h", "7d", "30d"];

export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams;
  const ids = (q.get("nodeIds") ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 8);
  const metric = (q.get("metric") ?? "p") as Metric;
  const range = (q.get("range") ?? "24h") as RangeKey;

  if (!ids.length) {
    return Response.json({ error: "nodeIds required" }, { status: 400 });
  }
  if (!METRICS.includes(metric) || !RANGES.includes(range)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  return Response.json(getTelemetrySeries(ids, metric, range));
}
