import "server-only";
import { headers } from "next/headers";

/** The site's own address, as this request reached it. */
export async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
