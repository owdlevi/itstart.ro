import { and, desc, gte, lte, sql } from "drizzle-orm";
import { challenges, participations, projects, users, type Db } from "@repo/db";
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
  counts: {
    /** People in the challenge now: participations not left, agents excluded (rule 2). */
    participants: number;
    agents: number;
    launched: number;
    inProgress: number;
  };
};

export type Challenges = {
  /** The challenge running now (rule 1), with its counts, or null between challenges. */
  running(): Promise<RunningChallenge | null>;
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

  return {
    running: async () => {
      const at = now();
      // Exactly one should match (rule 1); if admin data ever overlaps, the
      // latest start wins.
      const [row] = await db
        .select({
          id: challenges.id,
          number: challenges.number,
          slug: challenges.slug,
          title: challenges.title,
          summary: challenges.summary,
          builtFor: challenges.builtFor,
          startsAt: challenges.startsAt,
          endsAt: challenges.endsAt,
          participants: withExtra(
            members(false),
            challenges.id,
            "participants",
          ),
          agents: withExtra(members(true), challenges.id, "agents"),
          launched: withExtra(
            projectsAt("launched"),
            challenges.id,
            "launched",
          ),
          inProgress: withExtra(
            projectsAt("in_progress"),
            challenges.id,
            "in_progress",
          ),
        })
        .from(challenges)
        .where(and(lte(challenges.startsAt, at), gte(challenges.endsAt, at)))
        .orderBy(desc(challenges.startsAt))
        .limit(1);
      if (!row) return null;
      const { participants, agents, launched, inProgress, ...challenge } = row;
      return {
        ...challenge,
        counts: { participants, agents, launched, inProgress },
      };
    },
  };
}
