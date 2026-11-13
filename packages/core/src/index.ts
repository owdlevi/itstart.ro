import type { Db } from "@repo/db";
import { createVotes } from "./votes";

export type CoreDeps = {
  db: Db;
  now?: () => Date;
};

/** Wires every module once. The app's composition root calls this with real adapters. */
export function createCore(deps: CoreDeps) {
  const now = deps.now ?? (() => new Date());
  return {
    votes: createVotes({ db: deps.db, now }),
  };
}

export type Core = ReturnType<typeof createCore>;
export type { VoteRefusal, VoteResult } from "./votes";
