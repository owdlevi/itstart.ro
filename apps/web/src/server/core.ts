import "server-only";
import { createCore, createMemoryMailer, type Mailer } from "@repo/core";
import { createDb } from "@repo/db";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { createAuth } from "./auth";
import { createHttpsLinkChecker, withExampleHosts } from "./link-checker";
import { screenshotStorage } from "./storage";

// Design-fixtures mode: the clock stops at the moment the reference PNGs show,
// and /dev/login-as works. Never in production, whatever the env says.
export const designFixtures =
  process.env.DESIGN_FIXTURES === "1" &&
  process.env.VERCEL_ENV !== "production";
const FIXTURES_NOW = new Date("2026-11-11T07:35:00+02:00");
export const now = designFixtures ? () => FIXTURES_NOW : () => new Date();

// One pool per instance. Fluid compute shares it across invocations, and
// attachDatabasePool releases idle clients before the function suspends.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);

export const db = createDb(pool);
const httpsLinkChecker = createHttpsLinkChecker();
/** Rule 9's check; core uses it on save, the launch form on blur. */
export const linkChecker = designFixtures
  ? withExampleHosts(httpsLinkChecker)
  : httpsLinkChecker;
export const core = createCore({
  db,
  now,
  linkChecker,
  // Fails closed where nothing can be stored yet: no screenshot is ours.
  storage: screenshotStorage ?? undefined,
});

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
