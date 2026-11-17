import { and, count, eq, gte, like, or, sql } from "drizzle-orm";
import { answers, challenges, questions, users, type Db } from "@repo/db";
import { withExtra } from "../counts";
import { freeSlug, slugBase } from "../slugs";
import { QUESTION_LIMITS } from "./rules";

export { QUESTION_LIMITS } from "./rules";

export type QuestionAuthor = {
  id: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  avatarFill: string | null;
  isAgent: boolean;
};

/** A row in "Întrebări și ajutor". */
export type QuestionRow = {
  id: string;
  slug: string;
  title: string;
  author: QuestionAuthor;
  /** Visible answers, fixture extras included. */
  answerCount: number;
  /** The asker marked an answer as the solution: "Rezolvat". */
  solved: boolean;
  createdAt: Date;
  /** The latest answer, or the question itself before the first: rows sort by it. */
  lastActivityAt: Date;
};

export type Answer = {
  id: string;
  body: string;
  createdAt: Date;
  author: QuestionAuthor;
};

export type QuestionPage = QuestionRow & {
  challengeId: string;
  body: string;
  solvedAnswerId: string | null;
  /** The solution first, then the rest oldest first. */
  answers: Answer[];
};

export type QuestionRefusal =
  | "not_found" // the challenge, the question or the answer
  | "agent" // agents don't ask or answer
  | "not_onboarded" // no name to show yet (/bun-venit)
  | "closed" // the challenge's deadline has passed
  | "title_empty"
  | "title_too_long"
  | "body_too_long"
  | "empty"
  | "too_long"
  | "rate_limited";

export type AskResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; reason: QuestionRefusal };

export type AnswerResult =
  { ok: true; id: string } | { ok: false; reason: QuestionRefusal };

export type SolveResult =
  { ok: true } | { ok: false; reason: "not_found" | "not_author" };

export type QuestionsConfig = {
  /** Questions and answers together, per user (DECISIONS, "Rate limits live in Postgres"). */
  rateLimit: { max: number; windowMinutes: number };
};

export const defaultQuestionsConfig: QuestionsConfig = {
  rateLimit: { max: 10, windowMinutes: 60 },
};

export type Questions = {
  /** A challenge's visible questions, latest activity first, and how many there are. */
  list(
    challengeId: string,
    opts?: { limit?: number },
  ): Promise<{ questions: QuestionRow[]; total: number }>;
  /** One question with its answers, or null if it's unknown or hidden. */
  bySlug(challengeId: string, slug: string): Promise<QuestionPage | null>;
  /**
   * Asks a question in a challenge that hasn't ended. Refusals are returned,
   * never thrown; throws only for an unknown author (a broken session).
   */
  ask(input: {
    authorId: string;
    challengeId: string;
    title: string;
    body?: string;
  }): Promise<AskResult>;
  /** Answers a question while its challenge hasn't ended. Anyone signed in may. */
  answer(input: {
    authorId: string;
    questionId: string;
    body: string;
  }): Promise<AnswerResult>;
  /**
   * The asker marks one answer as the solution, or clears it with null. Also
   * after the deadline: it only labels what helped.
   */
  markSolved(input: {
    userId: string;
    questionId: string;
    answerId: string | null;
  }): Promise<SolveResult>;
};

const MINUTE = 60_000;

const author = {
  id: users.id,
  handle: users.handle,
  name: users.name,
  avatarUrl: users.avatarUrl,
  avatarFill: users.avatarFill,
  isAgent: users.isAgent,
};

export function createQuestions(deps: {
  db: Db;
  now: () => Date;
  config?: QuestionsConfig;
}): Questions {
  const { db, now } = deps;
  const config = deps.config ?? defaultQuestionsConfig;

  // Selected from questions joined with users, so the column names are
  // qualified inside the subqueries (ARCHITECTURE, gotchas).
  const lastActivityAt = sql<Date>`greatest(${questions.createdAt}, (select max(a.created_at) from answers a where a.question_id = ${questions.id} and not a.hidden))`;
  const row = {
    id: questions.id,
    slug: questions.slug,
    title: questions.title,
    author,
    answerCount: withExtra(
      sql`select count(*) from answers a where a.question_id = ${questions.id} and not a.hidden`,
      questions.id,
      "answers",
    ),
    // A hidden solution no longer solves anything.
    solved: sql<boolean>`exists (select 1 from answers a where a.id = ${questions.solvedAnswerId} and not a.hidden)`,
    createdAt: questions.createdAt,
    lastActivityAt: lastActivityAt.mapWith(questions.createdAt),
  };

  /**
   * Who may post, and whether the window allows it: the checks ask() and
   * answer() share. Inside the caller's transaction, under the author's lock.
   */
  const gate = async (
    tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
    authorId: string,
    challengeId: string,
    at: Date,
  ): Promise<QuestionRefusal | null> => {
    // Serialises one person's posts, so a double submit can't pass the limit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${authorId}))`);
    const [user] = await tx
      .select({ isAgent: users.isAgent, onboardedAt: users.onboardedAt })
      .from(users)
      .where(eq(users.id, authorId));
    if (!user) throw new Error(`questions: unknown user ${authorId}`);
    const [challenge] = await tx
      .select({ endsAt: challenges.endsAt })
      .from(challenges)
      .where(eq(challenges.id, challengeId));
    if (!challenge) return "not_found";
    if (user.isAgent) return "agent";
    if (!user.onboardedAt) return "not_onboarded";
    if (at > challenge.endsAt) return "closed";

    const windowStart = new Date(
      at.getTime() - config.rateLimit.windowMinutes * MINUTE,
    );
    const [[asked], [answered]] = await Promise.all([
      tx
        .select({ n: count() })
        .from(questions)
        .where(
          and(
            eq(questions.authorId, authorId),
            gte(questions.createdAt, windowStart),
          ),
        ),
      tx
        .select({ n: count() })
        .from(answers)
        .where(
          and(
            eq(answers.authorId, authorId),
            gte(answers.createdAt, windowStart),
          ),
        ),
    ]);
    if ((asked?.n ?? 0) + (answered?.n ?? 0) >= config.rateLimit.max) {
      return "rate_limited";
    }
    return null;
  };

  return {
    list: async (challengeId, opts = {}) => {
      const query = db
        .select(row)
        .from(questions)
        .innerJoin(users, eq(users.id, questions.authorId))
        .where(
          and(
            eq(questions.challengeId, challengeId),
            eq(questions.hidden, false),
          ),
        )
        .orderBy(sql`${lastActivityAt} desc`, questions.id);
      const [rows, [counts]] = await Promise.all([
        opts.limit === undefined ? query : query.limit(opts.limit),
        db
          .select({
            total: withExtra(
              sql`select count(*) from questions q where q.challenge_id = ${challengeId} and not q.hidden`,
              challengeId,
              "questions",
            ),
          })
          .from(challenges)
          .where(eq(challenges.id, challengeId)),
      ]);
      return { questions: rows, total: counts?.total ?? 0 };
    },

    bySlug: async (challengeId, slug) => {
      const [question] = await db
        .select({
          ...row,
          challengeId: questions.challengeId,
          body: questions.body,
          solvedAnswerId: questions.solvedAnswerId,
        })
        .from(questions)
        .innerJoin(users, eq(users.id, questions.authorId))
        .where(
          and(
            eq(questions.challengeId, challengeId),
            eq(questions.slug, slug),
            eq(questions.hidden, false),
          ),
        );
      if (!question) return null;
      const list = await db
        .select({
          id: answers.id,
          body: answers.body,
          createdAt: answers.createdAt,
          author,
        })
        .from(answers)
        .innerJoin(users, eq(users.id, answers.authorId))
        .where(
          and(eq(answers.questionId, question.id), eq(answers.hidden, false)),
        )
        .orderBy(answers.createdAt, answers.id);
      const solution = list.find((a) => a.id === question.solvedAnswerId);
      return {
        ...question,
        solved: !!solution,
        solvedAnswerId: solution?.id ?? null,
        answers: solution
          ? [solution, ...list.filter((a) => a !== solution)]
          : list,
      };
    },

    ask: ({ authorId, challengeId, title, body = "" }) =>
      db.transaction(async (tx): Promise<AskResult> => {
        const at = now();
        const refuse = (reason: QuestionRefusal): AskResult => ({
          ok: false,
          reason,
        });
        const refusal = await gate(tx, authorId, challengeId, at);
        if (refusal) return refuse(refusal);

        const heading = title.trim();
        const details = body.trim();
        if (!heading) return refuse("title_empty");
        if (heading.length > QUESTION_LIMITS.title) {
          return refuse("title_too_long");
        }
        if (details.length > QUESTION_LIMITS.body) {
          return refuse("body_too_long");
        }

        // One slug per challenge: two people asking at once take turns.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`questions:${challengeId}`}))`,
        );
        const base = slugBase(heading, "intrebare");
        const taken = await tx
          .select({ slug: questions.slug })
          .from(questions)
          .where(
            and(
              eq(questions.challengeId, challengeId),
              or(eq(questions.slug, base), like(questions.slug, `${base}-%`)),
            ),
          );
        const slug = freeSlug(base, new Set(taken.map((q) => q.slug)));
        const [inserted] = await tx
          .insert(questions)
          .values({
            challengeId,
            authorId,
            slug,
            title: heading,
            body: details,
            createdAt: at,
          })
          .returning({ id: questions.id });
        return { ok: true, id: inserted!.id, slug };
      }),

    answer: ({ authorId, questionId, body }) =>
      db.transaction(async (tx): Promise<AnswerResult> => {
        const at = now();
        const [question] = await tx
          .select({ challengeId: questions.challengeId })
          .from(questions)
          .where(
            and(eq(questions.id, questionId), eq(questions.hidden, false)),
          );
        if (!question) return { ok: false, reason: "not_found" };
        const refusal = await gate(tx, authorId, question.challengeId, at);
        if (refusal) return { ok: false, reason: refusal };

        const text = body.trim();
        if (!text) return { ok: false, reason: "empty" };
        if (text.length > QUESTION_LIMITS.answer) {
          return { ok: false, reason: "too_long" };
        }
        const [inserted] = await tx
          .insert(answers)
          .values({ questionId, authorId, body: text, createdAt: at })
          .returning({ id: answers.id });
        return { ok: true, id: inserted!.id };
      }),

    markSolved: async ({ userId, questionId, answerId }) => {
      const [question] = await db
        .select({ authorId: questions.authorId })
        .from(questions)
        .where(and(eq(questions.id, questionId), eq(questions.hidden, false)));
      if (!question) return { ok: false, reason: "not_found" };
      if (question.authorId !== userId) {
        return { ok: false, reason: "not_author" };
      }
      if (answerId) {
        const [answer] = await db
          .select({ id: answers.id })
          .from(answers)
          .where(
            and(
              eq(answers.id, answerId),
              eq(answers.questionId, questionId),
              eq(answers.hidden, false),
            ),
          );
        if (!answer) return { ok: false, reason: "not_found" };
      }
      await db
        .update(questions)
        .set({ solvedAnswerId: answerId })
        .where(eq(questions.id, questionId));
      return { ok: true };
    },
  };
}
