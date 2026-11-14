import { eq } from "drizzle-orm";
import { users, type Db } from "@repo/db";
import type { ProfileProject, Projects } from "../projects";

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

export type Profiles = {
  /** A profile by handle, as the viewer sees it, or null if there's none. */
  byHandle(handle: string, viewerId?: string | null): Promise<Profile | null>;
};

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
  };
}
