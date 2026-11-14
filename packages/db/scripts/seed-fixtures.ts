// pnpm db:seed:fixtures [--reset]
// Loads docs/design/fixtures.json, plus one admin user, for design-fixtures mode.
// Only what the schema has columns for is loaded; extend this as tables grow.
// Counts the references show beyond the seeded rows ("86 de oameni", 128 votes)
// go into fixture_count_extras (DECISIONS, "Fixture counts").
// Refuses a database that already has users, unless --reset (which empties it).
import { readFileSync } from "node:fs";
import { count, sql } from "drizzle-orm";
import {
  challenges,
  fixtureCountExtras,
  participations,
  projectUpdates,
  projects,
  reviews,
  users,
  voteEvents,
  votes,
} from "../src/schema";
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
  challenges: {
    slug: string;
    number: number;
    title: string;
    intro?: string;
    summary?: string;
    scenarioNote?: string;
    scenario?: string;
    baseLevel?: string[];
    stretch?: string[];
    launchCriteria?: string[];
    materialsNote?: string;
    startsAt?: string;
    deadlineAt: string;
    displayCounts: {
      participants: number;
      agents?: number;
      launched: number;
      inProgress?: number;
    };
    agentStatus?: Record<string, string>;
  }[];
  projects: {
    slug: string;
    name: string;
    pitch: string;
    owner: string;
    challenge: string | null;
    stage: "in_progress" | "launched";
    launchedAt?: string | null;
    liveUrl?: string;
    tools: string[];
    toolsAll?: string[];
    votes: number;
    reviewCount: number;
    updates?: { version: number; date: string; text: string }[];
  }[];
  votes: Record<string, string[]>;
  reviews: Record<
    string,
    {
      author: string;
      automated?: boolean;
      replyTo?: number;
      at: string;
      body: string;
    }[]
  >;
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
// Not in fixtures.json: the phrase after "pentru" on Home ("Luna asta: o frizerie.").
const BUILT_FOR: Record<string, string> = {
  frizerie: "o frizerie",
  cafenea: "o cafenea",
  "mester-local": "un meșter local",
  "pagina-personala": "tine",
};
// Not in fixtures.json: the rest of the running challenge's brief on screen 02.
const BRIEF: Record<
  string,
  {
    launchNote: string;
    materialsUrl: string;
    tips: { title: string; text: string }[];
  }
> = {
  frizerie: {
    launchNote:
      "E o primă versiune pe care oricine o poate încerca. Nu trebuie să fie gata de folosit într-o frizerie adevărată.",
    materialsUrl: "https://materiale.itstart.example/frizerie.zip",
    tips: [
      {
        title: "Descrie clientul, nu codul",
        text: "Spune-i AI-ului cine e Nea Gică și ce îl doare. Primești un rezultat mai bun decât dacă ceri „un formular”.",
      },
      {
        title: "O singură pagină pe rând",
        text: "Întâi alegerea orei. Apoi confirmarea. Apoi pagina frizerului. Pașii mici se repară ușor.",
      },
      {
        title: "Testează pe telefonul tău",
        text: "Fă o programare de la cap la coadă, cu degetul mare. Dacă te încurci tu, se încurcă și clientul.",
      },
      {
        title: "Lansează devreme",
        text: "Pune-l pe panou când merge partea de bază. Comentariile îți spun ce să repari mai departe.",
      },
    ],
  },
};
// Not in fixtures.json: screen 11's jury note, the same for every challenge so far.
const JURY_NOTE =
  "Juriul: echipa ITStart și doi invitați din comunitate. Criteriile sunt publice: nivelul de bază merge pe telefon, se înțelege fără explicații, se vede atenția la detalii, iar povestea construcției e sinceră.";
// Family name first, so the first word isn't what we call them (screen 02: "Réka").
const GIVEN_NAME: Record<string, string> = {
  "kovacs-reka": "Réka",
  "szabo-attila": "Attila",
};
// Joined the running challenge before the reference moment. Bianca isn't:
// screen 08 shows her joining.
const NOT_JOINED = new Set(["bianca-radu"]);

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
        sql`truncate ${users}, ${challenges}, ${participations}, ${projects}, ${projectUpdates}, ${votes}, ${voteEvents}, ${reviews}, ${fixtureCountExtras} cascade`,
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
            givenName: GIVEN_NAME[u.handle] ?? null,
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
    const isAgent = new Set(
      fixtures.users.filter((u) => u.isAgent).map((u) => u.handle),
    );

    const challengeRows = await tx
      .insert(challenges)
      .values(
        fixtures.challenges.map((c) => ({
          number: c.number,
          slug: c.slug,
          title: c.title,
          intro: c.intro ?? null,
          summary: c.summary ?? null,
          builtFor: BUILT_FOR[c.slug] ?? null,
          scenarioNote: c.scenarioNote ?? null,
          scenario: c.scenario ?? null,
          baseLevel: c.baseLevel ?? [],
          stretch: c.stretch ?? [],
          launchCriteria: c.launchCriteria ?? [],
          launchNote: BRIEF[c.slug]?.launchNote ?? null,
          materialsUrl: BRIEF[c.slug]?.materialsUrl ?? null,
          materialsNote: c.materialsNote ?? null,
          tips: BRIEF[c.slug]?.tips ?? [],
          juryNote: JURY_NOTE,
          // Past challenges have no start in the fixtures: the 1st of the deadline's month.
          startsAt: new Date(
            c.startsAt ??
              `${c.deadlineAt.slice(0, 8)}01T00:00:00${c.deadlineAt.slice(19)}`,
          ),
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
          slug: p.slug,
          ownerId: userId.get(p.owner)!,
          challengeId: p.challenge ? challengeId.get(p.challenge)! : null,
          name: p.name,
          pitch: p.pitch,
          liveUrl: p.liveUrl ?? `https://${p.slug}.example`,
          // Cards show the first two tools: the fixtures' `tools`, then the rest.
          tools: [...new Set([...p.tools, ...(p.toolsAll ?? [])])],
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

    // Updates have only a date in the fixtures: noon in Bucharest that day.
    const updateRows = fixtures.projects.flatMap((p) =>
      (p.updates ?? []).map((u) => ({
        projectId: projectId.get(p.slug)!,
        version: u.version,
        text: u.text,
        createdAt: new Date(`${u.date}T12:00:00+02:00`),
      })),
    );
    if (updateRows.length > 0) {
      await tx.insert(projectUpdates).values(updateRows);
    }

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

    // Reviews in fixture order; replyTo is an index into the same list.
    let reviewCount = 0;
    for (const [slug, list] of Object.entries(fixtures.reviews)) {
      const ids: string[] = [];
      for (const r of list) {
        const [row] = await tx
          .insert(reviews)
          .values({
            projectId: projectId.get(slug)!,
            authorId: userId.get(r.author)!,
            parentId: r.replyTo === undefined ? null : ids[r.replyTo]!,
            body: r.body,
            isAutomated: r.automated ?? false,
            createdAt: new Date(r.at),
          })
          .returning({ id: reviews.id });
        ids.push(row!.id);
        reviewCount++;
      }
    }

    // Everyone with a project in a challenge joined it, from its start.
    const joined = new Map<string, Set<string>>();
    for (const p of fixtures.projects) {
      if (!p.challenge || NOT_JOINED.has(p.owner)) continue;
      joined.set(p.challenge, joined.get(p.challenge) ?? new Set());
      joined.get(p.challenge)!.add(p.owner);
    }
    // Agents listed in a challenge's agent panel joined it too.
    for (const c of fixtures.challenges) {
      for (const agent of Object.keys(c.agentStatus ?? {})) {
        joined.set(c.slug, joined.get(c.slug) ?? new Set());
        joined.get(c.slug)!.add(agent);
      }
    }
    // A minute apart, in fixture order: screen 02 lists the earliest first
    // ("Ioana, Andrei, Réka și încă 83").
    const order = new Map(fixtures.users.map((u, i) => [u.handle, i]));
    const participationRows = [...joined].flatMap(([slug, handles]) =>
      [...handles].map((handle) => ({
        userId: userId.get(handle)!,
        challengeId: challengeId.get(slug)!,
        joinedAt: new Date(
          new Date(
            fixtures.challenges.find((c) => c.slug === slug)!.startsAt ??
              deadline.get(slug)!,
          ).getTime() +
            order.get(handle)! * 60_000,
        ),
      })),
    );
    if (participationRows.length > 0) {
      await tx.insert(participations).values(participationRows);
    }

    // What the references show minus what the rows above already count.
    const extras: (typeof fixtureCountExtras.$inferInsert)[] = [];
    const extra = (
      subjectId: string,
      metric: (typeof fixtureCountExtras.$inferInsert)["metric"],
      shown: number | undefined,
      rows: number,
    ) => {
      if (shown === undefined) return;
      if (shown < rows) {
        throw new Error(`${metric}: fixtures show ${shown}, rows give ${rows}`);
      }
      if (shown > rows) extras.push({ subjectId, metric, n: shown - rows });
    };
    for (const c of fixtures.challenges) {
      const handles = [...(joined.get(c.slug) ?? [])];
      const own = fixtures.projects.filter((p) => p.challenge === c.slug);
      const id = challengeId.get(c.slug)!;
      const shown = c.displayCounts;
      extra(
        id,
        "participants",
        shown.participants,
        handles.filter((h) => !isAgent.has(h)).length,
      );
      extra(
        id,
        "agents",
        shown.agents,
        handles.filter((h) => isAgent.has(h)).length,
      );
      extra(
        id,
        "launched",
        shown.launched,
        own.filter((p) => p.stage === "launched").length,
      );
      // "23 au lansat deja": the people's launches, so the agents' two are left out.
      extra(
        id,
        "launchers",
        shown.launched === undefined
          ? undefined
          : shown.launched -
              own.filter((p) => p.stage === "launched" && isAgent.has(p.owner))
                .length,
        new Set(
          own
            .filter((p) => p.stage === "launched" && !isAgent.has(p.owner))
            .map((p) => p.owner),
        ).size,
      );
      extra(
        id,
        "in_progress",
        shown.inProgress,
        own.filter((p) => p.stage === "in_progress").length,
      );
    }
    for (const p of fixtures.projects) {
      const id = projectId.get(p.slug)!;
      const voters = voteRows.filter((v) => v.projectId === id).length;
      const humanReviews = (fixtures.reviews[p.slug] ?? []).filter(
        (r) => !r.automated,
      ).length;
      if (p.stage === "launched") extra(id, "votes", p.votes, voters);
      extra(id, "reviews", p.reviewCount, humanReviews);
    }
    if (extras.length > 0) await tx.insert(fixtureCountExtras).values(extras);

    console.log(
      `Seeded ${userRows.length} users (admin: ${ADMIN.handle}), ${challengeRows.length} challenges, ${participationRows.length} participations, ${projectRows.length} projects, ${updateRows.length} project updates, ${voteRows.length} votes, ${reviewCount} reviews, ${extras.length} fixture count extras.`,
    );
  }),
);
