// The storage seam. Screenshots are uploaded by the app (Vercel Blob, or files
// on disk locally) and resized there; core only checks that a project's
// screenshots are files we stored, not any URL a request names.

export type Storage = {
  owns(url: string): boolean;
};

/** Owns URLs under `prefix`. For tests; the default owns nothing (fail closed). */
export function createPrefixStorage(prefix: string | null): Storage {
  return { owns: (url) => prefix !== null && url.startsWith(prefix) };
}
