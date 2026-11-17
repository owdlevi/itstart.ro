import { TIMELINE, type VoteTimeline } from "@repo/core";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { AgentBadge } from "@/components/agent-badge";
import { Container } from "@/components/container";
import { StatusChip } from "@/components/status-chip";
import { Table, Td, Th } from "./table";

/** A project's or a person's votes and retractions, newest first (rule 14). */
export async function TimelineView({ timeline }: { timeline: VoteTimeline }) {
  const [t, format] = await Promise.all([
    getTranslations("admin.votes"),
    getFormatter(),
  ]);
  const { subject, summary, events } = timeline;
  const ofProject = subject.kind === "project";
  const age = (hours: number) =>
    hours < 48
      ? t("age", { hours })
      : t("ageDays", { days: Math.floor(hours / 24) });
  const facts = [
    t("timeline.summary.toggles", { n: summary.toggles }),
    t("timeline.summary.casts", { n: summary.casts }),
    t("timeline.summary.retracts", { n: summary.retracts }),
    ofProject
      ? t("timeline.summary.voters", { n: summary.distinct })
      : t("timeline.summary.projects", { n: summary.distinct }),
    t("timeline.summary.fromNewAccounts", { n: summary.fromNewAccounts }),
  ];

  return (
    <Container className="max-w-[960px] pt-6 md:pt-10">
      <Link
        href="/admin/voturi"
        className="inline-flex min-h-11 items-center text-[15px] font-semibold"
      >
        {t("back")}
      </Link>
      <h1
        id="cronologie"
        className="mt-2 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[40px]"
      >
        {ofProject
          ? t("timeline.projectTitle", { name: subject.name })
          : t("timeline.userTitle", { name: subject.name })}
      </h1>
      <p className="mt-2 text-muted">
        {ofProject
          ? t.rich("timeline.projectLead", {
              owner: subject.owner.name,
              link: (chunks) => (
                <Link href={`/proiecte/${subject.slug}`}>{chunks}</Link>
              ),
            })
          : t.rich("timeline.userLead", {
              date: format.dateTime(subject.joinedAt, {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
              link: (chunks) => (
                <Link href={`/u/${subject.handle}`}>{chunks}</Link>
              ),
            })}
      </p>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[15px] font-semibold">
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">
        {t("signs", {
          days: TIMELINE.newAccountDays,
          count: TIMELINE.burst.count,
          minutes: TIMELINE.burst.minutes,
        })}
        {summary.toggles > events.length &&
          ` ${t("timeline.limited", { limit: TIMELINE.limit })}`}
      </p>

      <div className="mt-6">
        {events.length === 0 ? (
          <p className="text-muted">{t("timeline.empty")}</p>
        ) : (
          <Table labelledBy="cronologie">
            <thead>
              <tr>
                <Th>{t("timeline.at")}</Th>
                <Th>{t("timeline.action")}</Th>
                <Th>{t("timeline.signs")}</Th>
                {ofProject ? (
                  <Th>{t("timeline.voter")}</Th>
                ) : (
                  <Th>{t("timeline.project")}</Th>
                )}
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => (
                <tr key={`${event.at.toISOString()}-${i}`}>
                  <Td className="whitespace-nowrap tabular-nums">
                    {format.dateTime(event.at, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </Td>
                  <Td
                    className={
                      event.action === "retract"
                        ? "text-muted"
                        : "font-semibold"
                    }
                  >
                    {t(`timeline.${event.action}`)}
                  </Td>
                  <Td className="min-w-[210px]">
                    <span className="flex gap-1.5">
                      {event.newAccount && (
                        <StatusChip tone="warning">
                          {t("timeline.newAccount", {
                            age: age(event.accountAgeHours),
                          })}
                        </StatusChip>
                      )}
                      {event.burst && (
                        <StatusChip tone="warning">
                          {t("timeline.burst")}
                        </StatusChip>
                      )}
                    </span>
                  </Td>
                  <Td className="min-w-[180px]">
                    {ofProject ? (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {event.voter.handle ? (
                          <Link
                            href={`/admin/voturi/oameni/${event.voter.handle}`}
                          >
                            {event.voter.name}
                          </Link>
                        ) : (
                          event.voter.name
                        )}
                        {event.voter.isAgent && (
                          <AgentBadge>{t("timeline.agent")}</AgentBadge>
                        )}
                      </span>
                    ) : (
                      <Link
                        href={`/admin/voturi/proiecte/${event.project.slug}`}
                      >
                        {event.project.name}
                      </Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </Container>
  );
}
