import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { withExtra } from "../counts";

/**
 * Whether the review aliased `r` shows: it isn't hidden, and neither is the
 * review it replies to (a reply goes with its review). Every count of reviews
 * uses this, so a count never includes what the page doesn't show (§4).
 */
export const visibleReview = sql.raw(
  "not r.hidden and not exists (select 1 from reviews parent where parent.id = r.parent_id and parent.hidden)",
);

/** Rule 17's count: a project's visible human reviews and replies, with the fixtures' extra. */
export const humanReviews = (projectId: AnyPgColumn | string) =>
  withExtra(
    sql`select count(*) from reviews r where r.project_id = ${projectId} and not r.is_automated and ${visibleReview}`,
    projectId,
    "reviews",
  );
