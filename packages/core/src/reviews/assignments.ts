import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { projects, reviewAssignments, reviews, users, type Db } from "@repo/db";
import { withExtra } from "../counts";

/** How many projects each builder is asked to review in a challenge (rule 16). */
export const ASSIGNMENTS_PER_BUILDER = 2;

type Tx = Pick<Db, "select" | "selectDistinct" | "insert" | "execute">;

/**
 * Rule 16, run inside the transaction that launches `projectId`:
 * - its builder is assigned up to two launched projects in the same challenge,
 *   the ones with the fewest human reviews (oldest launch first on a tie), not
 *   their own, not agents', not reviewed by them, not assigned to them already;
 * - builders in that challenge still short of two (the first launchers found
 *   too few candidates) are assigned the new launch, unless an agent built it.
 *
 * Two per builder per challenge, not per launch: a second launch in the same
 * challenge adds none once they have two. Agents get none (they never review,
 * §12), and a project of its own (no challenge) gives none.
 */
export async function assignOnLaunch(
  tx: Tx,
  launch: {
    projectId: string;
    ownerId: string;
    challengeId: string | null;
    at: Date;
  },
) {
  const { projectId, ownerId, challengeId, at } = launch;
  if (!challengeId) return;
  // Two launches at once can't both top someone up past two.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`assign:${challengeId}`}))`,
  );
  const [owner] = await tx
    .select({ isAgent: users.isAgent })
    .from(users)
    .where(eq(users.id, ownerId));
  if (!owner || owner.isAgent) return;

  // Assignments a reviewer holds in this challenge, done or not.
  const held = (reviewerId: AnyPgColumn | string) =>
    sql`(select count(*) from ${reviewAssignments} join ${projects} p on p.id = ${reviewAssignments.projectId} where ${reviewAssignments.reviewerId} = ${reviewerId} and p.challenge_id = ${challengeId})`;
  const reviewedBy = (
    reviewerId: AnyPgColumn | string,
    project: AnyPgColumn | string,
  ) =>
    sql`exists (select 1 from ${reviews} where ${reviews.authorId} = ${reviewerId} and ${reviews.projectId} = ${project})`;

  const mine = await assignmentCount(tx, ownerId, challengeId);
  const need = ASSIGNMENTS_PER_BUILDER - mine.total;
  if (need > 0) {
    const picks = await tx
      .select({ id: projects.id })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.ownerId))
      .where(
        and(
          eq(projects.challengeId, challengeId),
          eq(projects.stage, "launched"),
          ne(projects.ownerId, ownerId),
          eq(users.isAgent, false),
          sql`not ${reviewedBy(ownerId, projects.id)}`,
          sql`not exists (select 1 from ${reviewAssignments} where ${reviewAssignments.reviewerId} = ${ownerId} and ${reviewAssignments.projectId} = ${projects.id})`,
        ),
      )
      .orderBy(
        asc(
          withExtra(
            sql`select count(*) from ${reviews} where ${reviews.projectId} = ${projects.id} and not ${reviews.isAutomated} and not ${reviews.hidden}`,
            projects.id,
            "reviews",
          ),
        ),
        asc(projects.launchedAt),
        asc(projects.id),
      )
      .limit(need);
    if (picks.length > 0) {
      await tx
        .insert(reviewAssignments)
        .values(
          picks.map((p) => ({
            reviewerId: ownerId,
            projectId: p.id,
            createdAt: at,
          })),
        )
        .onConflictDoNothing();
    }
  }

  // Builders who launched here before there were two projects to give them.
  const short = await tx
    .selectDistinct({ id: users.id })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.ownerId))
    .where(
      and(
        eq(projects.challengeId, challengeId),
        eq(projects.stage, "launched"),
        ne(projects.ownerId, ownerId),
        eq(users.isAgent, false),
        sql`${held(users.id)} < ${ASSIGNMENTS_PER_BUILDER}`,
        sql`not ${reviewedBy(users.id, projectId)}`,
      ),
    );
  if (short.length > 0) {
    await tx
      .insert(reviewAssignments)
      .values(
        short.map((u) => ({ reviewerId: u.id, projectId, createdAt: at })),
      )
      .onConflictDoNothing();
  }
}

/** How many of someone's assignments in a challenge exist and are done. */
export async function assignmentCount(
  db: Pick<Db, "select">,
  reviewerId: string,
  challengeId: string,
) {
  const [row] = await db
    .select({
      total: count(),
      done: sql<number>`count(${reviewAssignments.doneAt})::int`,
    })
    .from(reviewAssignments)
    .innerJoin(projects, eq(projects.id, reviewAssignments.projectId))
    .where(
      and(
        eq(reviewAssignments.reviewerId, reviewerId),
        eq(projects.challengeId, challengeId),
      ),
    );
  return { total: row?.total ?? 0, done: row?.done ?? 0 };
}
