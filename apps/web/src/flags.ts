/**
 * Milestone flags (HANDOVER §3): sections of M1 screens that wait for a later
 * milestone. Raise `MILESTONE` to turn them on; each screen must look right
 * with them off. M2 is built, so its sections are on.
 */
const MILESTONE: 1 | 2 | 3 = 2;

export const flags = {
  /** "Întrebări și ajutor" on screens 02 and 08 (M2). */
  questions: MILESTONE >= 2,
  /** The "Toate provocările" link on screens 02, 08 and 11 (M2). */
  challengeArchive: MILESTONE >= 2,
  /** The "Și 4 agenți AI" panel and agent-built projects, on screens 02, 03 and 08 (M3). */
  builderAgents: MILESTONE >= 3,
  /** The share image on screen 10, with its download button and the line about it (M2). */
  shareImage: MILESTONE >= 2,
  /** "Link verificat acum 3 ore. Merge." under the buttons on screen 04 (M2). */
  linkCheck: MILESTONE >= 2,
  /** "Raportează o problemă cu acest proiect" at the end of screen 04's sidebar (M2). */
  report: MILESTONE >= 2,
  /** "Vrei să te poată contacta cineva?" on screen 10 (M3). */
  contactConsent: MILESTONE >= 3,
};
