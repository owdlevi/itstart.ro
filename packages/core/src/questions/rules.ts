/**
 * The questions thread's limits, without the database, so a form can check
 * them early (exported as `@repo/core/question-rules`). Core checks them again
 * (DECISIONS, "Questions and answers").
 */
export const QUESTION_LIMITS = {
  /** A row's one line on screen 02; the longest in the references is 44. */
  title: 120,
  /** Optional details under the title. */
  body: 2000,
  /** Like a review (defaultReviewsConfig.maxLength). */
  answer: 2000,
} as const;
