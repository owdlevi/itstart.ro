import { notFound } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { auth, db, designFixtures } from "@/server/core";

/**
 * GET /dev/login-as/<handle>?next=<path>: signs in as a fixture user, for
 * docs/tools/capture.mjs. "anonymous" signs out. Exists only in design-fixtures
 * mode, which core.ts never turns on in production.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/dev/login-as/[handle]">,
) {
  if (!designFixtures) notFound();
  const { handle } = await ctx.params;

  // A relative Location, so the browser stays on whichever host it used, and
  // only same-site paths, so this can't redirect anywhere else.
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const location = /^\/(?![/\\])/.test(next) ? next : "/";
  const response = new NextResponse(null, {
    status: 307,
    headers: { location },
  });

  if (handle === "anonymous") {
    const signedOut = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });
    for (const cookie of signedOut.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  }

  const user = await db.query.users.findFirst({
    columns: { id: true },
    where: (u, { eq }) => eq(u.handle, handle),
  });
  if (!user) notFound();

  const context = await auth.$context;
  if (!("test" in context)) notFound(); // testUtils is only added in fixtures mode
  const { cookies } = await context.test.login({ userId: user.id });
  for (const {
    name,
    value,
    path,
    httpOnly,
    secure,
    sameSite,
    expires,
  } of cookies) {
    // No domain: the cookie belongs to whichever host served this request.
    response.cookies.set(name, value, {
      path,
      httpOnly,
      secure,
      sameSite: sameSite?.toLowerCase() as
        "lax" | "strict" | "none" | undefined,
      // testUtils gives seconds; Next expects milliseconds or a Date.
      expires: expires === undefined ? undefined : new Date(expires * 1000),
    });
  }
  return response;
}
