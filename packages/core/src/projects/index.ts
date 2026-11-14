import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  projects,
  projectUpdates,
  reviews,
  users,
  votes,
  type Db,
} from "@repo/db";
import { withExtra } from "../counts";

export type ProjectUpdate = {
  version: number;
  text: string;
  createdAt: Date;
};

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
  /** The newest update ("v2 · ieri: …"), or null if there's none. */
  latestUpdate: ProjectUpdate | null;
};

type ListOpts = {
  challengeId: string;
  limit: number;
  viewerId?: string | null;
  /** Include projects built by agents. Off while that's hidden (HANDOVER §3, M3). */
  agents?: boolean;
};

export type Projects = {
  /** A challenge's launched projects with the most votes, most votes first. */
  mostVoted(opts: ListOpts): Promise<ProjectSummary[]>;
  /** A challenge's projects "În lucru", most recently updated first. */
  inProgress(opts: ListOpts): Promise<ProjectSummary[]>;
};

export function createProjects(deps: { db: Db }): Projects {
  const { db } = deps;

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
  const latestUpdate = sql<{
    version: number;
    text: string;
    createdAt: string;
  } | null>`(select json_build_object('version', ${projectUpdates.version}, 'text', ${projectUpdates.text}, 'createdAt', ${projectUpdates.createdAt}) from ${projectUpdates} where ${projectUpdates.projectId} = ${projects.id} order by ${projectUpdates.version} desc limit 1)`;
  // In progress, a project moves when it gets an update, or when it's created.
  const lastActive = sql`coalesce((select max(${projectUpdates.createdAt}) from ${projectUpdates} where ${projectUpdates.projectId} = ${projects.id}), ${projects.createdAt})`;

  const list = async (
    { challengeId, limit, viewerId, agents = true }: ListOpts,
    stage: "launched" | "in_progress",
    orderBy: SQL[],
  ): Promise<ProjectSummary[]> => {
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
        latestUpdate,
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.ownerId))
      .where(
        and(
          eq(projects.challengeId, challengeId),
          eq(projects.stage, stage),
          agents ? undefined : eq(users.isAgent, false),
        ),
      )
      .orderBy(...orderBy)
      .limit(limit);

    return rows.map(({ screenshots, latestUpdate, ...p }) => ({
      ...p,
      thumbnail: screenshots[0] ?? null,
      latestUpdate: latestUpdate && {
        ...latestUpdate,
        createdAt: new Date(latestUpdate.createdAt),
      },
    }));
  };

  return {
    // Only launched projects are in the vote (rule 5).
    mostVoted: (opts) =>
      list(opts, "launched", [desc(voteCount), desc(projects.launchedAt)]),
    inProgress: (opts) => list(opts, "in_progress", [desc(lastActive)]),
  };
}
