import { z } from "zod";

/** Core's limit (defaultReviewsConfig.maxLength), checked early in the browser. */
export const REVIEW_MAX_LENGTH = 2000;

/** A review or, with parentId, the owner's reply. Parsed in the form and again in the action. */
export const reviewSchema = z.object({
  projectId: z.uuid(),
  parentId: z.uuid().nullable(),
  body: z
    .string()
    .trim()
    .min(1, { error: "empty" })
    .max(REVIEW_MAX_LENGTH, { error: "too_long" }),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
