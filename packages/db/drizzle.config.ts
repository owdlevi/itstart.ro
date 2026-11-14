import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// `db:generate` needs no database. `db:migrate` and `db:studio` prefer the direct
// (unpooled) URL, because Neon's pooler runs in transaction mode.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
});
