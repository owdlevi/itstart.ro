"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  joinChallenge,
  type ParticipationActionResult,
} from "@/app/actions/participation";
import { Button } from "@/components/button";

/**
 * "Intră în provocare" for someone signed in and onboarded: one action
 * (rule 2), then the page reloads with the joined banner. A refusal (the
 * deadline passed since the page loaded) is said under the button.
 */
export function JoinButton({ slug }: { slug: string }) {
  const t = useTranslations("challenge");
  const [result, action, pending] = useActionState<
    ParticipationActionResult,
    FormData
  >(joinChallenge, null);

  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" full aria-disabled={pending || undefined}>
        {t("timeLeft.join")}
      </Button>
      <p role="status" className="text-sm text-muted empty:hidden">
        {result &&
          t(
            result.reason === "ended"
              ? "participation.refused.ended"
              : "participation.refused.other",
          )}
      </p>
    </form>
  );
}
