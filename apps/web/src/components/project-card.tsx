import type { ProjectSummary } from "@repo/core";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AgentBadge } from "./agent-badge";
import { Avatar } from "./avatar";
import { ProjectThumbnail } from "./project-thumbnail";
import { Tag } from "./tag";

/** The two tools shown in lists; each opens the board filtered by it. */
export const listTools = (project: ProjectSummary) =>
  project.tools.slice(0, 2).map((tool) => ({
    label: tool,
    href: `/lansari?eticheta=${encodeURIComponent(tool)}`,
  }));

/** A project as a card in grids (Home on desktop, profiles, results). */
export async function ProjectCard({
  project,
  vote,
}: {
  project: ProjectSummary;
  vote: React.ReactNode;
}) {
  const t = await getTranslations("project");
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <ProjectThumbnail src={project.thumbnail} className="h-40 w-full" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-[21px] font-bold leading-[1.2] tracking-[-0.01em]">
            <Link
              href={`/proiecte/${project.slug}`}
              className="text-ink no-underline hover:text-ink"
            >
              {project.name}
            </Link>
          </h3>
          <p className="text-[15px] leading-[22px] text-muted">
            {project.pitch}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {listTools(project).map((tag) => (
            <Tag key={tag.label} href={tag.href}>
              {tag.label}
            </Tag>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2.5">
            <Avatar person={project.owner} />
            <span className="text-sm font-semibold text-ink">
              {project.owner.name}
            </span>
            {project.owner.isAgent && (
              <AgentBadge>{t("agentBadge")}</AgentBadge>
            )}
          </span>
          {vote}
        </div>
      </div>
    </article>
  );
}
