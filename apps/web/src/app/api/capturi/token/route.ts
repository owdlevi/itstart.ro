import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { BLOB_INCOMING } from "@/server/blob-paths";
import {
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_TYPES,
  screenshotStorage,
} from "@/server/storage";
import { getSession } from "@/server/session";

/**
 * POST /api/capturi/token: Vercel Blob's client-upload handshake. It hands a
 * signed-in browser a token for one original under `incoming/` (png, jpg or
 * webp, at most 5 MB, deleted after a day). The browser then posts the
 * blob's URL to /api/capturi, which resizes it into `capturi/`.
 */
export async function POST(request: Request) {
  if (screenshotStorage?.kind !== "blob")
    return Response.json({ error: "unavailable" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Thrown messages stay on the server; the browser sees a 400.
        if (!(await getSession())) throw new Error("signed_out");
        if (!pathname.startsWith(BLOB_INCOMING) || pathname.includes("/.."))
          throw new Error("pathname");
        return {
          allowedContentTypes: SCREENSHOT_TYPES,
          maximumSizeInBytes: SCREENSHOT_MAX_BYTES,
          addRandomSuffix: true,
          ttlDays: 1,
        };
      },
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "refused" }, { status: 400 });
  }
}
