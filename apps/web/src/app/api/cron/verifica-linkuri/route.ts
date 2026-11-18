import { start } from "workflow/api";
import { checkLinks } from "@/workflows/link-checks";

/**
 * GET /api/cron/verifica-linkuri: Vercel Cron calls it every hour
 * (vercel.json) and it starts one link-check run. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without the secret on Vercel nothing
 * runs. Off Vercel (local work) it's open. A start too many costs nothing:
 * core hands out only the links that are due.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const allowed = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : !process.env.VERCEL;
  if (!allowed) return new Response(null, { status: 401 });
  const run = await start(checkLinks);
  return Response.json({ runId: run.runId });
}
