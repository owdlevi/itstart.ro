import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { reviewAssignments, reviews as reviewsTable } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import {
  addExtra,
  makeChallenge,
  makeProject,
  makeUser,
  review,
} from "../test-data";
import {
  createReviews,
  defaultReviewsConfig,
  type ReviewsConfig,
} from "./index";

const MINUTE = 60_000;

async function setup(config?: ReviewsConfig) {
  const db = await createTestDb();
  let now = new Date("2026-11-11T05:35:00Z");
  const reviews = createReviews({ db, now: () => now, config });
  const challenge = await makeChallenge(db);
  const owner = await makeUser(db, { name: "Ioana Mureșan" });
  const reader = await makeUser(db, { name: "Andrei Popescu" });
  const project = await makeProject(db, {
    ownerId: owner.id,
    challengeId: challenge.id,
  });
  return {
    db,
    reviews,
    owner,
    reader,
    project,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

describe("reviews.post", () => {
  test("lets any signed-in person review a project (rule 15)", async () => {
    const { reviews, reader, project } = await setup();

    const result = await reviews.post({
      authorId: reader.id,
      projectId: project.id,
      body: "  Merge bine pe telefon.  ",
    });

    expect(result.ok).toBe(true);
    const thread = await reviews.thread(project.id);
    expect(thread.reviews.map((r) => [r.author.id, r.body])).toEqual([
      [reader.id, "Merge bine pe telefon."],
    ]);
  });

  test("allows reviews on a project in progress (rule 5)", async () => {
    const { db, reviews, owner, reader } = await setup();
    const wip = await makeProject(db, {
      ownerId: owner.id,
      stage: "in_progress",
    });

    const result = await reviews.post({
      authorId: reader.id,
      projectId: wip.id,
      body: "Promite.",
    });

    expect(result.ok).toBe(true);
  });

  test("lets the owner reply to a review (rule 15)", async () => {
    const { reviews, owner, reader, project } = await setup();
    const first = await reviews.post({
      authorId: reader.id,
      projectId: project.id,
      body: "Butonul iese din ecran.",
    });
    if (!first.ok) throw new Error(first.reason);

    const reply = await reviews.post({
      authorId: owner.id,
      projectId: project.id,
      parentId: first.id,
      body: "Am reparat.",
    });

    expect(reply.ok).toBe(true);
    const thread = await reviews.thread(project.id);
    expect(thread.reviews[0]!.replies.map((r) => r.body)).toEqual([
      "Am reparat.",
    ]);
  });

  test("refuses a reply from anyone but the owner (rule 15)", async () => {
    const { db, reviews, reader, project } = await setup();
    const parent = await review(db, project.id);

    const result = await reviews.post({
      authorId: reader.id,
      projectId: project.id,
      parentId: parent.id,
      body: "Și eu.",
    });

    expect(result).toEqual({ ok: false, reason: "not_owner" });
  });

  test("refuses a reply to a reply: one level only (rule 15)", async () => {
    const { db, reviews, owner, project } = await setup();
    const parent = await review(db, project.id);
    const reply = await review(db, project.id, { parentId: parent.id });

    const result = await reviews.post({
      authorId: owner.id,
      projectId: project.id,
      parentId: reply.id,
      body: "Mersi.",
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("refuses a reply to a review on another project", async () => {
    const { db, reviews, owner, project } = await setup();
    const other = await makeProject(db, { ownerId: owner.id });
    const parent = await review(db, other.id);

    const result = await reviews.post({
      authorId: owner.id,
      projectId: project.id,
      parentId: parent.id,
      body: "Mersi.",
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("refuses the owner's own top-level review: they reply instead", async () => {
    const { reviews, owner, project } = await setup();

    const result = await reviews.post({
      authorId: owner.id,
      projectId: project.id,
      body: "Al meu e cel mai bun.",
    });

    expect(result).toEqual({ ok: false, reason: "own" });
  });

  test("refuses an agent: automated reviews come from the review agent", async () => {
    const { db, reviews, project } = await setup();
    const agent = await makeUser(db, { isAgent: true });

    const result = await reviews.post({
      authorId: agent.id,
      projectId: project.id,
      body: "Merge.",
    });

    expect(result).toEqual({ ok: false, reason: "agent" });
  });

  test("refuses an empty or too long review", async () => {
    const { reviews, reader, project } = await setup({
      ...defaultReviewsConfig,
      maxLength: 10,
    });
    const post = (body: string) =>
      reviews.post({ authorId: reader.id, projectId: project.id, body });

    expect(await post("   ")).toEqual({ ok: false, reason: "empty" });
    expect(await post("unsprezece!")).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  test("refuses an unknown project", async () => {
    const { reviews, reader } = await setup();

    const result = await reviews.post({
      authorId: reader.id,
      projectId: crypto.randomUUID(),
      body: "Merge.",
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("limits reviews and replies together to 10 an hour per person", async () => {
    const { db, reviews, owner, reader, project, advance } = await setup();
    const other = await makeProject(db, { ownerId: reader.id });
    for (let i = 0; i < 9; i++) {
      const r = await reviews.post({
        authorId: owner.id,
        projectId: other.id,
        body: `Părerea ${i}`,
      });
      expect(r.ok).toBe(true);
    }
    const parent = await review(db, project.id);
    const tenth = await reviews.post({
      authorId: owner.id,
      projectId: project.id,
      parentId: parent.id,
      body: "Mersi.",
    });
    expect(tenth.ok).toBe(true);

    const eleventh = await reviews.post({
      authorId: owner.id,
      projectId: other.id,
      body: "Încă una.",
    });
    expect(eleventh).toEqual({ ok: false, reason: "rate_limited" });

    advance(61 * MINUTE);
    const later = await reviews.post({
      authorId: owner.id,
      projectId: other.id,
      body: "Încă una.",
    });
    expect(later.ok).toBe(true);
  });

  test("marks the reviewer's assignment on that project done (rule 16)", async () => {
    const { db, reviews, reader, project } = await setup();
    await db
      .insert(reviewAssignments)
      .values({ reviewerId: reader.id, projectId: project.id });

    await reviews.post({
      authorId: reader.id,
      projectId: project.id,
      body: "Merge.",
    });

    const [row] = await db
      .select({ doneAt: reviewAssignments.doneAt })
      .from(reviewAssignments)
      .where(eq(reviewAssignments.reviewerId, reader.id));
    expect(row!.doneAt).toEqual(new Date("2026-11-11T05:35:00Z"));
  });
});

describe("reviews.thread", () => {
  test("puts the automated review first, then people's newest first, replies oldest first (rule 18)", async () => {
    const { db, reviews, owner, project } = await setup();
    const at = (iso: string) => new Date(iso);
    const agent = await makeUser(db, { isAgent: true });
    await review(db, project.id, {
      body: "veche",
      createdAt: at("2026-11-10T18:00:00Z"),
    });
    const newer = await review(db, project.id, {
      body: "nouă",
      createdAt: at("2026-11-11T03:35:00Z"),
    });
    await db.insert(reviewsTable).values([
      {
        projectId: project.id,
        authorId: agent.id,
        body: "automată",
        isAutomated: true,
        createdAt: at("2026-11-10T17:06:00Z"),
      },
      {
        projectId: project.id,
        authorId: owner.id,
        parentId: newer.id,
        body: "răspuns 2",
        createdAt: at("2026-11-11T05:00:00Z"),
      },
      {
        projectId: project.id,
        authorId: owner.id,
        parentId: newer.id,
        body: "răspuns 1",
        createdAt: at("2026-11-11T04:35:00Z"),
      },
    ]);

    const thread = await reviews.thread(project.id);

    expect(
      thread.reviews.map((r) => [r.body, r.replies.map((x) => x.body)]),
    ).toEqual([
      ["automată", []],
      ["nouă", ["răspuns 1", "răspuns 2"]],
      ["veche", []],
    ]);
  });

  test("counts human reviews and replies without the automated one (rule 17)", async () => {
    const { db, reviews, project } = await setup();
    const agent = await makeUser(db, { isAgent: true });
    const parent = await review(db, project.id);
    await review(db, project.id, { parentId: parent.id });
    await review(db, project.id, { authorId: agent.id, isAutomated: true });
    await review(db, project.id, { hidden: true });
    await addExtra(db, project.id, "reviews", 5);

    const thread = await reviews.thread(project.id);

    expect(thread.humanCount).toBe(7);
    expect(thread.total).toBe(8);
    expect(thread.reviews).toHaveLength(2);
  });
});
