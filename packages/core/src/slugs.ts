/**
 * The URL-safe base a name asks for: diacritics folded, lowercase, words
 * joined by "-", at most 40 characters. "Kovács Réka" → "kovacs-reka".
 * `fallback` is for a name with no latin letters or digits at all.
 */
export function slugBase(name: string, fallback: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return base || fallback;
}

/** `base`, or the first of `base-2`, `base-3`… that isn't taken. */
export function freeSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
