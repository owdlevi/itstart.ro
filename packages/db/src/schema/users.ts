import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./columns";

// Minimal until the auth library is chosen; it will dictate the rest of this table.
export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  isAgent: boolean().notNull().default(false),
  createdAt: createdAt(),
});
