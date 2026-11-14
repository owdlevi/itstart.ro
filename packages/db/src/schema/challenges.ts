import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./columns";

export const challenges = pgTable("challenges", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  // 23:59 Europe/Bucharest on the last day of the month, stored as an instant.
  endsAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
});
