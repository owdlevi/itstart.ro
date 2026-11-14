// pnpm db:seed:fixtures [--reset]
// Loads docs/design/fixtures.json, plus one admin user, for design-fixtures mode.
// Only what the schema has columns for is loaded; extend this as tables grow.
// Refuses a database that already has users, unless --reset (which empties it).
import { readFileSync } from "node:fs";
import { count, sql } from "drizzle-orm";
import { challenges, projects, users, voteEvents, votes } from "../src/schema";
import { withDb } from "./connect";

type Fixtures = {
  users: {
    handle: string;
    name: string;
    isAgent: boolean;
    agentModel?: string;
    avatarUrl: string | null;
    avatarFill?: string;
    city?: string | null;
    bio?: string | null;
    links?: string[];
    toolsInterest?: string[];
    openToWork?: boolean;
    remindersOptIn?: boolean;
    joinedAt?: string;
  }[];
  challenges: { slug: string; title: string; deadlineAt: string }[];
  projects: {
    slug: string;
    name: string;
    owner: string;
    challenge: string | null;
    stage: "in_progress" | "launched";
    launchedAt?: string | null;
  }[];
  votes: Record<string, string[]>;
};

// Not in fixtures.json, so it can't change what any reference screen shows.
const ADMIN = {
  handle: "echipa-itstart",
  name: "Echipa ITStart",
  role: "admin" as const,
};
// Screen 07 shows her first sign-in, so she hasn't finished onboarding.
const NOT_ONBOARDED = new Set(["bianca-radu"]);
// Agents have no join date in the fixtures.
const AGENTS_JOINED = "2026-08-01";

if (process.env.VERCEL_ENV === "production") {
  console.error("Refusing to seed design fixtures into production.");
  process.exit(1);
}
const reset = process.argv.includes("--reset");
const fixtures: Fixtures = JSON.parse(
  readFileSync(
    new URL("../../../docs/design/fixtures.json", import.meta.url),
    "utf8",
  ),
);

await withDb((db) =>
  db.transaction(async (tx) => {
    if (reset) {
      await tx.execute(
        sql`truncate ${users}, ${challenges}, ${projects}, ${votes}, ${voteEvents} cascade`,
      );
    } else {
      const [existing] = await tx.select({ n: count() }).from(users);
      if (existing!.n > 0) {
        throw new Error(
          "The database already has users. Run with --reset to empty it first.",
        );
      }
    }

    const userRows = await tx
      .insert(users)
      .values([
        ...fixtures.users.map((u) => {
          const createdAt = new Date(u.joinedAt ?? AGENTS_JOINED);
          return {
            handle: u.handle,
            name: u.name,
            email: `${u.handle}@${u.isAgent ? "agents" : "fixtures"}.itstart.invalid`,
            emailVerified: !u.isAgent,
            avatarUrl: u.avatarUrl,
            avatarFill: u.avatarFill ?? null,
            city: u.city ?? null,
            bio: u.bio ?? null,
            links: u.links ?? [],
            toolsInterest: u.toolsInterest ?? [],
            isAgent: u.isAgent,
            agentModel: u.agentModel ?? null,
            openToWork: u.openToWork ?? false,
            remindersOptIn: u.remindersOptIn ?? false,
            onboardedAt: NOT_ONBOARDED.has(u.handle) ? null : createdAt,
            createdAt,
          };
        }),
        {
          ...ADMIN,
          email: `${ADMIN.handle}@fixtures.itstart.invalid`,
          emailVerified: true,
          createdAt: new Date(AGENTS_JOINED),
          onboardedAt: new Date(AGENTS_JOINED),
        },
      ])
      .returning({ id: users.id, handle: users.handle });
    const userId = new Map(userRows.map((u) => [u.handle, u.id]));

    const challengeRows = await tx
      .insert(challenges)
      .values(
        fixtures.challenges.map((c) => ({
          slug: c.slug,
          title: c.title,
          endsAt: new Date(c.deadlineAt),
        })),
      )
      .returning({ id: challenges.id, slug: challenges.slug });
    const challengeId = new Map(challengeRows.map((c) => [c.slug, c.id]));
    const deadline = new Map(
      fixtures.challenges.map((c) => [c.slug, new Date(c.deadlineAt)]),
    );

    const projectRows = await tx
      .insert(projects)
      .values(
        fixtures.projects.map((p) => ({
          ownerId: userId.get(p.owner)!,
          challengeId: p.challenge ? challengeId.get(p.challenge)! : null,
          name: p.name,
          stage: p.stage,
          // Past challenges' projects have no launch time in the fixtures: use their deadline.
          launchedAt:
            p.stage !== "launched"
              ? null
              : p.launchedAt
                ? new Date(p.launchedAt)
                : p.challenge
                  ? deadline.get(p.challenge)!
                  : null,
        })),
      )
      .returning({ id: projects.id });
    const projectId = new Map(
      fixtures.projects.map((p, i) => [p.slug, projectRows[i]!.id]),
    );

    const voteRows = Object.entries(fixtures.votes).flatMap(([handle, slugs]) =>
      slugs.map((slug) => ({
        userId: userId.get(handle)!,
        projectId: projectId.get(slug)!,
      })),
    );
    if (voteRows.length > 0) {
      await tx.insert(votes).values(voteRows);
      await tx
        .insert(voteEvents)
        .values(voteRows.map((v) => ({ ...v, action: "cast" as const })));
    }

    console.log(
      `Seeded ${userRows.length} users (admin: ${ADMIN.handle}), ${challengeRows.length} challenges, ${projectRows.length} projects, ${voteRows.length} votes.`,
    );
  }),
);
