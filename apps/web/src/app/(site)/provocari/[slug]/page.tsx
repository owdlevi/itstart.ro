import type { Challenge, Participant } from "@repo/core";
import { Check, Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AgentBadge } from "@/components/agent-badge";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Countdown } from "@/components/countdown";
import { LaunchRow } from "@/components/launch-row";
import { ProjectVote } from "@/components/project-vote";
import { SectionHeading } from "@/components/section-heading";
import { StatusChip } from "@/components/status-chip";
import { flags } from "@/flags";
import { cn } from "@/lib/utils";
import { core, now } from "@/server/core";
import { getSession } from "@/server/session";

const h2 =
  "text-2xl font-bold leading-[1.12] tracking-[-0.02em] md:text-[28px]";
const panel = "flex flex-col gap-4 rounded-lg border border-line bg-surface";
// Sidebar panels: Inter 16/24 headings, not the display face.
const sideH2 = "font-sans text-base font-bold";
const small = "text-sm text-muted";

const LIST_LIMIT = 4;
const AVATARS = 8;
const NAMED = 3;

/** Screen 02 · Provocare (HANDOVER §6). Screen 08 adds the joined state. */
export default async function ChallengePage({
  params,
}: PageProps<"/provocari/[slug]">) {
  const { slug } = await params;
  const [challenge, session] = await Promise.all([
    core.challenges.bySlug(slug),
    getSession(),
  ]);
  if (!challenge) notFound();

  const viewerId = session?.user.id ?? null;
  const list = {
    challengeId: challenge.id,
    limit: LIST_LIMIT,
    viewerId,
    agents: flags.builderAgents,
  };
  const [t, format, launched, inProgress, participants] = await Promise.all([
    getTranslations("challenge"),
    getFormatter(),
    core.projects.mostVoted(list),
    core.projects.inProgress(list),
    core.challenges.participants({
      challengeId: challenge.id,
      limit: AVATARS,
      viewerId,
    }),
  ]);
  const boardHref = `/lansari?provocare=${challenge.slug}`;

  return (
    <Container>
      <div className="flex flex-col gap-3 pb-6 pt-7 md:gap-4 md:pb-10 md:pt-12">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[13px] font-bold uppercase leading-[18px] tracking-[0.06em] text-primary">
            {t("eyebrow", {
              number: challenge.number,
              month: format.dateTime(challenge.startsAt, {
                month: "long",
                year: "numeric",
              }),
            })}
          </p>
          <ChallengeStatusChip challenge={challenge} />
          {flags.challengeArchive && (
            <Link
              href="/provocari"
              className="inline-flex min-h-11 items-center text-sm font-semibold"
            >
              {t("allChallenges")}
            </Link>
          )}
        </div>
        <h1 className="max-w-[820px] text-[32px] font-bold leading-[1.12] tracking-[-0.02em] md:text-5xl md:leading-[1.12]">
          {challenge.title}
        </h1>
        {challenge.intro && (
          <p className="max-w-[680px] text-[17px] leading-[26px] text-muted md:text-[19px] md:leading-[29px]">
            {challenge.intro}
          </p>
        )}
      </div>

      {/* The sidebar comes first in the DOM, so phones get the countdown and
          the join button above the brief; from 768px it moves to the right. */}
      <div className="flex flex-wrap items-start gap-6 pb-10 md:gap-10 md:pb-[72px]">
        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 md:order-last">
          {challenge.status !== "ended" && <TimeLeft challenge={challenge} />}
          <People challenge={challenge} participants={participants} />
          <Recognitions />
          {/* M3 (flags.builderAgents): the "Și 4 agenți AI" panel goes here. */}
        </aside>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-8 md:gap-12">
          <Brief challenge={challenge} />

          {challenge.tips.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className={h2}>{t("tips.title")}</h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
                {challenge.tips.map((tip) => (
                  <div
                    key={tip.title}
                    className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-5"
                  >
                    <h3 className="text-[19px] font-bold leading-[1.12] tracking-[-0.02em]">
                      {tip.title}
                    </h3>
                    <p className="text-[15px] leading-[23px] text-muted">
                      {tip.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* M2 (flags.questions): "Întrebări și ajutor" goes here. */}

          {launched.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeading
                title={t("launched.title", { n: challenge.counts.launched })}
                link={{ href: boardHref, label: t("launched.all") }}
              />
              <div className="flex flex-col gap-3">
                {launched.map((project) => (
                  <LaunchRow
                    key={project.id}
                    project={project}
                    vote={
                      <ProjectVote
                        project={project}
                        viewerId={viewerId}
                        votingOpen={challenge.votingOpen}
                      />
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {inProgress.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeading
                title={t("inProgress.title", {
                  n: challenge.counts.inProgress,
                })}
                link={{
                  href: `${boardHref}&stadiu=in-lucru`,
                  label: t("inProgress.all"),
                }}
              />
              <p className="-mt-2 text-[15px] leading-[23px] text-muted">
                {t("inProgress.text")}
              </p>
              <div className="flex flex-col gap-3">
                {inProgress.map((project) => (
                  <LaunchRow
                    key={project.id}
                    project={project}
                    vote={
                      <ProjectVote
                        project={project}
                        viewerId={viewerId}
                        votingOpen={challenge.votingOpen}
                      />
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Container>
  );
}

async function ChallengeStatusChip({ challenge }: { challenge: Challenge }) {
  const [t, format] = await Promise.all([
    getTranslations("challenge.status"),
    getFormatter(),
  ]);
  if (challenge.status === "ended") {
    return <AgentBadge>{t("ended")}</AgentBadge>;
  }
  if (challenge.status === "upcoming") {
    return (
      <StatusChip tone="warning">
        {t("upcoming", {
          date: format.dateTime(challenge.startsAt, {
            day: "numeric",
            month: "long",
          }),
        })}
      </StatusChip>
    );
  }
  return <StatusChip>{t("running")}</StatusChip>;
}

async function Brief({ challenge }: { challenge: Challenge }) {
  const t = await getTranslations("challenge.brief");
  const lists = [
    ["baseLevel", challenge.baseLevel, "text-primary"],
    ["stretch", challenge.stretch, "text-muted"],
    ["launchCriteria", challenge.launchCriteria, "text-primary"],
  ] as const;

  return (
    <section className={cn(panel, "p-5 md:p-7")}>
      <h2 className={h2}>{t("title")}</h2>
      {challenge.scenarioNote && (
        <p className={small}>{challenge.scenarioNote}</p>
      )}
      {challenge.scenario && <p>{challenge.scenario}</p>}
      {lists.map(
        ([key, items, tick]) =>
          items.length > 0 && (
            <div key={key} className="contents">
              <h3 className="mt-2 font-sans text-base font-bold">{t(key)}</h3>
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className={cn("inline-flex pt-[3px]", tick)}>
                      <Check
                        size={18}
                        strokeWidth={2.6}
                        aria-hidden
                        className="flex-none"
                      />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}
      {challenge.launchNote && <p className={small}>{challenge.launchNote}</p>}
      {challenge.materialsUrl && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
          <Button href={challenge.materialsUrl} variant="secondary">
            <Download
              size={18}
              strokeWidth={2.2}
              aria-hidden
              className="flex-none"
            />
            {t("materials")}
          </Button>
          {challenge.materialsNote && (
            <span className={small}>{challenge.materialsNote}</span>
          )}
        </div>
      )}
    </section>
  );
}

async function TimeLeft({ challenge }: { challenge: Challenge }) {
  const [t, format] = await Promise.all([
    getTranslations("challenge.timeLeft"),
    getFormatter(),
  ]);
  return (
    <section className={cn(panel, "p-5")}>
      <h2 className={sideH2}>{t("title")}</h2>
      <Countdown
        deadline={challenge.endsAt.toISOString()}
        serverNow={now().toISOString()}
      />
      <p className={small}>
        {t("deadline", {
          date: format.dateTime(challenge.endsAt, {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
          time: format.dateTime(challenge.endsAt, {
            hour: "2-digit",
            minute: "2-digit",
          }),
        })}
      </p>
      {/* Joining happens on sign-in (screen 06); screen 08 adds the joined state. */}
      <div className="flex flex-col gap-2.5">
        <Button href={`/intra?provocare=${challenge.slug}`} full>
          {t("join")}
        </Button>
      </div>
      <p className={small}>{t("joinNote")}</p>
    </section>
  );
}

async function People({
  challenge,
  participants,
}: {
  challenge: Challenge;
  participants: Participant[];
}) {
  const [t, format] = await Promise.all([
    getTranslations("challenge.people"),
    getFormatter(),
  ]);
  const { participants: total, launchers } = challenge.counts;
  const named = participants.slice(0, NAMED).map((p) => p.givenName);
  const rest = total - named.length;

  return (
    <section className={cn(panel, "p-5")}>
      <h2 className={sideH2}>{t("title", { n: total })}</h2>
      {participants.length > 0 && (
        <>
          <div
            role="img"
            aria-label={t("avatarsLabel")}
            className="flex flex-wrap gap-2"
          >
            {participants.map((person) => (
              <Avatar key={person.id} person={person} size={40} />
            ))}
          </div>
          <p className={small}>
            {format.list(rest > 0 ? [...named, t("more", { n: rest })] : named)}
            . {t("launchers", { n: launchers })}
          </p>
        </>
      )}
    </section>
  );
}

async function Recognitions() {
  const t = await getTranslations("challenge.recognitions");
  return (
    <section className={cn(panel, "p-5")}>
      <h2 className={sideH2}>{t("title")}</h2>
      <ul className="flex flex-col gap-2.5 text-[15px] leading-[22px]">
        {(["community", "jury", "firstProject"] as const).map((kind) => (
          <li key={kind}>
            <span className="font-bold">{t(`${kind}.name`)}</span>{" "}
            <span className="text-muted">{t(`${kind}.text`)}</span>
          </li>
        ))}
      </ul>
      <p className={small}>{t("note")}</p>
    </section>
  );
}
