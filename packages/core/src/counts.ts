import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { fixtureCountExtras } from "@repo/db";

type Metric = (typeof fixtureCountExtras.metric.enumValues)[number];

/**
 * Adds the design fixtures' extra to a count of rows. fixture_count_extras is
 * empty outside design-fixtures mode, so there this is the count of rows alone
 * (DECISIONS, "Fixture counts").
 */
export function withExtra(
  rows: SQL,
  subjectId: AnyPgColumn | string,
  metric: Metric,
): SQL<number> {
  return sql<number>`((${rows}) + coalesce((select ${fixtureCountExtras.n} from ${fixtureCountExtras} where ${fixtureCountExtras.subjectId} = ${subjectId} and ${fixtureCountExtras.metric} = ${metric}), 0))::int`;
}
