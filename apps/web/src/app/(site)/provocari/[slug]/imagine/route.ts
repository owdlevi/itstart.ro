import { core } from "@/server/core";
import { challengeShare } from "@/server/share-image/cards";
import { shareImageResponse } from "@/server/share-image/render";

/** GET /provocari/<slug>/imagine: the challenge's share image (og:image). */
export async function GET(
  request: Request,
  ctx: RouteContext<"/provocari/[slug]/imagine">,
) {
  const { slug } = await ctx.params;
  const challenge = await core.challenges.bySlug(slug);
  return shareImageResponse(
    challenge && (await challengeShare(challenge)),
    request,
    `provocarea-${slug}.png`,
  );
}
