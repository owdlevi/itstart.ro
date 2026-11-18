import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { challenges } from "./challenges";
import { createdAt } from "./columns";
import { users } from "./auth";

export const projectStage = pgEnum("project_stage", [
  "in_progress",
  "launched",
]);

// "Cât a durat?" on the launch form (screen 09).
export const buildDuration = pgEnum("build_duration", [
  "under_10h",
  "10_30h",
  "over_30h",
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
    // "Despre proiect". Paragraphs are separated by a blank line.
    description: text(),
    // "Cum l-am construit": required before launching (rule 4), except the prompt.
    buildDuration: buildDuration(),
    // The builder's own words for the duration, shown instead of the bucket's label.
    buildDurationText: text(),
    buildHardestPart: text(),
    buildPrompt: text(),
    stage: projectStage().notNull().default("in_progress"),
    // Set once, when it switches to "Lansat" (rule 6).
    launchedAt: timestamp({ withTimezone: true }),
    // Launched after its challenge's deadline: "După termen", out of the
    // recognitions (rule 7). Fixed at the launch, like launchedAt.
    isLate: boolean().notNull().default(false),
    // The link check (HANDOVER §4 linkCheck): the shown result and when it was
    // last confirmed. Null until the first check that counts.
    linkCheckedAt: timestamp({ withTimezone: true }),
    linkOk: boolean(),
    // A first failure waiting for a second in a row before it shows.
    linkFailedAt: timestamp({ withTimezone: true }),
    // Hidden by an admin (moderation): out of every list and count, its page
    // a 404 to everyone but its owner and admins.
    hidden: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.challengeId)],
);

// "v2 · ieri: am adăugat confirmarea pe e-mail." One line per meaningful change (rule 8).
export const projectUpdates = pgTable(
  "project_updates",
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    // 1, 2, 3… per project.
    version: integer().notNull(),
    // At most 140 characters.
    text: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.projectId, t.version)],
);
