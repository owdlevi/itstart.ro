import { and, asc, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  answers,
  challenges,
  projects,
  questions,
  reports,
  reviews,
  users,
  type Db,
} from "@repo/db";
import { isAdmin, type AdminResult } from "../admins";
import { REPORT_LIMITS, type ReportReason } from "./rules";

export {
  isReportReason,
  REPORT_LIMITS,
  REPORT_REASONS,
  type ReportReason,
} from "./rules";

export type ReportRefusal =
  | "not_found" // no such project, or it's hidden already
  | "own" // the owner edits their project rather than reporting it
  | "agent" // agents write only through their own paths
  | "details_empty" // "other" needs a few words
  | "too_long"
  | "already" // their earlier report on it is still open
  | "rate_limited";

export type ReportResult = { ok: true } | { ok: false; reason: ReportRefusal };

export type ModerationPerson = {
  name: string;
  handle: string | null;
  isAgent: boolean;
};

/** A project with its open reports, oldest first (screen: /admin/moderare). */
export type ReportedProject = {
  project: {
    id: string;
    slug: string;
    name: string;
    hidden: boolean;
    owner: ModerationPerson;
  };
  reports: {
    id: string;
    reason: ReportReason;
    details: string;
    createdAt: Date;
    /** Null once their account is gone. */
    reporter: ModerationPerson | null;
  }[];
};

export type ModerationKind = "project" | "review" | "question" | "answer";

/** Where an item shows, for the admin's link to it. */
export type ModerationPlace =
  | { kind: "project"; slug: string; name: string }
  | {
      kind: "question";
      challengeSlug: string;
      slug: string;
      title: string;
    };

/** Something an admin can hide or show again. */
export type ModerationItem = {
  kind: ModerationKind;
  id: string;
  /** A project's name, a question's title, a review's or answer's body. */
  text: string;
  author: ModerationPerson;
  /** A review written by the review agent ("Părere automată"). */
  isAutomated: boolean;
  /** A review that replies to another. */
  isReply: boolean;
  createdAt: Date;
  hidden: boolean;
  place: ModerationPlace;
};

export type ModerationTarget = { kind: ModerationKind; id: string };

export type ModerationConfig = {
  /** How many items the recent feed shows. */
  recent: number;
  /** How many hidden items the admin's list shows. */
  hidden: number;
};

export const MODERATION: ModerationConfig = { recent: 40, hidden: 200 };

export type Moderation = {
  /**
   * "Raportează o problemă cu acest proiect": anyone signed in but its owner
   * and agents, one open report per person per project, a few an hour.
   */
  report(input: {
    reporterId: string;
    projectId: string;
    reason: ReportReason;
    details: string;
  }): Promise<ReportResult>;
  /** The open reports, by project, the project waiting longest first. */
  queue(adminId: string): Promise<AdminResult<ReportedProject[]>>;
  /** The newest reviews, replies, questions and answers, newest first, hidden ones included. */
  recent(adminId: string): Promise<AdminResult<ModerationItem[]>>;
  /** Everything hidden now, newest first. */
  hiddenItems(adminId: string): Promise<AdminResult<ModerationItem[]>>;
  /**
   * Hides something, or shows it again. Hiding a project resolves its open
   * reports: the team acted on them.
   */
  setHidden(
    adminId: string,
    target: ModerationTarget,
    hidden: boolean,
  ): Promise<{ ok: true } | { ok: false; reason: "not_admin" | "not_found" }>;
  /** Resolves a project's open reports without changing anything else. */
  resolve(
    adminId: string,
    projectId: string,
  ): Promise<
    { ok: true; resolved: number } | { ok: false; reason: "not_admin" }
  >;
};

const HOUR = 3_600_000;

export function createModeration(deps: {
  db: Db;
  now: () => Date;
}): Moderation {
  const { db, now } = deps;

  const person = {
    name: users.name,
    handle: users.handle,
    isAgent: users.isAgent,
  };

  /** Reviews (and replies), questions and answers, each newest first. */
  const items = async (
    which: "recent" | "hidden",
  ): Promise<ModerationItem[]> => {
    const onlyHidden = which === "hidden";
    const limit = onlyHidden ? MODERATION.hidden : MODERATION.recent;
    const asked = alias(questions, "asked");

    const [reviewRows, questionRows, answerRows, projectRows] =
      await Promise.all([
        db
          .select({
            id: reviews.id,
            text: reviews.body,
            author: person,
            isAutomated: reviews.isAutomated,
            parentId: reviews.parentId,
            createdAt: reviews.createdAt,
            hidden: reviews.hidden,
            slug: projects.slug,
            name: projects.name,
          })
          .from(reviews)
          .innerJoin(users, eq(users.id, reviews.authorId))
          .innerJoin(projects, eq(projects.id, reviews.projectId))
          .where(onlyHidden ? eq(reviews.hidden, true) : undefined)
          .orderBy(desc(reviews.createdAt), desc(reviews.id))
          .limit(limit),
        db
          .select({
            id: questions.id,
            text: questions.title,
            author: person,
            createdAt: questions.createdAt,
            hidden: questions.hidden,
            slug: questions.slug,
            challengeSlug: challenges.slug,
          })
          .from(questions)
          .innerJoin(users, eq(users.id, questions.authorId))
          .innerJoin(challenges, eq(challenges.id, questions.challengeId))
          .where(onlyHidden ? eq(questions.hidden, true) : undefined)
          .orderBy(desc(questions.createdAt), desc(questions.id))
          .limit(limit),
        db
          .select({
            id: answers.id,
            text: answers.body,
            author: person,
            createdAt: answers.createdAt,
            hidden: answers.hidden,
            slug: asked.slug,
            title: asked.title,
            challengeSlug: challenges.slug,
          })
          .from(answers)
          .innerJoin(users, eq(users.id, answers.authorId))
          .innerJoin(asked, eq(asked.id, answers.questionId))
          .innerJoin(challenges, eq(challenges.id, asked.challengeId))
          .where(onlyHidden ? eq(answers.hidden, true) : undefined)
          .orderBy(desc(answers.createdAt), desc(answers.id))
          .limit(limit),
        // Projects come in through reports, so the feed has only hidden ones.
        onlyHidden
          ? db
              .select({
                id: projects.id,
                text: projects.name,
                author: person,
                createdAt: projects.createdAt,
                slug: projects.slug,
              })
              .from(projects)
              .innerJoin(users, eq(users.id, projects.ownerId))
              .where(eq(projects.hidden, true))
              .orderBy(desc(projects.createdAt), desc(projects.id))
              .limit(limit)
          : [],
      ]);

    const all: ModerationItem[] = [
      ...reviewRows.map(({ parentId, slug, name, ...r }) => ({
        ...r,
        kind: "review" as const,
        isReply: parentId !== null,
        place: { kind: "project" as const, slug, name },
      })),
      ...questionRows.map(({ slug, challengeSlug, text, ...q }) => ({
        ...q,
        text,
        kind: "question" as const,
        isAutomated: false,
        isReply: false,
        place: {
          kind: "question" as const,
          challengeSlug,
          slug,
          title: text,
        },
      })),
      ...answerRows.map(({ slug, title, challengeSlug, ...a }) => ({
        ...a,
        kind: "answer" as const,
        isAutomated: false,
        isReply: false,
        place: { kind: "question" as const, challengeSlug, slug, title },
      })),
      ...projectRows.map(({ slug, text, ...p }) => ({
        ...p,
        text,
        kind: "project" as const,
        isAutomated: false,
        isReply: false,
        hidden: true,
        place: { kind: "project" as const, slug, name: text },
      })),
    ];
    all.sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    );
    return all.slice(0, limit);
  };

  const asAdmin = async <T>(
    adminId: string,
    read: () => Promise<T>,
  ): Promise<AdminResult<T>> =>
    (await isAdmin(db, adminId))
      ? { ok: true, value: await read() }
      : { ok: false, reason: "not_admin" };

  const resolveOpen = (
    tx: Pick<Db, "update">,
    adminId: string,
    projectId: string,
  ) =>
    tx
      .update(reports)
      .set({ resolvedAt: now(), resolvedBy: adminId })
      .where(and(eq(reports.projectId, projectId), isNull(reports.resolvedAt)))
      .returning({ id: reports.id });

  return {
    report: ({ reporterId, projectId, reason, details }) =>
      db.transaction(async (tx) => {
        const refuse = (r: ReportRefusal): ReportResult => ({
          ok: false,
          reason: r,
        });
        // Serialises one person's reports, so a double submit can't pass the limits.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`report:${reporterId}`}))`,
        );
        const [reporter] = await tx
          .select({ isAgent: users.isAgent })
          .from(users)
          .where(eq(users.id, reporterId));
        if (!reporter)
          throw new Error(`moderation.report: unknown user ${reporterId}`);

        const [project] = await tx
          .select({ ownerId: projects.ownerId })
          .from(projects)
          .where(and(eq(projects.id, projectId), eq(projects.hidden, false)));
        if (!project) return refuse("not_found");
        if (reporter.isAgent) return refuse("agent");
        if (project.ownerId === reporterId) return refuse("own");

        const text = details.trim();
        if (reason === "other" && !text) return refuse("details_empty");
        if (text.length > REPORT_LIMITS.details) return refuse("too_long");

        const [open] = await tx
          .select({ n: count() })
          .from(reports)
          .where(
            and(
              eq(reports.reporterId, reporterId),
              eq(reports.projectId, projectId),
              isNull(reports.resolvedAt),
            ),
          );
        if ((open?.n ?? 0) > 0) return refuse("already");

        const at = now();
        const [recent] = await tx
          .select({ n: count() })
          .from(reports)
          .where(
            and(
              eq(reports.reporterId, reporterId),
              gte(reports.createdAt, new Date(at.getTime() - HOUR)),
            ),
          );
        if ((recent?.n ?? 0) >= REPORT_LIMITS.perHour) {
          return refuse("rate_limited");
        }

        await tx.insert(reports).values({
          projectId,
          reporterId,
          reason,
          details: text,
          createdAt: at,
        });
        return { ok: true };
      }),

    queue: (adminId) =>
      asAdmin(adminId, async () => {
        const owner = alias(users, "owner");
        const rows = await db
          .select({
            id: reports.id,
            reason: reports.reason,
            details: reports.details,
            createdAt: reports.createdAt,
            reporter: person,
            project: {
              id: projects.id,
              slug: projects.slug,
              name: projects.name,
              hidden: projects.hidden,
            },
            owner: {
              name: owner.name,
              handle: owner.handle,
              isAgent: owner.isAgent,
            },
          })
          .from(reports)
          .innerJoin(projects, eq(projects.id, reports.projectId))
          .innerJoin(owner, eq(owner.id, projects.ownerId))
          .leftJoin(users, eq(users.id, reports.reporterId))
          .where(isNull(reports.resolvedAt))
          .orderBy(asc(reports.createdAt), asc(reports.id));

        const byProject = new Map<string, ReportedProject>();
        for (const { project, owner: o, reporter, ...r } of rows) {
          const entry = byProject.get(project.id) ?? {
            project: { ...project, owner: o },
            reports: [],
          };
          // A left join gives an object of nulls without a reporter.
          entry.reports.push({
            ...r,
            reporter: reporter?.name != null ? reporter : null,
          });
          byProject.set(project.id, entry);
        }
        return [...byProject.values()];
      }),

    recent: (adminId) => asAdmin(adminId, () => items("recent")),
    hiddenItems: (adminId) => asAdmin(adminId, () => items("hidden")),

    setHidden: async (adminId, { kind, id }, hidden) => {
      if (!(await isAdmin(db, adminId))) {
        return { ok: false, reason: "not_admin" };
      }
      return db.transaction(async (tx) => {
        const changed =
          kind === "project"
            ? await tx
                .update(projects)
                .set({ hidden })
                .where(eq(projects.id, id))
                .returning({ id: projects.id })
            : kind === "review"
              ? await tx
                  .update(reviews)
                  .set({ hidden })
                  .where(eq(reviews.id, id))
                  .returning({ id: reviews.id })
              : kind === "question"
                ? await tx
                    .update(questions)
                    .set({ hidden })
                    .where(eq(questions.id, id))
                    .returning({ id: questions.id })
                : await tx
                    .update(answers)
                    .set({ hidden })
                    .where(eq(answers.id, id))
                    .returning({ id: answers.id });
        if (changed.length === 0) return { ok: false, reason: "not_found" };
        if (kind === "project" && hidden) await resolveOpen(tx, adminId, id);
        return { ok: true };
      });
    },

    resolve: async (adminId, projectId) => {
      if (!(await isAdmin(db, adminId))) {
        return { ok: false, reason: "not_admin" };
      }
      const resolved = await resolveOpen(db, adminId, projectId);
      return { ok: true, resolved: resolved.length };
    },
  };
}
