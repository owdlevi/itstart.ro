import type { RunningChallenge } from "@repo/core";
import { Clock } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Countdown } from "@/components/countdown";
import { LaunchRow } from "@/components/launch-row";
import { ProjectCard } from "@/components/project-card";
import { ProjectVote } from "@/components/project-vote";
import { SectionHeading } from "@/components/section-heading";
import { StatusChip } from "@/components/status-chip";
import { getRunningChallenge } from "@/server/challenge";
import { core, now } from "@/server/core";
import { getSession } from "@/server/session";

const eyebrow =
  "text-[13px] font-bold uppercase leading-[18px] tracking-[0.06em] text-primary";
const h2 =
  "text-2xl font-bold leading-[1.12] tracking-[-0.02em] md:text-[28px]";
const section =
  "flex flex-col gap-4 border-t border-line py-7 md:gap-6 md:py-12";

/** Screen 01 · Acasă (HANDOVER §6). */
export default async function HomePage() {
  const [t, format, session, challenge] = await Promise.all([
    getTranslations("home"),
    getFormatter(),
    getSession(),
    getRunningChallenge(),
  ]);
  const viewerId = session?.user.id ?? null;
  const challengeHref = challenge ? `/provocari/${challenge.slug}` : null;
  // Signed in: straight to the challenge. Signed out: sign in, then join it (screen 06).
  const joinHref =
    challenge &&
    (viewerId ? challengeHref! : `/intra?provocare=${challenge.slug}`);
  // §13.1 default: top 3 by votes in the running challenge.
  const top = challenge
    ? await core.projects.mostVoted({
        challengeId: challenge.id,
        limit: 3,
        viewerId,
      })
    : [];
  const month =
    challenge && format.dateTime(challenge.startsAt, { month: "long" });

  return (
    <Container>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] items-center gap-8 pb-10 pt-9 md:gap-14 md:pb-16 md:pt-[72px]">
        <div className="flex flex-col gap-4 md:gap-6">
          <p className={eyebrow}>{t("hero.eyebrow")}</p>
          <h1 className="text-[42px] font-bold leading-[1.02] tracking-[-0.03em] md:text-[68px]">
            {t("hero.title")}
          </h1>
          <p className="max-w-[520px] text-lg leading-[27px] text-muted md:text-xl md:leading-[30px]">
            {t("hero.lead")}
          </p>
          <div className="flex flex-wrap gap-3">
            {joinHref && month && (
              <Button href={joinHref} className="w-full md:w-auto">
                {t("hero.join", { month })}
              </Button>
            )}
            <Button
              href="/lansari"
              variant={joinHref ? "secondary" : "primary"}
              className="w-full md:w-auto"
            >
              {t("hero.launches")}
            </Button>
          </div>
        </div>
        {challenge && month && (
          <ChallengeCard
            challenge={challenge}
            month={month}
            deadline={format.dateTime(challenge.endsAt, {
              day: "numeric",
              month: "long",
            })}
          />
        )}
      </div>

      <section
        aria-label={t("steps.label")}
        className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-6 border-t border-line py-7 md:gap-10 md:py-12"
      >
        {(
          [
            ["brief", 1],
            ["build", 2],
            ["launch", 3],
          ] as const
        ).map(([step, n]) => (
          <div key={step} className="flex flex-col gap-2">
            <span
              aria-hidden
              className="inline-flex size-9 items-center justify-center rounded-md bg-tint font-display text-lg font-bold text-primary-hover"
            >
              {n}
            </span>
            <h3 className="text-xl font-bold leading-[1.12] tracking-[-0.02em]">
              {t(`steps.${step}.title`)}
            </h3>
            <p className="text-[15px] leading-[23px] text-muted">
              {t(`steps.${step}.text`)}
              {step === "brief" && challenge?.builtFor && (
                <>
                  {" "}
                  {t("steps.brief.thisMonth", { builtFor: challenge.builtFor })}
                </>
              )}
            </p>
          </div>
        ))}
      </section>

      <section className={section}>
        <SectionHeading title={t("why.title")} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
          {(
            ["beginner", "nonProgrammer", "programmer", "builder"] as const
          ).map((who) => (
            <div
              key={who}
              className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-5"
            >
              <h3 className="text-[19px] font-bold leading-[1.12] tracking-[-0.02em]">
                {t(`why.${who}.title`)}
              </h3>
              <p className="text-[15px] leading-[23px] text-muted">
                {t(`why.${who}.text`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {challenge && top.length > 0 && (
        <section className={`${section} pb-10 md:pb-[72px]`}>
          {/* §13.1: shows the running challenge's top 3, not this week's; the heading waits for the owner. */}
          <SectionHeading
            title={t("top.title")}
            link={{ href: "/lansari", label: t("top.all") }}
          />
          <div className="hidden grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-6 md:grid">
            {top.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                vote={
                  <ProjectVote
                    project={project}
                    viewerId={viewerId}
                    votingOpen
                  />
                }
              />
            ))}
          </div>
          <div className="flex flex-col gap-3 md:hidden">
            {top.map((project) => (
              <LaunchRow
                key={project.id}
                project={project}
                vote={
                  <ProjectVote
                    project={project}
                    viewerId={viewerId}
                    votingOpen
                  />
                }
              />
            ))}
          </div>
        </section>
      )}

      {joinHref && challenge?.builtFor && (
        <section className="mb-10 flex flex-wrap items-center justify-between gap-6 rounded-xl bg-band p-7 md:mb-[72px] md:p-12">
          <div className="flex flex-[1_1_320px] flex-col gap-2">
            <h2 className="text-[28px] font-bold leading-[1.12] tracking-[-0.02em] text-on-band md:text-4xl">
              {t("band.title", { builtFor: challenge.builtFor })}
            </h2>
            <p className="text-[17px] leading-[26px] text-on-band">
              {t("band.text")}
            </p>
          </div>
          <Button
            href={joinHref}
            variant="inverse"
            className="w-full md:w-auto"
          >
            {t("band.join")}
          </Button>
        </section>
      )}
    </Container>
  );
}

async function ChallengeCard({
  challenge,
  month,
  deadline,
}: {
  challenge: RunningChallenge;
  month: string;
  deadline: string;
}) {
  const t = await getTranslations("home.challengeCard");
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 shadow-raised md:p-7">
      <p className={eyebrow}>{t("eyebrow", { month })}</p>
      <h2 className={h2}>{challenge.title}</h2>
      {challenge.summary && <p className="text-muted">{challenge.summary}</p>}
      <Countdown
        deadline={challenge.endsAt.toISOString()}
        serverNow={now().toISOString()}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <StatusChip
          tone="warning"
          icon={<Clock size={15} strokeWidth={2.2} aria-hidden />}
        >
          {t("deadline", { date: deadline })}
        </StatusChip>
        <span>
          {t("counts", {
            people: challenge.counts.participants,
            agents: challenge.counts.agents,
            launches: challenge.counts.launched,
          })}
        </span>
      </div>
      <Button href={`/provocari/${challenge.slug}`} variant="secondary" full>
        {t("readBrief")}
      </Button>
    </section>
  );
}
