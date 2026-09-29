import { and, eq, ne, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { alarms, nodes, settings } from "@/lib/schema";
import type { LiveStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = getDb();

  const statusCounts = db
    .select({
      status: alarms.status,
      n: sql<number>`count(*)`,
    })
    .from(alarms)
    .where(ne(alarms.status, "resolved"))
    .groupBy(alarms.status)
    .all();

  const openAlarms = statusCounts
    .filter((r) => r.status === "open")
    .reduce((s, r) => s + r.n, 0);
  const ackAlarms = statusCounts
    .filter((r) => r.status === "acknowledged")
    .reduce((s, r) => s + r.n, 0);

  const openCritical =
    db
      .select({ n: sql<number>`count(*)` })
      .from(alarms)
      .where(and(eq(alarms.status, "open"), eq(alarms.severity, "critical")))
      .get()?.n ?? 0;

  const nodesDown =
    db
      .select({ n: sql<number>`count(*)` })
      .from(nodes)
      .where(ne(nodes.status, "operational"))
      .get()?.n ?? 0;

  const simRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "simulator_enabled"))
    .get();

  const payload: LiveStatus = {
    openAlarms,
    openCritical,
    ackAlarms,
    nodesDown,
    simulator: simRow ? Boolean(simRow.value) : false,
    ts: Date.now(),
  };
  return Response.json(payload);
}
