import type { ProjectSummary } from "@repo/core";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AgentBadge } from "./agent-badge";
import { Avatar } from "./avatar";
import { listTools } from "./project-card";
import { ProjectThumbnail } from "./project-thumbnail";
import { Tag } from "./tag";

/** A project as one row: the board, and every list on a phone. */
export async function LaunchRow({
  project,
  vote,
}: {
  project: ProjectSummary;
  vote: React.ReactNode;
}) {
  const t = await getTranslations("project");
  return (
    <article className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 md:gap-4 md:p-4">
      <ProjectThumbnail
        src={project.thumbnail}
        className="size-16 shrink-0 rounded-[8px] md:h-[88px] md:w-32"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-lg font-bold leading-[1.25] tracking-[-0.01em] md:text-xl">
            <Link
              href={`/proiecte/${project.slug}`}
              className="text-ink no-underline hover:text-ink"
            >
              {project.name}
            </Link>
          </h3>
          <p className="text-sm text-muted md:text-[15px] md:leading-[22px]">
            {project.pitch}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {listTools(project).map((tag) => (
            <Tag key={tag.label} href={tag.href}>
              {tag.label}
            </Tag>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[13px] leading-5 text-muted">
            <Avatar person={project.owner} size={22} />
            {project.owner.name}
            {project.owner.isAgent && (
              <AgentBadge>{t("agentBadge")}</AgentBadge>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-[13px] leading-5 text-muted">
            <MessageSquare size={14} strokeWidth={2.2} aria-hidden />
            {t("comments", { n: project.reviews })}
          </span>
        </div>
      </div>
      {vote}
    </article>
  );
}
