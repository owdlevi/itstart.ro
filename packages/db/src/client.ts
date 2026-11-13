import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

// Driver-agnostic, so the Postgres client and the PGlite test client are interchangeable.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDb(url: string): Db {
  return drizzle(url, { schema, casing: "snake_case" });
}
