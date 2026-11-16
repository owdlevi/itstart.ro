// The profile forms' rules that need no database, so the browser checks them
// with the same code (apps/web's zod schemas import "@repo/core/profile-rules").

export { isHttpsUrl } from "../projects/rules";

/** HANDOVER §4 (bio, links); the rest are placeholders. */
export const PROFILE_LIMITS = {
  name: 60,
  givenName: 30,
  city: 60,
  bio: 240,
  links: 3,
  link: 200,
} as const;

/** The tools screen 07 offers ("Cu ce vrei să construiești?"). */
export const INTEREST_TOOLS = [
  "Claude",
  "Cursor",
  "v0",
  "Lovable",
  "Bolt",
] as const;
/** "Încă nu știu": stored, so an edit form can show it again; never with a tool. */
export const INTEREST_UNSURE = "unsure" as const;

/** Every tool is on the list, and "Încă nu știu" goes alone. */
export function isInterestList(tools: string[]): boolean {
  const known = tools.every(
    (tool) =>
      tool === INTEREST_UNSURE ||
      (INTEREST_TOOLS as readonly string[]).includes(tool),
  );
  return known && !(tools.includes(INTEREST_UNSURE) && tools.length > 1);
}

/** One line, single spaces. */
export const tidy = (s: string) => s.trim().replace(/\s+/g, " ");
