import { describe, expect, test } from "vitest";
import { votes } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { createProjects } from "../projects";
import {
  addExtra,
  join,
  makeChallenge,
  makeProject,
  makeUser,
  vote,
} from "../test-data";
import { createProfiles, monthsInARow } from "./index";

// Wednesday 11 November 2026, 07:35 in Bucharest: the design fixtures' moment.
const NOW = new Date("2026-11-11T05:35:00Z");

const SEPTEMBER = {
  startsAt: new Date("2026-08-31T21:00:00Z"),
  endsAt: new Date("2026-09-30T20:59:00Z"),
};
const OCTOBER = {
  startsAt: new Date("2026-09-30T21:00:00Z"),
  endsAt: new Date("2026-10-31T21:59:00Z"),
};

async function setup() {
  const db = await createTestDb();
  const now = () => NOW;
  const profiles = createProfiles({
    db,
    now,
    projects: createProjects({ db, now }),
  });
  const user = await makeUser(db, {
    handle: "ioana-muresan",
    name: "Ioana Mureșan",
    email: "ioana@test.invalid",
    city: "Cluj-Napoca",
    bio: "Contabilă.",
    links: ["https://github.com/ioanamuresan"],
    createdAt: new Date("2026-09-03T09:00:00Z"),
  });
  return { db, profiles, user };
}

describe("monthsInARow", () => {
  const at = (iso: string) => new Date(iso);

  test("counts consecutive months back from this month", () => {
    expect(
      monthsInARow(
        [
          at("2026-11-10T17:00:00Z"),
          at("2026-10-20T10:00:00Z"),
          at("2026-09-05T10:00:00Z"),
          at("2026-07-05T10:00:00Z"),
        ],
        NOW,
      ),
    ).toBe(3);
  });

  test("may end last month, before this month's launch", () => {
    expect(
      monthsInARow(
        [at("2026-10-20T10:00:00Z"), at("2026-09-05T10:00:00Z")],
        NOW,
      ),
    ).toBe(2);
  });

  test("is 0 once the last launch is older than last month", () => {
    expect(monthsInARow([at("2026-09-05T10:00:00Z")], NOW)).toBe(0);
    expect(monthsInARow([], NOW)).toBe(0);
  });

  test("counts several launches in a month once", () => {
    expect(
      monthsInARow(
        [at("2026-11-02T10:00:00Z"), at("2026-11-09T10:00:00Z")],
        NOW,
      ),
    ).toBe(1);
  });

  test("reads months in Bucharest", () => {
    // 00:30 on 1 November in Bucharest, still 31 October in UTC.
    expect(monthsInARow([at("2026-10-31T22:30:00Z")], NOW)).toBe(1);
  });
});

describe("profiles.byHandle", () => {
  test("returns the profile, and never the e-mail (rule 23)", async () => {
    const { profiles } = await setup();

    const profile = await profiles.byHandle("ioana-muresan");

    expect(profile).toMatchObject({
      handle: "ioana-muresan",
      name: "Ioana Mureșan",
      city: "Cluj-Napoca",
      bio: "Contabilă.",
      links: ["https://github.com/ioanamuresan"],
      isAgent: false,
      joinedAt: new Date("2026-09-03T09:00:00Z"),
    });
    expect(JSON.stringify(profile)).not.toContain("ioana@test.invalid");
    expect(profile).not.toHaveProperty("email");
  });

  test("returns null for an unknown handle", async () => {
    const { profiles } = await setup();
    expect(await profiles.byHandle("nimeni")).toBeNull();
  });

  test("isn't open to collaborations until they opt in (rule 22)", async () => {
    const { profiles } = await setup();
    const profile = await profiles.byHandle("ioana-muresan");
    expect(profile?.openToWork).toBe(false);
  });

  test("marks an agent's profile (rule 19)", async () => {
    const { db, profiles } = await setup();
    await makeUser(db, {
      handle: "agent-claude",
      name: "Agent Claude",
      isAgent: true,
    });
    const profile = await profiles.byHandle("agent-claude");
    expect(profile?.isAgent).toBe(true);
  });

  test("lists launched projects, newest launch first, with their challenge; not projects in progress", async () => {
    const { db, profiles, user } = await setup();
    const september = await makeChallenge(db, { slug: "sep", ...SEPTEMBER });
    const november = await makeChallenge(db, { slug: "nov" });
    await makeProject(db, {
      ownerId: user.id,
      challengeId: september.id,
      name: "Meșterul Nelu",
      launchedAt: new Date("2026-09-30T20:59:00Z"),
    });
    await makeProject(db, {
      ownerId: user.id,
      challengeId: november.id,
      name: "Tuns la Fix",
      launchedAt: new Date("2026-11-10T17:00:00Z"),
    });
    await makeProject(db, {
      ownerId: user.id,
      name: "Al meu",
      launchedAt: new Date("2026-10-15T10:00:00Z"),
    });
    await makeProject(db, {
      ownerId: user.id,
      challengeId: november.id,
      name: "În lucru",
      stage: "in_progress",
    });

    const profile = await profiles.byHandle("ioana-muresan");

    expect(
      profile?.projects.map((p) => [p.name, p.challenge?.slug ?? null]),
    ).toEqual([
      ["Tuns la Fix", "nov"],
      ["Al meu", null],
      ["Meșterul Nelu", "sep"],
    ]);
  });

  test("closes the vote on a finished challenge's projects (rule 3)", async () => {
    const { db, profiles, user } = await setup();
    const october = await makeChallenge(db, { slug: "oct", ...OCTOBER });
    const november = await makeChallenge(db, { slug: "nov" });
    for (const challenge of [october, november]) {
      await makeProject(db, {
        ownerId: user.id,
        challengeId: challenge.id,
        name: challenge.slug,
        launchedAt: challenge.endsAt,
      });
    }

    const profile = await profiles.byHandle("ioana-muresan");

    expect(profile?.projects.map((p) => [p.name, p.votingOpen])).toEqual([
      ["nov", true],
      ["oct", false],
    ]);
  });

  test("says whether the viewer voted (rule 10); a visitor never has (rule 12)", async () => {
    const { db, profiles, user } = await setup();
    const project = await makeProject(db, { ownerId: user.id });
    const viewer = await makeUser(db);
    await db.insert(votes).values({ userId: viewer.id, projectId: project.id });

    const seen = await profiles.byHandle("ioana-muresan", viewer.id);
    const anonymous = await profiles.byHandle("ioana-muresan");

    expect(seen?.projects[0]?.voted).toBe(true);
    expect(anonymous?.projects[0]?.voted).toBe(false);
  });

  test("counts launches, months in a row and votes received, with the fixtures' extras", async () => {
    const { db, profiles, user } = await setup();
    const september = await makeChallenge(db, { slug: "sep", ...SEPTEMBER });
    const october = await makeChallenge(db, { slug: "oct", ...OCTOBER });
    const november = await makeChallenge(db, { slug: "nov" });
    const launched = [];
    for (const challenge of [september, october, november]) {
      launched.push(
        await makeProject(db, {
          ownerId: user.id,
          challengeId: challenge.id,
          launchedAt: challenge.endsAt < NOW ? challenge.endsAt : NOW,
        }),
      );
    }
    await vote(db, launched[0]!.id, 2);
    await addExtra(db, launched[0]!.id, "votes", 37);
    await addExtra(db, launched[1]!.id, "votes", 74);
    await vote(db, launched[2]!.id, 1);
    await addExtra(db, launched[2]!.id, "votes", 127);

    const profile = await profiles.byHandle("ioana-muresan");

    expect(profile?.stats).toEqual({
      launched: 3,
      monthsInARow: 3,
      votes: 241,
    });
  });

  test("has zero counts and empty lists before the first launch", async () => {
    const { db, profiles, user } = await setup();
    const november = await makeChallenge(db);
    await join(db, user.id, november.id);
    await makeProject(db, {
      ownerId: user.id,
      challengeId: november.id,
      stage: "in_progress",
    });

    const profile = await profiles.byHandle("ioana-muresan");

    expect(profile?.stats).toEqual({ launched: 0, monthsInARow: 0, votes: 0 });
    expect(profile?.projects).toEqual([]);
    expect(profile?.challenges).toEqual([]);
  });

  test("lists the challenges they launched in, running ones too, newest first, with their projects", async () => {
    const { db, profiles, user } = await setup();
    const september = await makeChallenge(db, { slug: "sep", ...SEPTEMBER });
    const october = await makeChallenge(db, { slug: "oct", ...OCTOBER });
    const november = await makeChallenge(db, { slug: "nov" });
    await join(db, user.id, october.id);
    await makeProject(db, {
      ownerId: user.id,
      challengeId: september.id,
      name: "Meșterul Nelu",
      launchedAt: september.endsAt,
    });
    await makeProject(db, {
      ownerId: user.id,
      challengeId: november.id,
      name: "Tuns la Fix",
      launchedAt: new Date("2026-11-10T17:00:00Z"),
    });
    await makeProject(db, {
      ownerId: user.id,
      challengeId: november.id,
      name: "Rând la Tuns",
      launchedAt: new Date("2026-11-08T17:00:00Z"),
    });
    await makeProject(db, { ownerId: user.id, name: "Al meu" });

    const profile = await profiles.byHandle("ioana-muresan");

    expect(
      profile?.challenges.map((c) => [c.slug, c.projects.map((p) => p.name)]),
    ).toEqual([
      ["nov", ["Tuns la Fix", "Rând la Tuns"]],
      ["sep", ["Meșterul Nelu"]],
    ]);
  });
});
