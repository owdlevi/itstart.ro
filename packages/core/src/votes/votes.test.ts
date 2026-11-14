import { describe, expect, test } from "vitest";
import { challenges, projects, users } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { addExtra } from "../test-data";
import { createVotes, type VotesConfig } from "./index";

const DAY = 86_400_000;
// 23:59 Europe/Bucharest (UTC+2 in November) on 30 November 2026.
const DEADLINE = new Date("2026-11-30T21:59:00Z");

async function setup(config?: VotesConfig) {
  const db = await createTestDb();
  let now = new Date("2026-11-20T12:00:00Z");
  const votes = createVotes({ db, now: () => now, config });

  const [challenge] = await db
    .insert(challenges)
    .values({
      number: 1,
      slug: "noiembrie",
      title: "Noiembrie",
      startsAt: new Date("2026-10-31T22:00:00Z"),
      endsAt: DEADLINE,
    })
    .returning();
  const makeUser = async (
    fields: { isAgent?: boolean; createdAt?: Date } = {},
  ) => {
    const [row] = await db
      .insert(users)
      .values({
        name: "u",
        email: `${crypto.randomUUID()}@test.invalid`,
        createdAt: new Date(now.getTime() - 3 * DAY),
        ...fields,
      })
      .returning();
    return row!;
  };
  const makeProject = async (
    ownerId: string,
    fields: {
      stage?: "in_progress" | "launched";
      challengeId?: string | null;
    } = {},
  ) => {
    const [row] = await db
      .insert(projects)
      .values({
        ownerId,
        slug: crypto.randomUUID(),
        challengeId: challenge!.id,
        name: "p",
        pitch: "p",
        liveUrl: "https://p.example",
        stage: "launched",
        ...fields,
      })
      .returning();
    return row!;
  };

  const owner = await makeUser();
  const voter = await makeUser();
  const project = await makeProject(owner.id);

  return {
    db,
    votes,
    owner,
    voter,
    project,
    makeUser,
    makeProject,
    setNow: (d: Date) => (now = d),
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

describe("votes.toggle", () => {
  test("first toggle casts the vote, second removes it (rule 10)", async () => {
    const { votes, voter, project } = await setup();

    expect(await votes.toggle(voter.id, project.id)).toEqual({
      ok: true,
      voted: true,
      count: 1,
    });
    expect(await votes.toggle(voter.id, project.id)).toEqual({
      ok: true,
      voted: false,
      count: 0,
    });
  });

  test("count includes every user's vote", async () => {
    const { votes, voter, project, makeUser } = await setup();
    const other = await makeUser();

    await votes.toggle(other.id, project.id);
    expect(await votes.toggle(voter.id, project.id)).toEqual({
      ok: true,
      voted: true,
      count: 2,
    });
  });

  test("count includes the design fixtures' extra votes", async () => {
    const { db, votes, voter, project } = await setup();
    await addExtra(db, project.id, "votes", 127);

    expect(await votes.toggle(voter.id, project.id)).toMatchObject({
      count: 128,
    });
    expect(await votes.toggle(voter.id, project.id)).toMatchObject({
      count: 127,
    });
  });

  test("refuses a vote on your own project (rule 11)", async () => {
    const { votes, owner, project } = await setup();

    expect(await votes.toggle(owner.id, project.id)).toEqual({
      ok: false,
      reason: "own",
    });
  });

  test("refuses a vote on an in-progress project (rule 5)", async () => {
    const { votes, owner, voter, makeProject } = await setup();
    const draft = await makeProject(owner.id, { stage: "in_progress" });

    expect(await votes.toggle(voter.id, draft.id)).toEqual({
      ok: false,
      reason: "in_progress",
    });
  });

  test("closes voting after the challenge deadline and keeps the count (rule 3)", async () => {
    const { votes, voter, project, setNow, makeUser } = await setup();
    await votes.toggle(voter.id, project.id);

    setNow(new Date(DEADLINE.getTime() + 1));

    expect(await votes.toggle(voter.id, project.id)).toEqual({
      ok: false,
      reason: "closed",
    });
    const late = await makeUser();
    expect(await votes.toggle(late.id, project.id)).toEqual({
      ok: false,
      reason: "closed",
    });
  });

  test("a project outside any challenge never closes", async () => {
    const { votes, owner, voter, makeProject, setNow } = await setup();
    const own = await makeProject(owner.id, { challengeId: null });

    setNow(new Date(DEADLINE.getTime() + 365 * DAY));

    expect(await votes.toggle(voter.id, own.id)).toMatchObject({
      ok: true,
      voted: true,
    });
  });

  test("agents never vote, but agent projects receive votes (rule 13)", async () => {
    const { votes, voter, project, makeUser, makeProject } = await setup();
    const agent = await makeUser({ isAgent: true });
    const agentProject = await makeProject(agent.id);

    expect(await votes.toggle(agent.id, project.id)).toEqual({
      ok: false,
      reason: "agent",
    });
    expect(await votes.toggle(voter.id, agentProject.id)).toMatchObject({
      ok: true,
      voted: true,
    });
  });

  test("an account must be 24 hours old to vote (rule 14)", async () => {
    const { votes, project, makeUser, advance } = await setup();
    const fresh = await makeUser({
      createdAt: new Date("2026-11-20T00:00:00Z"),
    });

    expect(await votes.toggle(fresh.id, project.id)).toEqual({
      ok: false,
      reason: "account_too_new",
    });
    advance(12 * 3_600_000);
    expect(await votes.toggle(fresh.id, project.id)).toMatchObject({
      ok: true,
      voted: true,
    });
  });

  test("rate-limits toggles per user, including retractions (rule 14)", async () => {
    const { votes, voter, project, advance } = await setup({
      minAccountAgeHours: 24,
      rateLimit: { max: 3, windowMinutes: 10 },
    });

    await votes.toggle(voter.id, project.id);
    await votes.toggle(voter.id, project.id);
    await votes.toggle(voter.id, project.id);
    expect(await votes.toggle(voter.id, project.id)).toEqual({
      ok: false,
      reason: "rate_limited",
    });

    advance(10 * 60_000 + 1);
    expect(await votes.toggle(voter.id, project.id)).toEqual({
      ok: true,
      voted: false,
      count: 0,
    });
  });

  test("an unknown project is not_found", async () => {
    const { votes, voter } = await setup();

    expect(await votes.toggle(voter.id, crypto.randomUUID())).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
