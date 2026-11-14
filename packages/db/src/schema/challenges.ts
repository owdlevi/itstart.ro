import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { users } from "./auth";

export const challenges = pgTable("challenges", {
  id: uuid().primaryKey().defaultRandom(),
  // "Provocarea #4"
  number: integer().notNull().unique(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  intro: text(),
  // One or two lines for cards (Home's challenge card).
  summary: text(),
  // Who the brief is for, as a phrase that follows "pentru": "o frizerie".
  builtFor: text(),
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
