import type { Mailer, SignIn } from "@repo/core";
import type { Db } from "@repo/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink, testUtils } from "better-auth/plugins";

// Product fields live on `users`. Every one is `input: false`, so no client can
// set them through Better Auth's endpoints; our own server code writes them.
const productField = <T>(field: T) => ({ ...field, input: false as const });

export type AuthDeps = {
  db: Db;
  signIn: SignIn;
  mailer: Mailer;
  /** Adds Better Auth's testUtils plugin, for /dev/login-as. */
  designFixtures: boolean;
};

/**
 * The Better Auth instance. `core.ts` builds the real one; `scripts/auth-generate.ts`
 * builds one for the CLI, which can't load `server-only`.
 */
export function createAuth({ db, signIn, mailer, designFixtures }: AuthDeps) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
    advanced: { database: { generateId: "uuid" } },
    rateLimit: { storage: "database" },
    // The sign-in method for now: magic link needs Resend and the providers
    // need OAuth apps, and neither exists yet. No e-mail verification and no
    // password reset until there's a mailer (DECISIONS, "Email and password for now").
    emailAndPassword: { enabled: true },
    user: {
      fields: { image: "avatarUrl" },
      additionalFields: {
        // Null until onboarding (/bun-venit): magic-link users arrive without a name.
        handle: productField({ type: "string", required: false, unique: true }),
        avatarFill: productField({ type: "string", required: false }),
        city: productField({ type: "string", required: false }),
        bio: productField({ type: "string", required: false }),
        links: productField({
          type: "string[]",
          required: true,
          defaultValue: [],
        }),
        toolsInterest: productField({
          type: "string[]",
          required: true,
          defaultValue: [],
        }),
        isAgent: productField({
          type: "boolean",
          required: true,
          defaultValue: false,
        }),
        agentModel: productField({ type: "string", required: false }),
        openToWork: productField({
          type: "boolean",
          required: true,
          defaultValue: false,
        }),
        remindersOptIn: productField({
          type: "boolean",
          required: true,
          defaultValue: false,
        }),
        role: productField({
          type: ["member", "admin"],
          required: true,
          defaultValue: "member",
        }),
        onboardedAt: productField({ type: "date", required: false }),
      },
    },
    socialProviders: {
      // Mark provider e-mails verified: a later magic-link sign-in to an
      // unverified user deletes that user's provider accounts.
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        mapProfileToUser: () => ({ emailVerified: true }),
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
        mapProfileToUser: () => ({ emailVerified: true }),
      },
    },
    plugins: [
      magicLink({
        expiresIn: 900,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          const allowed = await signIn.requestLink(email);
          if (!allowed.ok) {
            // The /intra form maps `code` to copy; retryAfter drives its timer.
            throw allowed.reason === "undeliverable"
              ? new APIError("BAD_REQUEST", { code: "UNDELIVERABLE" })
              : new APIError("TOO_MANY_REQUESTS", {
                  code: allowed.reason.toUpperCase(),
                  retryAfter: allowed.retryAfter,
                });
          }
          // The e-mail links to our confirm page, which verifies on a button
          // press, so link scanners that pre-fetch URLs can't use the token up.
          const link = new URL(url);
          const confirm = new URL(`/intra/confirma${link.search}`, link.origin);
          await mailer.send({
            kind: "sign_in_link",
            to: email,
            url: `${confirm}`,
          });
        },
      }),
      ...(designFixtures ? [testUtils()] : []),
      nextCookies(), // must stay last
    ],
  });
}
