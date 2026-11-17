// pnpm db:seed:fixtures [--reset]
// Loads docs/design/fixtures.json, plus one admin user, for design-fixtures mode.
// Only what the schema has columns for is loaded; extend this as tables grow.
// Counts the references show beyond the seeded rows ("86 de oameni", 128 votes)
// go into fixture_count_extras (DECISIONS, "Fixture counts").
// Refuses a database that already has users, unless --reset (which empties it).
import { readFileSync } from "node:fs";
import { count, eq, sql } from "drizzle-orm";
import {
  answers,
  challenges,
  fixtureCountExtras,
  participations,
  projectUpdates,
  reviewAssignments,
  projects,
  questions,
  recognitions,
  reviews,
  users,
  voteEvents,
  votes,
} from "../src/schema";
import { withDb } from "./connect";

type Fixtures = {
  /** The reference moment, which fixtures mode freezes the clock at. */
  now: string;
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
      reviews?: number;
      questions?: number;
    };
    recognitions?: {
      kind: "community" | "jury" | "first_project";
      project: string;
      reason: string;
    }[];
    bestAgentProject?: string;
    humansAboveBestAgent?: number;
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
    late?: boolean;
    updates?: { version: number; date: string; text: string }[];
    description?: string[];
    build?: { duration: string; hardestPart: string; prompt?: string };
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
  reviewAssignments: Record<string, string[]>;
  questions: Record<
    string,
    { title: string; author: string; answers: number; solved: boolean }[]
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
// Not in fixtures.json: what everyone is building, on screen 06 ("86 de oameni
// construiesc deja pagina frizeriei.").
const BUILDING_PHRASE: Record<string, string> = {
  frizerie: "pagina frizeriei",
  cafenea: "meniul cafenelei",
  "mester-local": "pagina meșterului",
  "pagina-personala": "pagina lor personală",
};
// Not in fixtures.json: the names on screen 03's challenge chips ("#4 Frizerie").
const SHORT_TITLE: Record<string, string> = {
  frizerie: "Frizerie",
  cafenea: "Cafenea",
  "mester-local": "Meșter local",
  "pagina-personala": "Pagină personală",
};
// Not in fixtures.json: the rest of the running challenge's brief on screen 02.
const BRIEF: Record<
  string,
  {
    launchNote: string;
    /** The last line of "Înainte să lansezi" on screen 09. */
    launchCheck: string;
    materialsUrl: string;
    tips: { title: string; text: string }[];
  }
> = {
  frizerie: {
    launchNote:
      "E o primă versiune pe care oricine o poate încerca. Nu trebuie să fie gata de folosit într-o frizerie adevărată.",
    launchCheck: "Ai făcut o programare de test, de la cap la coadă.",
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
// Not in fixtures.json: the bucket behind the build story's own words
// ("Cam 20 de ore…" is "Între 10 și 30 de ore").
const BUILD_DURATION: Record<
  string,
  (typeof projects.$inferInsert)["buildDuration"]
> = {
  "tuns-la-fix": "10_30h",
};
// Screenshots don't exist yet: launched projects get the two a launch needs
// (rule 4), three where the reference shows three. /dev/captura serves them as
// transparent images, so the `tint` placeholder behind each shows (HANDOVER §9.1).
const SCREENSHOTS: Record<string, number> = { "tuns-la-fix": 3 };
// Joined the running challenge before the reference moment. Bianca isn't:
// screen 08 shows her right after joining, so she joins a minute before the
// frozen clock, on top of the counts the references show ("87 de oameni";
// DECISIONS, "Screen 08 data").
const NOT_JOINED = new Set(["bianca-radu"]);
const JUST_JOINED = { handle: "bianca-radu", challenge: "frizerie" };
// Votes the references show beyond fixtures.votes: screen 08 has Bianca's on
// Tuns la Fix ("Ai votat · 128").
const EXTRA_VOTES: Record<string, string[]> = {
  "bianca-radu": ["tuns-la-fix"],
};

// Not in fixtures.json as projects: screen 12 names #2's and #1's jury picks
// only as text ("Instalatorul din Florești, de Elena Stan"; `juryPickText`).
// Loaded as launched projects with a jury recognition, so the archive reads
// them like any other pick. Their reasons aren't in any reference.
const JURY_PICKS: {
  challenge: string;
  slug: string;
  name: string;
  owner: string;
  pitch: string;
  reason: string;
}[] = [
  {
    challenge: "mester-local",
    slug: "instalatorul-din-floresti",
    name: "Instalatorul din Florești",
    owner: "elena-stan",
    pitch: "Lucrări, prețuri și un număr de telefon, pe un singur ecran.",
    reason: "„Un client găsește numărul de telefon în trei secunde.”",
  },
  {
    challenge: "pagina-personala",
    slug: "salut-sunt-vlad",
    name: "Salut, sunt Vlad",
    owner: "vlad-ionescu",
    pitch: "Cine sunt și ce fac, pe un singur ecran.",
    reason: "„Simplă, caldă și citită până la capăt.”",
  },
];

// What the questions on screens 02 and 08 hold beyond fixtures.json's titles,
// authors and counts: the details, when they were asked, and the answers, so
// each question's page has something to show. `solution` marks the answer the
// asker picked. Times put the rows in the reference's order (latest activity
// first) and after Bianca's account (11 November).
const QUESTION_THREADS: Record<
  string,
  {
    slug: string;
    at: string;
    body: string;
    answers: { author: string; at: string; body: string; solution?: true }[];
  }
> = {
  "Cum trimit SMS fără să plătesc?": {
    slug: "cum-trimit-sms-fara-sa-platesc",
    at: "2026-11-10T20:05:00+02:00",
    body: "Vreau ca Nea Gică să primească un SMS la fiecare programare nouă. Twilio cere card de la început. Există ceva gratuit pentru o lună de test?",
    answers: [
      {
        author: "ioana-muresan",
        at: "2026-11-10T20:40:00+02:00",
        body: "Twilio are cont de test cu credit gratuit, dar trimite doar la numere verificate. Pentru demo e destul: verifici numărul tău și pe al lui Nea Gică.",
        solution: true,
      },
      {
        author: "kovacs-reka",
        at: "2026-11-10T21:15:00+02:00",
        body: "Eu am trimis e-mail în loc de SMS. Pentru brief e la fel de bine, și Resend sau Brevo au planuri gratuite.",
      },
      {
        author: "szabo-attila",
        at: "2026-11-10T22:02:00+02:00",
        body: "Dacă ai un telefon Android vechi, sunt aplicații care trimit SMS prin el, cu un API mic. Merge, dar nu l-aș lăsa așa într-o frizerie adevărată.",
      },
      {
        author: "mihai-dumitrescu",
        at: "2026-11-11T07:30:00+02:00",
        body: "Atenție la diacritice: un SMS cu ș și ț trece pe alt set de caractere și încap mai puține litere în el.",
      },
    ],
  },
  "Supabase sau Firebase pentru programări?": {
    slug: "supabase-sau-firebase-pentru-programari",
    at: "2026-11-11T06:10:00+02:00",
    body: "N-am mai folosit niciuna. Am nevoie de o listă de programări și de un login pentru frizer. Ce e mai simplu de pus pe picioare cu AI?",
    answers: [
      {
        author: "andrei-popescu",
        at: "2026-11-11T06:22:00+02:00",
        body: "Supabase. E Postgres, iar Claude și Cursor scriu SQL foarte bine. Programările sunt un tabel cu oră de început și de sfârșit.",
      },
      {
        author: "ioana-muresan",
        at: "2026-11-11T06:31:00+02:00",
        body: "Tot Supabase. Login-ul pentru frizer îl ai gata, și poți pune o regulă ca doar el să vadă lista.",
      },
      {
        author: "elena-stan",
        at: "2026-11-11T06:40:00+02:00",
        body: "Am făcut #2 cu Firebase și a mers, dar căutările după dată au fost mai greu de scris. Pentru programări aș alege Supabase.",
      },
      {
        author: "vlad-ionescu",
        at: "2026-11-11T06:52:00+02:00",
        body: "Dacă folosești Lovable, are Supabase legat din start. Nu mai configurezi nimic.",
      },
      {
        author: "kovacs-reka",
        at: "2026-11-11T07:05:00+02:00",
        body: "Oricare, sincer. Contează mai mult să pornești azi decât să alegi perfect.",
      },
      {
        author: "szabo-attila",
        at: "2026-11-11T07:20:00+02:00",
        body: "Supabase, și ține fusul orar în minte: salvează orele în UTC și afișează-le în ora României.",
      },
    ],
  },
  "Cum fac să nu se suprapună două programări?": {
    slug: "cum-fac-sa-nu-se-suprapuna-doua-programari",
    at: "2026-11-08T18:30:00+02:00",
    body: "Dacă doi clienți apasă în același timp pe 10:00, amândoi primesc confirmare. Cum opresc asta?",
    answers: [
      {
        author: "ioana-muresan",
        at: "2026-11-08T19:10:00+02:00",
        body: "Verifică din nou pe server înainte să salvezi, nu doar în pagină. Pagina poate fi veche de câteva secunde.",
      },
      {
        author: "andrei-popescu",
        at: "2026-11-09T09:45:00+02:00",
        body: "Pune o constrângere unică în baza de date pe frizer și ora de început. A doua programare e refuzată acolo, oricât de repede ar apăsa amândoi.",
        solution: true,
      },
    ],
  },
};

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
for (const pick of JURY_PICKS) {
  fixtures.projects.push({
    slug: pick.slug,
    name: pick.name,
    pitch: pick.pitch,
    owner: pick.owner,
    challenge: pick.challenge,
    stage: "launched",
    tools: [],
    votes: 0,
    reviewCount: 0,
  });
  const challenge = fixtures.challenges.find((c) => c.slug === pick.challenge)!;
  challenge.recognitions = [
    ...(challenge.recognitions ?? []),
    { kind: "jury", project: pick.slug, reason: pick.reason },
  ];
}

await withDb((db) =>
  db.transaction(async (tx) => {
    if (reset) {
      await tx.execute(
        sql`truncate ${users}, ${challenges}, ${participations}, ${projects}, ${projectUpdates}, ${votes}, ${voteEvents}, ${reviews}, ${reviewAssignments}, ${recognitions}, ${questions}, ${answers}, ${fixtureCountExtras} cascade`,
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

    // A late launch: a day after its challenge's deadline (rule 7).
    const LATE_BY = 86_400_000;

    const challengeRows = await tx
      .insert(challenges)
      .values(
        fixtures.challenges.map((c) => ({
          number: c.number,
          slug: c.slug,
          title: c.title,
          shortTitle: SHORT_TITLE[c.slug] ?? null,
          intro: c.intro ?? null,
          summary: c.summary ?? null,
          builtFor: BUILT_FOR[c.slug] ?? null,
          buildingPhrase: BUILDING_PHRASE[c.slug] ?? null,
          scenarioNote: c.scenarioNote ?? null,
          scenario: c.scenario ?? null,
          baseLevel: c.baseLevel ?? [],
          stretch: c.stretch ?? [],
          launchCriteria: c.launchCriteria ?? [],
          launchNote: BRIEF[c.slug]?.launchNote ?? null,
          launchCheck: BRIEF[c.slug]?.launchCheck ?? null,
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
          screenshots:
            p.stage === "launched"
              ? Array.from(
                  { length: SCREENSHOTS[p.slug] ?? 2 },
                  (_, i) => `/dev/captura/${p.slug}-${i + 1}.svg`,
                )
              : [],
          description: p.description?.join("\n\n") ?? null,
          buildDuration: BUILD_DURATION[p.slug] ?? null,
          buildDurationText: p.build?.duration ?? null,
          buildHardestPart: p.build?.hardestPart ?? null,
          buildPrompt: p.build?.prompt ?? null,
          stage: p.stage,
          // Past challenges' projects have no launch time in the fixtures: use
          // their deadline, or a day after it for a late one.
          launchedAt:
            p.stage !== "launched"
              ? null
              : p.launchedAt
                ? new Date(p.launchedAt)
                : p.challenge
                  ? new Date(
                      deadline.get(p.challenge)!.getTime() +
                        (p.late ? LATE_BY : 0),
                    )
                  : null,
          isLate: p.late ?? false,
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

    const fixturesNow = new Date(fixtures.now).getTime();
    const launched = new Map(
      fixtures.projects.map((p) => [
        p.slug,
        p.launchedAt
          ? new Date(p.launchedAt).getTime()
          : fixturesNow - 86_400_000,
      ]),
    );
    let votesSeeded = 0;
    const voteRows = [
      ...Object.entries(fixtures.votes),
      ...Object.entries(EXTRA_VOTES),
    ].flatMap(([handle, slugs]) =>
      slugs.map((slug) => ({
        userId: userId.get(handle)!,
        projectId: projectId.get(slug)!,
        // Votes have no time in the fixtures: halfway between the launch and
        // the reference moment, a minute apart, so the admin's vote timeline
        // shows them before the frozen clock (and after the launch, so
        // screen 10 still counts 0 at launch).
        createdAt: new Date(
          (launched.get(slug)! + fixturesNow) / 2 + votesSeeded++ * 60_000,
        ),
      })),
    );
    if (voteRows.length > 0) {
      await tx.insert(votes).values(voteRows);
      await tx.insert(voteEvents).values(
        voteRows.map(({ createdAt, ...v }) => ({
          ...v,
          action: "cast" as const,
          at: createdAt,
        })),
      );
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

    // Questions with their answers; the solution is set once its answer exists.
    let answerCount = 0;
    const questionRows: { id: string; shown: number; rows: number }[] = [];
    for (const [slug, list] of Object.entries(fixtures.questions)) {
      for (const q of list) {
        const thread = QUESTION_THREADS[q.title];
        if (!thread) throw new Error(`No thread for "${q.title}"`);
        const [question] = await tx
          .insert(questions)
          .values({
            challengeId: challengeId.get(slug)!,
            authorId: userId.get(q.author)!,
            slug: thread.slug,
            title: q.title,
            body: thread.body,
            createdAt: new Date(thread.at),
          })
          .returning({ id: questions.id });
        for (const a of thread.answers) {
          const [answer] = await tx
            .insert(answers)
            .values({
              questionId: question!.id,
              authorId: userId.get(a.author)!,
              body: a.body,
              createdAt: new Date(a.at),
            })
            .returning({ id: answers.id });
          if (a.solution) {
            await tx
              .update(questions)
              .set({ solvedAnswerId: answer!.id })
              .where(eq(questions.id, question!.id));
          }
          answerCount++;
        }
        if (q.solved !== thread.answers.some((a) => a.solution)) {
          throw new Error(`"${q.title}": solved doesn't match the fixtures`);
        }
        questionRows.push({
          id: question!.id,
          shown: q.answers,
          rows: thread.answers.length,
        });
      }
    }

    // Assigned when the reviewer launched, a second apart so screen 10 lists
    // them in fixture order; none is done yet ("0 din 2").
    const assignmentRows = Object.entries(fixtures.reviewAssignments).flatMap(
      ([handle, slugs]) => {
        const launchedAt = fixtures.projects.find(
          (p) => p.owner === handle && p.challenge === "frizerie",
        )?.launchedAt;
        return slugs.map((slug, i) => ({
          reviewerId: userId.get(handle)!,
          projectId: projectId.get(slug)!,
          createdAt: launchedAt
            ? new Date(new Date(launchedAt).getTime() + i * 1000)
            : undefined,
        }));
      },
    );
    if (assignmentRows.length > 0) {
      await tx.insert(reviewAssignments).values(assignmentRows);
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
      // "386 păreri date": what the projects' own counts add up to, below.
      extra(
        id,
        "reviews",
        shown.reviews,
        own.reduce((n, p) => n + p.reviewCount, 0),
      );
      // "Întrebări și ajutor · 14"
      extra(
        id,
        "questions",
        shown.questions,
        fixtures.questions[c.slug]?.length ?? 0,
      );
      // "27 de proiecte făcute de oameni au primit mai multe voturi…"
      const best = own.find((p) => p.slug === c.bestAgentProject);
      extra(
        id,
        "humans_above_agent",
        best && c.humansAboveBestAgent,
        own.filter(
          (p) =>
            best &&
            p.stage === "launched" &&
            !isAgent.has(p.owner) &&
            p.votes > best.votes,
        ).length,
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
    for (const q of questionRows) extra(q.id, "answers", q.shown, q.rows);
    if (extras.length > 0) await tx.insert(fixtureCountExtras).values(extras);

    const recognitionRows = fixtures.challenges.flatMap((c) =>
      (c.recognitions ?? []).map((r) => ({
        challengeId: challengeId.get(c.slug)!,
        kind: r.kind,
        projectId: projectId.get(r.project)!,
        reason: r.reason,
      })),
    );
    if (recognitionRows.length > 0) {
      await tx.insert(recognitions).values(recognitionRows);
    }

    // After the extras, so her join adds one to what the references show.
    await tx.insert(participations).values({
      userId: userId.get(JUST_JOINED.handle)!,
      challengeId: challengeId.get(JUST_JOINED.challenge)!,
      joinedAt: new Date(new Date(fixtures.now).getTime() - 60_000),
    });

    console.log(
      `Seeded ${userRows.length} users (admin: ${ADMIN.handle}), ${challengeRows.length} challenges, ${participationRows.length + 1} participations, ${projectRows.length} projects, ${updateRows.length} project updates, ${voteRows.length} votes, ${reviewCount} reviews, ${assignmentRows.length} review assignments, ${recognitionRows.length} recognitions, ${questionRows.length} questions, ${answerCount} answers, ${extras.length} fixture count extras.`,
    );
  }),
);
