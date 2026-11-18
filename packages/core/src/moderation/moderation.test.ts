import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { recognitions, reports, reviewAssignments } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { createCore } from "../index";
import { assignOnLaunch } from "../reviews/assignments";
import {
  ask,
  makeChallenge,
  makeProject,
  makeUser,
  review,
  vote,
} from "../test-data";
import { REPORT_LIMITS } from "./rules";

const NOW = new Date("2026-11-11T05:35:00Z");
const DAY = 86_400_000;

async function setup() {
  const db = await createTestDb();
  let now = NOW;
  const core = createCore({ db, now: () => now });
  const challenge = await makeChallenge(db);
  const long = new Date("2026-09-01T00:00:00Z");
  const owner = await makeUser(db, {
    name: "Ioana Mureșan",
    handle: "ioana",
    createdAt: long,
  });
  const reporter = await makeUser(db, {
    name: "Andrei Popescu",
    handle: "andrei",
    createdAt: long,
  });
  const admin = await makeUser(db, { name: "Echipa", role: "admin" });
  const project = await makeProject(db, {
    ownerId: owner.id,
    challengeId: challenge.id,
    launchedAt: new Date("2026-11-10T10:00:00Z"),
  });
  return {
    db,
    core,
    challenge,
    owner,
    reporter,
    admin,
    project,
    at: (date: Date) => (now = date),
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;

const reportIt = (
  s: Setup,
  fields: Partial<{
    reporterId: string;
    projectId: string;
    details: string;
  }> = {},
) =>
  s.core.moderation.report({
    reporterId: s.reporter.id,
    projectId: s.project.id,
    reason: "link",
    details: "",
    ...fields,
  });

const hide = async (
  s: Setup,
  kind: "project" | "review" | "question" | "answer",
  id: string,
  hidden = true,
) => {
  const result = await s.core.moderation.setHidden(
    s.admin.id,
    { kind, id },
    hidden,
  );
  expect(result).toEqual({ ok: true });
};

describe("moderation.report", () => {
  test("a signed-in person reports a project; it waits in the admins' queue", async () => {
    const s = await setup();
    expect(await reportIt(s, { details: "Duce la altă pagină." })).toEqual({
      ok: true,
    });
    const queue = await s.core.moderation.queue(s.admin.id);
    expect(queue.ok && queue.value).toMatchObject([
      {
        project: {
          slug: s.project.slug,
          hidden: false,
          owner: { handle: "ioana" },
        },
        reports: [
          {
            reason: "link",
            details: "Duce la altă pagină.",
            reporter: { handle: "andrei" },
          },
        ],
      },
    ]);
  });

  test("refuses the owner, agents and a hidden or unknown project", async () => {
    const s = await setup();
    expect(await reportIt(s, { reporterId: s.owner.id })).toEqual({
      ok: false,
      reason: "own",
    });
    const agent = await makeUser(s.db, { isAgent: true });
    expect(await reportIt(s, { reporterId: agent.id })).toEqual({
      ok: false,
      reason: "agent",
    });
    expect(await reportIt(s, { projectId: crypto.randomUUID() })).toEqual({
      ok: false,
      reason: "not_found",
    });
    await hide(s, "project", s.project.id);
    expect(await reportIt(s)).toEqual({ ok: false, reason: "not_found" });
  });

  test('"other" needs a few words, and details have a limit', async () => {
    const s = await setup();
    expect(
      await s.core.moderation.report({
        reporterId: s.reporter.id,
        projectId: s.project.id,
        reason: "other",
        details: "  ",
      }),
    ).toEqual({ ok: false, reason: "details_empty" });
    expect(
      await reportIt(s, { details: "x".repeat(REPORT_LIMITS.details + 1) }),
    ).toEqual({ ok: false, reason: "too_long" });
  });

  test("one open report per person and project; another once it's resolved", async () => {
    const s = await setup();
    await reportIt(s);
    expect(await reportIt(s)).toEqual({ ok: false, reason: "already" });
    expect(await s.core.moderation.resolve(s.admin.id, s.project.id)).toEqual({
      ok: true,
      resolved: 1,
    });
    expect(await reportIt(s)).toEqual({ ok: true });
  });

  test(`at most ${REPORT_LIMITS.perHour} reports an hour per person, counted from their rows`, async () => {
    const s = await setup();
    for (let i = 0; i < REPORT_LIMITS.perHour; i++) {
      const p = await makeProject(s.db, { ownerId: s.owner.id });
      expect(await reportIt(s, { projectId: p.id })).toEqual({ ok: true });
    }
    expect(await reportIt(s)).toEqual({ ok: false, reason: "rate_limited" });
    s.at(new Date(NOW.getTime() + 61 * 60_000));
    expect(await reportIt(s)).toEqual({ ok: true });
  });
});

describe("moderation, admins only", () => {
  test("every admin method refuses anyone else, read from the database", async () => {
    const s = await setup();
    const m = s.core.moderation;
    const refused = { ok: false, reason: "not_admin" };
    expect(await m.queue(s.reporter.id)).toEqual(refused);
    expect(await m.recent(s.reporter.id)).toEqual(refused);
    expect(await m.hiddenItems(s.reporter.id)).toEqual(refused);
    expect(
      await m.setHidden(
        s.reporter.id,
        { kind: "project", id: s.project.id },
        true,
      ),
    ).toEqual(refused);
    expect(await m.resolve(s.reporter.id, s.project.id)).toEqual(refused);
    expect(
      await m.setHidden(
        s.admin.id,
        { kind: "review", id: crypto.randomUUID() },
        true,
      ),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  test("hiding a project resolves its open reports; resolving alone leaves it shown", async () => {
    const s = await setup();
    await reportIt(s);
    expect(await s.core.moderation.resolve(s.admin.id, s.project.id)).toEqual({
      ok: true,
      resolved: 1,
    });
    expect(await s.core.projects.bySlug(s.project.slug)).not.toBeNull();

    const other = await makeUser(s.db);
    await reportIt(s, { reporterId: other.id });
    await hide(s, "project", s.project.id);
    const [row] = await s.db
      .select()
      .from(reports)
      .where(eq(reports.reporterId, other.id));
    expect(row?.resolvedBy).toBe(s.admin.id);
    const queue = await s.core.moderation.queue(s.admin.id);
    expect(queue.ok && queue.value).toEqual([]);
  });

  test("the recent feed has every kind, hidden ones marked; the hidden list has only hidden ones", async () => {
    const s = await setup();
    const r = await review(s.db, s.project.id, {
      isAutomated: true,
      createdAt: new Date(NOW.getTime() - 3000),
    });
    const q = await ask(s.db, s.challenge.id, {
      createdAt: new Date(NOW.getTime() - 2000),
    });
    const answer = await s.core.questions.answer({
      authorId: (await makeUser(s.db, { onboardedAt: NOW })).id,
      questionId: q.id,
      body: "Așa.",
    });
    if (!answer.ok) throw new Error(answer.reason);
    await hide(s, "review", r.id);

    const recent = await s.core.moderation.recent(s.admin.id);
    expect(
      recent.ok && recent.value.map((i) => [i.kind, i.hidden, i.isAutomated]),
    ).toEqual([
      ["answer", false, false],
      ["question", false, false],
      ["review", true, true],
    ]);

    await hide(s, "project", s.project.id);
    const hidden = await s.core.moderation.hiddenItems(s.admin.id);
    expect(hidden.ok && hidden.value.map((i) => i.kind).sort()).toEqual([
      "project",
      "review",
    ]);

    await hide(s, "review", r.id, false);
    const after = await s.core.moderation.hiddenItems(s.admin.id);
    expect(after.ok && after.value.map((i) => i.kind)).toEqual(["project"]);
  });
});

describe("a hidden project", () => {
  test("is a 404 to visitors and other people, and its owner and admins still see it", async () => {
    const s = await setup();
    await hide(s, "project", s.project.id);
    expect(await s.core.projects.bySlug(s.project.slug)).toBeNull();
    expect(
      await s.core.projects.bySlug(s.project.slug, s.reporter.id),
    ).toBeNull();
    expect(
      await s.core.projects.bySlug(s.project.slug, s.owner.id),
    ).toMatchObject({ hidden: true });
    expect(
      await s.core.projects.bySlug(s.project.slug, s.admin.id),
    ).toMatchObject({ hidden: true });

    await hide(s, "project", s.project.id, false);
    expect(await s.core.projects.bySlug(s.project.slug)).toMatchObject({
      hidden: false,
    });
  });

  test("leaves every list and count: the board, the challenge, the profile (§4)", async () => {
    const s = await setup();
    const kept = await makeProject(s.db, {
      ownerId: s.owner.id,
      challengeId: s.challenge.id,
      launchedAt: new Date("2026-11-09T10:00:00Z"),
    });
    await makeProject(s.db, {
      ownerId: s.owner.id,
      challengeId: s.challenge.id,
      stage: "in_progress",
    });
    await vote(s.db, s.project.id, 3);
    await vote(s.db, kept.id, 1);
    const hiddenDraft = await makeProject(s.db, {
      ownerId: s.owner.id,
      challengeId: s.challenge.id,
      stage: "in_progress",
    });
    await hide(s, "project", s.project.id);
    await hide(s, "project", hiddenDraft.id);

    const opts = { challengeId: s.challenge.id, limit: 10 };
    expect((await s.core.projects.mostVoted(opts)).map((p) => p.id)).toEqual([
      kept.id,
    ]);
    expect(await s.core.projects.inProgress(opts)).toHaveLength(1);
    expect(
      (await s.core.projects.launchedIn({ challengeId: s.challenge.id })).map(
        (p) => p.id,
      ),
    ).toEqual([kept.id]);
    const board = await s.core.projects.board({
      scope: "challenges",
      stage: "launched",
      sort: "votes",
    });
    expect(board.map((p) => p.id)).toEqual([kept.id]);

    const challenge = await s.core.challenges.bySlug(s.challenge.slug);
    expect(challenge?.counts).toMatchObject({
      launched: 1,
      inProgress: 1,
      launchers: 1,
    });

    const profile = await s.core.profiles.byHandle("ioana");
    expect(profile?.projects.map((p) => p.id)).toEqual([kept.id]);
    expect(profile?.stats).toMatchObject({ launched: 1, votes: 1 });
    expect((await s.core.projects.bySlug(kept.slug))?.owner.launched).toBe(1);
  });

  test("takes no votes and no reviews", async () => {
    const s = await setup();
    await hide(s, "project", s.project.id);
    expect(await s.core.votes.toggle(s.reporter.id, s.project.id)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(
      await s.core.reviews.post({
        authorId: s.reporter.id,
        projectId: s.project.id,
        body: "Merge.",
      }),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  test("is left out of the link checker's due links", async () => {
    const s = await setup();
    expect((await s.core.linkChecks.due()).map((l) => l.projectId)).toEqual([
      s.project.id,
    ]);
    await hide(s, "project", s.project.id);
    expect(await s.core.linkChecks.due()).toEqual([]);
  });

  test("leaves the recognitions: not a candidate, not shown, not a jury pick (screens 11 and 12)", async () => {
    const s = await setup();
    await s.db.insert(recognitions).values({
      challengeId: s.challenge.id,
      kind: "jury",
      projectId: s.project.id,
      reason: "Simplu.",
    });
    s.at(new Date("2026-12-02T10:00:00Z"));
    expect((await s.core.recognitions.juryPicks([s.challenge.id])).size).toBe(
      1,
    );

    await hide(s, "project", s.project.id);
    const editor = await s.core.recognitions.editor(
      s.admin.id,
      s.challenge.slug,
    );
    expect(editor.ok && editor.value.candidates).toEqual([]);
    const results = await s.core.recognitions.results({
      challengeId: s.challenge.id,
    });
    expect(results.recognitions).toEqual([]);
    expect((await s.core.recognitions.juryPicks([s.challenge.id])).size).toBe(
      0,
    );
  });

  test("is never given as a review assignment, nor given one (rule 16)", async () => {
    const s = await setup();
    const kept = await makeProject(s.db, {
      ownerId: s.owner.id,
      challengeId: s.challenge.id,
    });
    await hide(s, "project", s.project.id);
    const builder = await makeUser(s.db);
    const launch = await makeProject(s.db, {
      ownerId: builder.id,
      challengeId: s.challenge.id,
    });
    await s.db.transaction((tx) =>
      assignOnLaunch(tx, {
        projectId: launch.id,
        ownerId: builder.id,
        challengeId: s.challenge.id,
        at: NOW,
      }),
    );
    const given = await s.db
      .select()
      .from(reviewAssignments)
      .where(eq(reviewAssignments.reviewerId, builder.id));
    expect(given.map((g) => g.projectId)).toEqual([kept.id]);

    // A hidden launch isn't handed to builders still short of two.
    const late = await makeProject(s.db, {
      ownerId: (await makeUser(s.db)).id,
      challengeId: s.challenge.id,
      hidden: true,
    });
    await s.db.transaction((tx) =>
      assignOnLaunch(tx, {
        projectId: late.id,
        ownerId: late.ownerId,
        challengeId: s.challenge.id,
        at: NOW,
      }),
    );
    const toLate = await s.db
      .select()
      .from(reviewAssignments)
      .where(eq(reviewAssignments.projectId, late.id));
    expect(toLate).toEqual([]);
  });
});

describe("a hidden review, question or answer", () => {
  test("a hidden review takes its replies with it, from the thread and every count (rule 17)", async () => {
    const s = await setup();
    const top = await review(s.db, s.project.id, {
      createdAt: new Date(NOW.getTime() - DAY),
    });
    await review(s.db, s.project.id, { parentId: top.id });
    await review(s.db, s.project.id);
    expect((await s.core.reviews.thread(s.project.id)).humanCount).toBe(3);

    await hide(s, "review", top.id);
    const thread = await s.core.reviews.thread(s.project.id);
    expect(thread.reviews).toHaveLength(1);
    expect(thread).toMatchObject({ humanCount: 1, total: 1 });
    const [row] = await s.core.projects.mostVoted({
      challengeId: s.challenge.id,
      limit: 1,
    });
    expect(row?.reviews).toBe(1);
  });

  test("an admin can hide an automated review (§12)", async () => {
    const s = await setup();
    const automated = await review(s.db, s.project.id, { isAutomated: true });
    expect((await s.core.reviews.thread(s.project.id)).total).toBe(1);
    await hide(s, "review", automated.id);
    expect(await s.core.reviews.thread(s.project.id)).toMatchObject({
      reviews: [],
      total: 0,
    });
  });

  test("a hidden question leaves the list and its count; a hidden answer leaves its question's", async () => {
    const s = await setup();
    const q = await ask(s.db, s.challenge.id);
    const other = await ask(s.db, s.challenge.id);
    const author = await makeUser(s.db, { onboardedAt: NOW });
    const answer = await s.core.questions.answer({
      authorId: author.id,
      questionId: other.id,
      body: "Așa.",
    });
    if (!answer.ok) throw new Error(answer.reason);

    await hide(s, "question", q.id);
    await hide(s, "answer", answer.id);
    const list = await s.core.questions.list(s.challenge.id);
    expect(list.total).toBe(1);
    expect(list.questions.map((r) => [r.slug, r.answerCount])).toEqual([
      [other.slug, 0],
    ]);
    expect(await s.core.questions.bySlug(s.challenge.id, q.slug)).toBeNull();
  });
});
