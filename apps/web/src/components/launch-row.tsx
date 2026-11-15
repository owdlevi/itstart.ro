import type { ProjectSummary } from "@repo/core";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { daysAgo } from "@/lib/dates";
import { now } from "@/server/core";
import { AgentBadge } from "./agent-badge";
import { Avatar } from "./avatar";
import { listTools } from "./project-card";
import { LaunchRowFrame } from "./launch-row-frame";
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
    <LaunchRowFrame
      thumbnail={project.thumbnail}
      title={
        <Link
          href={`/proiecte/${project.slug}`}
          className="text-ink no-underline hover:text-ink"
        >
          {project.name}
        </Link>
      }
      pitch={project.pitch}
      update={
        project.stage === "in_progress" &&
        project.latestUpdate &&
        t("update", {
          version: project.latestUpdate.version,
          days: daysAgo(project.latestUpdate.createdAt, now()),
          text: project.latestUpdate.text,
        })
      }
      tags={listTools(project).map((tag) => (
        <Tag key={tag.label} href={tag.href}>
          {tag.label}
        </Tag>
      ))}
      meta={
        <>
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
        </>
      }
      vote={vote}
    />
  );
}
