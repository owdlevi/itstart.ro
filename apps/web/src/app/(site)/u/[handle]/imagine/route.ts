import { core } from "@/server/core";
import { profileShare } from "@/server/share-image/cards";
import { shareImageResponse } from "@/server/share-image/render";

/** GET /u/<handle>/imagine: the profile's share image (og:image). */
export async function GET(
  request: Request,
  ctx: RouteContext<"/u/[handle]/imagine">,
) {
  const { handle } = await ctx.params;
  const profile = await core.profiles.byHandle(handle, null);
  return shareImageResponse(
    profile && (await profileShare(profile)),
    request,
    `${handle}.png`,
  );
}
