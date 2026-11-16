import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/admin";
import { core } from "@/server/core";
import { TimelineView } from "../../timeline";

/** One person's votes and retractions, across projects (rule 14). */
export default async function UserVotesRoute({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const adminId = await requireAdmin(`/admin/voturi/oameni/${handle}`);
  const result = await core.votes.timeline(adminId, { user: handle });
  if (!result.ok) notFound();
  return <TimelineView timeline={result.value} />;
}
