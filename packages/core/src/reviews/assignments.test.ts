import { asc, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { projects as projectRows, reviewAssignments, votes } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { createCannedLinkChecker } from "../link-checker";
import { createProjects, type ProjectInput } from "../projects";
import { createPrefixStorage } from "../storage";
import {
  addExtra,
  makeChallenge,
  makeProject,
  makeUser,
  review,
} from "../test-data";
import { createReviews } from "./index";

// Wednesday 11 November 2026, 07:35 in Bucharest: the design fixtures' moment.
const NOW = new Date("2026-11-11T05:35:00Z");
const LIVE = "https://lansat.example";
const day = (n: number) => new Date(`2026-11-0${n}T10:00:00Z`);

async function setup() {
  const db = await createTestDb();
  let at = NOW;
  const projects = createProjects({
    db,
    now: () => at,
    linkChecker: createCannedLinkChecker({ [LIVE]: { ok: true } }),
    storage: createPrefixStorage("https://storage.test/"),
  });
  const reviews = createReviews({ db, now: () => at });
  const challenge = await makeChallenge(db, { slug: "frizerie" });
  const builder = await makeUser(db, {
    name: "Ioana Mureșan",
    onboardedAt: new Date("2026-09-01T10:00:00Z"),
  });
  /** Someone else's launched project in the challenge. */
  const launched = async (
    fields: Partial<typeof projectRows.$inferInsert> = {},
  ) => {
    const owner = await makeUser(db, { onboardedAt: day(1) });
    return makeProject(db, {
      ownerId: owner.id,
      challengeId: challenge.id,
      launchedAt: day(5),
      ...fields,
    });
  };
  /** Projects assigned to someone, in the order the page shows them. */
  const assignedTo = async (reviewerId: string) =>
    (
      await db
        .select({ projectId: reviewAssignments.projectId })
        .from(reviewAssignments)
        .innerJoin(projectRows, eq(projectRows.id, reviewAssignments.projectId))
        .where(eq(reviewAssignments.reviewerId, reviewerId))
        .orderBy(asc(reviewAssignments.createdAt), asc(projectRows.launchedAt))
    ).map((a) => a.projectId);
  const setNow = (next: Date) => {
    at = next;
  };
  return {
    db,
    projects,
    reviews,
    challenge,
    builder,
    launched,
    assignedTo,
    setNow,
  };
}

const complete = (
  fields: Partial<ProjectInput> = {},
): ProjectInput & { update: null } => ({
  challengeSlug: "frizerie",
  name: "Tuns la Fix",
  pitch: "Programări online pentru frizeria din cartier, fără telefoane.",
  liveUrl: LIVE,
  screenshots: ["https://storage.test/1.webp", "https://storage.test/2.webp"],
  description: "Alegi tunsoarea și ora.",
  tools: ["Next.js"],
  build: { duration: "10_30h", hardestPart: "Programările.", prompt: null },
  stage: "launched",
  update: null,
  ...fields,
});

describe("review assignments on launch", () => {
  test("gives the builder the two launched projects with the fewest human reviews (rule 16)", async () => {
    const { db, projects, builder, launched, assignedTo } = await setup();
    const many = await launched();
    const few = await launched();
    const none = await launched();
    for (let i = 0; i < 3; i++) await review(db, many.id);
    await review(db, few.id);
    // Automated reviews don't count (rule 17).
    await review(db, none.id, { isAutomated: true });
    await review(db, none.id, { isAutomated: true });

    await projects.create(builder.id, complete());

    expect((await assignedTo(builder.id)).sort()).toEqual(
      [none.id, few.id].sort(),
    );
  });

  test("breaks a tie by the oldest launch, and counts the fixture extras like the rows show (rule 16)", async () => {
    const { db, projects, builder, launched, assignedTo } = await setup();
    const newer = await launched({ launchedAt: day(7) });
    const older = await launched({ launchedAt: day(3) });
    const shownMore = await launched({ launchedAt: day(2) });
    await addExtra(db, shownMore.id, "reviews", 4);

    await projects.create(builder.id, complete());

    expect(await assignedTo(builder.id)).toEqual([older.id, newer.id]);
  });

  test("never assigns their own, an agent's, one in progress, one from another challenge, one they reviewed or already hold (rule 16)", async () => {
    const { db, projects, builder, challenge, launched, assignedTo } =
      await setup();
    const agent = await makeUser(db, { isAgent: true });
    await makeProject(db, {
      ownerId: builder.id,
      challengeId: challenge.id,
      launchedAt: day(2),
    });
    await makeProject(db, {
      ownerId: agent.id,
      challengeId: challenge.id,
      launchedAt: day(2),
    });
    await launched({ stage: "in_progress", launchedAt: null });
    const other = await makeChallenge(db);
    await launched({ challengeId: other.id });
    await launched({ challengeId: null });
    const reviewed = await launched();
    await review(db, reviewed.id, { authorId: builder.id });
    const held = await launched();
    await db
      .insert(reviewAssignments)
      .values({ reviewerId: builder.id, projectId: held.id });
    const eligible = await launched();

    await projects.create(builder.id, complete());

    expect((await assignedTo(builder.id)).sort()).toEqual(
      [held.id, eligible.id].sort(),
    );
  });

  test("assigns what there is, and gives later launches to builders still short of two (rule 16)", async () => {
    const { db, projects, builder, launched, assignedTo } = await setup();
    const first = await launched();

    await projects.create(builder.id, complete());
    expect(await assignedTo(builder.id)).toEqual([first.id]);
    expect(await assignedTo(first.ownerId)).toHaveLength(1);

    const next = await makeUser(db, { onboardedAt: day(1) });
    await projects.create(next.id, complete({ name: "Scaunul 3" }));
    const [nextProject] = await db
      .select()
      .from(projectRows)
      .where(eq(projectRows.ownerId, next.id));

    expect(await assignedTo(builder.id)).toEqual([first.id, nextProject!.id]);
    expect(await assignedTo(first.ownerId)).toHaveLength(2);
    // The newcomer got the two with the fewest reviews.
    expect(await assignedTo(next.id)).toHaveLength(2);
  });

  test("doesn't give a later launch to someone who already reviewed it in progress (rule 16)", async () => {
    const { db, projects, reviews, builder, launched, assignedTo } =
      await setup();
    const first = await launched();
    const wip = await projects.create(
      builder.id,
      complete({ stage: "in_progress" }),
    );
    const [mine] = await db
      .select()
      .from(projectRows)
      .where(eq(projectRows.ownerId, builder.id));
    await reviews.post({
      authorId: first.ownerId,
      projectId: mine!.id,
      body: "Merge.",
    });

    await projects.edit(builder.id, wip.ok ? wip.slug : "", complete());

    expect(await assignedTo(first.ownerId)).toEqual([]);
    expect(await assignedTo(builder.id)).toEqual([first.id]);
  });

  test("gives nothing for a project of its own (rule 16)", async () => {
    const { projects, builder, launched, assignedTo } = await setup();
    await launched();
    await launched();

    await projects.create(builder.id, complete({ challengeSlug: null }));

    expect(await assignedTo(builder.id)).toEqual([]);
  });

  test("gives an agent no assignments, and its launch to nobody (rule 16)", async () => {
    const { db, projects, challenge, launched, assignedTo } = await setup();
    const short = await launched();
    const agent = await makeUser(db, {
      isAgent: true,
      onboardedAt: day(1),
    });
    const agentProject = await makeProject(db, {
      ownerId: agent.id,
      challengeId: challenge.id,
      stage: "in_progress",
      screenshots: [
        "https://storage.test/1.webp",
        "https://storage.test/2.webp",
      ],
    });
    await launched();

    await projects.edit(agent.id, agentProject.slug, complete());

    expect(await assignedTo(agent.id)).toEqual([]);
    expect(await assignedTo(short.ownerId)).toEqual([]);
  });

  test("assigns on a late launch too (rules 7 and 16)", async () => {
    const { projects, builder, challenge, launched, assignedTo, setNow } =
      await setup();
    const other = await launched();
    const wip = await projects.create(
      builder.id,
      complete({ stage: "in_progress" }),
    );
    setNow(new Date(challenge.endsAt.getTime() + 60_000));

    await projects.edit(builder.id, wip.ok ? wip.slug : "", complete());

    expect(await assignedTo(builder.id)).toEqual([other.id]);
  });

  test("asks for two per builder per challenge, not per launch (rule 16)", async () => {
    const { projects, builder, launched, assignedTo } = await setup();
    await launched();
    await launched();
    await launched();

    await projects.create(builder.id, complete());
    await projects.create(builder.id, complete({ name: "Tuns la Fix 2" }));

    expect(await assignedTo(builder.id)).toHaveLength(2);
  });

  test("assigns nothing for a save in progress or an edit after the launch (rules 6 and 16)", async () => {
    const { projects, builder, launched, assignedTo } = await setup();
    await launched();
    const wip = await projects.create(
      builder.id,
      complete({ stage: "in_progress" }),
    );
    expect(await assignedTo(builder.id)).toEqual([]);

    const slug = wip.ok ? wip.slug : "";
    await projects.edit(builder.id, slug, complete());
    await launched();
    await projects.edit(builder.id, slug, complete({ pitch: "Altă frază." }));

    expect(await assignedTo(builder.id)).toHaveLength(1);
  });
});

describe("projects.launch", () => {
  test("shows the owner their launch with a plain count, and their assignments with what's done (rules 11 and 16)", async () => {
    const { projects, reviews, builder, launched } = await setup();
    await launched({ name: "Scaunul 3" });
    const b = await launched({ name: "La Fix" });
    await projects.create(builder.id, complete());
    await reviews.post({ authorId: builder.id, projectId: b.id, body: "Bun." });

    const result = await projects.launch("tuns-la-fix", builder.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { project, assignments, expected } = result.page;
    expect(project.name).toBe("Tuns la Fix");
    expect(project.votes).toBe(0);
    expect(project.challenge?.slug).toBe("frizerie");
    expect(expected).toBe(2);
    expect(assignments.map((p) => [p.name, p.done]).sort()).toEqual([
      ["La Fix", true],
      ["Scaunul 3", false],
    ]);
    expect(assignments.every((p) => p.votingOpen)).toBe(true);
  });

  test("counts only what the project had at its launch when asked (HANDOVER §9.4)", async () => {
    const { db, projects, builder, setNow } = await setup();
    await projects.create(builder.id, complete());
    const [mine] = await db
      .select()
      .from(projectRows)
      .where(eq(projectRows.ownerId, builder.id));
    setNow(new Date(NOW.getTime() + 3_600_000));
    const voter = await makeUser(db);
    await db.insert(votes).values({
      userId: voter.id,
      projectId: mine!.id,
      createdAt: new Date(NOW.getTime() + 60_000),
    });
    await addExtra(db, mine!.id, "votes", 127);
    await review(db, mine!.id, { createdAt: new Date(NOW.getTime() + 60_000) });

    const now = await projects.launch("tuns-la-fix", builder.id);
    const then = await projects.launch("tuns-la-fix", builder.id, {
      countsAtLaunch: true,
    });

    expect(
      now.ok && [now.page.project.votes, now.page.project.reviews],
    ).toEqual([128, 1]);
    expect(
      then.ok && [then.page.project.votes, then.page.project.reviews],
    ).toEqual([0, 0]);
  });

  test("is only for the owner of a launched project", async () => {
    const { db, projects, builder } = await setup();
    await projects.create(builder.id, complete());
    await projects.create(
      builder.id,
      complete({ name: "Rând la Tuns", stage: "in_progress" }),
    );
    const someone = await makeUser(db);

    expect(await projects.launch("tuns-la-fix", someone.id)).toEqual({
      ok: false,
      reason: "not_owner",
    });
    expect(await projects.launch("rand-la-tuns", builder.id)).toEqual({
      ok: false,
      reason: "not_launched",
    });
    expect(await projects.launch("nimic", builder.id)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  test("asks for no reviews on a project of its own", async () => {
    const { projects, builder, launched } = await setup();
    await launched();
    await projects.create(builder.id, complete({ challengeSlug: null }));

    const result = await projects.launch("tuns-la-fix", builder.id);

    expect(result.ok && result.page).toMatchObject({
      assignments: [],
      expected: 0,
      project: { challenge: null },
    });
  });
});
