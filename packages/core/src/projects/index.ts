import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  challenges,
  projects,
  projectUpdates,
  recognitions,
  reviewAssignments,
  reviews,
  users,
  votes,
  type Db,
} from "@repo/db";
import { withExtra } from "../counts";
import { createCannedLinkChecker, type LinkChecker } from "../link-checker";
import type { RecognitionKind } from "../recognitions/rules";
import { ASSIGNMENTS_PER_BUILDER } from "../reviews/assignments";
import { createPrefixStorage, type Storage } from "../storage";
import type { ProjectEdit, ProjectInput } from "./rules";
import { createSaving, type EditableResult, type SaveResult } from "./save";

export {
  isHttpsUrl,
  missingToLaunch,
  PROJECT_LIMITS,
  type BuildDuration,
  type LaunchField,
  type ProjectEdit,
  type ProjectInput,
  type ProjectStage,
} from "./rules";
export type {
  EditableProject,
  EditableResult,
  SaveRefusal,
  SaveResult,
} from "./save";

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

/** Everything the project page (screen 04) shows about a project. */
export type ProjectPage = Omit<ProjectSummary, "owner"> & {
  liveUrl: string;
  /** In display order; the first is the thumbnail. */
  screenshots: string[];
  /** Paragraphs of "Despre proiect". */
  description: string[];
  build: {
    duration: "under_10h" | "10_30h" | "over_30h" | null;
    /** The builder's own words; shown instead of the duration's label. */
    durationText: string | null;
    hardestPart: string | null;
    prompt: string | null;
  };
  launchedAt: Date | null;
  /** False once its challenge's deadline has passed (rule 3); always true outside a challenge. */
  votingOpen: boolean;
  /** `startsAt` names its month (the share image). */
  challenge: {
    slug: string;
    number: number;
    title: string;
    startsAt: Date;
  } | null;
  owner: ProjectSummary["owner"] & {
    city: string | null;
    /** Their launched projects, this one included. */
    launched: number;
  };
  /** Newest first. */
  updates: ProjectUpdate[];
};

/** A launched project on its builder's profile (screen 05). */
export type ProfileProject = ProjectSummary & {
  launchedAt: Date;
  /** False once its challenge's deadline has passed (rule 3); always true outside a challenge. */
  votingOpen: boolean;
  /** Null for a project of its own. */
  challenge: {
    slug: string;
    number: number;
    title: string;
    startsAt: Date;
  } | null;
  /** The recognition it got in its challenge, if any (screen 05's footer). */
  recognition: RecognitionKind | null;
};

/** A launched project in an ended challenge's results (screen 11). */
export type ResultProject = ProjectSummary & {
  /** Launched after the deadline: "După termen", out of the recognitions (rule 7). */
  isLate: boolean;
  launchedAt: Date;
};

/** One of the projects a builder was asked to review (rule 16). */
export type AssignedProject = ProjectSummary & {
  /** False once its challenge's deadline has passed (rule 3). */
  votingOpen: boolean;
  /** They've reviewed it. */
  done: boolean;
};

/** The "Lansat" screen (10): the launch, and the reviews its builder owes. */
export type LaunchPage = {
  project: ProjectSummary & {
    launchedAt: Date;
    isLate: boolean;
    challenge: { slug: string; number: number; title: string } | null;
  };
  /** In the order they were given, then oldest launch first. */
  assignments: AssignedProject[];
  /** How many they're asked for: two in a challenge, none for a project of its own. */
  expected: number;
};

export type LaunchPageResult =
  | { ok: true; page: LaunchPage }
  | { ok: false; reason: "not_found" | "not_owner" | "not_launched" };

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
  /**
   * Every launched project in a challenge, most votes first, then earliest
   * launch: the results of an ended challenge (screen 11).
   */
  launchedIn(opts: Omit<ListOpts, "limit">): Promise<ResultProject[]>;
  /** A challenge's projects "În lucru", most recently updated first. */
  inProgress(opts: ListOpts): Promise<ProjectSummary[]>;
  /**
   * The launch board: launched projects or projects in progress, never both
   * (rule 5), filtered and sorted. No limit yet: a month brings tens of launches.
   */
  board(opts: BoardOpts): Promise<BoardProject[]>;
  /** One project with everything its page shows, or null if there's none. */
  bySlug(slug: string, viewerId?: string | null): Promise<ProjectPage | null>;
  /** Someone's launched projects, newest launch first. */
  launchedBy(
    ownerId: string,
    viewerId?: string | null,
  ): Promise<ProfileProject[]>;
  /**
   * A new project (screen 09): "În lucru" with a name, pitch and live link, or
   * "Lansat" with everything rule 4 asks for. The live link must answer (rule
   * 9). A project for the running challenge puts its builder in it (rule 2).
   */
  create(ownerId: string, input: ProjectInput): Promise<SaveResult>;
  /**
   * The owner's changes, launched or not (rule 8), with an optional update as
   * the next version. Launching sets launchedAt once (rule 6) and flags a
   * launch after the deadline as late (rule 7).
   */
  edit(userId: string, slug: string, input: ProjectEdit): Promise<SaveResult>;
  /** A project with its edit form's values, for its owner only. */
  editable(slug: string, userId: string): Promise<EditableResult>;
  /**
   * The owner's launched project with their review assignments in its
   * challenge (screen 10). `countsAtLaunch` counts only the votes and reviews
   * it had when it launched, without fixture extras: the design fixtures show
   * the moment of the launch (HANDOVER §9.4).
   */
  launch(
    slug: string,
    viewerId: string,
    opts?: { countsAtLaunch?: boolean },
  ): Promise<LaunchPageResult>;
};

export function createProjects(deps: {
  db: Db;
  now: () => Date;
  /** Fails closed: without a checker, no link answers. */
  linkChecker?: LinkChecker;
  /** Fails closed: without storage, no screenshot is ours. */
  storage?: Storage;
}): Projects {
  const { db, now } = deps;
  const saving = createSaving({
    db,
    now,
    linkChecker: deps.linkChecker ?? createCannedLinkChecker(),
    storage: deps.storage ?? createPrefixStorage(null),
  });

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

  const at =
    sql<Date>`case when ${projects.stage} = 'launched' then coalesce(${projects.launchedAt}, ${projects.createdAt}) else ${lastActive} end`.mapWith(
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
        isLate: projects.isLate,
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
        challenge: {
          slug: challenges.slug,
          number: challenges.number,
          title: challenges.title,
          startsAt: challenges.startsAt,
        },
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.ownerId))
      .leftJoin(challenges, eq(challenges.id, projects.challengeId))
      .where(and(...where, agents ? undefined : eq(users.isAgent, false)))
      .orderBy(...orderBy);
    const rows = await (limit === undefined ? query : query.limit(limit));

    const instant = now();
    return rows.map(
      ({ screenshots, latestUpdate, endsAt, challenge, ...p }) => ({
        ...p,
        // A left join gives an object of nulls when there's no challenge.
        challenge: challenge?.slug ? challenge : null,
        thumbnail: screenshots[0] ?? null,
        latestUpdate: latestUpdate && {
          ...latestUpdate,
          createdAt: new Date(latestUpdate.createdAt),
        },
        votingOpen: !endsAt || instant <= endsAt,
      }),
    );
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
    return rows.map(
      ({ at: _at, votingOpen: _open, challenge: _challenge, ...p }) => p,
    );
  };

  return {
    ...saving,
    // Only launched projects are in the vote (rule 5).
    mostVoted: (opts) =>
      list(opts, "launched", [desc(voteCount), desc(projects.launchedAt)]),
    inProgress: (opts) => list(opts, "in_progress", [desc(lastActive)]),

    launchedIn: async ({ challengeId, viewerId, agents }) => {
      const rows = await select({
        where: [
          eq(projects.challengeId, challengeId),
          eq(projects.stage, "launched"),
        ],
        orderBy: [desc(voteCount), asc(at), asc(projects.id)],
        viewerId,
        agents,
      });
      return rows.map(
        ({ at, votingOpen: _open, challenge: _challenge, ...p }) => ({
          ...p,
          launchedAt: at,
        }),
      );
    },

    bySlug: async (slug, viewerId) => {
      const [row] = await select({
        where: [eq(projects.slug, slug)],
        orderBy: [],
        limit: 1,
        viewerId,
      });
      if (!row) return null;
      const [[details], updates, [launched]] = await Promise.all([
        db
          .select({
            liveUrl: projects.liveUrl,
            screenshots: projects.screenshots,
            description: projects.description,
            buildDuration: projects.buildDuration,
            buildDurationText: projects.buildDurationText,
            buildHardestPart: projects.buildHardestPart,
            buildPrompt: projects.buildPrompt,
            launchedAt: projects.launchedAt,
            city: users.city,
            challenge: {
              slug: challenges.slug,
              number: challenges.number,
              title: challenges.title,
              startsAt: challenges.startsAt,
            },
          })
          .from(projects)
          .innerJoin(users, eq(users.id, projects.ownerId))
          .leftJoin(challenges, eq(challenges.id, projects.challengeId))
          .where(eq(projects.id, row.id)),
        db
          .select({
            version: projectUpdates.version,
            text: projectUpdates.text,
            createdAt: projectUpdates.createdAt,
          })
          .from(projectUpdates)
          .where(eq(projectUpdates.projectId, row.id))
          .orderBy(desc(projectUpdates.version)),
        db
          .select({ n: count() })
          .from(projects)
          .where(
            and(
              eq(projects.ownerId, row.owner.id),
              eq(projects.stage, "launched"),
            ),
          ),
      ]);
      const d = details!;
      const {
        at: _at,
        latestUpdate: _latest,
        challenge: _challenge,
        ...summary
      } = row;
      return {
        ...summary,
        latestUpdate: updates[0] ?? null,
        liveUrl: d.liveUrl,
        screenshots: d.screenshots,
        description: (d.description ?? "")
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
        build: {
          duration: d.buildDuration,
          durationText: d.buildDurationText,
          hardestPart: d.buildHardestPart,
          prompt: d.buildPrompt,
        },
        launchedAt: d.launchedAt,
        // A left join gives an object of nulls when there's no challenge.
        challenge: d.challenge?.slug ? d.challenge : null,
        owner: { ...row.owner, city: d.city, launched: launched?.n ?? 0 },
        updates,
      };
    },

    launch: async (slug, viewerId, opts = {}) => {
      const [row] = await select({
        where: [eq(projects.slug, slug)],
        orderBy: [],
        limit: 1,
        viewerId,
      });
      if (!row) return { ok: false, reason: "not_found" };
      if (row.owner.id !== viewerId) return { ok: false, reason: "not_owner" };
      if (row.stage !== "launched") {
        return { ok: false, reason: "not_launched" };
      }
      const [details] = await db
        .select({
          launchedAt: projects.launchedAt,
          isLate: projects.isLate,
          challengeId: projects.challengeId,
          votes: sql<number>`(select count(*) from ${votes} where ${votes.projectId} = ${row.id} and ${votes.createdAt} <= ${projects.launchedAt})::int`,
          reviews: sql<number>`(select count(*) from ${reviews} where ${reviews.projectId} = ${row.id} and not ${reviews.isAutomated} and not ${reviews.hidden} and ${reviews.createdAt} <= ${projects.launchedAt})::int`,
        })
        .from(projects)
        .where(eq(projects.id, row.id));
      const d = details!;

      const given = d.challengeId
        ? await db
            .select({
              projectId: reviewAssignments.projectId,
              doneAt: reviewAssignments.doneAt,
            })
            .from(reviewAssignments)
            .innerJoin(projects, eq(projects.id, reviewAssignments.projectId))
            .where(
              and(
                eq(reviewAssignments.reviewerId, viewerId),
                eq(projects.challengeId, d.challengeId),
              ),
            )
            .orderBy(
              asc(reviewAssignments.createdAt),
              asc(projects.launchedAt),
              asc(projects.id),
            )
        : [];
      const rows = given.length
        ? await select({
            where: [
              inArray(
                projects.id,
                given.map((g) => g.projectId),
              ),
            ],
            orderBy: [],
            viewerId,
          })
        : [];
      const assignments = given.flatMap((g) => {
        const p = rows.find((r) => r.id === g.projectId);
        if (!p) return [];
        const { at: _at, challenge: _challenge, ...summary } = p;
        return [{ ...summary, done: g.doneAt !== null }];
      });

      const { at: _at, votingOpen: _open, challenge, ...summary } = row;
      return {
        ok: true,
        page: {
          project: {
            ...summary,
            ...(opts.countsAtLaunch && {
              votes: d.votes,
              reviews: d.reviews,
              voted: false,
            }),
            launchedAt: d.launchedAt!,
            isLate: d.isLate,
            challenge: challenge && {
              slug: challenge.slug!,
              number: challenge.number!,
              title: challenge.title!,
            },
          },
          assignments,
          expected: d.challengeId ? ASSIGNMENTS_PER_BUILDER : 0,
        },
      };
    },

    launchedBy: async (ownerId, viewerId) => {
      const rows = await select({
        where: [eq(projects.ownerId, ownerId), eq(projects.stage, "launched")],
        orderBy: [desc(at), desc(projects.id)],
        viewerId,
      });
      const given = rows.length
        ? await db
            .select({
              projectId: recognitions.projectId,
              kind: recognitions.kind,
            })
            .from(recognitions)
            .where(
              inArray(
                recognitions.projectId,
                rows.map((r) => r.id),
              ),
            )
        : [];
      return rows.map(({ at, ...p }) => ({
        ...p,
        launchedAt: at,
        recognition: given.find((g) => g.projectId === p.id)?.kind ?? null,
      }));
    },

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
