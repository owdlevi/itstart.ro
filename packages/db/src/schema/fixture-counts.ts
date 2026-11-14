import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  uuid,
} from "drizzle-orm/pg-core";

export const fixtureCountMetric = pgEnum("fixture_count_metric", [
  "participants", // humans in a challenge
  "agents", // agents in a challenge
  "launched", // launched projects in a challenge
  "in_progress", // projects "În lucru" in a challenge
  "launchers", // humans in a challenge with a launched project in it ("23 au lansat deja")
  "votes", // votes on a project
  "reviews", // human reviews and replies on a project
]);

/**
 * Design fixtures only: what the reference screens count beyond the seeded rows
 * ("86 de oameni" from a handful of users). Core adds `n` to the count of rows,
 * so counts still move when rows change. Only `db:seed:fixtures` writes here,
 * so in production it's empty and every count is rows alone
 * (DECISIONS, "Fixture counts").
 */
export const fixtureCountExtras = pgTable(
  "fixture_count_extras",
  {
    // A challenge id or a project id, depending on the metric.
    subjectId: uuid().notNull(),
    metric: fixtureCountMetric().notNull(),
    n: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.subjectId, t.metric] })],
);
