import { pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { challenges } from "./challenges";
import { createdAt } from "./columns";
import { projects } from "./projects";

// "Alegerea comunității", "Alegerea juriului", "Cel mai bun prim proiect".
export const recognitionKind = pgEnum("recognition_kind", [
  "community",
  "jury",
  "first_project",
]);

// The three recognitions an admin enters after a challenge ends (HANDOVER §4).
// One per kind per challenge, and a project gets at most one.
export const recognitions = pgTable(
  "recognitions",
  {
    id: uuid().primaryKey().defaultRandom(),
    challengeId: uuid()
      .notNull()
      .references(() => challenges.id),
    kind: recognitionKind().notNull(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    // One line under the card: "Cele mai multe voturi: 112."
    reason: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.challengeId, t.kind), unique().on(t.projectId)],
);
