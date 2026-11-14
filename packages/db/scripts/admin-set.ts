// pnpm --filter @repo/db admin:set <email> admin|member
// Grants or removes admin. The person must have signed in once.
import { eq, sql } from "drizzle-orm";
import { users } from "../src/schema";
import { withDb } from "./connect";

const [email, role] = process.argv.slice(2);
if (!email || (role !== "admin" && role !== "member")) {
  console.error("Usage: pnpm --filter @repo/db admin:set <email> admin|member");
  process.exit(1);
}

const updated = await withDb((db) =>
  db
    .update(users)
    .set({ role })
    .where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()))
    .returning({ email: users.email, role: users.role }),
);

if (updated.length === 0) {
  console.error(`No user with e-mail ${email}. They must sign in once first.`);
  process.exit(1);
}
console.log(`${updated[0]!.email} is now ${updated[0]!.role}.`);
