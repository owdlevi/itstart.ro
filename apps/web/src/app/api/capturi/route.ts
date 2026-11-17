import {
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_TYPES,
  screenshotStorage,
  type ImageShape,
} from "@/server/storage";
import { getSession } from "@/server/session";

export type UploadAnswer =
  | { ok: true; url: string }
  | {
      ok: false;
      reason: "signed_out" | "unavailable" | "too_large" | "type" | "failed";
    };

const answer = (body: UploadAnswer, status = 200) =>
  Response.json(body, { status });

const STATUS = { too_large: 413, type: 415, failed: 400 } as const;

/**
 * POST /api/capturi: one screenshot, resized to webp and stored. With
 * `shape=avatar`, a profile picture, cropped square.
 * - Local adapter: multipart, `file` and `shape`.
 * - Blob adapter: JSON `{ url, shape }`, the original the browser uploaded
 *   through /api/capturi/token, past Vercel's 4.5 MB body cap
 *   (ARCHITECTURE, "Uploads").
 */
export async function POST(request: Request) {
  if (!screenshotStorage)
    return answer({ ok: false, reason: "unavailable" }, 503);
  const session = await getSession();
  if (!session) return answer({ ok: false, reason: "signed_out" }, 401);

  if (screenshotStorage.kind === "blob") {
    const body = (await request.json().catch(() => null)) as {
      url?: unknown;
      shape?: unknown;
    } | null;
    if (typeof body?.url !== "string")
      return answer({ ok: false, reason: "failed" }, 400);
    const saved = await screenshotStorage.finish(body.url, shapeOf(body.shape));
    return saved.ok ? answer(saved) : answer(saved, STATUS[saved.reason]);
  }

  // The form's overhead on top of the file.
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > SCREENSHOT_MAX_BYTES + 64 * 1024) {
    return answer({ ok: false, reason: "too_large" }, 413);
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return answer({ ok: false, reason: "failed" }, 400);
  if (file.size > SCREENSHOT_MAX_BYTES) {
    return answer({ ok: false, reason: "too_large" }, 413);
  }
  if (!SCREENSHOT_TYPES.includes(file.type)) {
    return answer({ ok: false, reason: "type" }, 415);
  }
  const saved = await screenshotStorage.save(
    Buffer.from(await file.arrayBuffer()),
    shapeOf(form?.get("shape")),
  );
  return saved.ok ? answer(saved) : answer(saved, STATUS[saved.reason]);
}

const shapeOf = (value: unknown): ImageShape =>
  value === "avatar" ? "avatar" : "screenshot";
