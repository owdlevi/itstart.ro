import { REPORT_LIMITS, REPORT_REASONS } from "@repo/core/moderation-rules";
import { z } from "zod";

/** The query flag that shows "Mulțumim…" once on the project page. */
export const REPORTED_PARAM = "raportat";

/** "Raportează o problemă". Parsed in the form and again in the action; core checks it too. */
export const reportSchema = z
  .object({
    projectId: z.uuid(),
    reason: z.enum(REPORT_REASONS, { error: "reason_empty" }),
    details: z
      .string()
      .trim()
      .max(REPORT_LIMITS.details, { error: "too_long" }),
  })
  .refine((v) => v.reason !== "other" || v.details.length > 0, {
    path: ["details"],
    error: "details_empty",
  });

export type ReportInput = z.infer<typeof reportSchema>;

/** What an admin hides or shows again. */
export const moderationTargetSchema = z.object({
  kind: z.enum(["project", "review", "question", "answer"]),
  id: z.uuid(),
  hidden: z.boolean(),
});

export const resolveSchema = z.object({ projectId: z.uuid() });
