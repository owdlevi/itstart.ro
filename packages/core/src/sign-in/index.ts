import { and, asc, eq, gt, sql } from "drizzle-orm";
import { signInLinkSends, type Db } from "@repo/db";

export type SignInLinkRefusal =
  | "too_soon" // one link per address per 30 s, the "Trimite din nou" timer
  | "too_many" // hourly cap per address
  | "undeliverable"; // reserved .invalid addresses, e.g. agents' placeholders

export type SignInLinkResult =
  | { ok: true }
  | { ok: false; reason: "undeliverable" }
  | {
      ok: false;
      reason: "too_soon" | "too_many";
      /** Seconds until this address may get a link again. */
      retryAfter: number;
    };

export type SignInConfig = {
  minIntervalSeconds: number;
  maxPerHour: number;
};

export const defaultSignInConfig: SignInConfig = {
  minIntervalSeconds: 30,
  maxPerHour: 5,
};

export type SignIn = {
  /**
   * Decides whether `email` may be sent a sign-in link now, and if so records
   * the send. Call it right before sending; on a refusal, send nothing.
   * Addresses are compared case-insensitively.
   */
  requestLink(email: string): Promise<SignInLinkResult>;
};

const SECOND = 1000;
const HOUR = 3_600_000;

export function createSignIn(deps: {
  db: Db;
  now: () => Date;
  config?: SignInConfig;
}): SignIn {
  const { db, now } = deps;
  const config = deps.config ?? defaultSignInConfig;

  return {
    requestLink: (rawEmail) => {
      const email = rawEmail.trim().toLowerCase();
      if (email.endsWith(".invalid")) {
        return Promise.resolve({ ok: false, reason: "undeliverable" });
      }

      return db.transaction(async (tx) => {
        const at = now();
        // Serialises requests for one address, so a double submit can't send two links.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);

        const hourAgo = new Date(at.getTime() - HOUR);
        const recent = await tx
          .select({ sentAt: signInLinkSends.sentAt })
          .from(signInLinkSends)
          .where(
            and(
              eq(signInLinkSends.email, email),
              gt(signInLinkSends.sentAt, hourAgo),
            ),
          )
          .orderBy(asc(signInLinkSends.sentAt));

        const secondsUntil = (t: number) =>
          Math.max(1, Math.ceil((t - at.getTime()) / SECOND));
        const latest = recent.at(-1);
        if (
          latest &&
          at.getTime() - latest.sentAt.getTime() <
            config.minIntervalSeconds * SECOND
        ) {
          return {
            ok: false,
            reason: "too_soon",
            retryAfter: secondsUntil(
              latest.sentAt.getTime() + config.minIntervalSeconds * SECOND,
            ),
          };
        }
        // The cap lifts once enough sends have left the hour to make room for one more.
        const blocking = recent[recent.length - config.maxPerHour];
        if (blocking) {
          return {
            ok: false,
            reason: "too_many",
            retryAfter: secondsUntil(blocking.sentAt.getTime() + HOUR),
          };
        }

        await tx.insert(signInLinkSends).values({ email, sentAt: at });
        return { ok: true };
      });
    },
  };
}
