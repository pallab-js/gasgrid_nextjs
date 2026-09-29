"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { alarms } from "@/lib/schema";

async function setAlarmStatus(
  alarmId: number,
  status: "acknowledged" | "resolved",
  note?: string
) {
  const user = await requireRole("operator");
  const db = getDb();
  const alarm = db.select().from(alarms).where(eq(alarms.id, alarmId)).get();
  if (!alarm) throw new Error("NOT_FOUND: alarm does not exist");
  if (alarm.status === "resolved") {
    throw new Error("CONFLICT: alarm already resolved");
  }

  const now = Date.now();
  if (status === "acknowledged") {
    if (alarm.status === "acknowledged") return;
    db.update(alarms)
      .set({ status, ackBy: user.id, ackAt: now, note: note ?? alarm.note })
      .where(eq(alarms.id, alarmId))
      .run();
  } else {
    db.update(alarms)
      .set({
        status,
        resolvedAt: now,
        note: note ?? alarm.note,
        ackBy: alarm.ackBy ?? user.id,
        ackAt: alarm.ackAt ?? now,
      })
      .where(eq(alarms.id, alarmId))
      .run();
  }

  audit(user.id, status === "acknowledged" ? "alarm.ack" : "alarm.resolve", "alarm", alarmId, {
    type: alarm.type,
    nodeId: alarm.nodeId,
    note: note ?? null,
  });
  revalidatePath("/", "layout");
}

export async function ackAlarmAction(alarmId: number): Promise<void> {
  await setAlarmStatus(alarmId, "acknowledged");
}

export async function resolveAlarmAction(
  alarmId: number,
  note?: string
): Promise<void> {
  await setAlarmStatus(alarmId, "resolved", note);
}
