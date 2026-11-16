import { TIMELINE } from "@repo/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Container } from "@/components/container";
import { requireAdmin } from "@/server/admin";
import { core } from "@/server/core";
import { Table, Td, Th } from "./table";

export async function generateMetadata() {
  const t = await getTranslations("admin.votes");
  return { title: t("metaTitle") };
}

/**
 * Rule 14's way in: the projects and voters with the most votes and
 * retractions lately, each linking to its timeline (no reference design).
 */
export default async function AdminVotesRoute() {
  const adminId = await requireAdmin("/admin/voturi");
  const [result, t, format] = await Promise.all([
    core.votes.activity(adminId),
    getTranslations("admin.votes"),
    getFormatter(),
  ]);
  if (!result.ok) notFound();
  const { projects, voters } = result.value;
  const days = TIMELINE.activityDays;
  const when = (at: Date) =>
    format.dateTime(at, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Container className="max-w-[960px] pt-8 md:pt-12">
      <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[40px]">
        {t("title")}
      </h1>
      <p className="mt-2 max-w-[640px] text-muted">{t("lead")}</p>
      <p className="mt-2 max-w-[640px] text-sm text-muted">
        {t("signs", {
          days: TIMELINE.newAccountDays,
          count: TIMELINE.burst.count,
          minutes: TIMELINE.burst.minutes,
        })}
      </p>

      <section className="mt-8 flex flex-col gap-4">
        <h2
          id="proiecte"
          className="font-display text-[22px] font-bold leading-7 tracking-[-0.01em]"
        >
          {t("projects.title", { days })}
        </h2>
        {projects.length === 0 ? (
          <p className="text-muted">{t("projects.empty", { days })}</p>
        ) : (
          <Table labelledBy="proiecte">
            <thead>
              <tr>
                <Th>{t("projects.project")}</Th>
                <Th numeric>{t("projects.lastDay")}</Th>
                <Th numeric>{t("projects.lastWeek", { days })}</Th>
                <Th numeric>{t("projects.voters")}</Th>
                <Th numeric>{t("projects.fromNewAccounts")}</Th>
                <Th>{t("projects.lastAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.slug}>
                  <Td className="min-w-[200px]">
                    <Link
                      href={`/admin/voturi/proiecte/${p.slug}`}
                      className="font-semibold"
                    >
                      {p.name}
                    </Link>
                    <span className="block text-sm text-muted">
                      {p.ownerName}
                    </span>
                  </Td>
                  <Td numeric>{p.lastDay}</Td>
                  <Td numeric>{p.lastWeek}</Td>
                  <Td numeric>{p.voters}</Td>
                  <Td
                    numeric
                    className={
                      p.fromNewAccounts > 0
                        ? "font-bold text-warning-ink"
                        : undefined
                    }
                  >
                    {p.fromNewAccounts}
                  </Td>
                  <Td className="whitespace-nowrap">{when(p.lastAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      {voters.length > 0 && (
        <section className="mt-10 flex flex-col gap-4">
          <h2
            id="oameni"
            className="font-display text-[22px] font-bold leading-7 tracking-[-0.01em]"
          >
            {t("voters.title", { days })}
          </h2>
          <Table labelledBy="oameni">
            <thead>
              <tr>
                <Th>{t("voters.person")}</Th>
                <Th>{t("voters.joined")}</Th>
                <Th numeric>{t("projects.lastDay")}</Th>
                <Th numeric>{t("projects.lastWeek", { days })}</Th>
                <Th numeric>{t("voters.projects")}</Th>
                <Th>{t("projects.lastAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {voters.map((v) => (
                <tr key={v.handle ?? v.name}>
                  <Td className="min-w-[180px]">
                    {v.handle ? (
                      <Link
                        href={`/admin/voturi/oameni/${v.handle}`}
                        className="font-semibold"
                      >
                        {v.name}
                      </Link>
                    ) : (
                      v.name
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {format.dateTime(v.joinedAt, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Td>
                  <Td numeric>{v.lastDay}</Td>
                  <Td numeric>{v.lastWeek}</Td>
                  <Td numeric>{v.projects}</Td>
                  <Td className="whitespace-nowrap">{when(v.lastAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}
    </Container>
  );
}
