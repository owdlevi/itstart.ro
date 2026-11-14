import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { users } from "./auth";

export type ChallengeTip = { title: string; text: string };

export const challenges = pgTable("challenges", {
  id: uuid().primaryKey().defaultRandom(),
  // "Provocarea #4"
  number: integer().notNull().unique(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  // The name on the launch board's filter chips: "Frizerie" in "#4 Frizerie".
  // Null falls back to the title.
  shortTitle: text(),
  intro: text(),
  // One or two lines for cards (Home's challenge card).
  summary: text(),
  // Who the brief is for, as a phrase that follows "pentru": "o frizerie".
  builtFor: text(),
  // The brief (screen 02). Lists are in display order.
  // "Un scenariu realist, scris de echipa ITStart. Nu e o comandă de la un client."
  scenarioNote: text(),
  scenario: text(),
  baseLevel: text().array().notNull().default([]),
  stretch: text().array().notNull().default([]),
  launchCriteria: text().array().notNull().default([]),
  // The line under the launch criteria: "E o primă versiune pe care oricine o poate încerca…"
  launchNote: text(),
  materialsUrl: text(),
  materialsNote: text(),
  // "Construiește-l cu AI": tip cards written for this brief.
  tips: jsonb().$type<ChallengeTip[]>().notNull().default([]),
  // Who the jury is and its criteria, shown with the results (HANDOVER §13.6).
  juryNote: text(),
  // The month's label ("noiembrie 2026") is derived from startsAt in Europe/Bucharest.
  startsAt: timestamp({ withTimezone: true }).notNull(),
  // 23:59 Europe/Bucharest on the last day of the month, stored as an instant.
  endsAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

// A user's membership in one challenge; leaving sets leftAt (rule 2).
export const participations = pgTable(
  "participations",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    challengeId: uuid()
      .notNull()
      .references(() => challenges.id),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp({ withTimezone: true }),
  },
  (t) => [unique().on(t.userId, t.challengeId), index().on(t.challengeId)],
);
