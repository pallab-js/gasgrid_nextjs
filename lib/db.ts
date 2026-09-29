import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

export type Db = BetterSQLite3Database<typeof schema>;

const g = globalThis as unknown as {
  __gasnext_db?: Db;
  __gasnext_ready?: boolean;
};

export const DATA_DIR = path.join(process.cwd(), "data");
export const DB_FILE = path.join(DATA_DIR, "gasnext.db");
export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

function bootstrap(db: Db) {
  if (g.__gasnext_ready) return;
  const journal = path.join(MIGRATIONS_DIR, "meta", "_journal.json");
  if (fs.existsSync(journal)) {
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  }
  seedIfEmpty(db);
  g.__gasnext_ready = true;
}

export function getDb(): Db {
  if (!g.__gasnext_db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const sqlite = new Database(DB_FILE);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("synchronous = NORMAL");
    const db = drizzle(sqlite, { schema });
    bootstrap(db);
    g.__gasnext_db = db;
  }
  return g.__gasnext_db;
}
