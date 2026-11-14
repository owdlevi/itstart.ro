"use server";

import type { OnboardingResult } from "@repo/core";
import { RedirectType, redirect } from "next/navigation";
import { completeOnboardingSchema } from "@/lib/schemas/onboarding";
import { signInDestination } from "@/lib/sign-in-destination";
import { core } from "@/server/core";
import { getJoinableChallenge } from "@/server/joinable";
import { getSession } from "@/server/session";

export type CompleteOnboardingResult =
  | Extract<OnboardingResult, { ok: false }>
  | { ok: false; reason: "signed_out" | "invalid" };

/**
 * Saves /bun-venit (screen 07) and sends them on, like a sign-in: to `next`,
 * the challenge, or Home. Screen 08 joins `challengeSlug` here too.
 */
export async function completeOnboarding(
  input: unknown,
): Promise<CompleteOnboardingResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = completeOnboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { fields, next, challengeSlug } = parsed.data;
  const result = await core.profiles.onboard(session.user.id, fields);
  // A second tab that already finished: on to the same place.
  if (!result.ok && result.reason !== "already_onboarded") return result;
  const challenge = await getJoinableChallenge(challengeSlug);
  redirect(
    signInDestination({
      onboarded: true,
      next,
      challengeSlug: challenge?.slug,
    }),
    RedirectType.replace,
  );
}
