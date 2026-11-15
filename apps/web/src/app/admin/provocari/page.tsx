import { monthBounds } from "@repo/core";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AgentBadge } from "@/components/agent-badge";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { StatusChip } from "@/components/status-chip";
import { requireAdmin } from "@/server/admin";
import { core } from "@/server/core";

/** Every challenge, newest month first, with its status (no reference design). */
export default async function AdminChallengesRoute() {
  const adminId = await requireAdmin("/admin/provocari");
  const [result, t, tStatus, format] = await Promise.all([
    core.challenges.all(adminId),
    getTranslations("admin.challenges"),
    getTranslations("challenge.status"),
    getFormatter(),
  ]);
  if (!result.ok) notFound();

  return (
    <Container className="max-w-[960px] pt-8 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[600px] flex-col gap-2">
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[40px]">
            {t("title")}
          </h1>
          <p className="text-muted">{t("lead")}</p>
        </div>
        <Button href="/admin/provocari/noua" className="w-full md:w-auto">
          {t("new")}
        </Button>
      </div>

      {result.value.length === 0 ? (
        <p className="mt-8 text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {result.value.map((challenge) => {
            const { startsAt } = monthBounds(challenge.month);
            return (
              <li
                key={challenge.slug}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-line bg-surface p-4 md:px-6"
              >
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-bold uppercase leading-[18px] tracking-[0.06em] text-muted">
                      {t("row", {
                        number: challenge.number,
                        month: format.dateTime(startsAt, {
                          month: "long",
                          year: "numeric",
                        }),
                      })}
                    </span>
                    {challenge.status === "ended" ? (
                      <AgentBadge>{tStatus("ended")}</AgentBadge>
                    ) : (
                      <StatusChip
                        tone={
                          challenge.status === "running" ? "success" : "warning"
                        }
                      >
                        {challenge.status === "running"
                          ? tStatus("running")
                          : tStatus("upcoming", {
                              date: format.dateTime(startsAt, {
                                day: "numeric",
                                month: "long",
                              }),
                            })}
                      </StatusChip>
                    )}
                  </div>
                  <h2 className="text-lg font-bold leading-6">
                    {challenge.title}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    href={`/admin/provocari/${challenge.slug}`}
                    variant="secondary"
                    size="sm"
                  >
                    {t("edit")}
                    <span className="sr-only">
                      {t("which", { number: challenge.number })}
                    </span>
                  </Button>
                  <Button
                    href={`/provocari/${challenge.slug}`}
                    variant="secondary"
                    size="sm"
                  >
                    {t("view")}
                    <span className="sr-only">
                      {t("which", { number: challenge.number })}
                    </span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
