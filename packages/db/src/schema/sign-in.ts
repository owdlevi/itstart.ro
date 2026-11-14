import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// One row per sign-in link sent. Backs the per-address limit, and doubles as its audit trail.
export const signInLinkSends = pgTable(
  "sign_in_link_sends",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.email, t.sentAt)],
);
