/**
 * Milestone flags (HANDOVER §3): sections of M1 screens that wait for a later
 * milestone. Raise `MILESTONE` to turn them on; each screen must look right
 * with them off.
 */
const MILESTONE: 1 | 2 | 3 = 1;

export const flags = {
  /** "Întrebări și ajutor" on screens 02 and 08 (M2). */
  questions: MILESTONE >= 2,
  /** The "Toate provocările" link on screens 02, 08 and 11 (M2). */
  challengeArchive: MILESTONE >= 2,
  /** The "Și 4 agenți AI" panel and agent-built projects, on screens 02, 03 and 08 (M3). */
  builderAgents: MILESTONE >= 3,
};
