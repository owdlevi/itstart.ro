import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { projects } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import {
  addExtra,
  join,
  makeChallenge,
  makeProject,
  makeUser,
} from "../test-data";
import { challengeStatus, createChallenges } from "./index";

const OCTOBER = {
  startsAt: new Date("2026-09-30T21:00:00Z"),
  endsAt: new Date("2026-10-31T21:59:00Z"),
};
const NOVEMBER = {
  startsAt: new Date("2026-10-31T22:00:00Z"),
  endsAt: new Date("2026-11-30T21:59:00Z"),
};
const DECEMBER = {
  startsAt: new Date("2026-11-30T22:00:00Z"),
  endsAt: new Date("2026-12-31T21:59:00Z"),
};

async function setup(at: string) {
  const db = await createTestDb();
  const challenges = createChallenges({ db, now: () => new Date(at) });
  return { db, challenges };
}

describe("challengeStatus", () => {
  test("upcoming before the start, running until the deadline, ended after it (rule 1)", () => {
    expect(challengeStatus(NOVEMBER, new Date("2026-10-31T21:59:59Z"))).toBe(
      "upcoming",
    );
    expect(challengeStatus(NOVEMBER, NOVEMBER.startsAt)).toBe("running");
    expect(challengeStatus(NOVEMBER, NOVEMBER.endsAt)).toBe("running");
    expect(challengeStatus(NOVEMBER, new Date("2026-11-30T21:59:01Z"))).toBe(
      "ended",
    );
  });
});

describe("challenges.running", () => {
  test("is the one challenge whose month contains now (rule 1)", async () => {
    const { db, challenges } = await setup("2026-11-11T05:35:00Z");
    await makeChallenge(db, { slug: "octombrie", ...OCTOBER });
    await makeChallenge(db, { slug: "noiembrie", ...NOVEMBER });
    await makeChallenge(db, { slug: "decembrie", ...DECEMBER });

    const running = await challenges.running();

    expect(running?.slug).toBe("noiembrie");
    expect(running?.endsAt).toEqual(NOVEMBER.endsAt);
  });

  test("runs until 23:59 Bucharest on the deadline, then none is running (rule 1)", async () => {
    const atDeadline = await setup("2026-11-30T21:59:00Z");
    await makeChallenge(atDeadline.db, NOVEMBER);
    expect(await atDeadline.challenges.running()).not.toBeNull();

    const after = await setup("2026-11-30T21:59:30Z");
    await makeChallenge(after.db, NOVEMBER);
    expect(await after.challenges.running()).toBeNull();
  });

  test("counts people and agents in the challenge, without those who left (rule 2)", async () => {
    const { db, challenges } = await setup("2026-11-11T05:35:00Z");
    const november = await makeChallenge(db, NOVEMBER);
    const october = await makeChallenge(db, OCTOBER);
    for (let i = 0; i < 3; i++) {
      await join(db, (await makeUser(db)).id, november.id);
    }
    await join(db, (await makeUser(db)).id, november.id, new Date());
    await join(db, (await makeUser(db, { isAgent: true })).id, november.id);
    await join(db, (await makeUser(db)).id, october.id);

    const running = await challenges.running();

    expect(running?.counts).toMatchObject({ participants: 3, agents: 1 });
  });

  test("counts launched and in-progress projects of this challenge only", async () => {
    const { db, challenges } = await setup("2026-11-11T05:35:00Z");
    const november = await makeChallenge(db, NOVEMBER);
    const october = await makeChallenge(db, OCTOBER);
    const owner = await makeUser(db);
    await makeProject(db, { ownerId: owner.id, challengeId: november.id });
    await makeProject(db, { ownerId: owner.id, challengeId: november.id });
    await makeProject(db, {
      ownerId: owner.id,
      challengeId: november.id,
      stage: "in_progress",
    });
    await makeProject(db, { ownerId: owner.id, challengeId: october.id });
    await makeProject(db, { ownerId: owner.id, challengeId: null });

    const running = await challenges.running();

    expect(running?.counts).toMatchObject({ launched: 2, inProgress: 1 });
  });

  test("adds the design fixtures' extra counts to the rows", async () => {
    const { db, challenges } = await setup("2026-11-11T05:35:00Z");
    const november = await makeChallenge(db, NOVEMBER);
    await join(db, (await makeUser(db)).id, november.id);
    await addExtra(db, november.id, "participants", 85);
    await addExtra(db, november.id, "launched", 25);

    const running = await challenges.running();

    expect(running?.counts).toEqual({
      participants: 86,
      agents: 0,
      launched: 25,
      inProgress: 0,
      launchers: 0,
    });
  });
});

describe("challenges.bySlug", () => {
  test("returns the challenge with its brief, whether or not it's running", async () => {
    const { db, challenges } = await setup("2026-11-11T05:35:00Z");
    await makeChallenge(db, {
      slug: "frizerie",
      scenario: "Nea Gică are o frizerie.",
      baseLevel: ["Clientul alege ora."],
      tips: [{ title: "Lansează devreme", text: "Pune-l pe panou." }],
      ...NOVEMBER,
    });
    await makeChallenge(db, { slug: "cafenea", ...OCTOBER });

    const challenge = await challenges.bySlug("frizerie");

    expect(challenge).toMatchObject({
      slug: "frizerie",
      scenario: "Nea Gică are o frizerie.",
      baseLevel: ["Clientul alege ora."],
      tips: [{ title: "Lansează devreme", text: "Pune-l pe panou." }],
    });
    expect((await challenges.bySlug("cafenea"))?.slug).toBe("cafenea");
    expect(await challenges.bySlug("nu-exista")).toBeNull();
  });

  test("is running until its deadline, and votes are accepted (rule 1)", async () => {
    const { db, challenges } = await setup("2026-11-30T21:59:00Z");
    await makeChallenge(db, { slug: "frizerie", ...NOVEMBER });

    expect(await challenges.bySlug("frizerie")).toMatchObject({
      status: "running",
      votingOpen: true,
    });
  });

  test("has ended after its deadline, and voting is closed (rule 3)", async () => {
    const { db, challenges } = await setup("2026-11-11T05:35:00Z");
    await makeChallenge(db, { slug: "cafenea", ...OCTOBER });

    expect(await challenges.bySlug("cafenea")).toMatchObject({
      status: "ended",
      votingOpen: false,
    });
  });

  test("counts the people who launched, once each and without agents", async () => {
    const { db, challenges } = await setup("2026-11-11T05:35:00Z");
    const november = await makeChallenge(db, { slug: "frizerie", ...NOVEMBER });
    const ana = await makeUser(db);
    const agent = await makeUser(db, { isAgent: true });
    const bogdan = await makeUser(db);
    await makeProject(db, { ownerId: ana.id, challengeId: november.id });
    await makeProject(db, { ownerId: ana.id, challengeId: november.id });
    await makeProject(db, { ownerId: agent.id, challengeId: november.id });
    await makeProject(db, {
      ownerId: bogdan.id,
      challengeId: november.id,
      stage: "in_progress",
    });
    await addExtra(db, november.id, "launchers", 22);

    const challenge = await challenges.bySlug("frizerie");

    expect(challenge?.counts).toMatchObject({ launched: 3, launchers: 23 });
  });
});

describe("challenges.participants", () => {
  const minute = (n: number) =>
    new Date(NOVEMBER.startsAt.getTime() + n * 60_000);

  test("lists people earliest-joined first, without those who left (rule 2) or agents", async () => {
    const { db, challenges } = await setup("2026-11-11T05:35:00Z");
    const november = await makeChallenge(db, NOVEMBER);
    const people = {
      ioana: await makeUser(db, { name: "Ioana Mureșan" }),
      andrei: await makeUser(db, { name: "Andrei Popescu" }),
      reka: await makeUser(db, { name: "Kovács Réka", givenName: "Réka" }),
      left: await makeUser(db, { name: "Dan Plecat" }),
      agent: await makeUser(db, { name: "Agent Claude", isAgent: true }),
    };
    await join(db, people.reka.id, november.id, null, minute(3));
    await join(db, people.ioana.id, november.id, null, minute(1));
    await join(db, people.andrei.id, november.id, null, minute(2));
    await join(db, people.left.id, november.id, minute(5), minute(0));
    await join(db, people.agent.id, november.id, null, minute(0));

    const list = await challenges.participants({
      challengeId: november.id,
      limit: 8,
    });

    expect(list.map((p) => p.givenName)).toEqual(["Ioana", "Andrei", "Réka"]);
  });

  test("always includes the viewer when they're in it, in join order, and stops at the limit", async () => {
    const { db, challenges } = await setup("2026-11-11T05:35:00Z");
    const november = await makeChallenge(db, NOVEMBER);
    const ioana = await makeUser(db, { name: "Ioana Mureșan" });
    const andrei = await makeUser(db, { name: "Andrei Popescu" });
    const bianca = await makeUser(db, { name: "Bianca Radu" });
    await join(db, ioana.id, november.id, null, minute(1));
    await join(db, andrei.id, november.id, null, minute(2));
    await join(db, bianca.id, november.id, null, minute(9));

    const list = await challenges.participants({
      challengeId: november.id,
      limit: 2,
      viewerId: bianca.id,
    });

    expect(list.map((p) => p.givenName)).toEqual(["Ioana", "Bianca"]);
  });
});

describe("challenges.join", () => {
  const at = "2026-11-11T05:35:00Z";

  test("joins in one action and counts them as a participant (rule 2)", async () => {
    const { db, challenges } = await setup(at);
    const november = await makeChallenge(db, NOVEMBER);
    const bianca = await makeUser(db, { onboardedAt: new Date(at) });

    const result = await challenges.join(bianca.id, november.slug);

    expect(result).toEqual({ ok: true, slug: november.slug });
    expect(await challenges.participation(november.id, bianca.id)).toEqual({
      joinedAt: new Date(at),
    });
    expect((await challenges.bySlug(november.slug))?.counts.participants).toBe(
      1,
    );
  });

  test("joining twice keeps one participation and the first join time (rule 2)", async () => {
    const { db, challenges } = await setup(at);
    const november = await makeChallenge(db, NOVEMBER);
    const bianca = await makeUser(db, { onboardedAt: new Date(at) });
    const earlier = new Date("2026-11-02T10:00:00Z");
    await join(db, bianca.id, november.id, null, earlier);

    expect(await challenges.join(bianca.id, november.slug)).toMatchObject({
      ok: true,
    });

    expect(await challenges.participation(november.id, bianca.id)).toEqual({
      joinedAt: earlier,
    });
    expect((await challenges.bySlug(november.slug))?.counts.participants).toBe(
      1,
    );
  });

  test("a join after leaving rejoins, from now (rule 2)", async () => {
    const { db, challenges } = await setup(at);
    const november = await makeChallenge(db, NOVEMBER);
    const bianca = await makeUser(db, { onboardedAt: new Date(at) });
    await join(
      db,
      bianca.id,
      november.id,
      new Date("2026-11-05T10:00:00Z"),
      new Date("2026-11-02T10:00:00Z"),
    );

    expect(await challenges.join(bianca.id, november.slug)).toMatchObject({
      ok: true,
    });

    expect(await challenges.participation(november.id, bianca.id)).toEqual({
      joinedAt: new Date(at),
    });
  });

  test("an upcoming challenge can be joined ahead of its start (rule 1)", async () => {
    const { db, challenges } = await setup(at);
    const december = await makeChallenge(db, DECEMBER);
    const bianca = await makeUser(db, { onboardedAt: new Date(at) });

    expect(await challenges.join(bianca.id, december.slug)).toMatchObject({
      ok: true,
    });
  });

  test("refuses an ended challenge (rules 1 and 3)", async () => {
    const { db, challenges } = await setup(at);
    const october = await makeChallenge(db, OCTOBER);
    const bianca = await makeUser(db, { onboardedAt: new Date(at) });

    expect(await challenges.join(bianca.id, october.slug)).toEqual({
      ok: false,
      reason: "ended",
    });
    expect(await challenges.participation(october.id, bianca.id)).toBeNull();
  });

  test("refuses someone who hasn't finished onboarding, so the list never shows a nameless participant (rule 2)", async () => {
    const { db, challenges } = await setup(at);
    const november = await makeChallenge(db, NOVEMBER);
    const newcomer = await makeUser(db, { name: "", onboardedAt: null });

    expect(await challenges.join(newcomer.id, november.slug)).toEqual({
      ok: false,
      reason: "not_onboarded",
    });
  });

  test("refuses an unknown challenge", async () => {
    const { db, challenges } = await setup(at);
    const bianca = await makeUser(db, { onboardedAt: new Date(at) });

    expect(await challenges.join(bianca.id, "nu-exista")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("challenges.leave", () => {
  const at = "2026-11-11T05:35:00Z";

  test("removes them from the participant list and the count, and keeps their projects (rule 2)", async () => {
    const { db, challenges } = await setup(at);
    const november = await makeChallenge(db, NOVEMBER);
    const bianca = await makeUser(db, { name: "Bianca Radu" });
    const ioana = await makeUser(db, { name: "Ioana Mureșan" });
    await join(db, bianca.id, november.id);
    await join(db, ioana.id, november.id);
    const project = await makeProject(db, {
      ownerId: bianca.id,
      challengeId: november.id,
      stage: "in_progress",
    });

    expect(await challenges.leave(bianca.id, november.slug)).toEqual({
      ok: true,
      slug: november.slug,
    });

    expect(await challenges.participation(november.id, bianca.id)).toBeNull();
    const list = await challenges.participants({
      challengeId: november.id,
      limit: 8,
      viewerId: bianca.id,
    });
    expect(list.map((p) => p.givenName)).toEqual(["Ioana"]);
    const after = await challenges.bySlug(november.slug);
    expect(after?.counts.participants).toBe(1);
    expect(after?.counts.inProgress).toBe(1);
    const [kept] = await db
      .select({ challengeId: projects.challengeId })
      .from(projects)
      .where(eq(projects.id, project.id));
    expect(kept?.challengeId).toBe(november.id);
  });

  test("refuses someone who isn't in the challenge (rule 2)", async () => {
    const { db, challenges } = await setup(at);
    const november = await makeChallenge(db, NOVEMBER);
    const bianca = await makeUser(db);
    await join(db, bianca.id, november.id, new Date("2026-11-05T10:00:00Z"));

    expect(await challenges.leave(bianca.id, november.slug)).toEqual({
      ok: false,
      reason: "not_joined",
    });
  });

  test("refuses after the deadline: the list is the month's record by then (rule 3)", async () => {
    const { db, challenges } = await setup(at);
    const october = await makeChallenge(db, OCTOBER);
    const bianca = await makeUser(db);
    await join(db, bianca.id, october.id);

    expect(await challenges.leave(bianca.id, october.slug)).toEqual({
      ok: false,
      reason: "ended",
    });
    expect(await challenges.participation(october.id, bianca.id)).not.toBeNull();
  });
});

describe("challenges.steps", () => {
  const at = "2026-11-11T05:35:00Z";

  test("ticks off posting a link and launching from the participant's own projects in the challenge (rules 4 and 5)", async () => {
    const { db, challenges } = await setup(at);
    const november = await makeChallenge(db, NOVEMBER);
    const october = await makeChallenge(db, OCTOBER);
    const bianca = await makeUser(db);
    const ioana = await makeUser(db);

    expect(await challenges.steps(november.id, bianca.id)).toEqual({
      posted: false,
      launched: false,
    });

    // Someone else's launch, and her own in another month, don't count.
    await makeProject(db, { ownerId: ioana.id, challengeId: november.id });
    await makeProject(db, { ownerId: bianca.id, challengeId: october.id });
    expect(await challenges.steps(november.id, bianca.id)).toEqual({
      posted: false,
      launched: false,
    });

    await makeProject(db, {
      ownerId: bianca.id,
      challengeId: november.id,
      stage: "in_progress",
    });
    expect(await challenges.steps(november.id, bianca.id)).toEqual({
      posted: true,
      launched: false,
    });

    await makeProject(db, { ownerId: bianca.id, challengeId: november.id });
    expect(await challenges.steps(november.id, bianca.id)).toEqual({
      posted: true,
      launched: true,
    });
  });
});

describe("challenges.started", () => {
  test("lists the challenges that have started, newest first, with their short title", async () => {
    const { db, challenges } = await setup("2026-11-11T05:35:00Z");
    await makeChallenge(db, {
      ...OCTOBER,
      number: 103,
      slug: "cafenea",
      title: "Meniu digital pentru o cafenea",
      shortTitle: "Cafenea",
    });
    await makeChallenge(db, {
      ...NOVEMBER,
      number: 104,
      slug: "frizerie",
      title: "Pagină pentru o frizerie",
    });
    await makeChallenge(db, { ...DECEMBER, number: 105, slug: "decembrie" });

    const list = await challenges.started();

    expect(list.map((c) => [c.number, c.slug, c.shortTitle, c.status])).toEqual(
      [
        [104, "frizerie", "Pagină pentru o frizerie", "running"],
        [103, "cafenea", "Cafenea", "ended"],
      ],
    );
  });
});
