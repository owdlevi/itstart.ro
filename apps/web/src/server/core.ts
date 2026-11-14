import "server-only";
import { createDb } from "@repo/db";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { createAuth } from "./auth";

const designFixtures = process.env.DESIGN_FIXTURES === "1";

// One pool per instance. Fluid compute shares it across invocations, and
// attachDatabasePool releases idle clients before the function suspends.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);

export const db = createDb(pool);
export const auth = createAuth({ db, designFixtures });
