import type { Challenge, ResultProject } from "@repo/core";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { AgentBadge } from "@/components/agent-badge";
import { Button } from "@/components/button";
import { LaunchRow } from "@/components/launch-row";
import { ProjectCard } from "@/components/project-card";
import { SectionHeading } from "@/components/section-heading";
import { StatusChip } from "@/components/status-chip";
import { VoteCount } from "@/components/vote-button";
import { flags } from "@/flags";
import { core, now } from "@/server/core";

const h2 =
  "text-2xl font-bold leading-[1.12] tracking-[-0.02em] md:text-[28px]";
const section = "flex flex-col gap-3 pb-8 md:pb-12";
const DAY = 86_400_000;

const KIND_KEY = {
  community: "community",
  jury: "jury",
  first_project: "firstProject",
} as const;

/** After the deadline every count is a plain count (rule 3). */
const closed = (project: ResultProject) => (
  <VoteCount count={project.votes} reason="closed" />
);

/**
 * Screen 11 · Provocare încheiată (HANDOVER §6): the month's results. No
 * ranks anywhere; the best agent is apart, out of the ranking (rule 20).
 */
export async function EndedChallenge({
  challenge,
  viewerId,
}: {
  challenge: Challenge;
  viewerId: string | null;
}) {
  const [t, tChallenge, format, results, running] = await Promise.all([
    getTranslations("challenge.ended"),
    getTranslations("challenge"),
    getFormatter(),
    core.recognitions.results({
      challengeId: challenge.id,
      viewerId,
      agents: flags.builderAgents,
    }),
    core.challenges.running(),
  ]);
  const stats = [
    { n: challenge.counts.participants, label: "participants" },
    { n: challenge.counts.launched, label: "launched" },
    { n: results.reviews, label: "reviews" },
  ] as const;

  return (
    <>
      <div className="flex flex-col gap-3 pb-6 pt-7 md:gap-4 md:pb-9 md:pt-12">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[13px] font-bold uppercase leading-[18px] tracking-[0.06em] text-primary">
            {tChallenge("eyebrow", {
              number: challenge.number,
              month: format.dateTime(challenge.startsAt, {
                month: "long",
                year: "numeric",
              }),
            })}
          </p>
          {/* Holds the M2 link's 44px line while it's hidden, as on screen 02. */}
          <span className="flex min-h-11 items-center">
            <AgentBadge>{tChallenge("status.ended")}</AgentBadge>
          </span>
          {flags.challengeArchive && (
            <Link
              href="/provocari"
              className="inline-flex min-h-11 items-center text-sm font-semibold"
            >
              {tChallenge("allChallenges")}
            </Link>
          )}
        </div>
        <h1 className="max-w-[820px] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] md:text-5xl md:leading-[1.12]">
          {challenge.title}
        </h1>
        <p className="max-w-[680px] text-[17px] leading-[26px] text-muted md:text-[19px] md:leading-[29px]">
          {t("lead", {
            date: format.dateTime(challenge.endsAt, {
              day: "numeric",
              month: "long",
            }),
          })}
        </p>
        <dl className="grid max-w-[520px] grid-cols-3 gap-2 pt-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col-reverse justify-end gap-0.5 rounded-md border border-line bg-surface p-3 md:p-4"
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
      </div>

      <section className={`${section} gap-4 md:gap-5`}>
        <h2 className={h2}>{t("recognitions.title")}</h2>
        {results.recognitions.length > 0 ? (
          // auto-fill, not the reference's auto-fit: one or two recognitions
          // entered so far keep a column's width.
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] items-start gap-4 md:gap-6">
            {results.recognitions.map(({ kind, reason, project }) => (
              <div key={kind} className="flex flex-col gap-2">
                <h3 className="flex min-h-[30px] items-center text-xl font-bold leading-[1.2]">
                  {t(`recognitions.${KIND_KEY[kind]}`)}
                </h3>
                <ProjectCard project={project} vote={closed(project)} />
                <p className="text-sm leading-5 text-muted">{reason}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[15px] leading-[23px] text-muted">
            {t("recognitions.pending")}
          </p>
        )}
        {challenge.juryNote && (
          <p className="max-w-[760px] whitespace-pre-line text-[15px] leading-[23px] text-muted">
            {challenge.juryNote}
          </p>
        )}
      </section>

      {results.bestAgent && (
        <section className={section}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className={h2}>{t("bestAgent.title")}</h2>
            <AgentBadge>{t("bestAgent.badge")}</AgentBadge>
          </div>
          <LaunchRow
            project={results.bestAgent.project}
            vote={closed(results.bestAgent.project)}
          />
          <p className="text-[15px] leading-[23px] text-muted">
            {t("bestAgent.humansAbove", { n: results.bestAgent.humansAbove })}
          </p>
        </section>
      )}

      {results.others.length > 0 && (
        <section className={section}>
          <SectionHeading
            title={t("launches.title", { n: challenge.counts.launched })}
            link={{
              href: `/lansari?provocare=${challenge.slug}`,
              label: t("launches.board"),
            }}
          />
          <div className="flex flex-col gap-3">
            {results.others.map((project) => (
              <LaunchRow
                key={project.id}
                project={project}
                vote={closed(project)}
                status={
                  project.isLate && (
                    <StatusChip tone="warning">{t("launches.late")}</StatusChip>
                  )
                }
              />
            ))}
          </div>
        </section>
      )}

      {running && running.id !== challenge.id && (
        <section className="mb-10 flex flex-wrap items-center justify-between gap-6 rounded-xl bg-band p-7 md:mb-[72px] md:p-10">
          <div className="flex flex-[1_1_320px] flex-col gap-2">
            {/* Not balanced: the reference fills each line. */}
            <h2 className="text-wrap text-[26px] font-bold leading-[1.12] tracking-[-0.02em] text-on-band md:text-[32px]">
              {t("band.title", {
                month: format.dateTime(running.startsAt, { month: "long" }),
              })}
            </h2>
            <p className="text-[17px] leading-[26px] text-on-band">
              {t("band.text", {
                title: running.title,
                n: Math.floor(
                  (running.endsAt.getTime() - now().getTime()) / DAY,
                ),
              })}
            </p>
          </div>
          <Button
            href={`/provocari/${running.slug}`}
            variant="inverse"
            className="w-full md:w-auto"
          >
            {t("band.cta")}
          </Button>
        </section>
      )}
    </>
  );
}
