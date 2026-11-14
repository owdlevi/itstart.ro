import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  challenges,
  participations,
  projects,
  users,
  type ChallengeTip,
  type Db,
} from "@repo/db";
import { withExtra } from "../counts";

export type ChallengeStatus = "upcoming" | "running" | "ended";

/** Rule 1: a challenge runs from its start until its deadline. */
export function challengeStatus(
  challenge: { startsAt: Date; endsAt: Date },
  at: Date,
): ChallengeStatus {
  if (at < challenge.startsAt) return "upcoming";
  if (at > challenge.endsAt) return "ended";
  return "running";
}

export type ChallengeCounts = {
  /** People in the challenge now: participations not left, agents excluded (rule 2). */
  participants: number;
  agents: number;
  launched: number;
  inProgress: number;
  /** People with a launched project in the challenge ("23 au lansat deja"). */
  launchers: number;
};

export type RunningChallenge = {
  id: string;
  number: number;
  slug: string;
  title: string;
  summary: string | null;
  builtFor: string | null;
  startsAt: Date;
  /** The deadline: 23:59 Europe/Bucharest on the month's last day. */
  endsAt: Date;
  counts: ChallengeCounts;
};

/** A challenge with its brief, as the challenge page shows it. */
export type Challenge = RunningChallenge & {
  intro: string | null;
  scenarioNote: string | null;
  scenario: string | null;
  baseLevel: string[];
  stretch: string[];
  launchCriteria: string[];
  launchNote: string | null;
  materialsUrl: string | null;
  materialsNote: string | null;
  tips: ChallengeTip[];
  juryNote: string | null;
  status: ChallengeStatus;
  /** Votes are accepted until the deadline (rule 3). */
  votingOpen: boolean;
};

export type Participant = {
  id: string;
  handle: string | null;
  name: string;
  /** What to call them in a sentence: `givenName`, or the first word of the name. */
  givenName: string;
  avatarUrl: string | null;
  avatarFill: string | null;
  isAgent: boolean;
};

export type Challenges = {
  /** The challenge running now (rule 1), with its counts, or null between challenges. */
  running(): Promise<RunningChallenge | null>;
  /** Any challenge by its slug, with its brief, status and counts. */
  bySlug(slug: string): Promise<Challenge | null>;
  /**
   * The first people in a challenge, for its participant list: the viewer
   * first if they're in it, then the earliest to join. People who left aren't
   * listed (rule 2), and neither are agents, which have their own panel.
   */
  participants(opts: {
    challengeId: string;
    limit: number;
    viewerId?: string | null;
  }): Promise<Participant[]>;
};

export function createChallenges(deps: {
  db: Db;
  now: () => Date;
}): Challenges {
  const { db, now } = deps;

  const members = (agents: boolean) =>
    sql`select count(*) from ${participations} join ${users} on ${users.id} = ${participations.userId} where ${participations.challengeId} = ${challenges.id} and ${participations.leftAt} is null and ${users.isAgent} = ${agents}`;
  const projectsAt = (stage: "launched" | "in_progress") =>
    sql`select count(*) from ${projects} where ${projects.challengeId} = ${challenges.id} and ${projects.stage} = ${stage}`;
  const launchers = sql`select count(distinct ${projects.ownerId}) from ${projects} join ${users} on ${users.id} = ${projects.ownerId} where ${projects.challengeId} = ${challenges.id} and ${projects.stage} = 'launched' and not ${users.isAgent}`;

  const summary = {
    id: challenges.id,
    number: challenges.number,
    slug: challenges.slug,
    title: challenges.title,
    summary: challenges.summary,
    builtFor: challenges.builtFor,
    startsAt: challenges.startsAt,
    endsAt: challenges.endsAt,
    participants: withExtra(members(false), challenges.id, "participants"),
    agents: withExtra(members(true), challenges.id, "agents"),
    launched: withExtra(projectsAt("launched"), challenges.id, "launched"),
    inProgress: withExtra(
      projectsAt("in_progress"),
      challenges.id,
      "in_progress",
    ),
    launchers: withExtra(launchers, challenges.id, "launchers"),
  };

  const withCounts = <T extends ChallengeCounts>({
    participants,
    agents,
    launched,
    inProgress,
    launchers,
    ...rest
  }: T) => ({
    ...rest,
    counts: { participants, agents, launched, inProgress, launchers },
  });

  const first = async (where: SQL | undefined) => {
    const [row] = await db
      .select(summary)
      .from(challenges)
      .where(where)
      .orderBy(desc(challenges.startsAt))
      .limit(1);
    return row ? withCounts(row) : null;
  };

  return {
    running: () => {
      const at = now();
      // Exactly one should match (rule 1); if admin data ever overlaps, the
      // latest start wins.
      return first(
        and(lte(challenges.startsAt, at), gte(challenges.endsAt, at)),
      );
    },

    bySlug: async (slug) => {
      const [row] = await db
        .select({
          ...summary,
          intro: challenges.intro,
          scenarioNote: challenges.scenarioNote,
          scenario: challenges.scenario,
          baseLevel: challenges.baseLevel,
          stretch: challenges.stretch,
          launchCriteria: challenges.launchCriteria,
          launchNote: challenges.launchNote,
          materialsUrl: challenges.materialsUrl,
          materialsNote: challenges.materialsNote,
          tips: challenges.tips,
          juryNote: challenges.juryNote,
        })
        .from(challenges)
        .where(eq(challenges.slug, slug))
        .limit(1);
      if (!row) return null;
      const status = challengeStatus(row, now());
      return { ...withCounts(row), status, votingOpen: status !== "ended" };
    },

    participants: async ({ challengeId, limit, viewerId }) => {
      const rows = await db
        .select({
          id: users.id,
          handle: users.handle,
          name: users.name,
          givenName: users.givenName,
          avatarUrl: users.avatarUrl,
          avatarFill: users.avatarFill,
          isAgent: users.isAgent,
        })
        .from(participations)
        .innerJoin(users, eq(users.id, participations.userId))
        .where(
          and(
            eq(participations.challengeId, challengeId),
            isNull(participations.leftAt),
            eq(users.isAgent, false),
          ),
        )
        .orderBy(
          ...(viewerId ? [desc(sql`${users.id} = ${viewerId}`)] : []),
          asc(participations.joinedAt),
          asc(users.id),
        )
        .limit(limit);
      return rows.map((p) => ({
        ...p,
        givenName: p.givenName ?? p.name.split(/\s+/)[0]!,
      }));
    },
  };
}
