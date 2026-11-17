import {
  boolean,
  index,
  pgTable,
  text,
  uuid,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { challenges } from "./challenges";
import { users } from "./auth";

// "Întrebări și ajutor" (M2): a challenge's questions. The asker marks one
// answer as the solution ("Rezolvat"). The slug is unique within the challenge:
// /provocari/<challenge>/intrebari/<slug>.
export const questions = pgTable(
  "questions",
  {
    id: uuid().primaryKey().defaultRandom(),
    challengeId: uuid()
      .notNull()
      .references(() => challenges.id),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    slug: text().notNull(),
    title: text().notNull(),
    // Optional details under the title.
    body: text().notNull().default(""),
    solvedAnswerId: uuid().references((): AnyPgColumn => answers.id),
    hidden: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.challengeId, t.slug),
    index().on(t.authorId, t.createdAt),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid().primaryKey().defaultRandom(),
    questionId: uuid()
      .notNull()
      .references((): AnyPgColumn => questions.id),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    body: text().notNull(),
    hidden: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.questionId), index().on(t.authorId, t.createdAt)],
);
