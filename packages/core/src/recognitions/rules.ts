// What the admin's form checks in the browser too: no database here.

export type RecognitionKind = "community" | "jury" | "first_project";

/** In the order screen 11 shows them. */
export const RECOGNITION_KINDS: readonly RecognitionKind[] = [
  "community",
  "jury",
  "first_project",
];

/** The one-line reason under the card. */
export const RECOGNITION_REASON_MAX = 160;
