import "server-only";
import { getDb } from "./db";
import { auditLog } from "./schema";

export function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId: string | number | null = null,
  details?: Record<string, unknown>
) {
  getDb()
    .insert(auditLog)
    .values({
      ts: Date.now(),
      userId,
      action,
      entity,
      entityId: entityId === null ? null : String(entityId),
      details: details ?? null,
    })
    .run();
}
