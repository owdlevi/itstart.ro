import type { Profile } from "@repo/core";
import { Check, Link as LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";
import { AgentBadge } from "@/components/agent-badge";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { FlashBanner } from "@/components/flash-banner";
import { ProjectCard } from "@/components/project-card";
import { ProjectVote } from "@/components/project-vote";
import { SectionHeading } from "@/components/section-heading";
import { StatusChip } from "@/components/status-chip";
import { PROFILE_SAVED_PARAM } from "@/lib/schemas/profile";
import { core } from "@/server/core";
import { getSession } from "@/server/session";
import { profileShare } from "@/server/share-image/cards";
import { shareMetadata } from "@/server/share-image/version";

const getProfile = cache((handle: string, viewerId: string | null) =>
  core.profiles.byHandle(handle, viewerId),
);

/** "https://www.github.com/ioana/" → "github.com/ioana". */
const linkLabel = (url: string) =>
  url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");

export async function generateMetadata({
  params,
}: PageProps<"/u/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const [session, t] = await Promise.all([
    getSession(),
    getTranslations("profile"),
  ]);
  const profile = await getProfile(handle, session?.user.id ?? null);
  if (!profile) return {};
  const share = await profileShare(profile);
  return shareMetadata({
    title: t("metaTitle", { name: profile.name }),
    shareTitle: profile.name,
    description: profile.bio ?? share.card.byline,
    path: `/u/${profile.handle}`,
    share,
    type: "profile",
  });
}

/** Screen 05 · Profil (HANDOVER §6). */
export default async function ProfilePage({
  params,
  searchParams,
}: PageProps<"/u/[handle]">) {
  const [{ handle }, query] = await Promise.all([params, searchParams]);
  const session = await getSession();
  const viewerId = session?.user.id ?? null;
  const profile = await getProfile(handle, viewerId);
  if (!profile) notFound();

  const [t, format] = await Promise.all([
    getTranslations("profile"),
    getFormatter(),
  ]);
  const month = (at: Date) => format.dateTime(at, { month: "long" });

  const own = profile.id === viewerId;

  return (
    <Container>
      {/* After "Editează profilul" saves, once. */}
      {own && query[PROFILE_SAVED_PARAM] !== undefined && (
        <FlashBanner param={PROFILE_SAVED_PARAM}>{t("saved")}</FlashBanner>
      )}
      <ProfileHeader profile={profile} own={own} />

      <section className="flex flex-col gap-4 pb-8 md:gap-5 md:pb-12">
        <SectionHeading title={t("projects.title")} />
        {profile.projects.length > 0 ? (
          // auto-fill, not the reference's auto-fit: one or two cards keep a column's width.
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4 md:gap-6">
            {profile.projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                // A recognition replaces the month ("Provocarea #3 · Alegerea juriului").
                meta={
                  project.challenge && project.recognition
                    ? t("projects.recognition", {
                        number: project.challenge.number,
                        kind: project.recognition,
                      })
                    : project.challenge
                      ? t("projects.challenge", {
                          number: project.challenge.number,
                          month: month(project.challenge.startsAt),
                        })
                      : t("projects.own")
                }
                vote={
                  <ProjectVote
                    project={project}
                    viewerId={viewerId}
                    votingOpen={project.votingOpen}
                  />
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-muted">{t("projects.empty")}</p>
        )}
      </section>

      {profile.challenges.length > 0 && (
        <section className="flex flex-col gap-4 pb-10 md:gap-5 md:pb-[72px]">
          <SectionHeading title={t("challenges.title")} />
          <ul className="flex flex-col gap-2.5">
            {profile.challenges.map((challenge) => (
              <li
                key={challenge.slug}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-3 py-3.5 md:px-4"
              >
                <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-tint font-display text-base font-bold text-primary-hover"
                  >
                    #{challenge.number}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold leading-[23px]">
                      <span className="sr-only">
                        {t("challenges.number", { number: challenge.number })}
                        {": "}
                      </span>
                      {challenge.title}
                    </span>
                    <span className="text-sm leading-5 text-muted">
                      {t("challenges.line", {
                        month: format.dateTime(challenge.startsAt, {
                          month: "long",
                          year: "numeric",
                        }),
                        n: challenge.projects.length,
                        names: challenge.projects.map((p) => p.name).join(", "),
                      })}
                    </span>
                  </div>
                </div>
                <StatusChip
                  icon={<Check size={15} strokeWidth={2.2} aria-hidden />}
                >
                  {t("challenges.finished")}
                </StatusChip>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}

async function ProfileHeader({
  profile,
  own,
}: {
  profile: Profile;
  own: boolean;
}) {
  const [t, tProject, format] = await Promise.all([
    getTranslations("profile"),
    getTranslations("project"),
    getFormatter(),
  ]);
  const joined = format.dateTime(profile.joinedAt, {
    month: "long",
    year: "numeric",
  });
  const stats = [
    { n: profile.stats.launched, label: "launched" },
    { n: profile.stats.monthsInARow, label: "monthsInARow" },
    { n: profile.stats.votes, label: "votes" },
  ] as const;

  return (
    <section className="mb-7 mt-5 flex flex-wrap items-start gap-5 rounded-xl border border-line bg-surface p-5 md:mb-10 md:mt-12 md:gap-10 md:p-8">
      <div className="flex min-w-0 flex-[999_1_420px] flex-wrap items-start gap-4 md:gap-6">
        <Avatar person={profile} size={72} className="md:hidden" />
        <Avatar person={profile} size={96} className="hidden md:inline-flex" />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[40px]">
              {profile.name}
            </h1>
            {profile.isAgent && (
              <AgentBadge>{tProject("agentBadge")}</AgentBadge>
            )}
          </div>
          <span className="text-sm leading-5 text-muted">
            {profile.city
              ? t("place", { city: profile.city, month: joined })
              : t("joined", { month: joined })}
          </span>
          {profile.bio && <p className="max-w-[560px]">{profile.bio}</p>}
          {profile.links.length > 0 && (
            <ul className="flex flex-wrap gap-x-5">
              {profile.links.map((url) => (
                <li key={url} className="min-w-0 max-w-full">
                  <a
                    href={url}
                    rel="nofollow ugc noopener"
                    className="inline-flex min-h-11 max-w-full items-center gap-1.5 break-all text-[15px] font-semibold leading-6"
                  >
                    <LinkIcon size={16} strokeWidth={2.2} aria-hidden />
                    {linkLabel(url)}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {/* M3: the "Deschisă la colaborări" chip and "Scrie-i Ioanei" go in this row. */}
          {own && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 pt-1">
              <Button
                href={`/u/${profile.handle}/editeaza`}
                variant="secondary"
                size="sm"
              >
                {t("edit")}
              </Button>
            </div>
          )}
        </div>
      </div>
      <dl className="grid min-w-0 flex-[1_1_300px] grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col-reverse justify-end gap-0.5 rounded-md border border-line bg-bg p-3 md:p-4"
          >
            <dt className="text-[13px] leading-[18px] text-muted">
              {t(`stats.${stat.label}`, { n: stat.n })}
            </dt>
            <dd className="font-display text-[26px] font-bold leading-[1.1] tabular-nums md:text-[32px]">
              {stat.n}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
