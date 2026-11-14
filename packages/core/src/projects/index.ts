import {
  and,
  arrayContains,
  desc,
  eq,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  challenges,
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

/** A row on the launch board (screen 03). */
export type BoardProject = ProjectSummary & {
  /** What the board groups by: when it launched, or, in progress, when it last changed. */
  at: Date;
  /** False once its challenge's deadline has passed (rule 3); always true outside a challenge. */
  votingOpen: boolean;
};

/** One challenge, every challenge ("Din provocări"), or none ("Proiecte proprii"). */
export type BoardScope = { challengeId: string } | "challenges" | "own";

export type BoardOpts = {
  scope: BoardScope;
  stage: "launched" | "in_progress";
  /** "newest" by `at`; "votes" by votes, newest first on a tie. */
  sort: "newest" | "votes";
  tool?: string | null;
  viewerId?: string | null;
  /** Include projects built by agents. Off while that's hidden (HANDOVER §3, M3). */
  agents?: boolean;
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
  /**
   * The launch board: launched projects or projects in progress, never both
   * (rule 5), filtered and sorted. No limit yet: a month brings tens of launches.
   */
  board(opts: BoardOpts): Promise<BoardProject[]>;
};

export function createProjects(deps: { db: Db; now: () => Date }): Projects {
  const { db, now } = deps;

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

  const at = sql<Date>`case when ${projects.stage} = 'launched' then coalesce(${projects.launchedAt}, ${projects.createdAt}) else ${lastActive} end`.mapWith(
    projects.launchedAt,
  );

  const select = async ({
    where,
    orderBy,
    limit,
    viewerId,
    agents = true,
  }: {
    where: (SQL | undefined)[];
    orderBy: SQL[];
    limit?: number;
    viewerId?: string | null;
    agents?: boolean;
  }) => {
    const voted = viewerId
      ? sql<boolean>`exists (select 1 from ${votes} where ${votes.projectId} = ${projects.id} and ${votes.userId} = ${viewerId})`
      : sql<boolean>`false`;

    const query = db
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
        at,
        endsAt: challenges.endsAt,
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.ownerId))
      .leftJoin(challenges, eq(challenges.id, projects.challengeId))
      .where(and(...where, agents ? undefined : eq(users.isAgent, false)))
      .orderBy(...orderBy);
    const rows = await (limit === undefined ? query : query.limit(limit));

    const instant = now();
    return rows.map(({ screenshots, latestUpdate, endsAt, ...p }) => ({
      ...p,
      thumbnail: screenshots[0] ?? null,
      latestUpdate: latestUpdate && {
        ...latestUpdate,
        createdAt: new Date(latestUpdate.createdAt),
      },
      votingOpen: !endsAt || instant <= endsAt,
    }));
  };

  // The two lists on a challenge page return summaries only.
  const list = async (
    { challengeId, limit, viewerId, agents }: ListOpts,
    stage: "launched" | "in_progress",
    orderBy: SQL[],
  ): Promise<ProjectSummary[]> => {
    const rows = await select({
      where: [eq(projects.challengeId, challengeId), eq(projects.stage, stage)],
      orderBy,
      limit,
      viewerId,
      agents,
    });
    return rows.map(({ at: _at, votingOpen: _open, ...p }) => p);
  };

  return {
    // Only launched projects are in the vote (rule 5).
    mostVoted: (opts) =>
      list(opts, "launched", [desc(voteCount), desc(projects.launchedAt)]),
    inProgress: (opts) => list(opts, "in_progress", [desc(lastActive)]),

    board: ({ scope, stage, sort, tool, viewerId, agents }) =>
      select({
        where: [
          scope === "own"
            ? isNull(projects.challengeId)
            : scope === "challenges"
              ? isNotNull(projects.challengeId)
              : eq(projects.challengeId, scope.challengeId),
          eq(projects.stage, stage),
          tool ? arrayContains(projects.tools, [tool]) : undefined,
        ],
        orderBy: [
          ...(sort === "votes" ? [desc(voteCount)] : []),
          desc(at),
          desc(projects.id),
        ],
        viewerId,
        agents,
      }),
  };
}
