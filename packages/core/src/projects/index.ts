import { and, desc, eq, sql } from "drizzle-orm";
import { projects, reviews, users, votes, type Db } from "@repo/db";
import { withExtra } from "../counts";

export type ProjectSummary = {
  id: string;
  slug: string;
  name: string;
  pitch: string;
  tools: string[];
  /** The first screenshot, or null until one is uploaded. */
  thumbnail: string | null;
  stage: "in_progress" | "launched";
  owner: {
    id: string;
    handle: string | null;
    name: string;
    avatarUrl: string | null;
    avatarFill: string | null;
    isAgent: boolean;
  };
  votes: number;
  /** Human reviews and replies; automated reviews don't count (rule 17). */
  reviews: number;
  /** Whether the viewer has voted; false for a signed-out visitor (rule 12). */
  voted: boolean;
};

export type Projects = {
  /** A challenge's launched projects with the most votes, most votes first. */
  mostVoted(opts: {
    challengeId: string;
    limit: number;
    viewerId?: string | null;
  }): Promise<ProjectSummary[]>;
};

export function createProjects(deps: { db: Db }): Projects {
  const { db } = deps;

  return {
    mostVoted: async ({ challengeId, limit, viewerId }) => {
      const voteCount = withExtra(
        sql`select count(*) from ${votes} where ${votes.projectId} = ${projects.id}`,
        projects.id,
        "votes",
      );
      const reviewCount = withExtra(
        sql`select count(*) from ${reviews} where ${reviews.projectId} = ${projects.id} and not ${reviews.isAutomated} and not ${reviews.hidden}`,
        projects.id,
        "reviews",
      );
      const voted = viewerId
        ? sql<boolean>`exists (select 1 from ${votes} where ${votes.projectId} = ${projects.id} and ${votes.userId} = ${viewerId})`
        : sql<boolean>`false`;

      const rows = await db
        .select({
          id: projects.id,
          slug: projects.slug,
          name: projects.name,
          pitch: projects.pitch,
          tools: projects.tools,
          screenshots: projects.screenshots,
          stage: projects.stage,
          owner: {
            id: users.id,
            handle: users.handle,
            name: users.name,
            avatarUrl: users.avatarUrl,
            avatarFill: users.avatarFill,
            isAgent: users.isAgent,
          },
          votes: voteCount,
          reviews: reviewCount,
          voted,
        })
        .from(projects)
        .innerJoin(users, eq(users.id, projects.ownerId))
        .where(
          and(
            eq(projects.challengeId, challengeId),
            // Only launched projects are in the vote (rule 5).
            eq(projects.stage, "launched"),
          ),
        )
        .orderBy(desc(voteCount), desc(projects.launchedAt))
        .limit(limit);

      return rows.map(({ screenshots, ...p }) => ({
        ...p,
        thumbnail: screenshots[0] ?? null,
      }));
    },
  };
}
