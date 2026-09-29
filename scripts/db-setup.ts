/**
 * DB bootstrap CLI.
 *   tsx scripts/db-setup.ts            → migrate + seed (idempotent)
 *   tsx scripts/db-setup.ts --reset    → delete DB file, then migrate + seed
 */
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import * as schema from "../lib/schema";

const reset = process.argv.includes("--reset");
const dbFile = path.join(process.cwd(), "data", "gasnext.db");

if (reset) {
  for (const suffix of ["", "-wal", "-shm"]) {
    const f = dbFile + suffix;
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  console.log("• Removed existing database file(s)");
}

const db = getDb();
const count = (table: (typeof schema)[keyof typeof schema]) =>
  // @ts-expect-error dynamic table access for CLI reporting
  db.select({ n: sql<number>`count(*)` }).from(table).get()?.n ?? 0;

console.log("✓ Database ready at data/gasnext.db");
console.log(
  JSON.stringify(
    {
      users: count(schema.users),
      nodes: count(schema.nodes),
      segments: count(schema.segments),
      consumers: count(schema.consumers),
      readings: count(schema.readings),
      telemetry: count(schema.telemetry),
      telemetry_hourly: count(schema.telemetryHourly),
      alarms: count(schema.alarms),
      work_orders: count(schema.workOrders),
    },
    null,
    2
  )
);
