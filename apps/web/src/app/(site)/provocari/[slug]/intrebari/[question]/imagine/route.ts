import { core } from "@/server/core";
import { questionShare } from "@/server/share-image/cards";
import { shareImageResponse } from "@/server/share-image/render";

/** GET /provocari/<slug>/intrebari/<question>/imagine: the question's share image (og:image). */
export async function GET(
  request: Request,
  ctx: RouteContext<"/provocari/[slug]/intrebari/[question]/imagine">,
) {
  const { slug, question: questionSlug } = await ctx.params;
  const challenge = await core.challenges.bySlug(slug);
  const question =
    challenge && (await core.questions.bySlug(challenge.id, questionSlug));
  return shareImageResponse(
    challenge && question && (await questionShare(challenge, question)),
    request,
    `${questionSlug}.png`,
  );
}
