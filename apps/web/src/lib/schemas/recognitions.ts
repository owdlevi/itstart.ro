import {
  RECOGNITION_KINDS,
  RECOGNITION_REASON_MAX,
  type RecognitionKind,
} from "@repo/core/recognition-rules";
import { z } from "zod";

export { RECOGNITION_KINDS, RECOGNITION_REASON_MAX, type RecognitionKind };

/** The query flag that shows "Am salvat recunoașterile." once. */
export const RECOGNITIONS_SAVED_PARAM = "salvat";

/** One recognition: no project means none for this kind yet. */
const entry = z
  .object({
    projectId: z.string(),
    reason: z
      .string()
      .trim()
      .max(RECOGNITION_REASON_MAX, { error: "too_long" }),
  })
  .refine((e) => !e.projectId || e.reason.length > 0, {
    error: "empty",
    path: ["reason"],
  });

/**
 * The admin's recognitions form, parsed in the browser and again in the
 * action; core checks every rule once more. Errors are codes, mapped to copy
 * by the form.
 */
export const recognitionsSchema = z.object({
  community: entry,
  jury: entry,
  first_project: entry,
});

export type RecognitionFields = z.infer<typeof recognitionsSchema>;

export const saveRecognitionsSchema = z.object({
  slug: z.string(),
  fields: recognitionsSchema,
});

/** The form's values as core takes them: an empty choice clears the kind. */
export const toRecognitionEntries = (fields: RecognitionFields) =>
  Object.fromEntries(
    RECOGNITION_KINDS.map((kind) => [
      kind,
      fields[kind].projectId ? fields[kind] : null,
    ]),
  ) as Record<RecognitionKind, { projectId: string; reason: string } | null>;
