import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// `db:generate` needs no database; `db:migrate` and `db:studio` read DATABASE_URL.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
