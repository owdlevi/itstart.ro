import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  challenges,
  fixtureCountExtras,
  projects,
  recognitions,
  reviews,
  users,
  votes,
  type Db,
} from "@repo/db";
import { isAdmin, type AdminResult } from "../admins";
import { challengeStatus } from "../challenges/rules";
import { withExtra } from "../counts";
import type { Projects, ResultProject } from "../projects";
import {
  RECOGNITION_KINDS,
  RECOGNITION_REASON_MAX,
  type RecognitionKind,
} from "./rules";

export {
  RECOGNITION_KINDS,
  RECOGNITION_REASON_MAX,
  type RecognitionKind,
} from "./rules";

/** What screen 11 shows below the header of an ended challenge. */
export type ChallengeResults = {
  /** The ones entered so far, in RECOGNITION_KINDS order. */
  recognitions: {
    kind: RecognitionKind;
    reason: string;
    project: ResultProject;
  }[];
  /**
   * The agent's project with the most votes, out of the ranking (rule 20),
   * and how many people's projects got more votes. Null without one.
   */
  bestAgent: { project: ResultProject; humansAbove: number } | null;
  /** Every other launch, most votes first; late ones carry `isLate` (rule 7). */
  others: ResultProject[];
  /** Human reviews and replies on the challenge's projects (rule 17): "386 păreri date". */
  reviews: number;
};

/** A project the admin can pick for a recognition. */
export type RecognitionCandidate = {
  id: string;
  name: string;
  ownerName: string;
  votes: number;
  /** Its builder's first launch ever: it can be "Cel mai bun prim proiect". */
  firstProject: boolean;
};

export type RecognitionEntry = { projectId: string; reason: string };

/** The admin's recognitions form for one challenge. */
export type RecognitionEditor = {
  challenge: { slug: string; number: number; title: string; ended: boolean };
  current: Record<RecognitionKind, RecognitionEntry | null>;
  /** People's projects launched on time, most votes first (rules 7 and 20). */
  candidates: RecognitionCandidate[];
  /** The community's pick follows the votes: the eligible project with the most. */
  suggestedCommunity: string | null;
};

export type RecognitionProblem =
  | "not_eligible" // not a launch in this challenge, late (rule 7), or an agent's (rule 20)
  | "not_first_project" // its builder had launched something before
  | "duplicate" // the same project in two kinds
  | "reason_empty"
  | "reason_too_long";

export type RecognitionSaveResult =
  | { ok: true }
  | { ok: false; reason: "not_admin" | "not_found" | "not_ended" }
  | {
      ok: false;
      reason: "invalid";
      kind: RecognitionKind;
      problem: RecognitionProblem;
    };

export type Recognitions = {
  /** An ended challenge's results (screen 11). Agents' projects other than the best one only with `agents`. */
  results(opts: {
    challengeId: string;
    viewerId?: string | null;
    agents?: boolean;
  }): Promise<ChallengeResults>;
  /** The recognition each of these projects got, by project id. */
  of(projectIds: string[]): Promise<Map<string, RecognitionKind>>;
  /** The admin's form: what's entered and what can be picked. Admins only. */
  editor(userId: string, slug: string): Promise<AdminResult<RecognitionEditor>>;
  /**
   * Replaces the challenge's recognitions with these; null clears a kind.
   * Admins only, and only after the deadline: the votes are final then.
   */
  save(
    userId: string,
    slug: string,
    entries: Record<RecognitionKind, RecognitionEntry | null>,
  ): Promise<RecognitionSaveResult>;
};

/** Spaces tidied: one line, single spaces. */
const line = (s: string) => s.trim().replace(/\s+/g, " ");

export function createRecognitions(deps: {
  db: Db;
  now: () => Date;
  projects: Projects;
}): Recognitions {
  const { db, now } = deps;

  const votesOf = withExtra(
    sql`select count(*) from ${votes} where ${votes.projectId} = ${projects.id}`,
    projects.id,
    "votes",
  );

  /** People's launches in the challenge, on time, with whether each is its builder's first. */
  const candidates = (tx: Pick<Db, "select">, challengeId: string) => {
    // Another launch by the same builder before this one, in any challenge or none.
    const earlier = sql`select 1 from ${projects} as earlier where earlier.owner_id = ${projects.ownerId} and earlier.stage = 'launched' and earlier.id <> ${projects.id} and (earlier.launched_at < ${projects.launchedAt} or (earlier.launched_at = ${projects.launchedAt} and earlier.id < ${projects.id}))`;
    return tx
      .select({
        id: projects.id,
        name: projects.name,
        ownerName: users.name,
        votes: votesOf,
        firstProject: sql<boolean>`not exists (${earlier})`,
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.ownerId))
      .where(
        and(
          eq(projects.challengeId, challengeId),
          eq(projects.stage, "launched"),
          eq(projects.isLate, false),
          eq(users.isAgent, false),
        ),
      )
      .orderBy(
        sql`${votesOf} desc`,
        asc(projects.launchedAt),
        asc(projects.id),
      );
  };

  const challengeBySlug = async (tx: Pick<Db, "select">, slug: string) => {
    const [row] = await tx
      .select({
        id: challenges.id,
        slug: challenges.slug,
        number: challenges.number,
        title: challenges.title,
        startsAt: challenges.startsAt,
        endsAt: challenges.endsAt,
      })
      .from(challenges)
      .where(eq(challenges.slug, slug));
    return row ?? null;
  };

  return {
    results: async ({ challengeId, viewerId, agents = false }) => {
      const [launched, entered, [extras], [reviewRows]] = await Promise.all([
        deps.projects.launchedIn({ challengeId, viewerId, agents: true }),
        db
          .select({
            kind: recognitions.kind,
            reason: recognitions.reason,
            projectId: recognitions.projectId,
          })
          .from(recognitions)
          .where(eq(recognitions.challengeId, challengeId)),
        db
          .select({ n: fixtureCountExtras.n })
          .from(fixtureCountExtras)
          .where(
            and(
              eq(fixtureCountExtras.subjectId, challengeId),
              eq(fixtureCountExtras.metric, "humans_above_agent"),
            ),
          ),
        db
          .select({
            // Each project's count as its page shows it, plus the challenge's extra.
            n: withExtra(
              sql`select coalesce(sum(${withExtra(
                sql`select count(*) from ${reviews} where ${reviews.projectId} = ${projects.id} and not ${reviews.isAutomated} and not ${reviews.hidden}`,
                projects.id,
                "reviews",
              )}), 0) from ${projects} where ${projects.challengeId} = ${challengeId}`,
              challengeId,
              "reviews",
            ),
          })
          .from(sql`(select 1) as one`),
      ]);

      const byId = new Map(launched.map((p) => [p.id, p]));
      const shown = RECOGNITION_KINDS.flatMap((kind) => {
        const row = entered.find((r) => r.kind === kind);
        const project = row && byId.get(row.projectId);
        return project ? [{ kind, reason: row.reason, project }] : [];
      });
      // launchedIn() puts the most votes first, so the first agent's is the best.
      const best = launched.find((p) => p.owner.isAgent);
      const bestAgent = best
        ? {
            project: best,
            humansAbove:
              launched.filter((p) => !p.owner.isAgent && p.votes > best.votes)
                .length + (extras?.n ?? 0),
          }
        : null;
      const featured = new Set([
        ...shown.map((r) => r.project.id),
        ...(best ? [best.id] : []),
      ]);
      return {
        recognitions: shown,
        bestAgent,
        others: launched.filter(
          (p) => !featured.has(p.id) && (agents || !p.owner.isAgent),
        ),
        reviews: reviewRows?.n ?? 0,
      };
    },

    of: async (projectIds) => {
      if (projectIds.length === 0) return new Map();
      const rows = await db
        .select({ projectId: recognitions.projectId, kind: recognitions.kind })
        .from(recognitions)
        .where(inArray(recognitions.projectId, projectIds));
      return new Map(rows.map((r) => [r.projectId, r.kind]));
    },

    editor: async (userId, slug) => {
      if (!(await isAdmin(db, userId)))
        return { ok: false, reason: "not_admin" };
      const challenge = await challengeBySlug(db, slug);
      if (!challenge) return { ok: false, reason: "not_found" };
      const [rows, list] = await Promise.all([
        db
          .select({
            kind: recognitions.kind,
            projectId: recognitions.projectId,
            reason: recognitions.reason,
          })
          .from(recognitions)
          .where(eq(recognitions.challengeId, challenge.id)),
        candidates(db, challenge.id),
      ]);
      const current = Object.fromEntries(
        RECOGNITION_KINDS.map((kind) => {
          const row = rows.find((r) => r.kind === kind);
          return [
            kind,
            row ? { projectId: row.projectId, reason: row.reason } : null,
          ];
        }),
      ) as Record<RecognitionKind, RecognitionEntry | null>;
      return {
        ok: true,
        value: {
          challenge: {
            slug: challenge.slug,
            number: challenge.number,
            title: challenge.title,
            ended: challengeStatus(challenge, now()) === "ended",
          },
          current,
          candidates: list,
          // Ties go to the earlier launch, as candidates() orders them.
          suggestedCommunity: list[0]?.id ?? null,
        },
      };
    },

    save: (userId, slug, entries) =>
      db.transaction(async (tx) => {
        if (!(await isAdmin(tx, userId))) {
          return { ok: false, reason: "not_admin" };
        }
        const challenge = await challengeBySlug(tx, slug);
        if (!challenge) return { ok: false, reason: "not_found" };
        if (challengeStatus(challenge, now()) !== "ended") {
          return { ok: false, reason: "not_ended" };
        }
        const eligible = new Map(
          (await candidates(tx, challenge.id)).map((c) => [c.id, c]),
        );

        const rows: (typeof recognitions.$inferInsert)[] = [];
        const invalid = (kind: RecognitionKind, problem: RecognitionProblem) =>
          ({ ok: false, reason: "invalid", kind, problem }) as const;
        for (const kind of RECOGNITION_KINDS) {
          const entry = entries[kind];
          if (!entry) continue;
          const reason = line(entry.reason);
          const candidate = eligible.get(entry.projectId);
          if (!candidate) return invalid(kind, "not_eligible");
          if (kind === "first_project" && !candidate.firstProject) {
            return invalid(kind, "not_first_project");
          }
          if (rows.some((r) => r.projectId === entry.projectId)) {
            return invalid(kind, "duplicate");
          }
          if (!reason) return invalid(kind, "reason_empty");
          if (reason.length > RECOGNITION_REASON_MAX) {
            return invalid(kind, "reason_too_long");
          }
          rows.push({
            challengeId: challenge.id,
            kind,
            projectId: entry.projectId,
            reason,
          });
        }

        await tx
          .delete(recognitions)
          .where(eq(recognitions.challengeId, challenge.id));
        if (rows.length > 0) await tx.insert(recognitions).values(rows);
        return { ok: true };
      }),
  };
}
