import type { Metadata } from "next";
import { Check, Download } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { CopyLink } from "@/components/copy-link";
import { LaunchRow } from "@/components/launch-row";
import { ProjectVote } from "@/components/project-vote";
import { ShareCardPreview } from "@/components/share-card";
import { StatusChip } from "@/components/status-chip";
import { VoteCount } from "@/components/vote-button";
import { flags } from "@/flags";
import { cn } from "@/lib/utils";
import { core, designFixtures } from "@/server/core";
import { origin } from "@/server/origin";
import { getSession } from "@/server/session";
import { projectShare } from "@/server/share-image/cards";
import { DOWNLOAD_PARAM, imagePath } from "@/server/share-image/version";

const h2 =
  "text-[22px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[26px]";
const section = "flex flex-col gap-3.5";
const divided = "border-t border-line pt-6 md:pt-8";

// Design fixtures show the moment of the launch: 0 votes, 0 reviews (HANDOVER §9.4).
const getLaunch = cache((slug: string, userId: string) =>
  core.projects.launch(slug, userId, { countsAtLaunch: designFixtures }),
);

export async function generateMetadata({
  params,
}: PageProps<"/proiecte/[slug]/lansat">): Promise<Metadata> {
  const { slug } = await params;
  const [session, t] = await Promise.all([
    getSession(),
    getTranslations("launched"),
  ]);
  const result = session && (await getLaunch(slug, session.user.id));
  if (!result?.ok) return {};
  return { title: t("metaTitle", { name: result.page.project.name }) };
}

/**
 * Screen 10 · Lansat (HANDOVER §6): right after a launch, the project and the
 * two reviews its builder is asked for (rule 16). Owner only.
 */
export default async function LaunchedRoute({
  params,
}: PageProps<"/proiecte/[slug]/lansat">) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect(`/intra?next=/proiecte/${slug}/lansat`);
  const { user } = session;
  const [result, t, base] = await Promise.all([
    getLaunch(slug, user.id),
    getTranslations("launched"),
    origin(),
  ]);
  if (!result.ok && result.reason === "not_found") notFound();
  // Someone else's project, or one still in progress: its page.
  if (!result.ok) redirect(`/proiecte/${slug}`);
  const { project, assignments, expected } = result.page;
  // The same card as the PNG and the project page's og:image.
  const page = flags.shareImage && (await core.projects.bySlug(slug, user.id));
  const share = page ? await projectShare(page) : null;

  const name = user.givenName ?? user.name.trim().split(/\s+/)[0];
  const done = assignments.filter((a) => a.done).length;
  const open = assignments.find((a) => !a.done);
  const projectHref = `/proiecte/${project.slug}`;
  const seeProject = (primary: boolean) => (
    <Button
      href={projectHref}
      variant={primary ? "primary" : "secondary"}
      className="w-full md:w-auto"
    >
      {t("seeProject")}
    </Button>
  );

  return (
    <Container>
      <div className="mx-auto flex max-w-[680px] flex-col gap-6 pb-10 pt-8 md:gap-9 md:pb-24 md:pt-16">
        {/* The launch is a status message (HANDOVER §10). */}
        <div role="status" className="flex flex-col items-start gap-3">
          <StatusChip icon={<Check size={15} strokeWidth={2.2} aria-hidden />}>
            {t("chip")}
          </StatusChip>
          <h1 className="text-[34px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[52px]">
            {name ? t("title", { name }) : t("titleNoName")}
          </h1>
          <p className="text-[17px] leading-[26px] text-muted md:text-[19px] md:leading-[29px]">
            {t("lead", { name: project.name })}
          </p>
        </div>

        <LaunchRow
          project={project}
          // Rule 11: a plain count on your own project.
          vote={<VoteCount count={project.votes} reason="own" />}
        />

        {expected > 0 ? (
          <section className={section}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className={h2}>{t("reviews.title")}</h2>
              <StatusChip tone={done >= expected ? "success" : "warning"}>
                {t("reviews.count", { done, total: expected })}
              </StatusChip>
            </div>
            <p className="text-[15px] leading-[23px] text-muted">
              {t("reviews.text")}
            </p>
            {assignments.length > 0 && (
              <div className="flex flex-col gap-3">
                {assignments.map((a) => (
                  <LaunchRow
                    key={a.id}
                    project={a}
                    vote={
                      <ProjectVote
                        project={a}
                        viewerId={user.id}
                        votingOpen={a.votingOpen}
                      />
                    }
                    status={
                      a.done && (
                        <StatusChip
                          icon={
                            <Check size={15} strokeWidth={2.2} aria-hidden />
                          }
                        >
                          {t("reviews.done")}
                        </StatusChip>
                      )
                    }
                  />
                ))}
              </div>
            )}
            {assignments.length < expected && (
              <p className="text-[15px] leading-[23px] text-muted">
                {t("reviews.waiting", { n: expected - assignments.length })}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {open && (
                <Button
                  href={`/proiecte/${open.slug}#pareri`}
                  className="w-full md:w-auto"
                >
                  {done === 0
                    ? t("reviews.writeFirst")
                    : t("reviews.writeSecond")}
                </Button>
              )}
              {seeProject(!open)}
            </div>
          </section>
        ) : (
          // A project of its own asks for no reviews.
          <div className="flex flex-wrap gap-3">{seeProject(true)}</div>
        )}

        <section className={cn(section, divided)}>
          <h2 className={h2}>{t("share.title")}</h2>
          {share && (
            <>
              <ShareCardPreview card={share.card} alt={share.alt} />
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  href={`${imagePath(projectHref, share)}&${DOWNLOAD_PARAM}`}
                  download={`${project.slug}.png`}
                  className="w-full md:w-auto"
                >
                  <Download size={18} strokeWidth={2.2} aria-hidden />
                  {t("share.download")}
                </Button>
              </div>
            </>
          )}
          <CopyLink
            url={`${base}${projectHref}`}
            hint={flags.shareImage ? t("share.hint") : undefined}
          />
        </section>

        {/* M3: "Vrei să te poată contacta cineva?" (flags.contactConsent). */}

        <p className="text-[15px] leading-[23px] text-muted">{t("closing")}</p>
      </div>
    </Container>
  );
}
