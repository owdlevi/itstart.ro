import { and, count, eq, gte, isNull, sql } from "drizzle-orm";
import { projects, reviewAssignments, reviews, users, type Db } from "@repo/db";
import { withExtra } from "../counts";

export type ReviewAuthor = {
  id: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  avatarFill: string | null;
  isAgent: boolean;
};

export type Review = {
  id: string;
  body: string;
  /** Written by the review agent: "Părere automată" (rule 18). */
  isAutomated: boolean;
  createdAt: Date;
  editedAt: Date | null;
  author: ReviewAuthor;
  /** Oldest first. Replies have no replies (rule 15). */
  replies: Omit<Review, "replies">[];
};

export type ReviewThread = {
  /** Automated reviews first (rule 18), then people's, newest first. */
  reviews: Review[];
  /** Human reviews and replies; automated reviews don't count (rule 17). */
  humanCount: number;
  /** Every review and reply on the page: "Păreri · 4". */
  total: number;
};

export type ReviewRefusal =
  | "not_found" // the project, or the review being replied to
  | "agent" // agents review only through the review agent (§12)
  | "own" // a builder replies on their own project rather than reviewing it
  | "not_owner" // only the project's owner replies (rule 15)
  | "empty"
  | "too_long"
  | "rate_limited";

export type ReviewResult =
  { ok: true; id: string } | { ok: false; reason: ReviewRefusal };

export type ReviewsConfig = {
  maxLength: number;
  /** Reviews and replies together, per user (DECISIONS, "Rate limits live in Postgres"). */
  rateLimit: { max: number; windowMinutes: number };
};

export const defaultReviewsConfig: ReviewsConfig = {
  maxLength: 2000,
  rateLimit: { max: 10, windowMinutes: 60 },
};

export type Reviews = {
  /** A project's visible reviews with their replies, and the counts. */
  thread(projectId: string): Promise<ReviewThread>;
  /**
   * Posts a review (any signed-in person, rule 15) or, with `parentId`, the
   * owner's reply to one (one level). Refusals are returned, never thrown.
   * Throws only if `authorId` does not exist, which means a broken session.
   */
  post(input: {
    authorId: string;
    projectId: string;
    parentId?: string | null;
    body: string;
  }): Promise<ReviewResult>;
};

const MINUTE = 60_000;

export function createReviews(deps: {
  db: Db;
  now: () => Date;
  config?: ReviewsConfig;
}): Reviews {
  const { db, now } = deps;
  const config = deps.config ?? defaultReviewsConfig;

  return {
    thread: async (projectId) => {
      const [rows, [counts]] = await Promise.all([
        db
          .select({
            id: reviews.id,
            parentId: reviews.parentId,
            body: reviews.body,
            isAutomated: reviews.isAutomated,
            createdAt: reviews.createdAt,
            editedAt: reviews.editedAt,
            author: {
              id: users.id,
              handle: users.handle,
              name: users.name,
              avatarUrl: users.avatarUrl,
              avatarFill: users.avatarFill,
              isAgent: users.isAgent,
            },
          })
          .from(reviews)
          .innerJoin(users, eq(users.id, reviews.authorId))
          .where(
            and(eq(reviews.projectId, projectId), eq(reviews.hidden, false)),
          )
          .orderBy(reviews.createdAt, reviews.id),
        db
          .select({
            human: withExtra(
              sql`select count(*) from ${reviews} where ${reviews.projectId} = ${projectId} and not ${reviews.isAutomated} and not ${reviews.hidden}`,
              projectId,
              "reviews",
            ),
            automated: sql<number>`(select count(*) from ${reviews} where ${reviews.projectId} = ${projectId} and ${reviews.isAutomated} and not ${reviews.hidden})::int`,
          })
          // Drizzle leaves columns unqualified in a one-table select, so the
          // subqueries compare with the id itself, not projects.id.
          .from(projects)
          .where(eq(projects.id, projectId)),
      ]);

      const top = rows
        .filter((r) => r.parentId === null)
        .map(({ parentId: _p, ...r }) => ({
          ...r,
          replies: rows
            .filter((reply) => reply.parentId === r.id)
            .map(({ parentId: _parent, ...reply }) => reply),
        }));
      const ordered = [
        ...top.filter((r) => r.isAutomated),
        ...top.filter((r) => !r.isAutomated).reverse(),
      ];
      const humanCount = counts?.human ?? 0;
      return {
        reviews: ordered,
        humanCount,
        total: humanCount + (counts?.automated ?? 0),
      };
    },

    post: ({ authorId, projectId, parentId = null, body }) =>
      db.transaction(async (tx) => {
        const at = now();
        const refuse = (reason: ReviewRefusal): ReviewResult => ({
          ok: false,
          reason,
        });
        // Serialises one person's posts, so a double submit can't pass the limit.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${authorId}))`,
        );

        const [author] = await tx
          .select({ isAgent: users.isAgent })
          .from(users)
          .where(eq(users.id, authorId));
        if (!author) throw new Error(`reviews.post: unknown user ${authorId}`);

        const [project] = await tx
          .select({ ownerId: projects.ownerId })
          .from(projects)
          .where(eq(projects.id, projectId));
        if (!project) return refuse("not_found");
        if (author.isAgent) return refuse("agent");

        if (parentId) {
          const [parent] = await tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(
              and(
                eq(reviews.id, parentId),
                eq(reviews.projectId, projectId),
                isNull(reviews.parentId),
                eq(reviews.hidden, false),
              ),
            );
          if (!parent) return refuse("not_found");
          if (project.ownerId !== authorId) return refuse("not_owner");
        } else if (project.ownerId === authorId) {
          return refuse("own");
        }

        const text = body.trim();
        if (!text) return refuse("empty");
        if (text.length > config.maxLength) return refuse("too_long");

        const windowStart = new Date(
          at.getTime() - config.rateLimit.windowMinutes * MINUTE,
        );
        const [recent] = await tx
          .select({ n: count() })
          .from(reviews)
          .where(
            and(
              eq(reviews.authorId, authorId),
              gte(reviews.createdAt, windowStart),
            ),
          );
        if ((recent?.n ?? 0) >= config.rateLimit.max) {
          return refuse("rate_limited");
        }

        const [row] = await tx
          .insert(reviews)
          .values({ projectId, authorId, parentId, body: text, createdAt: at })
          .returning({ id: reviews.id });
        if (!parentId) {
          // Reviewing an assigned project fulfils the assignment (rule 16).
          await tx
            .update(reviewAssignments)
            .set({ doneAt: at })
            .where(
              and(
                eq(reviewAssignments.reviewerId, authorId),
                eq(reviewAssignments.projectId, projectId),
                isNull(reviewAssignments.doneAt),
              ),
            );
        }
        return { ok: true, id: row!.id };
      }),
  };
}
