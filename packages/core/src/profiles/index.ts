import { eq, like, or, sql } from "drizzle-orm";
import { users, type Db } from "@repo/db";
import type { ProfileProject, Projects } from "../projects";
import { freeSlug, slugBase } from "../slugs";

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

/** The tools screen 07 offers ("Cu ce vrei să construiești?"). */
export const INTEREST_TOOLS = ["Claude", "Cursor", "v0", "Lovable", "Bolt"];
/** "Încă nu știu": stored, so an edit form can show it again; never with a tool. */
export const INTEREST_UNSURE = "unsure";
export const NAME_MAX_LENGTH = 60;
export const CITY_MAX_LENGTH = 60;

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

export type Profiles = {
  /** A profile by handle, as the viewer sees it, or null if there's none. */
  byHandle(handle: string, viewerId?: string | null): Promise<Profile | null>;
  /**
   * Finishes a first sign-in: name, city, tools, the reminders choice, and a
   * handle made from the name when they have none yet. Once only.
   */
  onboard(userId: string, input: OnboardingInput): Promise<OnboardingResult>;
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

export function createProfiles(deps: {
  db: Db;
  now: () => Date;
  projects: Projects;
}): Profiles {
  const { db, now, projects } = deps;

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
      const name = input.name.trim().replace(/\s+/g, " ");
      if (!name) return { ok: false, reason: "name_empty" };
      if (name.length > NAME_MAX_LENGTH) {
        return { ok: false, reason: "name_too_long" };
      }
      const city = input.city?.trim().replace(/\s+/g, " ") || null;
      if (city && city.length > CITY_MAX_LENGTH) {
        return { ok: false, reason: "city_too_long" };
      }
      const tools = [...new Set(input.toolsInterest)];
      const known = tools.every(
        (tool) => tool === INTEREST_UNSURE || INTEREST_TOOLS.includes(tool),
      );
      if (!known || (tools.includes(INTEREST_UNSURE) && tools.length > 1)) {
        return { ok: false, reason: "unknown_tool" };
      }

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
  };
}
