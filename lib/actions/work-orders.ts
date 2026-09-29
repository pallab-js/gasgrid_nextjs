"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { nodes, workOrders } from "@/lib/schema";
import {
  PRIORITIES,
  WO_STATUSES,
  WO_TYPES,
  type Priority,
  type WoStatus,
  type WoType,
} from "@/lib/schema";
import { TERMINAL_WO as TERMINAL, WO_NEXT as NEXT } from "@/lib/wo-status";

export type WorkOrderInput = {
  title: string;
  description?: string;
  type: WoType;
  priority: Priority;
  nodeId?: number | null;
  assignedTo?: number | null;
  dueOn?: number | null;
};

function assertEnums(type: string, priority: string) {
  if (!WO_TYPES.includes(type as WoType)) {
    throw new Error("VALIDATION: invalid work order type");
  }
  if (!PRIORITIES.includes(priority as Priority)) {
    throw new Error("VALIDATION: invalid priority");
  }
}

export async function createWorkOrderAction(input: WorkOrderInput): Promise<void> {
  const user = await requireRole("operator");
  const title = input.title?.trim();
  if (!title) throw new Error("VALIDATION: title is required");
  assertEnums(input.type, input.priority);

  const db = getDb();
  const year = new Date().getFullYear();
  const existing = db
    .select({ code: workOrders.code })
    .from(workOrders)
    .orderBy(asc(workOrders.code))
    .all();
  let seq = 1;
  for (const r of existing) {
    const m = /^WO-(\d{4})-(\d{4})$/.exec(r.code);
    if (m && Number(m[1]) === year) seq = Math.max(seq, Number(m[2]) + 1);
  }
  const code = `WO-${year}-${String(seq).padStart(4, "0")}`;

  const nodeId = input.nodeId ?? null;
  if (nodeId != null) {
    const n = db.select({ id: nodes.id }).from(nodes).where(eq(nodes.id, nodeId)).get();
    if (!n) throw new Error("VALIDATION: asset does not exist");
  }

  const now = Date.now();
  const assignedTo = input.assignedTo ?? null;
  const row = db
    .insert(workOrders)
    .values({
      code,
      title,
      description: input.description?.trim() || null,
      type: input.type,
      priority: input.priority,
      status: assignedTo ? "assigned" : "open",
      nodeId,
      assignedTo,
      dueOn: input.dueOn ?? null,
      createdBy: user.id,
      createdAt: now,
    })
    .returning({ id: workOrders.id })
    .get();

  audit(user.id, "wo.create", "work_order", row.id, {
    code,
    priority: input.priority,
    nodeId,
  });
  revalidatePath("/", "layout");
}

export type WorkOrderPatch = WorkOrderInput & { status?: WoStatus };

export async function updateWorkOrderAction(
  id: number,
  patch: WorkOrderPatch
): Promise<void> {
  const user = await requireRole("operator");
  const db = getDb();
  const before = db.select().from(workOrders).where(eq(workOrders.id, id)).get();
  if (!before) throw new Error("NOT_FOUND: work order does not exist");

  const title = patch.title?.trim();
  if (!title) throw new Error("VALIDATION: title is required");
  assertEnums(patch.type, patch.priority);

  if (patch.status && !WO_STATUSES.includes(patch.status)) {
    throw new Error("VALIDATION: invalid status");
  }
  if (
    patch.status &&
    patch.status !== before.status &&
    !NEXT[before.status].includes(patch.status)
  ) {
    throw new Error(
      `CONFLICT: cannot move from ${before.status} to ${patch.status}`
    );
  }

  const status = patch.status ?? before.status;
  const becameTerminal = TERMINAL.includes(status) && !TERMINAL.includes(before.status);
  const leftTerminal =
    !TERMINAL.includes(status) && TERMINAL.includes(before.status);

  db.update(workOrders)
    .set({
      title,
      description: patch.description?.trim() || null,
      type: patch.type,
      priority: patch.priority,
      nodeId: patch.nodeId ?? null,
      assignedTo: patch.assignedTo ?? null,
      dueOn: patch.dueOn ?? null,
      status,
      closedAt: becameTerminal
        ? Date.now()
        : leftTerminal
          ? null
          : before.closedAt,
    })
    .where(eq(workOrders.id, id))
    .run();

  audit(user.id, "wo.update", "work_order", id, {
    code: before.code,
    statusFrom: before.status,
    statusTo: status,
  });
  revalidatePath("/", "layout");
}
