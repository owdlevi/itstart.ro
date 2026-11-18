import { core } from "@/server/core";
import { projectShare } from "@/server/share-image/cards";
import { shareImageResponse } from "@/server/share-image/render";

/** GET /proiecte/<slug>/imagine: the project's share image (screen 10, og:image). */
export async function GET(
  request: Request,
  ctx: RouteContext<"/proiecte/[slug]/imagine">,
) {
  const { slug } = await ctx.params;
  const project = await core.projects.bySlug(slug, null);
  return shareImageResponse(
    project && (await projectShare(project)),
    request,
    `${slug}.png`,
  );
}
