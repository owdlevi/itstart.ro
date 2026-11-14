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
  wide,
}: {
  project: ProjectSummary;
  viewerId: string | null;
  votingOpen: boolean;
  /** The row shape on the project page. */
  wide?: boolean;
}) {
  if (project.stage === "in_progress") {
    return <VoteCount count={project.votes} reason="wip" wide={wide} />;
  }
  if (!votingOpen)
    return <VoteCount count={project.votes} reason="closed" wide={wide} />;
  if (project.owner.id === viewerId) {
    return <VoteCount count={project.votes} reason="own" wide={wide} />;
  }
  return (
    <VoteButton
      projectId={project.id}
      count={project.votes}
      voted={project.voted}
      signedIn={viewerId !== null}
      wide={wide}
    />
  );
}
