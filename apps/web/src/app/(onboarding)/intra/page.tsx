import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Container } from "@/components/container";
import { SignInForm } from "@/components/sign-in-form";
import { signInDestination } from "@/lib/sign-in-destination";
import { getRunningChallenge } from "@/server/challenge";
import { getJoinableChallenge } from "@/server/joinable";
import { getSession } from "@/server/session";

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : null;

export async function generateMetadata({
  searchParams,
}: PageProps<"/intra">): Promise<Metadata> {
  const [query, t] = await Promise.all([
    searchParams,
    getTranslations("signIn"),
  ]);
  const joining = await getJoinableChallenge(one(query.provocare));
  return {
    title: t("metaTitle", { context: joining ? "challenge" : "community" }),
  };
}

/**
 * Screen 06 · Înscriere: cont (HANDOVER §6), with e-mail and password for now
 * (DECISIONS, "Screen 06 copy: password sign-in"). `?provocare=<slug>` comes
 * from a challenge, `?next=<path>` from a vote or a review (rule 12), and
 * `?cont=nou|intra` picks the mode.
 */
export default async function SignInPage({
  searchParams,
}: PageProps<"/intra">) {
  const query = await searchParams;
  const next = one(query.next);
  const [session, joining] = await Promise.all([
    getSession(),
    getJoinableChallenge(one(query.provocare)),
  ]);
  // Signed in already: on to where signing in would have gone.
  if (session) {
    redirect(
      signInDestination({
        handle: session.user.handle,
        next,
        challengeSlug: joining?.slug,
      }),
    );
  }

  const [t, format, running] = await Promise.all([
    getTranslations("signIn"),
    getFormatter(),
    getRunningChallenge(),
  ]);
  // "Ce urmează" is about the challenge they came from, or the running one.
  const challenge = joining ?? running;

  const cont = one(query.cont);
  // From a challenge, most visitors are new; from the header, most aren't.
  const mode =
    cont === "nou" || (cont !== "intra" && joining) ? "signUp" : "signIn";
  const switchQuery = new URLSearchParams();
  if (joining) switchQuery.set("provocare", joining.slug);
  if (next) switchQuery.set("next", next);
  switchQuery.set("cont", mode === "signUp" ? "intra" : "nou");

  const steps = [
    { key: "profile", title: t("next.profile.title"), text: t("next.profile.text") },
    ...(challenge
      ? [
          {
            key: "build",
            title: t("next.build.title", {
              date: format.dateTime(challenge.endsAt, {
                day: "numeric",
                month: "long",
              }),
            }),
            text: t("next.build.text"),
          },
        ]
      : []),
    { key: "launch", title: t("next.launch.title"), text: t("next.launch.text") },
  ];

  return (
    <Container>
      <div className="flex flex-wrap items-start justify-center gap-7 pb-10 pt-6 md:gap-16 md:pb-24 md:pt-[72px]">
        <section className="flex min-w-0 max-w-[460px] flex-[1_1_380px] flex-col gap-4 rounded-lg border border-line bg-surface p-5 md:p-8">
          {joining && (
            <p className="text-[13px] font-bold uppercase leading-[18px] tracking-[0.06em] text-primary">
              {t("eyebrow", {
                number: joining.number,
                month: format.dateTime(joining.startsAt, { month: "long" }),
              })}
            </p>
          )}
          <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[36px]">
            {t("title", { context: joining ? "challenge" : "community" })}
          </h1>
          <p className="text-muted">{t("lead")}</p>
          <SignInForm
            mode={mode}
            switchHref={`/intra?${switchQuery}`}
            next={next}
            challengeSlug={joining?.slug ?? null}
          />
          <p className="text-sm text-muted">
            {t.rich("rules", {
              link: (chunks) => <Link href="/reguli">{chunks}</Link>,
            })}
          </p>
        </section>

        <section className="flex min-w-0 max-w-[420px] flex-[1_1_320px] flex-col gap-4">
          <h2 className="text-[22px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[26px]">
            {t("next.title")}
          </h2>
          <ol className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={step.key} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="inline-flex size-8 flex-none items-center justify-center rounded-md bg-tint font-display text-base font-bold text-primary-hover"
                >
                  {i + 1}
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold">{step.title}</span>
                  <span className="text-sm text-muted">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
          {challenge && (
            <p className="text-sm text-muted">
              {challenge.buildingPhrase
                ? t("next.peopleBuilding", {
                    count: challenge.counts.participants,
                    what: challenge.buildingPhrase,
                  })
                : t("next.people", { count: challenge.counts.participants })}
            </p>
          )}
        </section>
      </div>
    </Container>
  );
}
