import type { ArchivedChallenge, JuryPick } from "@repo/core";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { AgentBadge } from "@/components/agent-badge";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { StatusChip } from "@/components/status-chip";
import { cn } from "@/lib/utils";
import { core, now } from "@/server/core";

const DAY = 86_400_000;
/**
 * Where "Propune un brief" writes, until there's a form (DECISIONS, "Screen
 * 12"). The owner confirms the mailbox (NEXT-ACTIONS).
 */
const BRIEF_ADDRESS = "echipa@itstart.ro";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("archive");
  return { title: t("metaTitle") };
}

/** Screen 12 · Toate provocările (HANDOVER §6): every challenge that has started. */
export default async function ArchivePage() {
  const [list, t, tStatus, format] = await Promise.all([
    core.challenges.archive(),
    getTranslations("archive"),
    getTranslations("challenge.status"),
    getFormatter(),
  ]);
  const picks = await core.recognitions.juryPicks(
    list.filter((c) => c.status === "ended").map((c) => c.id),
  );

  const month = (date: Date) =>
    format.dateTime(date, { month: "long", year: "numeric" });
  const first = list.at(-1);
  // The month after the latest one starts on the 1st, a minute after its deadline.
  const nextStart = list[0] && new Date(list[0].endsAt.getTime() + 60_000);
  const subject = encodeURIComponent(t("proposeSubject"));

  return (
    <Container className="max-w-[960px]">
      <div className="flex flex-col gap-2 pb-5 pt-7 md:pb-8 md:pt-12">
        <h1 className="text-[36px] font-bold leading-[1.12] tracking-[-0.02em] md:text-5xl md:leading-[1.12]">
          {t("title")}
        </h1>
        <p className="text-[17px] leading-[26px] text-muted">
          {t("lead", { since: first ? month(first.startsAt) : "none" })}
        </p>
      </div>

      {list.length > 0 ? (
        <ul className="flex flex-col gap-3 pb-6 md:pb-8">
          {list.map((challenge) => (
            <Row
              key={challenge.id}
              challenge={challenge}
              pick={picks.get(challenge.id) ?? null}
              month={month(challenge.startsAt)}
              status={tStatus(challenge.status)}
              t={t}
            />
          ))}
        </ul>
      ) : (
        <p className="pb-6 leading-6 text-muted md:pb-8">{t("empty")}</p>
      )}

      <p className="pb-10 text-[15px] leading-[23px] text-muted md:pb-[72px]">
        {nextStart && nextStart > now() && (
          <>
            {t("next", {
              month: format.dateTime(nextStart, { month: "long" }),
              date: format.dateTime(nextStart, {
                day: "numeric",
                month: "long",
              }),
            })}{" "}
          </>
        )}
        {t.rich("propose", {
          link: (chunks) => (
            <a href={`mailto:${BRIEF_ADDRESS}?subject=${subject}`}>{chunks}</a>
          ),
        })}
      </p>
    </Container>
  );
}

function Row({
  challenge,
  pick,
  month,
  status,
  t,
}: {
  challenge: ArchivedChallenge;
  pick: JuryPick | null;
  month: string;
  status: string;
  t: Awaited<ReturnType<typeof getTranslations<"archive">>>;
}) {
  const running = challenge.status === "running";
  const { counts } = challenge;
  const titleId = `provocare-${challenge.slug}`;
  return (
    <li
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg bg-surface p-4 md:p-5",
        running ? "border-2 border-primary" : "border border-line",
      )}
    >
      <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3.5">
        <span
          aria-hidden
          className="inline-flex size-11 flex-none items-center justify-center rounded-md bg-tint font-display text-[17px] font-bold text-primary-hover"
        >
          #{challenge.number}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-[13px] font-bold leading-[18px] text-muted">
              {month}
            </span>
            {running ? (
              <StatusChip>{status}</StatusChip>
            ) : (
              <AgentBadge>{status}</AgentBadge>
            )}
          </div>
          <h2
            id={titleId}
            className="text-[20px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[22px]"
          >
            <span className="sr-only">
              {t("number", { number: challenge.number })}
            </span>
            {challenge.title}
          </h2>
          <p className="text-sm leading-5 text-muted">
            {running
              ? t("runningCounts", {
                  people: counts.participants,
                  agents: counts.agents,
                  launches: counts.launched,
                  days: Math.floor(
                    (challenge.endsAt.getTime() - now().getTime()) / DAY,
                  ),
                })
              : t("endedCounts", {
                  people: counts.participants,
                  launches: counts.launched,
                })}
            {pick &&
              t("juryPick", {
                project: pick.project.name,
                builder: pick.builder.name,
              })}
          </p>
        </div>
      </div>
      <Button
        href={`/provocari/${challenge.slug}`}
        variant={running ? "primary" : "secondary"}
        aria-describedby={titleId}
        className="w-full md:w-auto"
      >
        {running ? t("see") : t("results")}
      </Button>
    </li>
  );
}
