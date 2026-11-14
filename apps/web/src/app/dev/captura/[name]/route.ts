import { notFound } from "next/navigation";
import { designFixtures } from "@/server/core";

// 16:10, transparent: the `tint` behind every screenshot shows through.
const PLACEHOLDER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"/>';

/**
 * GET /dev/captura/<name>.svg: the fixtures' screenshots, which don't exist as
 * images yet (HANDOVER §9.1: a flat `tint` placeholder). Design-fixtures mode only.
 */
export async function GET() {
  if (!designFixtures) notFound();
  return new Response(PLACEHOLDER, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400",
    },
  });
}
