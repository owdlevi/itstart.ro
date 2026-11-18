import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt } from "./columns";
import { projects } from "./projects";
import { users } from "./auth";

// "Raportează o problemă cu acest proiect" (screen 04): the reasons offered.
export const reportReason = pgEnum("report_reason", [
  "link",
  "not_theirs",
  "offensive",
  "spam",
  "personal_data",
  "other",
]);

// A report waits in the moderation queue until an admin resolves it. The
// reporter is null once their account is gone; the report stays.
export const reports = pgTable(
  "reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    reporterId: uuid().references(() => users.id, { onDelete: "set null" }),
    reason: reportReason().notNull(),
    // The reporter's own words; required for "other".
    details: text().notNull().default(""),
    createdAt: createdAt(),
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index().on(t.projectId), index().on(t.reporterId, t.createdAt)],
);
