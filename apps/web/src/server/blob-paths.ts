/** Originals, straight from the browser; deleted once finished, or after a day. */
export const BLOB_INCOMING = "incoming/";
/** Finished pictures: screenshots and profile pictures, webp. */
export const BLOB_DIR = "capturi/";
const BLOB_NAME = /^[0-9a-f-]{36}\.webp$/;

/**
 * Which URLs are in our Vercel Blob store (`itstart-ro-blob`, public). They
 * read `https://<store id>.public.blob.vercel-storage.com/<pathname>`, the id
 * lower-cased, as in the read-write token (`vercel_blob_rw_<id>_<secret>`).
 */
export function blobPaths(token: string) {
  const storeId = token.split("_")[3]?.toLowerCase();
  const origin = `https://${storeId}.public.blob.vercel-storage.com`;
  /** The pathname, if `url` is in our store, written as Blob writes it. */
  const pathnameOf = (url: string) => {
    try {
      const parsed = new URL(url);
      // href differs from a URL with `..` in it.
      return parsed.origin === origin &&
        parsed.href === url &&
        !parsed.search &&
        !parsed.hash
        ? parsed.pathname.slice(1)
        : null;
    } catch {
      return null;
    }
  };
  return {
    /** An original the browser uploaded, waiting to be finished. */
    isIncoming: (url: string) => !!pathnameOf(url)?.startsWith(BLOB_INCOMING),
    /** A finished picture: core's `storage.owns()`. */
    owns: (url: string) => {
      const pathname = pathnameOf(url);
      return (
        !!pathname?.startsWith(BLOB_DIR) &&
        BLOB_NAME.test(pathname.slice(BLOB_DIR.length))
      );
    },
  };
}
