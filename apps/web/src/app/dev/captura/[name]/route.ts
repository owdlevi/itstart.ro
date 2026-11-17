import { notFound } from "next/navigation";
import { designFixtures } from "@/server/core";
import { readLocalScreenshot } from "@/server/storage";

// 16:10, transparent: the `tint` behind every screenshot shows through.
const PLACEHOLDER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"/>';

/**
 * GET /dev/captura/<name>: a screenshot uploaded locally (the local storage
 * adapter, off Vercel only), or, in design-fixtures mode, the fixtures'
 * screenshots, which don't exist as images (HANDOVER §9.1: a flat `tint`
 * placeholder).
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/dev/captura/[name]">,
) {
  const { name } = await ctx.params;
  const uploaded = await readLocalScreenshot(name);
  if (uploaded) {
    return new Response(new Uint8Array(uploaded), {
      headers: {
        "content-type": "image/webp",
        // A name is never reused.
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }
  if (!designFixtures) notFound();
  return new Response(PLACEHOLDER, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400",
    },
  });
}
