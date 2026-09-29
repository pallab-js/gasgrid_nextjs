import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "./data/gasnext.db",
  },
  strict: true,
  verbose: true,
});
