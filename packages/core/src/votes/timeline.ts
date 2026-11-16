import { and, desc, eq, gte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { projects, users, voteEvents, type Db } from "@repo/db";
import { isAdmin, type AdminResult } from "../admins";

// Rule 14: "admins can see vote timelines". Every toggle is a row in
// vote_events (DECISIONS, "Vote anti-abuse defaults"); these reads show them
// to an admin with the two signs of abuse marked: accounts made just before
// voting, and many toggles close together.

/** Placeholders, like the vote limits (DECISIONS, "Admin: vote timeline"). */
export const TIMELINE = {
  /** An account this young when it toggled is "new". */
  newAccountDays: 7,
  /** This many toggles on one timeline within `minutes` is a burst. */
  burst: { count: 5, minutes: 10 },
  /** The newest toggles a timeline shows. */
  limit: 300,
  /** The activity list looks back this far. */
  activityDays: 7,
  /** Rows in each activity list. */
  activityRows: 30,
} as const;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type VoteEventRow = {
  at: Date;
  action: "cast" | "retract";
  voter: { handle: string | null; name: string; isAgent: boolean };
  /** The voter's account age when they toggled, in hours. */
  accountAgeHours: number;
  project: { slug: string; name: string };
  /** The account was under `newAccountDays` old when it toggled. */
  newAccount: boolean;
  /** One of `burst.count` or more toggles on this timeline within `burst.minutes`. */
  burst: boolean;
};

export type VoteTimeline = {
  subject:
    | {
        kind: "project";
        slug: string;
        name: string;
        owner: { handle: string | null; name: string };
      }
    | { kind: "user"; handle: string; name: string; joinedAt: Date };
  /** Over every toggle, not only the ones shown. */
  summary: {
    toggles: number;
    casts: number;
    retracts: number;
    /** Distinct voters (a user's own timeline: distinct projects). */
    distinct: number;
    fromNewAccounts: number;
  };
  /** Newest first, at most `TIMELINE.limit`. */
  events: VoteEventRow[];
};

/** A project with toggles in the last `activityDays`. */
export type ProjectVoteActivity = {
  slug: string;
  name: string;
  ownerName: string;
  lastDay: number;
  lastWeek: number;
  voters: number;
  fromNewAccounts: number;
  lastAt: Date;
};

/** A voter with toggles in the last `activityDays`. */
export type VoterActivity = {
  handle: string | null;
  name: string;
  joinedAt: Date;
  lastDay: number;
  lastWeek: number;
  projects: number;
  lastAt: Date;
};

export type VoteActivity = {
  /** Most toggles in the last day first, then the week. */
  projects: ProjectVoteActivity[];
  voters: VoterActivity[];
};

export type TimelineSubject = { project: string } | { user: string };

/**
 * Marks each toggle that sits in a run of `count` or more within `minutes`.
 * `times` must be oldest first.
 */
export function burstFlags(
  times: Date[],
  burst: { count: number; minutes: number } = TIMELINE.burst,
): boolean[] {
  const flags = times.map(() => false);
  const window = burst.minutes * 60_000;
  let end = 0;
  for (let start = 0; start < times.length; start++) {
    end = Math.max(end, start);
    while (
      end + 1 < times.length &&
      times[end + 1]!.getTime() - times[start]!.getTime() <= window
    ) {
      end++;
    }
    if (end - start + 1 >= burst.count) {
      for (let i = start; i <= end; i++) flags[i] = true;
    }
  }
  return flags;
}

export function createVoteTimeline(deps: { db: Db; now: () => Date }) {
  const { db, now } = deps;
  const owners = alias(users, "owners");
  // users.created_at is a UTC timestamp without a time zone (ARCHITECTURE, gotchas).
  const newAccountSql = sql`${users.createdAt} > (${voteEvents.at} at time zone 'UTC') - make_interval(days => ${TIMELINE.newAccountDays})`;

  return {
    /** The projects and voters with the most toggles lately (admins only). */
    activity: async (adminId: string): Promise<AdminResult<VoteActivity>> => {
      if (!(await isAdmin(db, adminId))) {
        return { ok: false, reason: "not_admin" };
      }
      const at = now();
      const weekStart = new Date(at.getTime() - TIMELINE.activityDays * DAY);
      const dayStart = new Date(at.getTime() - DAY);
      const lastDay = sql<number>`(count(*) filter (where ${voteEvents.at} >= ${dayStart}))::int`;
      const lastWeek = sql<number>`count(*)::int`;
      const lastAt = sql<Date>`max(${voteEvents.at})`.mapWith(
        (v: string | Date) => new Date(v),
      );
      const recent = and(
        gte(voteEvents.at, weekStart),
        sql`${voteEvents.at} <= ${at}`,
      );

      const projectRows = await db
        .select({
          slug: projects.slug,
          name: projects.name,
          ownerName: owners.name,
          lastDay,
          lastWeek,
          voters: sql<number>`count(distinct ${voteEvents.userId})::int`,
          fromNewAccounts: sql<number>`(count(*) filter (where ${newAccountSql}))::int`,
          lastAt,
        })
        .from(voteEvents)
        .innerJoin(projects, eq(projects.id, voteEvents.projectId))
        .innerJoin(owners, eq(owners.id, projects.ownerId))
        .innerJoin(users, eq(users.id, voteEvents.userId))
        .where(recent)
        .groupBy(projects.id, owners.name)
        .orderBy(desc(lastDay), desc(lastWeek), desc(lastAt))
        .limit(TIMELINE.activityRows);

      const voterRows = await db
        .select({
          handle: users.handle,
          name: users.name,
          joinedAt: users.createdAt,
          lastDay,
          lastWeek,
          projects: sql<number>`count(distinct ${voteEvents.projectId})::int`,
          lastAt,
        })
        .from(voteEvents)
        .innerJoin(users, eq(users.id, voteEvents.userId))
        .where(recent)
        .groupBy(users.id)
        .orderBy(desc(lastDay), desc(lastWeek), desc(lastAt))
        .limit(TIMELINE.activityRows);

      return { ok: true, value: { projects: projectRows, voters: voterRows } };
    },

    /** A project's or a user's toggles, newest first (admins only). */
    timeline: async (
      adminId: string,
      of: TimelineSubject,
    ): Promise<AdminResult<VoteTimeline>> => {
      if (!(await isAdmin(db, adminId))) {
        return { ok: false, reason: "not_admin" };
      }

      let subject: VoteTimeline["subject"];
      let filter;
      if ("project" in of) {
        const [project] = await db
          .select({
            id: projects.id,
            slug: projects.slug,
            name: projects.name,
            ownerHandle: owners.handle,
            ownerName: owners.name,
          })
          .from(projects)
          .innerJoin(owners, eq(owners.id, projects.ownerId))
          .where(eq(projects.slug, of.project));
        if (!project) return { ok: false, reason: "not_found" };
        subject = {
          kind: "project",
          slug: project.slug,
          name: project.name,
          owner: { handle: project.ownerHandle, name: project.ownerName },
        };
        filter = eq(voteEvents.projectId, project.id);
      } else {
        const [user] = await db
          .select({
            id: users.id,
            handle: users.handle,
            name: users.name,
            joinedAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.handle, of.user));
        if (!user?.handle) return { ok: false, reason: "not_found" };
        subject = {
          kind: "user",
          handle: user.handle,
          name: user.name,
          joinedAt: user.joinedAt,
        };
        filter = eq(voteEvents.userId, user.id);
      }

      const [summary] = await db
        .select({
          toggles: sql<number>`count(*)::int`,
          casts: sql<number>`(count(*) filter (where ${voteEvents.action} = 'cast'))::int`,
          retracts: sql<number>`(count(*) filter (where ${voteEvents.action} = 'retract'))::int`,
          distinct:
            subject.kind === "project"
              ? sql<number>`count(distinct ${voteEvents.userId})::int`
              : sql<number>`count(distinct ${voteEvents.projectId})::int`,
          fromNewAccounts: sql<number>`(count(*) filter (where ${newAccountSql}))::int`,
        })
        .from(voteEvents)
        .innerJoin(users, eq(users.id, voteEvents.userId))
        .where(filter);

      const rows = await db
        .select({
          at: voteEvents.at,
          action: voteEvents.action,
          voterHandle: users.handle,
          voterName: users.name,
          voterIsAgent: users.isAgent,
          voterJoinedAt: users.createdAt,
          projectSlug: projects.slug,
          projectName: projects.name,
        })
        .from(voteEvents)
        .innerJoin(users, eq(users.id, voteEvents.userId))
        .innerJoin(projects, eq(projects.id, voteEvents.projectId))
        .where(filter)
        .orderBy(desc(voteEvents.at), desc(voteEvents.id))
        .limit(TIMELINE.limit);

      // Bursts are found oldest first, then shown newest first.
      const bursts = burstFlags(rows.map((r) => r.at).reverse()).reverse();
      const events = rows.map((row, i): VoteEventRow => {
        const accountAgeHours = Math.max(
          0,
          Math.floor((row.at.getTime() - row.voterJoinedAt.getTime()) / HOUR),
        );
        return {
          at: row.at,
          action: row.action,
          voter: {
            handle: row.voterHandle,
            name: row.voterName,
            isAgent: row.voterIsAgent,
          },
          accountAgeHours,
          project: { slug: row.projectSlug, name: row.projectName },
          newAccount: accountAgeHours < TIMELINE.newAccountDays * 24,
          burst: bursts[i]!,
        };
      });

      return {
        ok: true,
        value: {
          subject,
          summary: summary ?? {
            toggles: 0,
            casts: 0,
            retracts: 0,
            distinct: 0,
            fromNewAccounts: 0,
          },
          events,
        },
      };
    },
  };
}

export type VoteTimelines = ReturnType<typeof createVoteTimeline>;
