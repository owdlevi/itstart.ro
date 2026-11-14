import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { projects } from "./projects";
import { users } from "./auth";

// "Păreri". A reply has a parentId; replies have no replies (rule 15).
export const reviews = pgTable(
  "reviews",
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    parentId: uuid().references((): AnyPgColumn => reviews.id),
    body: text().notNull(),
    // Written by the review agent; never counted with human reviews (rule 17).
    isAutomated: boolean().notNull().default(false),
    hidden: boolean().notNull().default(false),
    createdAt: createdAt(),
    editedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.projectId)],
);
