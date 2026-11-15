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
  /** What everyone is building, after "construiesc deja": "pagina frizeriei". */
  buildingPhrase: string | null;
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

/** A challenge as the launch board's filter lists it. */
export type ChallengeOption = {
  id: string;
  number: number;
  slug: string;
  /** "Frizerie" in "#4 Frizerie"; the title when no short one is set. */
  shortTitle: string;
  status: ChallengeStatus;
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

export type JoinRefusal =
  | "not_found"
  | "ended" // rules 1 and 3: the month is over
  | "not_onboarded"; // no name yet, so nothing to list them by

export type LeaveRefusal =
  | "not_found"
  | "not_joined"
  | "ended"; // rule 3: after the deadline the list is the month's record

export type ParticipationResult<R> =
  | { ok: true; slug: string }
  | { ok: false; reason: R };

/** "Pașii tăi" on the challenge page: what a participant has done so far. */
export type ParticipantSteps = {
  /** They have a project in the challenge, in progress or launched. */
  posted: boolean;
  /** One of them is launched. */
  launched: boolean;
};

export type Challenges = {
  /** The challenge running now (rule 1), with its counts, or null between challenges. */
  running(): Promise<RunningChallenge | null>;
  /** Any challenge by its slug, with its brief, status and counts. */
  bySlug(slug: string): Promise<Challenge | null>;
  /** Every challenge that has started (running or ended), newest first. */
  started(): Promise<ChallengeOption[]>;
  /**
   * The first people in a challenge, for its participant list, earliest to
   * join first. The viewer is always among them if they're in it. People who
   * left aren't listed (rule 2), and neither are agents, which have their own
   * panel.
   */
  participants(opts: {
    challengeId: string;
    limit: number;
    viewerId?: string | null;
  }): Promise<Participant[]>;
  /** The user's participation in a challenge, or null if they never joined or left. */
  participation(
    challengeId: string,
    userId: string,
  ): Promise<{ joinedAt: Date } | null>;
  /**
   * Joins a running or upcoming challenge (rule 2: one action). Joining again
   * changes nothing; joining after leaving rejoins, from now. Throws only for
   * an unknown user.
   */
  join(
    userId: string,
    slug: string,
  ): Promise<ParticipationResult<JoinRefusal>>;
  /**
   * Leaves a challenge before its deadline (rule 2): off the participant list
   * and its count, while their projects stay where they are.
   */
  leave(
    userId: string,
    slug: string,
  ): Promise<ParticipationResult<LeaveRefusal>>;
  /** What a participant has done in the challenge so far ("Pașii tăi"). */
  steps(challengeId: string, userId: string): Promise<ParticipantSteps>;
};

/**
 * Puts someone in a challenge, with no checks: the callers make them (join(),
 * and a project saved for the challenge). One row per person and challenge: a
 * rejoin clears `leftAt` and starts from `at`; a second join changes nothing.
 */
export async function enter(
  db: Pick<Db, "insert">,
  userId: string,
  challengeId: string,
  at: Date,
) {
  await db
    .insert(participations)
    .values({ userId, challengeId, joinedAt: at })
    .onConflictDoUpdate({
      target: [participations.userId, participations.challengeId],
      set: {
        joinedAt: sql`case when ${participations.leftAt} is null then ${participations.joinedAt} else ${at} end`,
        leftAt: null,
      },
    });
}

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
    buildingPhrase: challenges.buildingPhrase,
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

    started: async () => {
      const at = now();
      const rows = await db
        .select({
          id: challenges.id,
          number: challenges.number,
          slug: challenges.slug,
          title: challenges.title,
          shortTitle: challenges.shortTitle,
          startsAt: challenges.startsAt,
          endsAt: challenges.endsAt,
        })
        .from(challenges)
        .where(lte(challenges.startsAt, at))
        .orderBy(desc(challenges.startsAt));
      return rows.map(({ title, shortTitle, startsAt, endsAt, ...c }) => ({
        ...c,
        shortTitle: shortTitle ?? title,
        status: challengeStatus({ startsAt, endsAt }, at),
      }));
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
          joinedAt: participations.joinedAt,
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
          // The viewer makes the cut whenever they're in; the list is then
          // put back in join order.
          ...(viewerId ? [desc(sql`${users.id} = ${viewerId}`)] : []),
          asc(participations.joinedAt),
          asc(users.id),
        )
        .limit(limit);
      return rows
        .sort(
          (a, b) =>
            a.joinedAt.getTime() - b.joinedAt.getTime() ||
            (a.id < b.id ? -1 : 1),
        )
        .map(({ joinedAt: _, ...p }) => ({
          ...p,
          givenName: p.givenName ?? p.name.split(/\s+/)[0]!,
        }));
    },

    participation: async (challengeId, userId) => {
      const [row] = await db
        .select({ joinedAt: participations.joinedAt })
        .from(participations)
        .where(
          and(
            eq(participations.challengeId, challengeId),
            eq(participations.userId, userId),
            isNull(participations.leftAt),
          ),
        );
      return row ?? null;
    },

    join: (userId, slug) =>
      db.transaction(async (tx) => {
        const at = now();
        const [user] = await tx
          .select({ onboardedAt: users.onboardedAt })
          .from(users)
          .where(eq(users.id, userId));
        if (!user) throw new Error(`challenges.join: unknown user ${userId}`);
        const [challenge] = await tx
          .select({
            id: challenges.id,
            startsAt: challenges.startsAt,
            endsAt: challenges.endsAt,
          })
          .from(challenges)
          .where(eq(challenges.slug, slug));
        if (!challenge) return { ok: false, reason: "not_found" };
        if (challengeStatus(challenge, at) === "ended") {
          return { ok: false, reason: "ended" };
        }
        if (!user.onboardedAt) return { ok: false, reason: "not_onboarded" };

        await enter(tx, userId, challenge.id, at);
        return { ok: true, slug };
      }),

    leave: (userId, slug) =>
      db.transaction(async (tx) => {
        const [challenge] = await tx
          .select({
            id: challenges.id,
            startsAt: challenges.startsAt,
            endsAt: challenges.endsAt,
          })
          .from(challenges)
          .where(eq(challenges.slug, slug));
        if (!challenge) return { ok: false, reason: "not_found" };
        const at = now();
        if (challengeStatus(challenge, at) === "ended") {
          return { ok: false, reason: "ended" };
        }
        const left = await tx
          .update(participations)
          .set({ leftAt: at })
          .where(
            and(
              eq(participations.challengeId, challenge.id),
              eq(participations.userId, userId),
              isNull(participations.leftAt),
            ),
          )
          .returning({ userId: participations.userId });
        if (left.length === 0) return { ok: false, reason: "not_joined" };
        return { ok: true, slug };
      }),

    steps: async (challengeId, userId) => {
      const rows = await db
        .select({ stage: projects.stage })
        .from(projects)
        .where(
          and(
            eq(projects.challengeId, challengeId),
            eq(projects.ownerId, userId),
          ),
        );
      return {
        posted: rows.length > 0,
        launched: rows.some((p) => p.stage === "launched"),
      };
    },
  };
}
