"use server";

import type { ProfileEditResult } from "@repo/core";
import { refresh } from "next/cache";
import {
  PROFILE_SAVED_PARAM,
  profileSchema,
  toProfileInput,
} from "@/lib/schemas/profile";
import { core } from "@/server/core";
import { getSession } from "@/server/session";

export type SaveProfileResult =
  | { ok: true; href: string }
  | Exclude<ProfileEditResult, { ok: true }>
  | { ok: false; reason: "signed_out" | "invalid_input" };

/**
 * "Editează profilul": saves the signed-in user's own profile. The form
 * navigates to the profile, with the saved status once.
 */
export async function saveProfile(input: unknown): Promise<SaveProfileResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid_input" };
  const result = await core.profiles.edit(
    session.user.id,
    toProfileInput(parsed.data),
  );
  if (!result.ok) return result;
  // The header (a shared layout) shows the name and picture too.
  refresh();
  return { ok: true, href: `/u/${result.handle}?${PROFILE_SAVED_PARAM}=1` };
}
