import fs from "node:fs";
import path from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import {
  DB_FILE,
  MIGRATIONS_DIR,
  getDb,
} from "@/lib/db";
import { auditLog, settings, users } from "@/lib/schema";
import type { Role } from "@/lib/schema";

export type Thresholds = {
  primary: { over: number; under: number };
  secondary: { over: number; under: number };
  tertiary: { over: number; under: number };
  high_flow_cgs: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  primary: { over: 30, under: 15 },
  secondary: { over: 5.5, under: 2.5 },
  tertiary: { over: 1.5, under: 0.4 },
  high_flow_cgs: 13500,
};

export type SettingsUser = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt: number;
};

export type AuditEntry = {
  id: number;
  ts: number;
  username: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
};

export type SettingsPage = {
  company: string;
  simulator: { enabled: boolean; intervalMs: number };
  thresholds: Thresholds;
  users: SettingsUser[];
  system: {
    dbPath: string;
    dbSizeBytes: number;
    migrationTag: string | null;
    appVersion: string;
    nextVersion: string;
    nodeVersion: string;
    counts: Record<string, number>;
  };
  audit: AuditEntry[];
};

function readSetting<T>(key: string, fallback: T): T {
  const row = getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  return (row?.value as T | undefined) ?? fallback;
}

function fileSize(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

export function getSettingsPage(): SettingsPage {
  const db = getDb();

  const userRows = db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.username)
    .all();

  const counts: Record<string, number> = {};
  const tableNames = [
    "nodes",
    "segments",
    "consumers",
    "alarms",
    "work_orders",
    "users",
    "sessions",
    "readings",
    "telemetry",
    "telemetry_hourly",
    "audit_log",
  ];
  for (const name of tableNames) {
    const row = db
      .get<{ n: number }>(
        sql`select count(*) as n from ${sql.identifier(name)}`
      );
    counts[name] = row?.n ?? 0;
  }

  let appVersion = "unknown";
  let nextVersion = "unknown";
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
    ) as { version?: string; dependencies?: Record<string, string> };
    appVersion = pkg.version ?? "0.0.0";
    nextVersion = pkg.dependencies?.next ?? "unknown";
  } catch {
    /* leave unknown */
  }

  let migrationTag: string | null = null;
  try {
    const journal = JSON.parse(
      fs.readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")
    ) as { entries?: { tag?: string }[] };
    migrationTag = journal.entries?.[journal.entries.length - 1]?.tag ?? null;
  } catch {
    /* no journal */
  }

  const dbSizeBytes =
    fileSize(DB_FILE) + fileSize(`${DB_FILE}-wal`) + fileSize(`${DB_FILE}-shm`);

  const auditRows = db
    .select({
      id: auditLog.id,
      ts: auditLog.ts,
      username: users.username,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      details: auditLog.details,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .orderBy(desc(auditLog.ts))
    .limit(100)
    .all();

  const thresholds = readSetting<Thresholds>(
    "alarm_thresholds",
    DEFAULT_THRESHOLDS
  );

  return {
    company: readSetting<string>("company_name", "Aurum Gas Grid Pvt. Ltd."),
    simulator: {
      enabled: readSetting<boolean>("simulator_enabled", true),
      intervalMs: readSetting<number>("simulator_interval_ms", 4000),
    },
    thresholds: {
      primary: thresholds.primary ?? DEFAULT_THRESHOLDS.primary,
      secondary: thresholds.secondary ?? DEFAULT_THRESHOLDS.secondary,
      tertiary: thresholds.tertiary ?? DEFAULT_THRESHOLDS.tertiary,
      high_flow_cgs:
        thresholds.high_flow_cgs ?? DEFAULT_THRESHOLDS.high_flow_cgs,
    },
    users: userRows,
    system: {
      dbPath: DB_FILE,
      dbSizeBytes,
      migrationTag,
      appVersion,
      nextVersion,
      nodeVersion: process.version,
      counts,
    },
    audit: auditRows,
  };
}
