import type { Db } from "@repo/db";
import { createSignIn } from "./sign-in";
import { createVotes } from "./votes";

export type CoreDeps = {
  db: Db;
  now?: () => Date;
};

/** Wires every module once. The app's composition root calls this with real adapters. */
export function createCore(deps: CoreDeps) {
  const now = deps.now ?? (() => new Date());
  return {
    signIn: createSignIn({ db: deps.db, now }),
    votes: createVotes({ db: deps.db, now }),
  };
}

export type Core = ReturnType<typeof createCore>;
export type { SignIn, SignInLinkRefusal, SignInLinkResult } from "./sign-in";
export type { VoteRefusal, VoteResult } from "./votes";
export { createMemoryMailer, type Email, type Mailer } from "./mailer";
