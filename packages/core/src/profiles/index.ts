import { eq, like, or, sql } from "drizzle-orm";
import { users, type Db } from "@repo/db";
import type { ProfileProject, Projects } from "../projects";
import { freeSlug, slugBase } from "../slugs";
import type { Storage } from "../storage";
import {
  INTEREST_TOOLS,
  INTEREST_UNSURE,
  isHttpsUrl,
  isInterestList,
  PROFILE_LIMITS,
  tidy,
} from "./rules";

export { INTEREST_TOOLS, INTEREST_UNSURE, PROFILE_LIMITS };

/** A challenge on a profile's "Provocări terminate": one they launched in. */
export type FinishedChallenge = {
  slug: string;
  number: number;
  title: string;
  startsAt: Date;
  /** Their launched projects in it, newest launch first. */
  projects: { slug: string; name: string }[];
};

/** Everything a public profile (screen 05) shows. Never the e-mail (rule 23). */
export type Profile = {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  avatarFill: string | null;
  isAgent: boolean;
  city: string | null;
  bio: string | null;
  links: string[];
  /** "Deschis la colaborări": off until they tick it (rule 22). */
  openToWork: boolean;
  joinedAt: Date;
  stats: {
    launched: number;
    /** Consecutive months with a launch, ending this month or last month. */
    monthsInARow: number;
    /** Across all their projects. */
    votes: number;
  };
  /** Launched projects, newest launch first. */
  projects: ProfileProject[];
  /** Newest first. */
  challenges: FinishedChallenge[];
};

export const NAME_MAX_LENGTH = PROFILE_LIMITS.name;
export const CITY_MAX_LENGTH = PROFILE_LIMITS.city;

/** What a first sign-in fills in on /bun-venit (screen 07). */
export type OnboardingInput = {
  name: string;
  city?: string | null;
  toolsInterest: string[];
  /** Reminder e-mails: false unless they ticked it (rule 22). */
  remindersOptIn: boolean;
};

export type OnboardingResult =
  | { ok: true; handle: string }
  | {
      ok: false;
      reason:
        | "already_onboarded"
        | "name_empty"
        | "name_too_long"
        | "city_too_long"
        | "unknown_tool";
    };

/** What "Editează profilul" (/u/<handle>/editeaza) saves. */
export type ProfileInput = {
  name: string;
  /** What sentences call them ("Bravo, Réka!"); null: the name's first word. */
  givenName: string | null;
  city: string | null;
  /** One paragraph, at most 240 characters (HANDOVER §4). */
  bio: string | null;
  /** At most 3, https, in the order given. */
  links: string[];
  /** A file our storage holds, the one they have already, or null for initials. */
  avatarUrl: string | null;
  toolsInterest: string[];
  /** Reminder e-mails, exactly as ticked (rule 22). */
  remindersOptIn: boolean;
};

/** A field the edit form can mark when core refuses what it holds. */
export type ProfileField = keyof ProfileInput;

/** A profile as its owner edits it. */
export type EditableProfile = {
  id: string;
  handle: string;
  avatarFill: string | null;
  input: ProfileInput;
};

export type EditableProfileResult =
  | { ok: true; value: EditableProfile }
  | { ok: false; reason: "not_found" | "not_owner" | "not_onboarded" };

export type ProfileEditResult =
  | { ok: true; handle: string }
  | { ok: false; reason: "not_onboarded" | "avatar_unknown" }
  /** Empty, too long, or not the right shape; the form checks the same rules first. */
  | { ok: false; reason: "invalid"; field: ProfileField };

export type Profiles = {
  /** A profile by handle, as the viewer sees it, or null if there's none. */
  byHandle(handle: string, viewerId?: string | null): Promise<Profile | null>;
  /**
   * Finishes a first sign-in: name, city, tools, the reminders choice, and a
   * handle made from the name when they have none yet. Once only.
   */
  onboard(userId: string, input: OnboardingInput): Promise<OnboardingResult>;
  /** The edit form's prefill: the owner's own profile, once onboarded. */
  editable(handle: string, userId: string): Promise<EditableProfileResult>;
  /**
   * Saves the user's own profile. The handle stays as it is, whatever the
   * name: profile links are shared (DECISIONS, "Profile editing").
   */
  edit(userId: string, input: ProfileInput): Promise<ProfileEditResult>;
};

/** The handle a name asks for: "Kovács Réka" → "kovacs-reka" (see slugBase). */
export const handleBase = (name: string) => slugBase(name, "constructor");
export const freeHandle = freeSlug;

// Months are counted in Bucharest, like the challenges' deadlines.
const monthOf = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Bucharest",
  year: "numeric",
  month: "numeric",
});
const monthIndex = (at: Date) => {
  const parts = Object.fromEntries(
    monthOf.formatToParts(at).map((p) => [p.type, p.value]),
  );
  return Number(parts.year) * 12 + Number(parts.month) - 1;
};

/** A run that ended before last month doesn't count: it has been broken. */
export function monthsInARow(launches: Date[], now: Date): number {
  const months = new Set(launches.map(monthIndex));
  const current = monthIndex(now);
  let month = months.has(current) ? current : current - 1;
  let run = 0;
  while (months.has(month)) {
    run++;
    month--;
  }
  return run;
}

type Invalid = { ok: false; reason: "invalid"; field: ProfileField };

function clean(
  input: ProfileInput,
): { ok: true; value: ProfileInput } | Invalid {
  const invalid = (field: ProfileField): Invalid => ({
    ok: false,
    reason: "invalid",
    field,
  });
  const L = PROFILE_LIMITS;
  const value: ProfileInput = {
    name: tidy(input.name),
    givenName: tidy(input.givenName ?? "") || null,
    city: tidy(input.city ?? "") || null,
    bio: tidy(input.bio ?? "") || null,
    links: [...new Set(input.links.map((l) => l.trim()).filter(Boolean))],
    avatarUrl: input.avatarUrl || null,
    toolsInterest: [...new Set(input.toolsInterest)],
    remindersOptIn: input.remindersOptIn,
  };
  if (!value.name || value.name.length > L.name) return invalid("name");
  if ((value.givenName?.length ?? 0) > L.givenName) return invalid("givenName");
  if ((value.city?.length ?? 0) > L.city) return invalid("city");
  if ((value.bio?.length ?? 0) > L.bio) return invalid("bio");
  if (
    value.links.length > L.links ||
    value.links.some((link) => link.length > L.link || !isHttpsUrl(link))
  ) {
    return invalid("links");
  }
  if (!isInterestList(value.toolsInterest)) return invalid("toolsInterest");
  return { ok: true, value };
}

export function createProfiles(deps: {
  db: Db;
  now: () => Date;
  projects: Projects;
  storage?: Storage;
}): Profiles {
  const { db, now, projects } = deps;
  // Fail closed: without storage no new picture is ours.
  const owns = (url: string) => deps.storage?.owns(url) ?? false;

  return {
    byHandle: async (handle, viewerId) => {
      const [user] = await db
        .select({
          id: users.id,
          handle: users.handle,
          name: users.name,
          avatarUrl: users.avatarUrl,
          avatarFill: users.avatarFill,
          isAgent: users.isAgent,
          city: users.city,
          bio: users.bio,
          links: users.links,
          openToWork: users.openToWork,
          joinedAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.handle, handle));
      if (!user?.handle) return null;

      const launched = await projects.launchedBy(user.id, viewerId);

      const challenges = new Map<string, FinishedChallenge>();
      for (const project of launched) {
        if (!project.challenge) continue;
        const entry = challenges.get(project.challenge.slug) ?? {
          ...project.challenge,
          projects: [],
        };
        entry.projects.push({ slug: project.slug, name: project.name });
        challenges.set(project.challenge.slug, entry);
      }

      return {
        ...user,
        handle: user.handle,
        stats: {
          launched: launched.length,
          monthsInARow: monthsInARow(
            launched.map((p) => p.launchedAt),
            now(),
          ),
          votes: launched.reduce((sum, p) => sum + p.votes, 0),
        },
        projects: launched,
        challenges: [...challenges.values()].sort(
          (a, b) => b.number - a.number,
        ),
      };
    },

    onboard: async (userId, input) => {
      const name = tidy(input.name);
      if (!name) return { ok: false, reason: "name_empty" };
      if (name.length > NAME_MAX_LENGTH) {
        return { ok: false, reason: "name_too_long" };
      }
      const city = tidy(input.city ?? "") || null;
      if (city && city.length > CITY_MAX_LENGTH) {
        return { ok: false, reason: "city_too_long" };
      }
      const tools = [...new Set(input.toolsInterest)];
      if (!isInterestList(tools)) return { ok: false, reason: "unknown_tool" };

      return db.transaction(async (tx) => {
        const [user] = await tx
          .select({ handle: users.handle, onboardedAt: users.onboardedAt })
          .from(users)
          .where(eq(users.id, userId))
          .for("update");
        if (!user) throw new Error(`Unknown user ${userId}`);
        if (user.onboardedAt) return { ok: false, reason: "already_onboarded" };

        let handle = user.handle;
        if (!handle) {
          const base = handleBase(name);
          // Two people named alike finishing at once can't both get `base`.
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`handle:${base}`}))`,
          );
          const taken = await tx
            .select({ handle: users.handle })
            .from(users)
            .where(or(eq(users.handle, base), like(users.handle, `${base}-%`)));
          handle = freeHandle(base, new Set(taken.map((t) => t.handle ?? "")));
        }

        await tx
          .update(users)
          .set({
            name,
            city,
            toolsInterest: tools,
            remindersOptIn: input.remindersOptIn,
            handle,
            onboardedAt: now(),
          })
          .where(eq(users.id, userId));
        return { ok: true, handle };
      });
    },

    editable: async (handle, userId) => {
      const [user] = await db
        .select({
          id: users.id,
          handle: users.handle,
          avatarFill: users.avatarFill,
          onboardedAt: users.onboardedAt,
          name: users.name,
          givenName: users.givenName,
          city: users.city,
          bio: users.bio,
          links: users.links,
          avatarUrl: users.avatarUrl,
          toolsInterest: users.toolsInterest,
          remindersOptIn: users.remindersOptIn,
        })
        .from(users)
        .where(eq(users.handle, handle));
      if (!user?.handle) return { ok: false, reason: "not_found" };
      if (user.id !== userId) return { ok: false, reason: "not_owner" };
      if (!user.onboardedAt) return { ok: false, reason: "not_onboarded" };
      return {
        ok: true,
        value: {
          id: user.id,
          handle: user.handle,
          avatarFill: user.avatarFill,
          input: {
            name: user.name,
            givenName: user.givenName,
            city: user.city,
            bio: user.bio,
            links: user.links,
            avatarUrl: user.avatarUrl,
            toolsInterest: user.toolsInterest,
            remindersOptIn: user.remindersOptIn,
          },
        },
      };
    },

    edit: async (userId, input) => {
      const cleaned = clean(input);
      if (!cleaned.ok) return cleaned;
      const value = cleaned.value;

      return db.transaction(async (tx) => {
        const [user] = await tx
          .select({
            handle: users.handle,
            onboardedAt: users.onboardedAt,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(eq(users.id, userId))
          .for("update");
        if (!user) throw new Error(`Unknown user ${userId}`);
        if (!user.onboardedAt || !user.handle) {
          return { ok: false, reason: "not_onboarded" };
        }
        // A new picture must be a file we stored; the one they have stays.
        if (
          value.avatarUrl !== null &&
          value.avatarUrl !== user.avatarUrl &&
          !owns(value.avatarUrl)
        ) {
          return { ok: false, reason: "avatar_unknown" };
        }
        await tx.update(users).set(value).where(eq(users.id, userId));
        return { ok: true, handle: user.handle };
      });
    },
  };
}
