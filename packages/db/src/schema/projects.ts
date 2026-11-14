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
import { users } from "./users";

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
