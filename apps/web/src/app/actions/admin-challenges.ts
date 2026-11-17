"use server";

import type { ChallengeSaveResult } from "@repo/core";
import {
  CHALLENGE_SAVED_PARAM,
  saveChallengeSchema,
  toChallengeInput,
} from "@/lib/schemas/challenge";
import { core } from "@/server/core";
import { getSession } from "@/server/session";

export type SaveChallengeResult =
  | { ok: true; href: string }
  | Exclude<ChallengeSaveResult, { ok: true }>
  | { ok: false; reason: "signed_out" | "invalid_input" };

/**
 * The admin's challenge form: creates a challenge (slug null) or saves an
 * edit. Core reads the role from the database and refuses anyone but an
 * admin. The form navigates to the edit page, with the saved status once.
 */
export async function saveChallenge(
  input: unknown,
): Promise<SaveChallengeResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = saveChallengeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid_input" };
  const { slug, fields } = parsed.data;
  const challenge = toChallengeInput(fields);
  const result = slug
    ? await core.challenges.edit(session.user.id, slug, challenge)
    : await core.challenges.create(session.user.id, challenge);
  if (!result.ok) return result;
  return {
    ok: true,
    href: `/admin/provocari/${result.slug}?${CHALLENGE_SAVED_PARAM}=1`,
  };
}
