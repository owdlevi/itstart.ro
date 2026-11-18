import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ModerationButton } from "@/components/moderation-button";
import { requireAdmin } from "@/server/admin";
import { core } from "@/server/core";
import { ModerationShell } from "./shell";

export async function generateMetadata() {
  const t = await getTranslations("admin.moderation");
  return { title: t("metaTitle") };
}

/**
 * The moderation queue: projects with open reports, the one waiting longest
 * first, each with its reports and the two ways to close them.
 */
export default async function ModerationReportsRoute() {
  const adminId = await requireAdmin("/admin/moderare");
  const [result, t, tReport, format] = await Promise.all([
    core.moderation.queue(adminId),
    getTranslations("admin.moderation.reports"),
    getTranslations("report"),
    getFormatter(),
  ]);
  if (!result.ok) notFound();

  return (
    <ModerationShell current="reports" lead={t("lead")}>
      {result.value.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {result.value.map(({ project, reports }) => {
            const titleId = `proiect-${project.id}`;
            return (
              <li
                key={project.id}
                className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 md:p-5"
              >
                <div className="flex flex-col gap-0.5">
                  <h2
                    id={titleId}
                    className="font-display text-[20px] font-bold leading-7 tracking-[-0.01em]"
                  >
                    <Link href={`/proiecte/${project.slug}`}>
                      {project.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted">
                    {t("owner", { name: project.owner.name })} ·{" "}
                    {t("count", { n: reports.length })}
                  </p>
                </div>
                <ul className="flex flex-col gap-3 border-t border-line pt-3">
                  {reports.map((report) => (
                    <li key={report.id} className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-semibold leading-6">
                        {tReport(`reasons.${report.reason}`)}
                      </span>
                      {report.details && (
                        <p className="whitespace-pre-line text-[15px] leading-[23px]">
                          {report.details}
                        </p>
                      )}
                      <span className="text-sm text-muted">
                        {t("by", {
                          name: report.reporter?.name ?? t("deleted"),
                          when: format.dateTime(report.createdAt, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-start gap-3 border-t border-line pt-3">
                  <ModerationButton
                    action={{
                      type: "hide",
                      kind: "project",
                      id: project.id,
                      hidden: true,
                    }}
                    label={t("hide")}
                    describedBy={titleId}
                    primary
                  />
                  <ModerationButton
                    action={{ type: "resolve", projectId: project.id }}
                    label={t("resolve")}
                    describedBy={titleId}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ModerationShell>
  );
}
