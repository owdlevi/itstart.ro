import { existsSync } from "node:fs";
import { Pool } from "pg";
import { createDb, type Db } from "../src/client";

/**
 * Runs `fn` against the database in `.env.local` (or the environment), over the
 * direct URL when there is one, then closes the connection.
 */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL.");
  const pool = new Pool({ connectionString: url });
  try {
    return await fn(createDb(pool));
  } finally {
    await pool.end();
  }
}
