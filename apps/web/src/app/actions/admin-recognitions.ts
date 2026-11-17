"use server";

import type { RecognitionSaveResult } from "@repo/core";
import {
  RECOGNITIONS_SAVED_PARAM,
  saveRecognitionsSchema,
  toRecognitionEntries,
} from "@/lib/schemas/recognitions";
import { core } from "@/server/core";
import { getSession } from "@/server/session";

export type SaveRecognitionsResult =
  | { ok: true; href: string }
  | Exclude<RecognitionSaveResult, { ok: true }>
  | { ok: false; reason: "signed_out" | "invalid_input" };

/**
 * The admin's recognitions form for an ended challenge. Core reads the role
 * from the database and checks every rule; the form reloads the page with
 * the saved status once.
 */
export async function saveRecognitions(
  input: unknown,
): Promise<SaveRecognitionsResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = saveRecognitionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid_input" };
  const { slug, fields } = parsed.data;
  const result = await core.recognitions.save(
    session.user.id,
    slug,
    toRecognitionEntries(fields),
  );
  if (!result.ok) return result;
  return {
    ok: true,
    href: `/admin/provocari/${slug}/recunoasteri?${RECOGNITIONS_SAVED_PARAM}=1`,
  };
}
