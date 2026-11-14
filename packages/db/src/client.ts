import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Pool } from "pg";
import * as schema from "./schema";

// Driver-agnostic, so the Postgres client and the PGlite test client are interchangeable.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** A URL for scripts; a `Pool` when the caller owns it (apps/web registers it with `attachDatabasePool`). */
export function createDb(client: string | Pool): Db {
  return typeof client === "string"
    ? drizzle(client, { schema, casing: "snake_case" })
    : drizzle({ client, schema, casing: "snake_case" });
}
