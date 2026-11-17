import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { LaunchPage } from "@/components/launch-page";
import { ProjectForm, type ChallengeChoice } from "@/components/project-form";
import { toProjectFields } from "@/lib/schemas/project";
import { getRunningChallenge } from "@/server/challenge";
import { core } from "@/server/core";
import { getSession } from "@/server/session";
import { uploadVia } from "@/server/storage";

const getEditable = cache((slug: string, userId: string) =>
  core.projects.editable(slug, userId),
);

export async function generateMetadata({
  params,
}: PageProps<"/proiecte/[slug]/editeaza">): Promise<Metadata> {
  const { slug } = await params;
  const [session, t] = await Promise.all([
    getSession(),
    getTranslations("launch"),
  ]);
  const result = session && (await getEditable(slug, session.user.id));
  if (!result?.ok) return {};
  return { title: t("editMetaTitle", { name: result.project.input.name }) };
}

/** Screen 09 for editing: the owner's project, prefilled (rule 8). */
export default async function EditProjectRoute({
  params,
}: PageProps<"/proiecte/[slug]/editeaza">) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect(`/intra?next=/proiecte/${slug}/editeaza`);
  const { user } = session;
  const [result, running, t] = await Promise.all([
    getEditable(slug, user.id),
    getRunningChallenge(),
    getTranslations("launch"),
  ]);
  if (!result.ok && result.reason === "not_found") notFound();
  // Someone else's project: its page, which they can see anyway.
  if (!result.ok) redirect(`/proiecte/${slug}`);
  const { project } = result;
  const launched = project.stage === "launched";

  // Its own challenge, ended or not, then the running one while it can move
  // (a launched project stays where its votes were cast).
  const choices: ChallengeChoice[] = [];
  if (project.challenge) {
    choices.push({
      slug: project.challenge.slug,
      label: t("challenge.option", {
        number: project.challenge.number,
        title: project.challenge.title,
      }),
      launchCheck: project.challenge.launchCheck,
    });
  }
  if (!launched && running && running.slug !== project.challenge?.slug) {
    choices.push({
      slug: running.slug,
      label: t("challenge.option", {
        number: running.number,
        title: running.title,
      }),
      launchCheck: running.launchCheck,
    });
  }

  return (
    <LaunchPage title={t("editTitle")} lead={t("editLead")}>
      <ProjectForm
        uploadVia={uploadVia}
        slug={project.slug}
        defaults={toProjectFields(project.input)}
        challenges={choices}
        allowOwn={!launched || !project.challenge}
        launched={launched}
        nextVersion={project.nextVersion}
        owner={{
          id: user.id,
          name: user.name,
          avatarUrl: user.image ?? null,
          avatarFill: user.avatarFill ?? null,
          isAgent: user.isAgent,
        }}
        votes={project.votes}
        draftKey={null}
      />
    </LaunchPage>
  );
}
