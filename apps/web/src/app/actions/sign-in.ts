"use server";

import { RedirectType, redirect } from "next/navigation";
import { finishSignInSchema } from "@/lib/schemas/sign-in";
import { signInDestination } from "@/lib/sign-in-destination";
import { getJoinableChallenge } from "@/server/joinable";
import { getSession } from "@/server/session";

/**
 * Called by the /intra form once Better Auth has signed the visitor in: sends
 * them on (signInDestination). Screen 08 joins `challengeSlug` here, so
 * signing in from a challenge also joins it (HANDOVER §6 06).
 */
export async function finishSignIn(
  input: unknown,
): Promise<{ ok: false; reason: "signed_out" | "invalid" }> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = finishSignInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const challenge = await getJoinableChallenge(parsed.data.challengeSlug);
  redirect(
    signInDestination({
      handle: session.user.handle,
      next: parsed.data.next,
      challengeSlug: challenge?.slug,
    }),
    RedirectType.replace,
  );
}
