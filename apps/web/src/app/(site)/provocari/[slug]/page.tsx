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
import { FlashBanner } from "@/components/flash-banner";
import { JoinButton } from "@/components/join-button";
import { LaunchRow } from "@/components/launch-row";
import { LeaveChallenge } from "@/components/leave-challenge";
import { ProjectVote } from "@/components/project-vote";
import { SectionHeading } from "@/components/section-heading";
import { StatusChip } from "@/components/status-chip";
import { flags } from "@/flags";
import { JOINED_PARAM, LEFT_PARAM } from "@/lib/sign-in-destination";
import { cn } from "@/lib/utils";
import { core, designFixtures, now } from "@/server/core";
import { getSession, type Session } from "@/server/session";

const h2 =
  "text-2xl font-bold leading-[1.12] tracking-[-0.02em] md:text-[28px]";
const panel = "flex flex-col gap-4 rounded-lg border border-line bg-surface";
// Sidebar panels: Inter 16/24 headings, not the display face.
const sideH2 = "font-sans text-base font-bold";
const small = "text-sm text-muted";

const LIST_LIMIT = 4;
const AVATARS = 8;
const NAMED = 3;
const DAY = 86_400_000;
// Design fixtures only: a join this recent counts as "right after joining",
// so screen 08's capture (no query flag) shows the banner. The clock is
// frozen there; Bianca's seeded join is a minute old (DECISIONS, "Screen 08 data").
const FIXTURES_JUST_JOINED = 10 * 60_000;

/**
 * Screen 02 · Provocare (HANDOVER §6), and screen 08 for a participant: the
 * joined banner (once, after joining), the chip, "Pașii tăi" and leaving.
 */
export default async function ChallengePage({
  params,
  searchParams,
}: PageProps<"/provocari/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
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
  const [t, format, launched, inProgress, participants, participation] =
    await Promise.all([
      getTranslations("challenge"),
      getFormatter(),
      core.projects.mostVoted(list),
      core.projects.inProgress(list),
      core.challenges.participants({
        challengeId: challenge.id,
        limit: AVATARS,
        viewerId,
      }),
      viewerId ? core.challenges.participation(challenge.id, viewerId) : null,
    ]);
  const boardHref = `/lansari?provocare=${challenge.slug}`;
  const ended = challenge.status === "ended";
  const joined = !!participation && !ended;
  const justJoined =
    joined &&
    (query[JOINED_PARAM] === "1" ||
      (designFixtures &&
        now().getTime() - participation.joinedAt.getTime() <
          FIXTURES_JUST_JOINED));
  const justLeft = !participation && !!session && query[LEFT_PARAM] === "1";
  const viewer = participants.find((p) => p.id === viewerId);

  return (
    <Container>
      {justJoined && (
        <FlashBanner param={JOINED_PARAM}>
          {viewer?.givenName
            ? t("participation.joined.greeting", { name: viewer.givenName })
            : t("participation.joined.greetingNoName")}{" "}
          {challenge.status === "upcoming"
            ? t("participation.joined.startsOn", {
                date: format.dateTime(challenge.startsAt, {
                  day: "numeric",
                  month: "long",
                }),
              })
            : t("participation.joined.daysLeft", {
                n: Math.floor(
                  (challenge.endsAt.getTime() - now().getTime()) / DAY,
                ),
              })}
        </FlashBanner>
      )}
      {justLeft && (
        <FlashBanner param={LEFT_PARAM} tone="quiet">
          {t("participation.left")}
        </FlashBanner>
      )}
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
          {/* The chip shares a line with the M2 link (44px tap target), so it
              holds that height and the header keeps the reference's rhythm
              while the link is hidden, on one line or two. */}
          <span className="flex min-h-11 max-w-full flex-wrap items-center gap-x-3 gap-y-2">
            <ChallengeStatusChip challenge={challenge} />
            {joined && (
              <StatusChip
                icon={
                  <Check
                    size={15}
                    strokeWidth={2.2}
                    aria-hidden
                    className="flex-none"
                  />
                }
              >
                {t("participation.chip")}
              </StatusChip>
            )}
          </span>
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

      {/* The sidebar comes first in the DOM, so a single column gets the
          countdown and the join button above the brief. It moves right only
          once both columns fit side by side: 560 + 40 + 320 + 2 × 32 = 984px.
          Below that (768px tablets included) the flex row wraps to one column. */}
      <div className="flex flex-wrap items-start gap-6 pb-10 md:gap-10 md:pb-[72px]">
        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 min-[984px]:order-last">
          {!ended && (
            <TimeLeft
              challenge={challenge}
              session={session}
              joined={joined}
            />
          )}
          <People
            challenge={challenge}
            participants={participants}
            viewerId={viewerId}
          />
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
  // An empty panel would be a heading over nothing (past challenges in the
  // fixtures have no brief; an admin may not have written one yet).
  if (
    !challenge.scenario &&
    !challenge.scenarioNote &&
    !challenge.materialsUrl &&
    lists.every(([, items]) => items.length === 0)
  ) {
    return null;
  }

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

async function TimeLeft({
  challenge,
  session,
  joined,
}: {
  challenge: Challenge;
  session: Session | null;
  joined: boolean;
}) {
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
      {joined ? (
        <>
          <Steps challenge={challenge} userId={session!.user.id} />
          <div className="flex flex-col gap-2.5">
            <Button href="/lanseaza" full>
              {t("addProject")}
            </Button>
            <LeaveChallenge slug={challenge.slug} />
          </div>
        </>
      ) : session?.user.onboardedAt ? (
        // One action (rule 2): nothing to sign in to, so no note.
        <JoinButton slug={challenge.slug} />
      ) : (
        // Signed out: sign-in joins it (screen 06). Signed in without a name
        // yet: /bun-venit joins it once they have one (screen 07).
        <>
          <div className="flex flex-col gap-2.5">
            <Button
              href={`${session ? "/bun-venit" : "/intra"}?provocare=${challenge.slug}`}
              full
            >
              {t("join")}
            </Button>
          </div>
          <p className={small}>{t("joinNote")}</p>
        </>
      )}
    </section>
  );
}

/** "Pașii tăi": done / not done, from their projects in the challenge. */
async function Steps({
  challenge,
  userId,
}: {
  challenge: Challenge;
  userId: string;
}) {
  const [t, format, steps] = await Promise.all([
    getTranslations("challenge.steps"),
    getFormatter(),
    core.challenges.steps(challenge.id, userId),
  ]);
  const items = [
    { done: true, label: t("joined") },
    { done: steps.posted, label: t("posted") },
    {
      done: steps.launched,
      label: t("launched", {
        date: format.dateTime(challenge.endsAt, {
          day: "numeric",
          month: "long",
        }),
      }),
    },
  ];
  return (
    <>
      <h2 className={cn(sideH2, "mt-1")}>{t("title")}</h2>
      <ul className="flex flex-col gap-2.5">
        {items.map(({ done, label }) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2.5 text-[15px] leading-[22px]",
              done ? "text-muted" : "text-ink",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-flex size-[22px] flex-none items-center justify-center rounded-full",
                done
                  ? "bg-primary text-on-primary"
                  : "border-2 border-border",
              )}
            >
              {done && (
                <Check size={14} strokeWidth={3} className="flex-none" />
              )}
            </span>
            <span>{done ? t("done", { step: label }) : label}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

async function People({
  challenge,
  participants,
  viewerId,
}: {
  challenge: Challenge;
  participants: Participant[];
  viewerId: string | null;
}) {
  const [t, format] = await Promise.all([
    getTranslations("challenge.people"),
    getFormatter(),
  ]);
  const { participants: total, launchers } = challenge.counts;
  // The viewer, when they're in, is named first, as "Tu" (screen 08); the
  // avatars stay in join order, as in the reference.
  const you = participants.some((p) => p.id === viewerId);
  const named = [
    ...(you ? [t("you")] : []),
    ...participants
      .filter((p) => p.id !== viewerId)
      .slice(0, you ? NAMED - 1 : NAMED)
      .map((p) => p.givenName),
  ];
  const rest = total - named.length;
  const ended = challenge.status === "ended";

  return (
    <section className={cn(panel, "p-5")}>
      <h2 className={sideH2}>
        {t(ended ? "titleEnded" : "title", { n: total })}
      </h2>
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
            . {t(ended ? "launchersEnded" : "launchers", { n: launchers })}
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
