import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { projects } from "./projects";
import { users } from "./users";

export const votes = pgTable(
  "votes",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.projectId] }),
    index().on(t.projectId),
  ],
);

export const voteAction = pgEnum("vote_action", ["cast", "retract"]);

// Append-only: feeds the vote rate limit and the admin vote timeline.
export const voteEvents = pgTable(
  "vote_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    action: voteAction().notNull(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.at), index().on(t.projectId, t.at)],
);
