import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { alarms, nodes, users } from "@/lib/schema";

export type AlarmConsoleRow = {
  id: number;
  ts: number;
  type: string;
  severity: string;
  message: string;
  value: number | null;
  threshold: number | null;
  status: string;
  note: string | null;
  nodeId: number;
  nodeCode: string;
  nodeName: string;
  ackBy: string | null;
  ackAt: number | null;
  resolvedAt: number | null;
};

export type AlarmsPage = {
  ts: number;
  rows: AlarmConsoleRow[];
  counts: { open: number; acknowledged: number; resolved: number; critical: number };
  filterNodes: { id: number; code: string; name: string }[];
};

export function getAlarmsPage(): AlarmsPage {
  const db = getDb();

  const rows = db
    .select({
      id: alarms.id,
      ts: alarms.ts,
      type: alarms.type,
      severity: alarms.severity,
      message: alarms.message,
      value: alarms.value,
      threshold: alarms.threshold,
      status: alarms.status,
      note: alarms.note,
      nodeId: alarms.nodeId,
      nodeCode: nodes.code,
      nodeName: nodes.name,
      ackBy: users.username,
      ackAt: alarms.ackAt,
      resolvedAt: alarms.resolvedAt,
    })
    .from(alarms)
    .innerJoin(nodes, eq(alarms.nodeId, nodes.id))
    .leftJoin(users, eq(alarms.ackBy, users.id))
    .orderBy(desc(alarms.ts))
    .limit(400)
    .all();

  const counts = { open: 0, acknowledged: 0, resolved: 0, critical: 0 };
  for (const r of rows) {
    if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
    if (r.status === "open" && r.severity === "critical") counts.critical += 1;
  }

  const filterNodes = db
    .select({ id: nodes.id, code: nodes.code, name: nodes.name })
    .from(nodes)
    .orderBy(nodes.code)
    .all();

  return { ts: Date.now(), rows, counts, filterNodes };
}
