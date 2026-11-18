import { eq } from "drizzle-orm";
import { challenges, projects, type Db } from "@repo/db";
import { createCannedLinkChecker, type LinkChecker } from "../link-checker";
import {
  afterCheck,
  LINK_CHECKS,
  nextCheckAt,
  type LinkCheckConfig,
  type LinkState,
} from "./rules";

export {
  afterCheck,
  LINK_CHECKS,
  nextCheckAt,
  shownCheck,
  type LinkCheckConfig,
  type LinkState,
} from "./rules";

/** A state as `projects` columns. */
const columnsOf = (state: LinkState) => ({
  linkCheckedAt: state.checkedAt,
  linkOk: state.ok,
  linkFailedAt: state.failedAt,
});

/**
 * Rule 9's check on save answered: the columns that record it as the latest
 * link check, whatever came before (a new link starts over).
 */
export const linkPassed = (at: Date) =>
  columnsOf(
    afterCheck({ checkedAt: null, ok: null, failedAt: null }, true, at),
  );

/** A project whose live link is due for a check. */
export type DueLink = { projectId: string; url: string };

export type LinkCheckOutcome =
  /** It opened; the page says "Merge." */
  | "opened"
  /** A first failure: nothing shows until the next check confirms it. */
  | "failed_once"
  /** A second failure in a row, or a link already failing: it shows. */
  | "failing"
  /** The project is gone, or its link changed since it was handed out. */
  | "stale";

export type LinkChecks = {
  /** The links due now, the longest waiting first, at most `batch`. */
  due(): Promise<DueLink[]>;
  /** Checks one link through the seam and records what it means. */
  check(link: DueLink): Promise<LinkCheckOutcome>;
};

export function createLinkChecks(deps: {
  db: Db;
  now: () => Date;
  /** Fails closed: without a checker, no link answers. */
  linkChecker?: LinkChecker;
  config?: LinkCheckConfig;
}): LinkChecks {
  const { db, now } = deps;
  const linkChecker = deps.linkChecker ?? createCannedLinkChecker();
  const config = deps.config ?? LINK_CHECKS;

  return {
    due: async () => {
      // Every visible project, launched or in progress: both are public with a live
      // link. A month brings tens, so the rule runs here rather than in SQL.
      const rows = await db
        .select({
          projectId: projects.id,
          url: projects.liveUrl,
          checkedAt: projects.linkCheckedAt,
          ok: projects.linkOk,
          failedAt: projects.linkFailedAt,
          endsAt: challenges.endsAt,
        })
        .from(projects)
        .leftJoin(challenges, eq(challenges.id, projects.challengeId))
        // A hidden project's page is gone for visitors; nothing to show a check on.
        .where(eq(projects.hidden, false));
      const at = now();
      return rows
        .map((row) => ({
          projectId: row.projectId,
          url: row.url,
          next: nextCheckAt(
            row,
            row.endsAt !== null && row.endsAt < at,
            config,
          ),
        }))
        .filter((row) => row.next <= at)
        .sort((a, b) => a.next.getTime() - b.next.getTime())
        .slice(0, config.batch)
        .map(({ projectId, url }) => ({ projectId, url }));
    },

    check: async ({ projectId, url }) => {
      const answer = await linkChecker.check(url);
      return db.transaction(async (tx) => {
        // Held until the commit, so two runs can't both count a first failure.
        const [row] = await tx
          .select({
            liveUrl: projects.liveUrl,
            checkedAt: projects.linkCheckedAt,
            ok: projects.linkOk,
            failedAt: projects.linkFailedAt,
          })
          .from(projects)
          .where(eq(projects.id, projectId))
          .for("update");
        // A new link was checked when it was saved; this answer is the old one's.
        if (!row || row.liveUrl !== url) return "stale";
        const next = afterCheck(row, answer.ok, now());
        await tx
          .update(projects)
          .set(columnsOf(next))
          .where(eq(projects.id, projectId));
        if (answer.ok) return "opened";
        return next.failedAt ? "failed_once" : "failing";
      });
    },
  };
}
