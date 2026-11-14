import "server-only";
import { cache } from "react";
import { core } from "./core";

/**
 * The challenge behind `?provocare=`, if it can still be joined (running or
 * upcoming), or null. Read once per request.
 */
export const getJoinableChallenge = cache(async (slug: string | null) => {
  if (!slug) return null;
  const challenge = await core.challenges.bySlug(slug);
  return challenge && challenge.status !== "ended" ? challenge : null;
});
