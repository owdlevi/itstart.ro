import type { Db } from "@repo/db";
import { createAdmins } from "./admins";
import { createChallenges } from "./challenges";
import { createProfiles } from "./profiles";
import { createProjects } from "./projects";
import { createRecognitions } from "./recognitions";
import { createReviews } from "./reviews";
import { createSignIn } from "./sign-in";
import type { LinkChecker } from "./link-checker";
import type { Storage } from "./storage";
import { createVotes } from "./votes";

export type CoreDeps = {
  db: Db;
  now?: () => Date;
  linkChecker?: LinkChecker;
  storage?: Storage;
};

/** Wires every module once. The app's composition root calls this with real adapters. */
export function createCore(deps: CoreDeps) {
  const now = deps.now ?? (() => new Date());
  const projects = createProjects({
    db: deps.db,
    now,
    linkChecker: deps.linkChecker,
    storage: deps.storage,
  });
  return {
    admins: createAdmins({ db: deps.db }),
    challenges: createChallenges({ db: deps.db, now }),
    profiles: createProfiles({
      db: deps.db,
      now,
      projects,
      storage: deps.storage,
    }),
    projects,
    recognitions: createRecognitions({ db: deps.db, now, projects }),
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
  type JoinRefusal,
  type LeaveRefusal,
  type ParticipantSteps,
  type ParticipationResult,
  type RunningChallenge,
} from "./challenges";
export type {
  AdminChallengeRow,
  AdminResult,
  ChallengeField,
  ChallengeSaveRefusal,
  ChallengeSaveResult,
  EditableChallenge,
} from "./challenges/admin";
export {
  addMonths,
  CHALLENGE_LIMITS,
  isMonth,
  isSlug,
  monthBounds,
  monthOf,
  type ChallengeInput,
} from "./challenges/rules";
export type { Admins } from "./admins";
export {
  CITY_MAX_LENGTH,
  INTEREST_TOOLS,
  INTEREST_UNSURE,
  NAME_MAX_LENGTH,
  PROFILE_LIMITS,
} from "./profiles";
export type {
  EditableProfile,
  EditableProfileResult,
  FinishedChallenge,
  OnboardingInput,
  OnboardingResult,
  Profile,
  ProfileEditResult,
  ProfileField,
  ProfileInput,
  Profiles,
} from "./profiles";
export { isHttpsUrl, missingToLaunch, PROJECT_LIMITS } from "./projects";
export type {
  AssignedProject,
  BuildDuration,
  EditableProject,
  EditableResult,
  LaunchField,
  LaunchPage,
  LaunchPageResult,
  ProjectEdit,
  ProjectInput,
  ProjectStage,
  SaveRefusal,
  SaveResult,
  BoardOpts,
  BoardProject,
  BoardScope,
  ProfileProject,
  ProjectPage,
  ProjectSummary,
  ProjectUpdate,
  Projects,
  ResultProject,
} from "./projects";
export {
  RECOGNITION_KINDS,
  RECOGNITION_REASON_MAX,
  type ChallengeResults,
  type RecognitionCandidate,
  type RecognitionEditor,
  type RecognitionEntry,
  type RecognitionKind,
  type RecognitionProblem,
  type RecognitionSaveResult,
  type Recognitions,
} from "./recognitions";
export type {
  Review,
  ReviewAuthor,
  ReviewRefusal,
  ReviewResult,
  ReviewThread,
  Reviews,
} from "./reviews";
export type { SignIn, SignInLinkRefusal, SignInLinkResult } from "./sign-in";
export { TIMELINE } from "./votes";
export type {
  ProjectVoteActivity,
  TimelineSubject,
  VoteActivity,
  VoteEventRow,
  VoteRefusal,
  VoteResult,
  VoteTimeline,
  VoterActivity,
} from "./votes";
export { createMemoryMailer, type Email, type Mailer } from "./mailer";
export {
  createCannedLinkChecker,
  type LinkCheck,
  type LinkChecker,
} from "./link-checker";
export { createPrefixStorage, type Storage } from "./storage";
