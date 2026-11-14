import type { ProjectSummary } from "@repo/core";
import { VoteButton, VoteCount } from "./vote-button";

/**
 * Picks the vote slot: În lucru (rule 5), closed (rule 3), own project
 * (rule 11), or the button. Core enforces the same rules on the server.
 */
export function ProjectVote({
  project,
  viewerId,
  votingOpen,
}: {
  project: ProjectSummary;
  viewerId: string | null;
  votingOpen: boolean;
}) {
  if (project.stage === "in_progress") {
    return <VoteCount count={project.votes} reason="wip" />;
  }
  if (!votingOpen) return <VoteCount count={project.votes} reason="closed" />;
  if (project.owner.id === viewerId) {
    return <VoteCount count={project.votes} reason="own" />;
  }
  return (
    <VoteButton
      projectId={project.id}
      count={project.votes}
      voted={project.voted}
      signedIn={viewerId !== null}
    />
  );
}
