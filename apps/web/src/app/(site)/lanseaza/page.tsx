import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LaunchPage } from "@/components/launch-page";
import { ProjectForm } from "@/components/project-form";
import { emptyProjectFields } from "@/lib/schemas/project";
import { getRunningChallenge } from "@/server/challenge";
import { designFixtures } from "@/server/core";
import { getSession } from "@/server/session";
import { uploadVia } from "@/server/storage";
import { FIXTURE_DRAFT, FIXTURE_DRAFT_VIEWER } from "./fixture-draft";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("launch");
  return { title: t("metaTitle") };
}

/** Screen 09 · Lansează un proiect (HANDOVER §6): a new project. */
export default async function LaunchRoute() {
  const [session, running, t] = await Promise.all([
    getSession(),
    getRunningChallenge(),
    getTranslations("launch"),
  ]);
  if (!session) redirect("/intra?next=/lanseaza");
  const { user } = session;
  // A project shows its builder's name (core refuses `not_onboarded`).
  if (!user.onboardedAt) redirect("/bun-venit?next=/lanseaza");

  const prefilled = designFixtures && user.handle === FIXTURE_DRAFT_VIEWER;
  return (
    <LaunchPage title={t("title")} lead={t("lead")}>
      <ProjectForm
        uploadVia={uploadVia}
        slug={null}
        defaults={
          prefilled ? FIXTURE_DRAFT : emptyProjectFields(running?.slug ?? null)
        }
        challenges={
          running
            ? [
                {
                  slug: running.slug,
                  label: t("challenge.option", {
                    number: running.number,
                    title: running.title,
                  }),
                  launchCheck: running.launchCheck,
                },
              ]
            : []
        }
        allowOwn
        launched={false}
        nextVersion={null}
        owner={{
          id: user.id,
          name: user.name,
          avatarUrl: user.image ?? null,
          avatarFill: user.avatarFill ?? null,
          isAgent: user.isAgent,
        }}
        votes={0}
        draftKey={`itstart:ciorna:${user.id}`}
      />
    </LaunchPage>
  );
}
