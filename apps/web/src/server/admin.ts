import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { core } from "./core";
import { getSession } from "./session";

const adminId = cache(async () => {
  const session = await getSession();
  if (!session) return { signedIn: false as const };
  // The role from the database, never the session's cookie cache (DECISIONS, "Admins").
  const admin = await core.admins.isAdmin(session.user.id);
  return { signedIn: true as const, userId: admin ? session.user.id : null };
});

/**
 * Every admin page calls this first, since a layout doesn't stop its page
 * rendering: signed out → sign-in, back to `path`; anyone but an admin → 404.
 * Returns the admin's id, which core checks again.
 */
export async function requireAdmin(path: string): Promise<string> {
  const admin = await adminId();
  if (!admin.signedIn) redirect(`/intra?next=${encodeURIComponent(path)}`);
  if (!admin.userId) notFound();
  return admin.userId;
}
