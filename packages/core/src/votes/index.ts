import { and, count, eq, gte, sql } from "drizzle-orm";
import {
  challenges,
  projects,
  users,
  voteEvents,
  votes,
  type Db,
} from "@repo/db";
import { withExtra } from "../counts";
import { createVoteTimeline, type VoteTimelines } from "./timeline";

export {
  burstFlags,
  TIMELINE,
  type ProjectVoteActivity,
  type TimelineSubject,
  type VoteActivity,
  type VoteEventRow,
  type VoteTimeline,
  type VoterActivity,
} from "./timeline";

export type VoteRefusal =
  | "not_found"
  | "agent" // rule 13: agents never vote
  | "own" // rule 11
  | "in_progress" // rule 5
  | "closed" // rule 3: challenge deadline passed
  | "account_too_new" // rule 14
  | "rate_limited"; // rule 14

export type VoteResult =
  | { ok: true; voted: boolean; count: number }
  | { ok: false; reason: VoteRefusal };

export type VotesConfig = {
  minAccountAgeHours: number;
  rateLimit: { max: number; windowMinutes: number };
};

export const defaultVotesConfig: VotesConfig = {
  minAccountAgeHours: 24,
  rateLimit: { max: 30, windowMinutes: 10 },
};

export type Votes = {
  /**
   * Casts the user's vote on a project, or removes it if already cast (rule 10).
   * Every product rule is checked here; a refusal is returned, never thrown.
   * Throws only if `userId` does not exist, which means a broken session.
   */
  toggle(userId: string, projectId: string): Promise<VoteResult>;
} & VoteTimelines;

const HOUR = 3_600_000;
const MINUTE = 60_000;

export function createVotes(deps: {
  db: Db;
  now: () => Date;
  config?: VotesConfig;
}): Votes {
  const { db, now } = deps;
  const config = deps.config ?? defaultVotesConfig;

  return {
    ...createVoteTimeline({ db, now }),
    toggle: (userId, projectId) =>
      db.transaction(async (tx) => {
        const at = now();
        const refuse = (reason: VoteRefusal): VoteResult => ({
          ok: false,
          reason,
        });

        const [voter] = await tx
          .select({ isAgent: users.isAgent, createdAt: users.createdAt })
          .from(users)
          .where(eq(users.id, userId));
        if (!voter) throw new Error(`votes.toggle: unknown user ${userId}`);

        const [project] = await tx
          .select({
            ownerId: projects.ownerId,
            stage: projects.stage,
            endsAt: challenges.endsAt,
          })
          .from(projects)
          .leftJoin(challenges, eq(projects.challengeId, challenges.id))
          .where(eq(projects.id, projectId));
        if (!project) return refuse("not_found");

        if (voter.isAgent) return refuse("agent");
        if (project.ownerId === userId) return refuse("own");
        if (project.stage !== "launched") return refuse("in_progress");
        if (project.endsAt && at > project.endsAt) return refuse("closed");
        if (
          at.getTime() - voter.createdAt.getTime() <
          config.minAccountAgeHours * HOUR
        ) {
          return refuse("account_too_new");
        }

        const windowStart = new Date(
          at.getTime() - config.rateLimit.windowMinutes * MINUTE,
        );
        const [recent] = await tx
          .select({ n: count() })
          .from(voteEvents)
          .where(
            and(eq(voteEvents.userId, userId), gte(voteEvents.at, windowStart)),
          );
        if ((recent?.n ?? 0) >= config.rateLimit.max)
          return refuse("rate_limited");

        const removed = await tx
          .delete(votes)
          .where(and(eq(votes.userId, userId), eq(votes.projectId, projectId)))
          .returning({ userId: votes.userId });
        const voted = removed.length === 0;
        if (voted) {
          await tx
            .insert(votes)
            .values({ userId, projectId, createdAt: at })
            .onConflictDoNothing();
        }
        await tx.insert(voteEvents).values({
          userId,
          projectId,
          action: voted ? "cast" : "retract",
          at,
        });

        const [total] = await tx
          .select({
            n: withExtra(
              sql`select count(*) from ${votes} where ${votes.projectId} = ${projects.id}`,
              projects.id,
              "votes",
            ),
          })
          .from(projects)
          .where(eq(projects.id, projectId));
        return { ok: true, voted, count: total?.n ?? 0 };
      }),
  };
}
