import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "./core";

/**
 * The signed-in user and session, or null. Cached per request, so a layout and
 * a page can both ask without a second lookup. Don't use it for admin checks:
 * those read `role` from the database (ARCHITECTURE, "Admin checks").
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;
