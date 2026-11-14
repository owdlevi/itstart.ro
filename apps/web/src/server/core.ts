import "server-only";
import { createCore, createMemoryMailer, type Mailer } from "@repo/core";
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
export const core = createCore({ db });

// In-memory until the Resend adapter exists; logs each e-mail so local sign-in works.
const memoryMailer = createMemoryMailer();
const mailer: Mailer = {
  send: async (email) => {
    await memoryMailer.send(email);
    console.info(`[mailer] ${email.kind} to ${email.to}: ${email.url}`);
  },
};

export const auth = createAuth({
  db,
  signIn: core.signIn,
  mailer,
  designFixtures,
});
