/**
 * Milestone flags (HANDOVER §3): sections of M1 screens that wait for a later
 * milestone. Raise `MILESTONE` to turn them on; each screen must look right
 * with them off. M2's sections that are built are on by themselves.
 */
const MILESTONE: 1 | 2 | 3 = 1;

export const flags = {
  /**
   * "Întrebări și ajutor" on screens 02 and 08 (M2). On by itself like
   * `challengeArchive` (DECISIONS, "Questions and answers").
   */
  questions: true,
  /**
   * The "Toate provocările" link on screens 02, 08 and 11 (M2). On ahead of
   * the rest of M2, since screen 12 is built (DECISIONS, "Screen 12").
   */
  challengeArchive: true,
  /** The "Și 4 agenți AI" panel and agent-built projects, on screens 02, 03 and 08 (M3). */
  builderAgents: MILESTONE >= 3,
  /**
   * The share image on screen 10, with its download button and the line
   * about it (M2). On by itself, like `questions` (DECISIONS, "Share image
   * and Open Graph tags").
   */
  shareImage: true,
  /**
   * "Link verificat acum 3 ore. Merge." under the buttons on screen 04 (M2).
   * On by itself, like `shareImage` (DECISIONS, "Link checker").
   */
  linkCheck: true,
  /** "Vrei să te poată contacta cineva?" on screen 10 (M3). */
  contactConsent: MILESTONE >= 3,
};
