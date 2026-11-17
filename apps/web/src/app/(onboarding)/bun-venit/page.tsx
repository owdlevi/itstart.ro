import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/container";
import { OnboardingForm } from "@/components/onboarding-form";
import { onboardingSchema } from "@/lib/schemas/onboarding";
import { signInDestination } from "@/lib/sign-in-destination";
import { getJoinableChallenge } from "@/server/joinable";
import { getSession } from "@/server/session";

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : null;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("metaTitle") };
}

/**
 * Screen 07 · Înscriere: profil (HANDOVER §6): once, after the first sign-in.
 * `?provocare=` and `?next=` come from /intra and go on from here.
 */
export default async function OnboardingPage({
  searchParams,
}: PageProps<"/bun-venit">) {
  const query = await searchParams;
  const next = one(query.next);
  const [session, joining] = await Promise.all([
    getSession(),
    getJoinableChallenge(one(query.provocare)),
  ]);
  const carried = new URLSearchParams();
  if (joining) carried.set("provocare", joining.slug);
  if (next) carried.set("next", next);
  // Sign-in comes back here while onboarding isn't done.
  if (!session) redirect(`/intra${carried.size ? `?${carried}` : ""}`);
  const { user } = session;
  if (user.onboardedAt) {
    redirect(
      signInDestination({
        onboarded: true,
        next,
        challengeSlug: joining?.slug,
      }),
    );
  }

  const t = await getTranslations("onboarding");
  // Whatever the account already has: a provider's name, or the fixtures'
  // Bianca. A password sign-up starts empty.
  const prefill = onboardingSchema.shape.toolsInterest.safeParse(
    user.toolsInterest,
  );

  return (
    <Container>
      <div className="flex justify-center pb-10 pt-6 md:pb-24 md:pt-16">
        <section className="flex w-full max-w-[520px] flex-col gap-4 rounded-lg border border-line bg-surface p-5 md:p-8">
          <p className="text-sm font-semibold text-muted">{t("step")}</p>
          <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[36px]">
            {t("title")}
          </h1>
          <p className="text-muted">{t("lead")}</p>
          <OnboardingForm
            defaults={{
              name: user.name,
              city: user.city ?? "",
              toolsInterest: prefill.success ? prefill.data : [],
              remindersOptIn: user.remindersOptIn,
            }}
            next={next}
            challengeSlug={joining?.slug ?? null}
          />
        </section>
      </div>
    </Container>
  );
}
