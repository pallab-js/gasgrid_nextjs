"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { scryptHash } from "@/lib/password";
import { getDb } from "@/lib/db";
import { alarms, nodes, sessions, settings, users } from "@/lib/schema";
import { type Role } from "@/lib/schema";
import type { Thresholds } from "@/lib/repo/settings";

const ROLES: Role[] = ["admin", "operator", "viewer"];

function putSetting(key: string, value: unknown) {
  const db = getDb();
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export async function createUserAction(input: {
  username: string;
  fullName: string;
  password: string;
  role: Role;
}): Promise<void> {
  const admin = await requireRole("admin");
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new Error("VALIDATION: username must be 3–20 chars (a–z, 0–9, _)");
  }
  if (!input.fullName.trim()) {
    throw new Error("VALIDATION: full name is required");
  }
  if (input.password.length < 6) {
    throw new Error("VALIDATION: password must be at least 6 characters");
  }
  if (!ROLES.includes(input.role)) {
    throw new Error("VALIDATION: invalid role");
  }

  const db = getDb();
  const exists = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (exists) throw new Error("CONFLICT: username already exists");

  const row = db
    .insert(users)
    .values({
      username,
      fullName: input.fullName.trim(),
      passwordHash: scryptHash(input.password),
      role: input.role,
      active: true,
      createdAt: Date.now(),
    })
    .returning({ id: users.id })
    .get();

  audit(admin.id, "user.create", "user", row.id, { username, role: input.role });
  revalidatePath("/", "layout");
}

export async function updateUserAction(
  id: number,
  patch: { fullName: string; role: Role; active: boolean }
): Promise<void> {
  const admin = await requireRole("admin");
  if (!ROLES.includes(patch.role)) {
    throw new Error("VALIDATION: invalid role");
  }
  if (!patch.fullName.trim()) {
    throw new Error("VALIDATION: full name is required");
  }
  if (id === admin.id && (!patch.active || patch.role !== "admin")) {
    throw new Error("CONFLICT: cannot demote or deactivate your own account");
  }

  const db = getDb();
  const before = db.select().from(users).where(eq(users.id, id)).get();
  if (!before) throw new Error("NOT_FOUND: user does not exist");

  db.update(users)
    .set({
      fullName: patch.fullName.trim(),
      role: patch.role,
      active: patch.active,
    })
    .where(eq(users.id, id))
    .run();

  if (!patch.active) {
    db.delete(sessions).where(eq(sessions.userId, id)).run();
  }

  audit(admin.id, "user.update", "user", id, {
    username: before.username,
    roleFrom: before.role,
    roleTo: patch.role,
    active: patch.active,
  });
  revalidatePath("/", "layout");
}

export async function resetPasswordAction(
  id: number,
  password: string
): Promise<void> {
  const admin = await requireRole("admin");
  if (password.length < 6) {
    throw new Error("VALIDATION: password must be at least 6 characters");
  }
  const db = getDb();
  const before = db.select().from(users).where(eq(users.id, id)).get();
  if (!before) throw new Error("NOT_FOUND: user does not exist");

  db.update(users)
    .set({ passwordHash: scryptHash(password) })
    .where(eq(users.id, id))
    .run();
  db.delete(sessions).where(eq(sessions.userId, id)).run();

  audit(admin.id, "user.password_reset", "user", id, {
    username: before.username,
  });
  revalidatePath("/", "layout");
}

export async function saveThresholdsAction(th: Thresholds): Promise<void> {
  const admin = await requireRole("admin");
  const zones = ["primary", "secondary", "tertiary"] as const;
  for (const z of zones) {
    const band = th[z];
    if (
      !band ||
      typeof band.over !== "number" ||
      typeof band.under !== "number" ||
      band.over <= band.under ||
      band.under <= 0
    ) {
      throw new Error(`VALIDATION: invalid ${z} band (over must exceed under > 0)`);
    }
  }
  if (typeof th.high_flow_cgs !== "number" || th.high_flow_cgs <= 0) {
    throw new Error("VALIDATION: high flow threshold must be positive");
  }

  putSetting("alarm_thresholds", th);
  audit(admin.id, "settings.thresholds", "settings", "alarm_thresholds", {
    high_flow_cgs: th.high_flow_cgs,
  });
  revalidatePath("/", "layout");
}

export async function setSimulatorAction(input: {
  enabled?: boolean;
  intervalMs?: number;
}): Promise<void> {
  const admin = await requireRole("admin");
  if (input.enabled !== undefined) {
    putSetting("simulator_enabled", input.enabled);
  }
  if (input.intervalMs !== undefined) {
    if (
      !Number.isFinite(input.intervalMs) ||
      input.intervalMs < 1000 ||
      input.intervalMs > 60_000
    ) {
      throw new Error("VALIDATION: interval must be between 1000 and 60000 ms");
    }
    putSetting("simulator_interval_ms", Math.round(input.intervalMs));
  }
  audit(admin.id, "settings.simulator", "settings", "simulator", input);
  revalidatePath("/", "layout");
}

export async function injectTestAlarmAction(): Promise<void> {
  const admin = await requireRole("admin");
  const db = getDb();
  const node = db
    .select({ id: nodes.id, code: nodes.code })
    .from(nodes)
    .where(eq(nodes.kind, "CGS"))
    .orderBy(nodes.code)
    .get();
  if (!node) throw new Error("NOT_FOUND: no CGS node to attach the test alarm");

  const row = db
    .insert(alarms)
    .values({
      nodeId: node.id,
      ts: Date.now(),
      type: "HIGH_FLOW",
      severity: "critical",
      message: `TEST: injected from settings panel — ${node.code} simulated high flow`,
      value: 99999,
      threshold: 13500,
      status: "open",
    })
    .returning({ id: alarms.id })
    .get();

  audit(admin.id, "alarm.inject_test", "alarm", row.id, { nodeId: node.id });
  revalidatePath("/", "layout");
}
