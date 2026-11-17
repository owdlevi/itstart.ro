import { upload } from "@vercel/blob/client";
import type { UploadAnswer } from "@/app/api/capturi/route";
import type { ImageShape, UploadVia } from "@/server/storage";

/** HANDOVER §6 09: png, jpg or webp, at most 5 MB; the server checks again. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * One picture from the browser to storage, resized on the server. Local:
 * the bytes go to /api/capturi. Blob: the original goes straight to the
 * store (the token route), then /api/capturi resizes it by its URL.
 */
export async function uploadImage(
  file: File,
  shape: ImageShape,
  via: UploadVia,
): Promise<UploadAnswer> {
  try {
    if (via === "blob") {
      const original = await upload(
        `incoming/${shape}.${EXTENSIONS[file.type] ?? "img"}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/capturi/token",
          contentType: file.type,
        },
      );
      return await answerOf(
        fetch("/api/capturi", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: original.url, shape }),
        }),
      );
    }
    const body = new FormData();
    body.set("file", file);
    body.set("shape", shape);
    return await answerOf(fetch("/api/capturi", { method: "POST", body }));
  } catch {
    return { ok: false, reason: "failed" };
  }
}

const answerOf = async (response: Promise<Response>) =>
  (await (await response).json()) as UploadAnswer;
