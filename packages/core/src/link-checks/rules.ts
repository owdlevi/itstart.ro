// The link check over time (HANDOVER §3 M2, §4 linkCheck): when a project's
// live link is checked again, and what a result means. No database here.

const HOUR = 3_600_000;

export const LINK_CHECKS = {
  /** A link that opens, in the running challenge or a project of its own. */
  every: 6 * HOUR,
  /** A link that opens, in a challenge that has ended: it changes less. */
  endedEvery: 24 * HOUR,
  /**
   * After a failure: a first one is confirmed or dropped this soon, and a
   * link that doesn't open is tried this often (while its challenge runs).
   */
  retryAfter: HOUR,
  /** At most this many checks per run, the oldest due first. */
  batch: 60,
};

export type LinkCheckConfig = typeof LINK_CHECKS;

/** What's stored on a project. */
export type LinkState = {
  /** When the shown result was last confirmed. */
  checkedAt: Date | null;
  ok: boolean | null;
  /** A first failure, not shown until a second in a row confirms it. */
  failedAt: Date | null;
};

/**
 * One check's result applied to the stored state. A link that opens shows at
 * once. A link that doesn't shows only on the second failure in a row, so a
 * host that is briefly down doesn't mark a project; one that already shows as
 * failing stays failing with the new time.
 */
export function afterCheck(
  state: LinkState,
  opened: boolean,
  at: Date,
): LinkState {
  if (opened) return { checkedAt: at, ok: true, failedAt: null };
  if (state.ok === false || state.failedAt !== null) {
    return { checkedAt: at, ok: false, failedAt: null };
  }
  return { ...state, failedAt: at };
}

/** When a project is due again. Never checked: at once. */
export function nextCheckAt(
  state: LinkState,
  challengeEnded: boolean,
  config: LinkCheckConfig = LINK_CHECKS,
): Date {
  if (state.failedAt) {
    return new Date(state.failedAt.getTime() + config.retryAfter);
  }
  if (!state.checkedAt) return new Date(0);
  const wait = challengeEnded
    ? config.endedEvery
    : state.ok === false
      ? config.retryAfter
      : config.every;
  return new Date(state.checkedAt.getTime() + wait);
}

/** What the project page shows: the confirmed result, or nothing yet. */
export function shownCheck(
  state: LinkState,
): { checkedAt: Date; ok: boolean } | null {
  if (!state.checkedAt || state.ok === null) return null;
  return { checkedAt: state.checkedAt, ok: state.ok };
}
