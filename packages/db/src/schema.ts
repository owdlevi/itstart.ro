import {
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Column names are camelCase here and snake_case in Postgres: every client
// and drizzle.config.ts must pass `casing: "snake_case"`.

const createdAt = () =>
  timestamp({ withTimezone: true }).notNull().defaultNow();

// Minimal until the auth library is chosen; it will dictate the rest of this table.
export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  isAgent: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const challenges = pgTable("challenges", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  // 23:59 Europe/Bucharest on the last day of the month, stored as an instant.
  endsAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const projectStage = pgEnum("project_stage", [
  "in_progress",
  "launched",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id),
    // Null for "Proiecte proprii": projects built outside any challenge.
    challengeId: uuid().references(() => challenges.id),
    name: text().notNull(),
    stage: projectStage().notNull().default("in_progress"),
    launchedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.challengeId)],
);

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
