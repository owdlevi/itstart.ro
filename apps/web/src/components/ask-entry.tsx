import { getTranslations } from "next-intl/server";
import type { Session } from "@/server/session";
import { AskQuestion } from "./ask-question";
import { Button } from "./button";

/**
 * "Pune o întrebare", for whoever is looking: signed out, a link to sign in
 * that comes back here; without a name yet, to /bun-venit; otherwise the form,
 * opened in place.
 */
export async function AskEntry({
  challengeId,
  challengeSlug,
  session,
  returnTo,
}: {
  challengeId: string;
  challengeSlug: string;
  session: Session | null;
  /** Where signing in comes back to. */
  returnTo: string;
}) {
  const t = await getTranslations("questions.ask");
  if (session?.user.onboardedAt) {
    return (
      <AskQuestion
        challengeId={challengeId}
        questionsHref={`/provocari/${challengeSlug}/intrebari`}
      />
    );
  }
  const next = encodeURIComponent(returnTo);
  return (
    <div className="flex">
      <Button
        href={session ? `/bun-venit?next=${next}` : `/intra?next=${next}`}
        variant="secondary"
        className="w-full md:w-auto"
      >
        {t("button")}
      </Button>
    </div>
  );
}
