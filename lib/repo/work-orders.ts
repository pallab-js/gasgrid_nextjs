import { aliasedTable, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { nodes, users, workOrders } from "@/lib/schema";
import type { WoStatus } from "@/lib/schema";

export type WoRow = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: WoStatus;
  nodeId: number | null;
  nodeCode: string | null;
  nodeName: string | null;
  assignee: string | null;
  dueOn: number | null;
  createdAt: number;
  createdBy: string | null;
  closedAt: number | null;
};

export type WorkOrdersBoard = {
  ts: number;
  rows: WoRow[];
  counts: Record<WoStatus, number>;
  assets: { id: number; code: string; name: string }[];
  users: { id: number; username: string; fullName: string }[];
};

const EMPTY_COUNTS: Record<WoStatus, number> = {
  open: 0,
  assigned: 0,
  in_progress: 0,
  blocked: 0,
  done: 0,
  cancelled: 0,
};

export function getWorkOrdersBoard(): WorkOrdersBoard {
  const db = getDb();
  const creator = aliasedTable(users, "creator");

  const rows = db
    .select({
      id: workOrders.id,
      code: workOrders.code,
      title: workOrders.title,
      description: workOrders.description,
      type: workOrders.type,
      priority: workOrders.priority,
      status: workOrders.status,
      nodeId: workOrders.nodeId,
      nodeCode: nodes.code,
      nodeName: nodes.name,
      assignee: users.username,
      dueOn: workOrders.dueOn,
      createdAt: workOrders.createdAt,
      createdBy: creator.username,
      closedAt: workOrders.closedAt,
    })
    .from(workOrders)
    .leftJoin(nodes, eq(workOrders.nodeId, nodes.id))
    .leftJoin(users, eq(workOrders.assignedTo, users.id))
    .leftJoin(creator, eq(workOrders.createdBy, creator.id))
    .orderBy(desc(workOrders.createdAt))
    .all();

  const counts = { ...EMPTY_COUNTS };
  for (const r of rows) counts[r.status] += 1;

  const assets = db
    .select({ id: nodes.id, code: nodes.code, name: nodes.name })
    .from(nodes)
    .orderBy(nodes.code)
    .all();

  const usersList = db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
    })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(users.username)
    .all();

  return { ts: Date.now(), rows, counts, assets, users: usersList };
}
