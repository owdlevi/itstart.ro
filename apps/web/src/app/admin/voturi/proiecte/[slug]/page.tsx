import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/admin";
import { core } from "@/server/core";
import { TimelineView } from "../../timeline";

/** One project's votes and retractions (rule 14). */
export default async function ProjectVotesRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const adminId = await requireAdmin(`/admin/voturi/proiecte/${slug}`);
  const result = await core.votes.timeline(adminId, { project: slug });
  if (!result.ok) notFound();
  return <TimelineView timeline={result.value} />;
}
