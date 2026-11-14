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

async function setup() {
  const db = await createTestDb();
  const projects = createProjects({ db });
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
