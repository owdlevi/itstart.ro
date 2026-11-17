"use server";

import { RedirectType, redirect } from "next/navigation";
import { finishSignInSchema } from "@/lib/schemas/sign-in";
import { signInDestination } from "@/lib/sign-in-destination";
import { core } from "@/server/core";
import { getJoinableChallenge } from "@/server/joinable";
import { getSession } from "@/server/session";

/**
 * Called by the /intra form once Better Auth has signed the visitor in: sends
 * them on (signInDestination). Signing in from a challenge also joins it
 * (HANDOVER §6 06), once they're onboarded; until then /bun-venit carries the
 * challenge on and joins it (completeOnboarding).
 */
export async function finishSignIn(
  input: unknown,
): Promise<{ ok: false; reason: "signed_out" | "invalid" }> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = finishSignInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const challenge = await getJoinableChallenge(parsed.data.challengeSlug);
  const onboarded = !!session.user.onboardedAt;
  const joined =
    onboarded && !!challenge
      ? (await core.challenges.join(session.user.id, challenge.slug)).ok
      : false;
  redirect(
    signInDestination({
      onboarded,
      next: parsed.data.next,
      challengeSlug: challenge?.slug,
      joined,
    }),
    RedirectType.replace,
  );
}
