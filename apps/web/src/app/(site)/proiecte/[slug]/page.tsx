import type { ProjectPage, Review } from "@repo/core";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";
import { AgentBadge } from "@/components/agent-badge";
import { FlashBanner } from "@/components/flash-banner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { listTools } from "@/components/project-card";
import { ProjectVote } from "@/components/project-vote";
import { ReplyToggle } from "@/components/reply-toggle";
import { ReviewForm } from "@/components/review-form";
import { ScreenshotViewer } from "@/components/screenshot-viewer";
import { ShareButton } from "@/components/share-button";
import { Tag } from "@/components/tag";
import { afterLaunch, timeAgo } from "@/lib/dates";
import { SAVED_PARAM } from "@/lib/schemas/project";
import { REPORTED_PARAM } from "@/lib/schemas/report";
import { TEAM_EMAIL } from "@/lib/team";
import { cn } from "@/lib/utils";
import { flags } from "@/flags";
import { core, now } from "@/server/core";
import { getSession } from "@/server/session";
import { projectShare } from "@/server/share-image/cards";
import { shareMetadata } from "@/server/share-image/version";

const h2 =
  "text-[22px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[26px]";
const panel =
  "flex flex-col gap-4 rounded-lg border border-line bg-surface p-5";
const sideH2 =
  "font-sans text-[13px] font-bold uppercase leading-[18px] tracking-[0.06em] text-muted";

const getProject = cache((slug: string, viewerId: string | null) =>
  core.projects.bySlug(slug, viewerId),
);

export async function generateMetadata({
  params,
}: PageProps<"/proiecte/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [session, t] = await Promise.all([
    getSession(),
    getTranslations("projectPage"),
  ]);
  const project = await getProject(slug, session?.user.id ?? null);
  if (!project) return {};
  // Only its owner and admins get here; nothing to index or share.
  if (project.hidden)
    return {
      title: t("metaTitle", { name: project.name }),
      robots: { index: false },
    };
  return shareMetadata({
    title: t("metaTitle", { name: project.name }),
    shareTitle: project.name,
    description: project.pitch,
    path: `/proiecte/${project.slug}`,
    share: await projectShare(project),
    type: "article",
  });
}

/** Screen 04 · Proiect (HANDOVER §6). */
export default async function ProjectPageRoute({
  params,
  searchParams,
}: PageProps<"/proiecte/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const session = await getSession();
  const viewerId = session?.user.id ?? null;
  const project = await getProject(slug, viewerId);
  if (!project) notFound();

  const [t, tProject, format, thread] = await Promise.all([
    getTranslations("projectPage"),
    getTranslations("project"),
    getFormatter(),
    core.reviews.thread(project.id),
  ]);
  const tags = [
    ...(project.challenge
      ? [
          {
            label: t("challengeTag", { number: project.challenge.number }),
            href: `/lansari?provocare=${project.challenge.slug}`,
          },
        ]
      : []),
    ...listTools(project),
  ];
  const { build } = project;
  const own = viewerId === project.owner.id;
  const duration =
    build.durationText ??
    (build.duration && t(`build.durations.${build.duration}`));

  return (
    <Container>
      <div className="pt-3 md:pt-6">
        <Link
          href="/lansari"
          className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold"
        >
          <ArrowLeft size={18} strokeWidth={2.2} aria-hidden />
          {t("back")}
        </Link>
        {/* After the launch form saves (screen 09), once. */}
        {own && query[SAVED_PARAM] && (
          <FlashBanner param={SAVED_PARAM}>{t("saved")}</FlashBanner>
        )}
        {/* After "Raportează o problemă", once. */}
        {!own && query[REPORTED_PARAM] && (
          <FlashBanner param={REPORTED_PARAM}>{t("reported")}</FlashBanner>
        )}
        {project.hidden && <HiddenNotice own={own} />}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pb-6 pt-2 md:pb-9 md:pt-3">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
          <h1 className="text-[36px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[52px]">
            {project.name}
          </h1>
          <p className="text-lg leading-[27px] text-muted md:text-xl md:leading-[30px]">
            {project.pitch}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Tag key={tag.label} href={tag.href}>
                {tag.label}
              </Tag>
            ))}
          </div>
        </div>
        <div className="flex w-full flex-col gap-1.5 md:w-auto md:items-end">
          <div className="flex flex-wrap gap-3">
            <Button
              href={project.liveUrl}
              external
              className="w-full md:w-auto"
            >
              <ExternalLink size={18} strokeWidth={2.2} aria-hidden />
              {t("open")}
            </Button>
            <ProjectVote
              project={project}
              viewerId={viewerId}
              votingOpen={project.votingOpen}
              wide
            />
            <ShareButton title={project.name} />
            {own && (
              <Button
                href={`/proiecte/${project.slug}/editeaza`}
                variant="secondary"
                className="w-full md:w-auto"
              >
                {t("edit")}
              </Button>
            )}
          </div>
          {flags.linkCheck && project.linkCheck && (
            <LinkCheckLine check={project.linkCheck} own={own} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6 pb-10 md:gap-10 md:pb-[72px]">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-7 md:gap-10">
          {project.screenshots.length > 0 && (
            <ScreenshotViewer
              name={project.name}
              screenshots={project.screenshots}
            />
          )}

          {project.description.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className={h2}>{t("about")}</h2>
              {project.description.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          )}

          {(duration || build.hardestPart || build.prompt) && (
            <section className="flex flex-col gap-3">
              <h2 className={h2}>{t("build.title")}</h2>
              {(duration || build.hardestPart) && (
                <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-3">
                  {duration && (
                    <BuildCard term={t("build.duration")} value={duration} />
                  )}
                  {build.hardestPart && (
                    <BuildCard
                      term={t("build.hardestPart")}
                      value={build.hardestPart}
                    />
                  )}
                </dl>
              )}
              {build.prompt && (
                <figure className="flex flex-col gap-1.5 rounded-lg bg-tint p-4">
                  <figcaption className="text-[13px] font-bold leading-[18px] text-muted">
                    {t("build.prompt")}
                  </figcaption>
                  <blockquote>
                    {t("build.quoted", { text: build.prompt })}
                  </blockquote>
                </figure>
              )}
            </section>
          )}

          {project.updates.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className={h2}>{t("updates.title")}</h2>
              <ul className="flex flex-col gap-2">
                {project.updates.map((update) => (
                  <li
                    key={update.version}
                    className="flex flex-wrap gap-x-3 gap-y-0.5"
                  >
                    <span className="w-[140px] shrink-0 text-sm font-bold leading-[23px] text-muted">
                      {t("updates.label", {
                        version: update.version,
                        date: format.dateTime(update.createdAt, {
                          day: "numeric",
                          month: "long",
                        }),
                      })}
                    </span>
                    <span className="flex-[1_1_240px] text-[15px] leading-[23px]">
                      {update.text}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Reviews project={project} viewerId={viewerId} thread={thread} />
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section className={panel}>
            <h2 className={sideH2}>{t("builtBy.title")}</h2>
            <div className="flex items-center gap-3">
              <Avatar person={project.owner} size={52} />
              <div className="flex min-w-0 flex-col">
                <span className="flex flex-wrap items-center gap-x-2 text-[17px] font-bold leading-6">
                  {project.owner.name}
                  {project.owner.isAgent && (
                    <AgentBadge>{tProject("agentBadge")}</AgentBadge>
                  )}
                </span>
                <span className="text-sm text-muted">
                  {[
                    project.owner.city,
                    t("builtBy.launched", { n: project.owner.launched }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            </div>
            {/* M3: the "Deschisă la colaborări" chip and "Scrie-i" go here. */}
            {project.owner.handle && (
              <Button
                href={`/u/${project.owner.handle}`}
                variant="secondary"
                full
              >
                {t("builtBy.profile")}
              </Button>
            )}
          </section>

          {project.tools.length > 0 && (
            <section className={panel}>
              <h2 className={sideH2}>{t("tools")}</h2>
              <div className="flex flex-wrap gap-1.5">
                {project.tools.map((tool) => (
                  <Tag
                    key={tool}
                    href={`/lansari?eticheta=${encodeURIComponent(tool)}`}
                  >
                    {tool}
                  </Tag>
                ))}
              </div>
            </section>
          )}

          {project.challenge && (
            <section className={panel}>
              <h2 className={sideH2}>{t("madeFor.title")}</h2>
              <Link
                href={`/provocari/${project.challenge.slug}`}
                className="inline-flex min-h-11 items-center font-semibold leading-[23px]"
              >
                {t("madeFor.challenge", {
                  number: project.challenge.number,
                  title: project.challenge.title,
                })}
              </Link>
              {project.launchedAt && (
                <span className="text-sm text-muted">
                  {t("madeFor.launched", {
                    date: format.dateTime(project.launchedAt, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }),
                  })}
                </span>
              )}
            </section>
          )}
          {/* Not for its owner, who edits it instead, nor once it's hidden. */}
          {flags.report && !own && !project.hidden && (
            <Link
              href={`/proiecte/${project.slug}/raporteaza`}
              className="inline-flex min-h-11 items-center text-[14px] font-semibold leading-6 text-muted"
            >
              {t("report")}
            </Link>
          )}
        </aside>
      </div>
    </Container>
  );
}

/**
 * A hidden project reaches only its owner and admins (moderation). The owner
 * learns it here, since no e-mail is sent; an admin gets the way back.
 */
async function HiddenNotice({ own }: { own: boolean }) {
  const t = await getTranslations("projectPage.hidden");
  return (
    <p className="mt-4 rounded-lg bg-warning-bg px-4 py-3.5 font-semibold text-warning-ink md:mt-6 md:px-5 md:py-4">
      {own
        ? t.rich("owner", {
            email: TEAM_EMAIL,
            mail: (chunks) => (
              <a href={`mailto:${TEAM_EMAIL}`} className="text-warning-ink">
                {chunks}
              </a>
            ),
          })
        : t.rich("admin", {
            link: (chunks) => (
              <Link href="/admin/moderare/ascunse" className="text-warning-ink">
                {chunks}
              </Link>
            ),
          })}
    </p>
  );
}

/** "Link verificat acum 3 ore. Merge." (M2): the latest confirmed link check. */
async function LinkCheckLine({
  check,
  own,
}: {
  check: { checkedAt: Date; ok: boolean };
  own: boolean;
}) {
  const [t, format] = await Promise.all([
    getTranslations("projectPage"),
    getFormatter(),
  ]);
  const ago = timeAgo(check.checkedAt, now());
  const when = ago
    ? t("reviews.ago", ago)
    : t("linkCheck.on", {
        date: format.dateTime(check.checkedAt, {
          day: "numeric",
          month: "long",
        }),
      });
  return (
    <>
      <p
        className={cn(
          "text-[13px] leading-[18px]",
          check.ok ? "text-muted" : "font-semibold text-warning-ink",
        )}
      >
        {t(check.ok ? "linkCheck.ok" : "linkCheck.failing", { when })}
      </p>
      {/* The owner can do something about it; everyone else just knows. */}
      {!check.ok && own && (
        <p className="max-w-[420px] text-[13px] leading-[18px] text-muted md:text-right">
          {t("linkCheck.ownerHint")}
        </p>
      )}
    </>
  );
}

function BuildCard({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
      <dt className="text-[13px] font-bold leading-[18px] text-muted">
        {term}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

async function Reviews({
  project,
  viewerId,
  thread,
}: {
  project: ProjectPage;
  viewerId: string | null;
  thread: Awaited<ReturnType<typeof core.reviews.thread>>;
}) {
  const t = await getTranslations("projectPage");
  const isOwner = project.owner.id === viewerId;
  return (
    <section id="pareri" className="flex scroll-mt-6 flex-col gap-5">
      <h2 className={h2}>{t("reviews.title", { n: thread.total })}</h2>
      {thread.reviews.map((review) => (
        <div key={review.id} className="flex flex-col gap-5">
          <ReviewItem review={review} launchedAt={project.launchedAt} />
          {review.replies.map((reply) => (
            <ReviewItem
              key={reply.id}
              review={reply}
              launchedAt={project.launchedAt}
              reply
            />
          ))}
          {isOwner && (
            <div className="ml-6 md:ml-12">
              <ReplyToggle projectId={project.id} parentId={review.id} />
            </div>
          )}
        </div>
      ))}
      {/* Without a form below it, the owner's empty section needs a line. */}
      {isOwner && thread.total === 0 && (
        <p className="text-muted">{t("reviews.none")}</p>
      )}
      {/* The owner replies to reviews rather than reviewing their own project. */}
      {!viewerId ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-4 md:p-5">
          <p className="text-[15px] font-bold leading-6">
            {t("reviews.write")}
          </p>
          <Button
            href={`/intra?next=${encodeURIComponent(`/proiecte/${project.slug}#pareri`)}`}
            variant="secondary"
            className="w-full md:w-auto md:self-end"
          >
            {t("reviews.signIn")}
          </Button>
        </div>
      ) : (
        !isOwner && <ReviewForm projectId={project.id} />
      )}
    </section>
  );
}

async function ReviewItem({
  review,
  launchedAt,
  reply,
}: {
  review: Omit<Review, "replies">;
  launchedAt: Date | null;
  reply?: boolean;
}) {
  const [t, format] = await Promise.all([
    getTranslations("projectPage.reviews"),
    getFormatter(),
  ]);
  const after =
    review.isAutomated && launchedAt
      ? afterLaunch(review.createdAt, launchedAt)
      : null;
  const ago = timeAgo(review.createdAt, now());
  const when = after
    ? t("afterLaunch", after)
    : ago
      ? t("ago", ago)
      : format.dateTime(review.createdAt, { day: "numeric", month: "long" });
  return (
    <article className={cn("flex items-start gap-3", reply && "ml-6 md:ml-12")}>
      <Avatar person={review.author} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-6">
          <span className="text-[15px] font-bold">{review.author.name}</span>
          {review.isAutomated && <AgentBadge>{t("automated")}</AgentBadge>}
          <span className="text-[13px] text-muted">{when}</span>
        </div>
        <p className="whitespace-pre-line text-[15px] leading-[23px]">
          {review.body}
        </p>
      </div>
    </article>
  );
}
