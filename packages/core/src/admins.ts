import { eq } from "drizzle-orm";
import { users, type Db } from "@repo/db";

/**
 * Whether the user is an admin now, read from the database on every call,
 * never from a session cache, so removing an admin takes effect at once
 * (DECISIONS, "Admins").
 */
export async function isAdmin(
  db: Pick<Db, "select">,
  userId: string,
): Promise<boolean> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId));
  return user?.role === "admin";
}

/** What an admin-only read returns: the value, or why not. */
export type AdminResult<T> =
  { ok: true; value: T } | { ok: false; reason: "not_admin" | "not_found" };

export type Admins = { isAdmin(userId: string): Promise<boolean> };

export function createAdmins(deps: { db: Db }): Admins {
  return { isAdmin: (userId) => isAdmin(deps.db, userId) };
}
