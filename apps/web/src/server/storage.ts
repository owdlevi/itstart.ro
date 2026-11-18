import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { BLOB_DIR, blobPaths } from "./blob-paths";

/** HANDOVER §6 09: png, jpg or webp, at most 5 MB. */
export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

export type SaveScreenshot =
  | { ok: true; url: string }
  | { ok: false; reason: "type" | "too_large" | "failed" };

/** A screenshot keeps its shape; a profile picture is cropped square. */
export type ImageShape = "screenshot" | "avatar";

/**
 * Where screenshots are kept: core's storage seam (`owns`) plus saving.
 * Saving resizes to webp with sharp, whatever the adapter.
 */
export type ScreenshotStorage =
  | {
      /** The browser posts the bytes to /api/capturi. */
      kind: "local";
      save(bytes: Buffer, shape?: ImageShape): Promise<SaveScreenshot>;
      owns(url: string): boolean;
    }
  | {
      /**
       * The browser uploads the original to `incoming/` (the token route,
       * /api/capturi/token), then posts its URL to /api/capturi, which
       * finishes it here.
       */
      kind: "blob";
      finish(incomingUrl: string, shape?: ImageShape): Promise<SaveScreenshot>;
      owns(url: string): boolean;
    };

/** How the browser sends a picture; the pickers branch on it. */
export type UploadVia = ScreenshotStorage["kind"];

/**
 * Checks the bytes are really png, jpeg or webp, then resizes: at most 1600px
 * on the long side (a profile picture: 400px square, cropped from the
 * middle), EXIF orientation applied and metadata (GPS included) dropped, webp.
 */
export async function toWebp(
  bytes: Buffer,
  shape: ImageShape = "screenshot",
): Promise<Buffer | null> {
  try {
    const image = sharp(bytes);
    const { format } = await image.metadata();
    if (format !== "png" && format !== "jpeg" && format !== "webp") return null;
    return await image
      .rotate()
      .resize(
        shape === "avatar"
          ? { width: 400, height: 400, fit: "cover" }
          : {
              width: 1600,
              height: 1600,
              fit: "inside",
              withoutEnlargement: true,
            },
      )
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return null;
  }
}

const LOCAL_DIR = path.join(process.cwd(), ".data", "capturi");
const LOCAL_URL = "/dev/captura/";
/** A stored upload, or a fixture's placeholder (`tuns-la-fix-1.svg`). */
const LOCAL_NAME = /^[a-z0-9-]{1,80}\.(webp|svg)$/;

/**
 * Files on disk in apps/web/.data/capturi, served by /dev/captura/<name>.
 * For local work, off Vercel (DECISIONS, "Screen 09 build", "Blob adapter").
 */
function createLocalStorage(): ScreenshotStorage {
  return {
    kind: "local",
    save: async (bytes, shape) => {
      const webp = await toWebp(bytes, shape);
      if (!webp) return { ok: false, reason: "type" };
      const name = `${randomUUID()}.webp`;
      await mkdir(LOCAL_DIR, { recursive: true });
      await writeFile(path.join(LOCAL_DIR, name), webp);
      return { ok: true, url: `${LOCAL_URL}${name}` };
    },
    owns: (url) =>
      url.startsWith(LOCAL_URL) && LOCAL_NAME.test(url.slice(LOCAL_URL.length)),
  };
}

/** Vercel Blob (`itstart-ro-blob`, public, fra1). */
function createBlobStorage(token: string): ScreenshotStorage {
  const paths = blobPaths(token);
  return {
    kind: "blob",
    finish: async (url, shape) => {
      if (!paths.isIncoming(url)) return { ok: false, reason: "failed" };
      const response = await fetch(url, { cache: "no-store" }).catch(
        () => null,
      );
      if (!response?.ok) return { ok: false, reason: "failed" };
      // The token route capped it already; this is the server's own check.
      const bytes = Buffer.from(await response.arrayBuffer());
      const webp =
        bytes.length > SCREENSHOT_MAX_BYTES ? null : await toWebp(bytes, shape);
      // The original goes whatever happens next; its day-long TTL is the backstop.
      await del(url).catch(() => {});
      if (bytes.length > SCREENSHOT_MAX_BYTES)
        return { ok: false, reason: "too_large" };
      if (!webp) return { ok: false, reason: "type" };
      const saved = await put(`${BLOB_DIR}${randomUUID()}.webp`, webp, {
        access: "public",
        contentType: "image/webp",
        // The name is new for every file, so it never changes.
        cacheControlMaxAge: 365 * 24 * 60 * 60,
      }).catch(() => null);
      return saved
        ? { ok: true, url: saved.url }
        : { ok: false, reason: "failed" };
    },
    owns: paths.owns,
  };
}

/** A local upload's bytes by its name, or null. */
export async function readLocalScreenshot(name: string) {
  if (!localStorageActive || !/^[0-9a-f-]{36}\.webp$/.test(name)) return null;
  return readFile(path.join(LOCAL_DIR, name)).catch(() => null);
}

/**
 * A stored picture's bytes by its URL (the share image draws the builder's):
 * the local adapter's file, or our store's. Null for anything else.
 */
export async function readPicture(url: string): Promise<Buffer | null> {
  if (url.startsWith(LOCAL_URL))
    return readLocalScreenshot(url.slice(LOCAL_URL.length));
  if (screenshotStorage?.kind !== "blob" || !screenshotStorage.owns(url))
    return null;
  const response = await fetch(url).catch(() => null);
  return response?.ok ? Buffer.from(await response.arrayBuffer()) : null;
}

// Local files off Vercel, whatever .env.local holds: the store is connected
// for Production and Preview only, and refuses a local machine's writes.
// On Vercel, a deploy's disk isn't kept, so it's Blob or nothing.
const localStorageActive = !process.env.VERCEL;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

/** Null where nothing can be stored: uploads are refused. */
export const screenshotStorage: ScreenshotStorage | null = localStorageActive
  ? createLocalStorage()
  : blobToken
    ? createBlobStorage(blobToken)
    : null;

/** Null storage answers through /api/capturi, which refuses. */
export const uploadVia: UploadVia = screenshotStorage?.kind ?? "local";
