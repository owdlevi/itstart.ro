import {
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_TYPES,
  screenshotStorage,
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

/**
 * POST /api/capturi (multipart, `file`): one screenshot, resized to webp and
 * stored by the local adapter. The Blob adapter will upload from the browser
 * instead, past Vercel's 4.5 MB body cap (ARCHITECTURE, "Uploads").
 */
export async function POST(request: Request) {
  if (!screenshotStorage)
    return answer({ ok: false, reason: "unavailable" }, 503);
  const session = await getSession();
  if (!session) return answer({ ok: false, reason: "signed_out" }, 401);
  // The form's overhead on top of the file.
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > SCREENSHOT_MAX_BYTES + 64 * 1024) {
    return answer({ ok: false, reason: "too_large" }, 413);
  }
  const file = (await request.formData().catch(() => null))?.get("file");
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
  );
  return saved.ok ? answer(saved) : answer(saved, 415);
}
