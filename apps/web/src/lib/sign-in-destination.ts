// Any origin works: it only tells a path on this site from one elsewhere.
const BASE = "http://itstart.invalid";

/**
 * A `?next=` worth returning to: a path on this site, with its query and hash
 * (rule 12), never another site and never /intra itself. Null otherwise.
 */
export function safeNext(raw: string | null | undefined): string | null {
  // "//evil.example" and "/\evil.example" are other sites to a browser.
  if (!raw?.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  if (url.pathname === "/intra" || url.pathname.startsWith("/intra/")) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Where someone goes once they're signed in (screen 06):
 * - someone who hasn't finished onboarding goes to /bun-venit (screen 07), carrying
 *   `provocare` and `next` on;
 * - otherwise back to `next` (rule 12: a vote, a review);
 * - otherwise to the challenge they came to join;
 * - otherwise Home.
 */
export function signInDestination({
  onboarded,
  next,
  challengeSlug,
}: {
  /** `onboardedAt` is set: they've been through /bun-venit. */
  onboarded: boolean;
  next: string | null | undefined;
  /** A challenge that can still be joined, already checked by the caller. */
  challengeSlug: string | null | undefined;
}): string {
  const back = safeNext(next);
  if (!onboarded) {
    const query = new URLSearchParams();
    if (challengeSlug) query.set("provocare", challengeSlug);
    if (back) query.set("next", back);
    const search = `${query}`;
    return search ? `/bun-venit?${search}` : "/bun-venit";
  }
  if (back) return back;
  if (challengeSlug) return `/provocari/${encodeURIComponent(challengeSlug)}`;
  return "/";
}
