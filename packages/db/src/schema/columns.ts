import { timestamp } from "drizzle-orm/pg-core";

// Column names are camelCase here and snake_case in Postgres: every client
// and drizzle.config.ts must pass `casing: "snake_case"`.

export const createdAt = () =>
  timestamp({ withTimezone: true }).notNull().defaultNow();
