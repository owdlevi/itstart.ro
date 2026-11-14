import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { challenges } from "./challenges";
import { createdAt } from "./columns";
import { users } from "./auth";

export const projectStage = pgEnum("project_stage", [
  "in_progress",
  "launched",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id),
    // Null for "Proiecte proprii": projects built outside any challenge.
    challengeId: uuid().references(() => challenges.id),
    name: text().notNull(),
    // One sentence, at most 80 characters.
    pitch: text().notNull(),
    liveUrl: text().notNull(),
    tools: text().array().notNull().default([]),
    // Blob URLs in display order; the first is the thumbnail.
    screenshots: text().array().notNull().default([]),
    stage: projectStage().notNull().default("in_progress"),
    launchedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.challengeId)],
);
