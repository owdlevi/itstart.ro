import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** HANDOVER §6 09: png, jpg or webp, at most 5 MB. */
export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

export type SaveScreenshot =
  { ok: true; url: string } | { ok: false; reason: "type" };

/** A screenshot keeps its shape; a profile picture is cropped square. */
export type ImageShape = "screenshot" | "avatar";

/**
 * Where screenshots are kept: core's storage seam (`owns`) plus saving.
 * Saving resizes to webp with sharp, whatever the adapter.
 */
export type ScreenshotStorage = {
  /** "local" takes the bytes through /api/capturi; "blob" (to come) uploads from the browser. */
  kind: "local";
  save(bytes: Buffer, shape?: ImageShape): Promise<SaveScreenshot>;
  owns(url: string): boolean;
};

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
 * For local work until the Blob adapter exists (DECISIONS, "Screen 09 build").
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

/** A local upload's bytes by its name, or null. */
export async function readLocalScreenshot(name: string) {
  if (!localStorageActive || !/^[0-9a-f-]{36}\.webp$/.test(name)) return null;
  return readFile(path.join(LOCAL_DIR, name)).catch(() => null);
}

// Only off Vercel: a deploy's disk isn't kept, and there the Blob adapter
// takes over once the owner creates the store (NEXT-ACTIONS).
const localStorageActive = !process.env.VERCEL;

/** Null where nothing can be stored yet: uploads are refused. */
export const screenshotStorage: ScreenshotStorage | null = localStorageActive
  ? createLocalStorage()
  : null;
