import type { Db } from "@repo/db";
import { createChallenges } from "./challenges";
import { createProjects } from "./projects";
import { createReviews } from "./reviews";
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
    challenges: createChallenges({ db: deps.db, now }),
    projects: createProjects({ db: deps.db, now }),
    reviews: createReviews({ db: deps.db, now }),
    signIn: createSignIn({ db: deps.db, now }),
    votes: createVotes({ db: deps.db, now }),
  };
}

export type Core = ReturnType<typeof createCore>;
export {
  challengeStatus,
  type Challenge,
  type ChallengeCounts,
  type ChallengeOption,
  type ChallengeStatus,
  type Participant,
  type Challenges,
  type RunningChallenge,
} from "./challenges";
export type {
  BoardOpts,
  BoardProject,
  BoardScope,
  ProjectPage,
  ProjectSummary,
  ProjectUpdate,
  Projects,
} from "./projects";
export type {
  Review,
  ReviewAuthor,
  ReviewRefusal,
  ReviewResult,
  ReviewThread,
  Reviews,
} from "./reviews";
export type { SignIn, SignInLinkRefusal, SignInLinkResult } from "./sign-in";
export type { VoteRefusal, VoteResult } from "./votes";
export { createMemoryMailer, type Email, type Mailer } from "./mailer";
