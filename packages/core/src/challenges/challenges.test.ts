import { describe, expect, test } from "vitest";
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
    });
  });
});
