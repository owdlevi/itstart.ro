// Entry for `pnpm auth:generate`. The Better Auth CLI loads its config outside
// Next.js, where core.ts's `server-only` import throws, so this builds the same
// instance with a database it never connects to.
import { createCore, createMemoryMailer } from "@repo/core";
import { createDb } from "@repo/db";
import { createAuth } from "../src/server/auth";

const db = createDb("postgres://unused");

export const auth = createAuth({
  db,
  signIn: createCore({ db }).signIn,
  mailer: createMemoryMailer(),
  designFixtures: false,
});
