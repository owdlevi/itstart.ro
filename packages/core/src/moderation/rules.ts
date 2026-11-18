/**
 * Reporting's options and limits, without the database, so the report form
 * can check them early (exported as `@repo/core/moderation-rules`). Core
 * checks them again (DECISIONS, "Raportează and moderation").
 */
export const REPORT_REASONS = [
  "link",
  "not_theirs",
  "offensive",
  "spam",
  "personal_data",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_LIMITS = {
  /** The reporter's own words; required for "other". */
  details: 1000,
  /** Reports per person per hour, counted from `reports`. */
  perHour: 5,
} as const;

export const isReportReason = (value: string): value is ReportReason =>
  (REPORT_REASONS as readonly string[]).includes(value);
