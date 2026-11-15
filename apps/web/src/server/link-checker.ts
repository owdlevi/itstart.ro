import "server-only";
import type { LinkCheck, LinkChecker } from "@repo/core";
import { lookup, type LookupAddress } from "node:dns";
import https from "node:https";
import net from "node:net";
import { isBlocked } from "./blocked-addresses";

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

/**
 * DNS lookup that refuses blocked addresses. It runs at connect time, so a
 * name can't resolve to a public address for a check and a private one after.
 */
const safeLookup: typeof lookup = ((
  hostname: string,
  options: { all?: boolean },
  callback: (
    err: Error | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void,
) => {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    if (!addresses.length || addresses.some((a) => isBlocked(a.address))) {
      return callback(new Error("blocked address"), []);
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0]!.address, addresses[0]!.family);
  });
}) as typeof lookup;

type Answer = { status: number; location: string | null; challenge: boolean };

function get(url: URL): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        lookup: safeLookup,
        headers: {
          "user-agent": "ITStart link check (+https://itstart.ro)",
          accept: "text/html,*/*",
        },
      },
      (response) => {
        resolve({
          status: response.statusCode ?? 0,
          location: response.headers.location ?? null,
          // Cloudflare's bot check: a browser gets through.
          challenge: response.headers["cf-mitigated"] === "challenge",
        });
        // Only the status matters: drop the body.
        request.destroy();
      },
    );
    request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

/**
 * Rule 9: one GET, at most 5 s, following up to 3 https redirects. 2xx opens;
 * 401 and 403 ask for an account (unless it's Cloudflare's bot check); no
 * answer, any other status or a private address is unreachable.
 */
export function createHttpsLinkChecker(): LinkChecker {
  return {
    check: async (raw): Promise<LinkCheck> => {
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return { ok: false, reason: "unreachable" };
      }
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        if (url.protocol !== "https:")
          return { ok: false, reason: "unreachable" };
        const host = url.hostname.replace(/^\[|\]$/g, "");
        if (net.isIP(host) && isBlocked(host)) {
          return { ok: false, reason: "unreachable" };
        }
        let answer: Answer;
        try {
          answer = await get(url);
        } catch {
          return { ok: false, reason: "unreachable" };
        }
        if (answer.status >= 200 && answer.status < 300) return { ok: true };
        if (answer.challenge) return { ok: true };
        if (answer.status === 401 || answer.status === 403) {
          return { ok: false, reason: "needs_account" };
        }
        if (answer.status >= 300 && answer.status < 400 && answer.location) {
          url = new URL(answer.location, url);
          continue;
        }
        return { ok: false, reason: "unreachable" };
      }
      return { ok: false, reason: "unreachable" };
    },
  };
}

/**
 * Design fixtures: the seeded links use the reserved `.example` domain, which
 * never resolves, so they open; everything else is checked for real.
 */
export function withExampleHosts(checker: LinkChecker): LinkChecker {
  return {
    check: async (url) =>
      /^https:\/\/[^/]+\.example(\/|$)/.test(url)
        ? { ok: true }
        : checker.check(url),
  };
}
