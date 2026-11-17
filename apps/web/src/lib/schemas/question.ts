import { QUESTION_LIMITS } from "@repo/core/question-rules";
import { z } from "zod";

/** "Pune o întrebare". Parsed in the form and again in the action; core checks the limits too. */
export const askSchema = z.object({
  challengeId: z.uuid(),
  title: z
    .string()
    .trim()
    .min(1, { error: "title_empty" })
    .max(QUESTION_LIMITS.title, { error: "title_too_long" }),
  body: z.string().trim().max(QUESTION_LIMITS.body, { error: "body_too_long" }),
});

export type AskInput = z.infer<typeof askSchema>;

/** An answer under a question. */
export const answerSchema = z.object({
  questionId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, { error: "empty" })
    .max(QUESTION_LIMITS.answer, { error: "too_long" }),
});

export type AnswerInput = z.infer<typeof answerSchema>;

/** The asker's pick, or null to clear it. */
export const solveSchema = z.object({
  questionId: z.uuid(),
  answerId: z.uuid().nullable(),
});
