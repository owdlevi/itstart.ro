"use server";

import type { JoinRefusal, LeaveRefusal } from "@repo/core";
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";
import { LEFT_PARAM, joinedHref } from "@/lib/sign-in-destination";
import { core } from "@/server/core";
import { getSession } from "@/server/session";

export type ParticipationActionResult = {
  ok: false;
  reason: JoinRefusal | LeaveRefusal | "signed_out" | "invalid";
} | null;

const slugSchema = z.string().min(1).max(200);

/**
 * "Intră în provocare" for someone signed in (rule 2: one action). On to the
 * challenge with the joined banner. Sign-in from a challenge joins in
 * finishSignIn and completeOnboarding instead.
 */
export async function joinChallenge(
  _prev: ParticipationActionResult,
  form: FormData,
): Promise<ParticipationActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const slug = slugSchema.safeParse(form.get("slug"));
  if (!slug.success) return { ok: false, reason: "invalid" };
  const result = await core.challenges.join(session.user.id, slug.data);
  if (!result.ok) return result;
  redirect(joinedHref(result.slug), RedirectType.replace);
}

/** "Renunță la provocare", once confirmed (rule 2). Their projects stay. */
export async function leaveChallenge(
  _prev: ParticipationActionResult,
  form: FormData,
): Promise<ParticipationActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const slug = slugSchema.safeParse(form.get("slug"));
  if (!slug.success) return { ok: false, reason: "invalid" };
  const result = await core.challenges.leave(session.user.id, slug.data);
  if (!result.ok) return result;
  redirect(
    `/provocari/${encodeURIComponent(result.slug)}?${LEFT_PARAM}=1`,
    RedirectType.replace,
  );
}
