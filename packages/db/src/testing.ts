import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "./client";
import * as schema from "./schema";

const migrationsFolder = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

/** A fresh in-memory Postgres with every migration applied. One per test keeps tests isolated. */
export async function createTestDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder });
  return db;
}
