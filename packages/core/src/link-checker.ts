// The linkChecker seam (rule 9). Core decides when a live link must answer;
// the adapter makes the one short request (apps/web: https with a timeout,
// private addresses refused).

export type LinkCheck =
  | { ok: true }
  | {
      ok: false;
      /** No answer, an error status, or an address we won't call. */
      reason: "unreachable" | "needs_account";
    };

export type LinkChecker = {
  check(url: string): Promise<LinkCheck>;
};

/**
 * Answers from a table, `unreachable` for anything not in it. For tests, and
 * the fail-closed default when no checker is wired in.
 */
export function createCannedLinkChecker(
  answers: Record<string, LinkCheck> = {},
): LinkChecker & { checked: string[] } {
  const checked: string[] = [];
  return {
    checked,
    check: async (url) => {
      checked.push(url);
      return answers[url] ?? { ok: false, reason: "unreachable" };
    },
  };
}
