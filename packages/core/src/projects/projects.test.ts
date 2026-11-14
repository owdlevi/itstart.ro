import { describe, expect, test } from "vitest";
import { votes } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import {
  addExtra,
  addUpdate,
  makeChallenge,
  makeProject,
  makeUser,
  review,
  vote,
} from "../test-data";
import { createProjects } from "./index";

// Wednesday 11 November 2026, 07:35 in Bucharest: the design fixtures' moment.
const NOW = new Date("2026-11-11T05:35:00Z");

async function setup() {
  const db = await createTestDb();
  const projects = createProjects({ db, now: () => NOW });
  const challenge = await makeChallenge(db);
  const owner = await makeUser(db, { handle: "ana-pop", name: "Ana Pop" });
  const make = (
    fields: Omit<Parameters<typeof makeProject>[1], "ownerId"> = {},
  ) =>
    makeProject(db, {
      ownerId: owner.id,
      challengeId: challenge.id,
      ...fields,
    });
  return { db, projects, challenge, owner, make };
}

describe("projects.mostVoted", () => {
  test("returns the challenge's launched projects, most votes first, up to the limit", async () => {
    const { db, projects, challenge, make } = await setup();
    const a = await make({ name: "A" });
    const b = await make({ name: "B" });
    const c = await make({ name: "C" });
    const d = await make({ name: "D" });
    await vote(db, b.id, 3);
    await vote(db, c.id, 2);
    await vote(db, a.id, 1);
    await vote(db, d.id, 0);
    const other = await makeChallenge(db, { slug: "alta" });
    const elsewhere = await make({ name: "E", challengeId: other.id });
    await vote(db, elsewhere.id, 5);

    const top = await projects.mostVoted({
      challengeId: challenge.id,
      limit: 3,
    });

    expect(top.map((p) => [p.name, p.votes])).toEqual([
      ["B", 3],
      ["C", 2],
      ["A", 1],
    ]);
  });

  test("leaves out projects in progress, which can't be voted on (rule 5)", async () => {
    const { db, projects, challenge, make } = await setup();
    const wip = await make({ name: "WIP", stage: "in_progress" });
    await vote(db, wip.id, 4);
    await make({ name: "Lansat" });

    const top = await projects.mostVoted({
      challengeId: challenge.id,
      limit: 3,
    });

    expect(top.map((p) => p.name)).toEqual(["Lansat"]);
  });

  test("counts human reviews and replies, not automated reviews (rule 17)", async () => {
    const { db, projects, challenge, make } = await setup();
    const project = await make();
    await review(db, project.id, { isAutomated: true });
    const first = await review(db, project.id);
    await review(db, project.id, { parentId: first.id });

    const [top] = await projects.mostVoted({
      challengeId: challenge.id,
      limit: 1,
    });

    expect(top?.reviews).toBe(2);
  });

  test("shows a signed-out visitor every project unvoted (rule 12)", async () => {
    const { db, projects, challenge, make } = await setup();
    const project = await make();
    const voter = await makeUser(db);
    await db.insert(votes).values({ userId: voter.id, projectId: project.id });

    const [signedOut] = await projects.mostVoted({
      challengeId: challenge.id,
      limit: 1,
    });
    const [signedIn] = await projects.mostVoted({
      challengeId: challenge.id,
      limit: 1,
      viewerId: voter.id,
    });

    expect(signedOut?.voted).toBe(false);
    expect(signedIn?.voted).toBe(true);
  });

  test("adds the design fixtures' extra votes and reviews, and ranks by the total", async () => {
    const { db, projects, challenge, make } = await setup();
    const a = await make({ name: "A" });
    const b = await make({ name: "B" });
    await vote(db, a.id, 2);
    await vote(db, b.id, 1);
    await addExtra(db, b.id, "votes", 127);
    await addExtra(db, b.id, "reviews", 3);

    const top = await projects.mostVoted({
      challengeId: challenge.id,
      limit: 2,
    });

    expect(top.map((p) => [p.name, p.votes, p.reviews])).toEqual([
      ["B", 128, 3],
      ["A", 2, 0],
    ]);
  });

  test("gives the owner and the first screenshot as the thumbnail", async () => {
    const { projects, challenge, make } = await setup();
    await make({ screenshots: ["https://blob/1.webp", "https://blob/2.webp"] });

    const [top] = await projects.mostVoted({
      challengeId: challenge.id,
      limit: 1,
    });

    expect(top?.thumbnail).toBe("https://blob/1.webp");
    expect(top?.owner).toMatchObject({ handle: "ana-pop", name: "Ana Pop" });
  });
});

describe("agent-built projects", () => {
  test("are listed unless the caller hides them", async () => {
    const { db, projects, challenge, make } = await setup();
    await make({ name: "Om" });
    const agent = await makeUser(db, { isAgent: true });
    await makeProject(db, {
      ownerId: agent.id,
      challengeId: challenge.id,
      name: "Agent",
    });

    const all = await projects.mostVoted({
      challengeId: challenge.id,
      limit: 4,
    });
    const people = await projects.mostVoted({
      challengeId: challenge.id,
      limit: 4,
      agents: false,
    });

    expect(all.map((p) => p.name).sort()).toEqual(["Agent", "Om"]);
    expect(people.map((p) => p.name)).toEqual(["Om"]);
  });
});

describe("projects.inProgress", () => {
  test("lists only projects in progress, kept apart from the vote (rule 5)", async () => {
    const { projects, challenge, make } = await setup();
    await make({ name: "Lansat" });
    await make({ name: "În lucru", stage: "in_progress" });

    const list = await projects.inProgress({
      challengeId: challenge.id,
      limit: 4,
    });

    expect(list.map((p) => [p.name, p.stage])).toEqual([
      ["În lucru", "in_progress"],
    ]);
  });

  test("puts the most recently updated first, with its latest update", async () => {
    const { db, projects, challenge, make } = await setup();
    const older = await make({ name: "Foarfeca", stage: "in_progress" });
    const newer = await make({ name: "Rând la Tuns", stage: "in_progress" });
    await addUpdate(db, older.id, 1, new Date("2026-11-08T10:00:00Z"));
    await addUpdate(db, newer.id, 1, new Date("2026-11-04T10:00:00Z"));
    await addUpdate(
      db,
      newer.id,
      2,
      new Date("2026-11-10T10:00:00Z"),
      "am adăugat confirmarea pe e-mail.",
    );

    const list = await projects.inProgress({
      challengeId: challenge.id,
      limit: 4,
    });

    expect(list.map((p) => p.name)).toEqual(["Rând la Tuns", "Foarfeca"]);
    expect(list[0]!.latestUpdate).toEqual({
      version: 2,
      text: "am adăugat confirmarea pe e-mail.",
      createdAt: new Date("2026-11-10T10:00:00Z"),
    });
  });

  test("has no latest update before the first one", async () => {
    const { projects, challenge, make } = await setup();
    await make({ stage: "in_progress" });

    const [project] = await projects.inProgress({
      challengeId: challenge.id,
      limit: 4,
    });

    expect(project!.latestUpdate).toBeNull();
  });
});

describe("projects.board", () => {
  const launched = (iso: string) => ({ launchedAt: new Date(iso) });

  test("lists a challenge's launched projects, newest launch first, with when they launched", async () => {
    const { projects, challenge, make } = await setup();
    await make({ name: "Luni", ...launched("2026-11-09T10:00:00Z") });
    await make({ name: "Miercuri", ...launched("2026-11-11T05:00:00Z") });
    await make({ name: "Marți", ...launched("2026-11-03T10:00:00Z") });
    await make({ name: "WIP", stage: "in_progress" });

    const rows = await projects.board({
      scope: { challengeId: challenge.id },
      stage: "launched",
      sort: "newest",
    });

    expect(rows.map((p) => p.name)).toEqual(["Miercuri", "Luni", "Marți"]);
    expect(rows[0]!.at).toEqual(new Date("2026-11-11T05:00:00Z"));
  });

  test("sorts by votes, newest first on a tie", async () => {
    const { db, projects, challenge, make } = await setup();
    const a = await make({ name: "A", ...launched("2026-11-02T10:00:00Z") });
    const b = await make({ name: "B", ...launched("2026-11-03T10:00:00Z") });
    const c = await make({ name: "C", ...launched("2026-11-04T10:00:00Z") });
    await vote(db, a.id, 2);
    await vote(db, b.id, 1);
    await vote(db, c.id, 2);

    const rows = await projects.board({
      scope: { challengeId: challenge.id },
      stage: "launched",
      sort: "votes",
    });

    expect(rows.map((p) => p.name)).toEqual(["C", "A", "B"]);
  });

  test("lists projects in progress on their own, by their latest change (rule 5)", async () => {
    const { db, projects, challenge, make } = await setup();
    await make({ name: "Lansat", ...launched("2026-11-10T10:00:00Z") });
    const old = await make({
      name: "Vechi",
      stage: "in_progress",
      createdAt: new Date("2026-11-02T10:00:00Z"),
    });
    await make({
      name: "Nou",
      stage: "in_progress",
      createdAt: new Date("2026-11-05T10:00:00Z"),
    });
    await addUpdate(db, old.id, 2, new Date("2026-11-10T08:00:00Z"));

    const rows = await projects.board({
      scope: { challengeId: challenge.id },
      stage: "in_progress",
      sort: "newest",
    });

    expect(rows.map((p) => [p.name, p.at])).toEqual([
      ["Vechi", new Date("2026-11-10T08:00:00Z")],
      ["Nou", new Date("2026-11-05T10:00:00Z")],
    ]);
  });

  test("filters by tool", async () => {
    const { projects, challenge, make } = await setup();
    await make({ name: "Cu Claude", tools: ["Next.js", "Claude"] });
    await make({ name: "Fără", tools: ["Cursor"] });

    const rows = await projects.board({
      scope: { challengeId: challenge.id },
      stage: "launched",
      sort: "newest",
      tool: "Claude",
    });

    expect(rows.map((p) => p.name)).toEqual(["Cu Claude"]);
  });

  test("spans every challenge, or lists only the projects outside any", async () => {
    const { db, projects, make } = await setup();
    const other = await makeChallenge(db, { slug: "alta" });
    await make({ name: "Aici", ...launched("2026-11-03T10:00:00Z") });
    await make({
      name: "Acolo",
      challengeId: other.id,
      ...launched("2026-11-02T10:00:00Z"),
    });
    await make({
      name: "Propriu",
      challengeId: null,
      ...launched("2026-11-01T10:00:00Z"),
    });

    const all = await projects.board({
      scope: "challenges",
      stage: "launched",
      sort: "newest",
    });
    const own = await projects.board({
      scope: "own",
      stage: "launched",
      sort: "newest",
    });

    expect(all.map((p) => p.name)).toEqual(["Aici", "Acolo"]);
    expect(own.map((p) => p.name)).toEqual(["Propriu"]);
  });

  test("closes the vote on projects of a challenge past its deadline, not on others (rule 3)", async () => {
    const { db, projects, make } = await setup();
    const ended = await makeChallenge(db, {
      slug: "octombrie",
      startsAt: new Date("2026-09-30T21:00:00Z"),
      endsAt: new Date("2026-10-31T21:59:00Z"),
    });
    await make({ name: "Acum", ...launched("2026-11-03T10:00:00Z") });
    await make({
      name: "Încheiat",
      challengeId: ended.id,
      ...launched("2026-10-20T10:00:00Z"),
    });
    await make({
      name: "Propriu",
      challengeId: null,
      ...launched("2026-10-01T10:00:00Z"),
    });

    const all = await projects.board({
      scope: "challenges",
      stage: "launched",
      sort: "newest",
    });
    const own = await projects.board({
      scope: "own",
      stage: "launched",
      sort: "newest",
    });

    expect([...all, ...own].map((p) => [p.name, p.votingOpen])).toEqual([
      ["Acum", true],
      ["Încheiat", false],
      ["Propriu", true],
    ]);
  });

  test("marks the viewer's votes, and none for a signed-out visitor (rule 12)", async () => {
    const { db, projects, challenge, make } = await setup();
    const project = await make();
    const viewer = await makeUser(db);
    await db.insert(votes).values({ userId: viewer.id, projectId: project.id });
    const opts = {
      scope: { challengeId: challenge.id },
      stage: "launched",
      sort: "newest",
    } as const;

    const [mine] = await projects.board({ ...opts, viewerId: viewer.id });
    const [anon] = await projects.board(opts);

    expect(mine!.voted).toBe(true);
    expect(anon!.voted).toBe(false);
  });

  test("hides agent-built projects when the caller asks", async () => {
    const { db, projects, challenge, make } = await setup();
    const agent = await makeUser(db, { isAgent: true });
    await make({ name: "Om" });
    await makeProject(db, {
      name: "Agent",
      ownerId: agent.id,
      challengeId: challenge.id,
    });
    const opts = {
      scope: { challengeId: challenge.id },
      stage: "launched",
      sort: "newest",
    } as const;

    const hidden = await projects.board({ ...opts, agents: false });

    expect(hidden.map((p) => p.name)).toEqual(["Om"]);
    expect(await projects.board(opts)).toHaveLength(2);
  });
});

describe("projects.bySlug", () => {
  test("returns everything the project page shows", async () => {
    const { db, projects, challenge, owner, make } = await setup();
    const project = await make({
      slug: "tuns-la-fix",
      tools: ["Next.js", "Claude"],
      screenshots: ["a.webp", "b.webp"],
      description: "Primul paragraf.\n\nAl doilea.",
      buildDuration: "10_30h",
      buildDurationText: "Cam 20 de ore.",
      buildHardestPart: "Orele suprapuse.",
      launchedAt: new Date("2026-11-10T17:00:00Z"),
    });
    await make({ name: "Alt proiect lansat" });
    await make({ name: "În lucru", stage: "in_progress" });
    await addUpdate(db, project.id, 1, new Date("2026-11-04T10:00:00Z"));
    await addUpdate(db, project.id, 2, new Date("2026-11-07T10:00:00Z"));
    await vote(db, project.id, 2);

    const page = await projects.bySlug("tuns-la-fix");

    expect(page).toMatchObject({
      id: project.id,
      thumbnail: "a.webp",
      screenshots: ["a.webp", "b.webp"],
      description: ["Primul paragraf.", "Al doilea."],
      build: {
        duration: "10_30h",
        durationText: "Cam 20 de ore.",
        hardestPart: "Orele suprapuse.",
        prompt: null,
      },
      votes: 2,
      votingOpen: true,
      challenge: { slug: challenge.slug, number: challenge.number },
      owner: { id: owner.id, launched: 2 },
    });
    expect(page!.updates.map((u) => u.version)).toEqual([2, 1]);
  });

  test("returns null for an unknown slug", async () => {
    const { projects } = await setup();
    expect(await projects.bySlug("nu-exista")).toBeNull();
  });

  test("has no challenge for a project of its own", async () => {
    const { projects, make } = await setup();
    await make({ slug: "propriu", challengeId: null });
    expect((await projects.bySlug("propriu"))!.challenge).toBeNull();
  });

  test("says whether the viewer voted (rule 10); a visitor never has (rule 12)", async () => {
    const { db, projects, make } = await setup();
    const project = await make({ slug: "votat" });
    const viewer = await makeUser(db);
    await db.insert(votes).values({ userId: viewer.id, projectId: project.id });

    expect((await projects.bySlug("votat", viewer.id))!.voted).toBe(true);
    expect((await projects.bySlug("votat", null))!.voted).toBe(false);
  });

  test("closes voting once the challenge has ended (rule 3)", async () => {
    const { db, projects, owner } = await setup();
    const ended = await makeChallenge(db, {
      slug: "octombrie",
      startsAt: new Date("2026-09-30T21:00:00Z"),
      endsAt: new Date("2026-10-31T21:59:00Z"),
    });
    await makeProject(db, {
      ownerId: owner.id,
      challengeId: ended.id,
      slug: "vechi",
    });
    expect((await projects.bySlug("vechi"))!.votingOpen).toBe(false);
  });
});
