import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { projects } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { createCannedLinkChecker, type LinkCheck } from "../link-checker";
import { makeChallenge, makeProject, makeUser } from "../test-data";
import { createLinkChecks } from "./index";
import { afterCheck, nextCheckAt, shownCheck } from "./rules";

// Wednesday 11 November 2026, 07:35 in Bucharest: the design fixtures' moment.
const NOW = new Date("2026-11-11T05:35:00Z");
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);
const DEAD = "https://mort.example";
const LIVE = "https://merge.example";

async function setup() {
  const db = await createTestDb();
  let at = NOW;
  const answers: Record<string, LinkCheck> = {
    [LIVE]: { ok: true },
    "https://cont.example": { ok: false, reason: "needs_account" },
  };
  const linkChecker = createCannedLinkChecker(answers);
  const linkChecks = createLinkChecks({ db, now: () => at, linkChecker });
  const owner = await makeUser(db, { handle: "ioana-muresan" });
  const running = await makeChallenge(db, { slug: "frizerie" });
  const ended = await makeChallenge(db, {
    slug: "cafenea",
    startsAt: new Date("2026-09-30T21:00:00Z"),
    endsAt: new Date("2026-10-31T21:59:00Z"),
  });
  const project = (fields: Partial<typeof projects.$inferInsert> = {}) =>
    makeProject(db, { ownerId: owner.id, challengeId: running.id, ...fields });
  const state = async (id: string) => {
    const [row] = await db
      .select({
        checkedAt: projects.linkCheckedAt,
        ok: projects.linkOk,
        failedAt: projects.linkFailedAt,
      })
      .from(projects)
      .where(eq(projects.id, id));
    return row!;
  };
  return {
    db,
    linkChecks,
    linkChecker,
    answers,
    running,
    ended,
    project,
    state,
    setNow: (d: Date) => (at = d),
  };
}

describe("link checks: when a link is due", () => {
  test("a project never checked is due at once, launched or in progress", async () => {
    const { linkChecks, project } = await setup();
    const launched = await project({ liveUrl: LIVE });
    const inProgress = await project({ liveUrl: DEAD, stage: "in_progress" });
    const due = await linkChecks.due();
    expect(due.map((d) => d.projectId).sort()).toEqual(
      [launched.id, inProgress.id].sort(),
    );
    expect(due.find((d) => d.projectId === launched.id)?.url).toBe(LIVE);
  });

  test("a link that opens waits 6 hours, or a day once its challenge has ended", async () => {
    const { linkChecks, project, ended } = await setup();
    const fresh = await project({ linkCheckedAt: ago(5), linkOk: true });
    const stale = await project({ linkCheckedAt: ago(6), linkOk: true });
    const old = await project({
      challengeId: ended.id,
      linkCheckedAt: ago(23),
      linkOk: true,
    });
    const own = await project({
      challengeId: null,
      linkCheckedAt: ago(7),
      linkOk: true,
    });
    const ids = (await linkChecks.due()).map((d) => d.projectId);
    expect(ids).toContain(stale.id);
    expect(ids).toContain(own.id);
    expect(ids).not.toContain(fresh.id);
    expect(ids).not.toContain(old.id);
  });

  test("a first failure, or a link that doesn't open, is tried again after an hour", async () => {
    const { linkChecks, project, ended } = await setup();
    const pending = await project({
      linkCheckedAt: ago(3),
      linkOk: true,
      linkFailedAt: ago(1),
    });
    const waiting = await project({
      linkCheckedAt: ago(3),
      linkOk: true,
      linkFailedAt: ago(0.5),
    });
    const failing = await project({ linkCheckedAt: ago(1), linkOk: false });
    const failingEnded = await project({
      challengeId: ended.id,
      linkCheckedAt: ago(2),
      linkOk: false,
    });
    const ids = (await linkChecks.due()).map((d) => d.projectId);
    expect(ids).toContain(pending.id);
    expect(ids).toContain(failing.id);
    expect(ids).not.toContain(waiting.id);
    expect(ids).not.toContain(failingEnded.id);
  });

  test("hands out at most a batch, the longest waiting first", async () => {
    const db = await createTestDb();
    const owner = await makeUser(db);
    const linkChecks = createLinkChecks({
      db,
      now: () => NOW,
      config: {
        every: 6 * HOUR,
        endedEvery: 24 * HOUR,
        retryAfter: HOUR,
        batch: 2,
      },
    });
    await makeProject(db, {
      ownerId: owner.id,
      linkCheckedAt: ago(7),
      linkOk: true,
    });
    const b = await makeProject(db, {
      ownerId: owner.id,
      linkCheckedAt: ago(9),
      linkOk: true,
    });
    const never = await makeProject(db, { ownerId: owner.id });
    expect((await linkChecks.due()).map((d) => d.projectId)).toEqual([
      never.id,
      b.id,
    ]);
  });
});

describe("link checks: what a result means", () => {
  test("a link that opens shows at once, with the time", async () => {
    const { linkChecks, project, state } = await setup();
    const p = await project({ liveUrl: LIVE });
    expect(await linkChecks.check({ projectId: p.id, url: LIVE })).toBe(
      "opened",
    );
    expect(await state(p.id)).toEqual({
      checkedAt: NOW,
      ok: true,
      failedAt: null,
    });
  });

  test("one failure doesn't show; a second in a row does", async () => {
    const { linkChecks, project, state, setNow } = await setup();
    const p = await project({
      liveUrl: DEAD,
      linkCheckedAt: ago(6),
      linkOk: true,
    });
    expect(await linkChecks.check({ projectId: p.id, url: DEAD })).toBe(
      "failed_once",
    );
    expect(await state(p.id)).toEqual({
      checkedAt: ago(6),
      ok: true,
      failedAt: NOW,
    });
    const later = new Date(NOW.getTime() + HOUR);
    setNow(later);
    expect(await linkChecks.check({ projectId: p.id, url: DEAD })).toBe(
      "failing",
    );
    expect(await state(p.id)).toEqual({
      checkedAt: later,
      ok: false,
      failedAt: null,
    });
  });

  test("a failure followed by an answer clears it", async () => {
    const { linkChecks, project, state, answers } = await setup();
    const url = "https://intermitent.example";
    const p = await project({
      liveUrl: url,
      linkCheckedAt: ago(6),
      linkOk: true,
      linkFailedAt: ago(1),
    });
    answers[url] = { ok: true };
    expect(await linkChecks.check({ projectId: p.id, url })).toBe("opened");
    expect(await state(p.id)).toEqual({
      checkedAt: NOW,
      ok: true,
      failedAt: null,
    });
  });

  test("a link that asks for an account counts as a failure", async () => {
    const { linkChecks, project, state } = await setup();
    const url = "https://cont.example";
    const p = await project({
      liveUrl: url,
      linkCheckedAt: ago(1),
      linkOk: false,
    });
    expect(await linkChecks.check({ projectId: p.id, url })).toBe("failing");
    expect((await state(p.id)).ok).toBe(false);
  });

  test("an answer for a link that has since changed is dropped", async () => {
    const { db, linkChecks, project, state } = await setup();
    const p = await project({
      liveUrl: DEAD,
      linkCheckedAt: ago(1),
      linkOk: false,
    });
    await db
      .update(projects)
      .set({ liveUrl: LIVE })
      .where(eq(projects.id, p.id));
    expect(await linkChecks.check({ projectId: p.id, url: DEAD })).toBe(
      "stale",
    );
    expect(await state(p.id)).toEqual({
      checkedAt: ago(1),
      ok: false,
      failedAt: null,
    });
  });

  test("without a checker wired in, nothing answers (fails closed)", async () => {
    const db = await createTestDb();
    const owner = await makeUser(db);
    const p = await makeProject(db, {
      ownerId: owner.id,
      linkCheckedAt: ago(9),
      linkOk: false,
    });
    const linkChecks = createLinkChecks({ db, now: () => NOW });
    expect(await linkChecks.check({ projectId: p.id, url: p.liveUrl })).toBe(
      "failing",
    );
  });
});

describe("link checks: the rules alone", () => {
  test("shows nothing before the first confirmed check", () => {
    expect(shownCheck({ checkedAt: null, ok: null, failedAt: NOW })).toBeNull();
    expect(shownCheck({ checkedAt: NOW, ok: false, failedAt: null })).toEqual({
      checkedAt: NOW,
      ok: false,
    });
  });

  test("a project never checked fails twice before it shows", () => {
    const first = afterCheck(
      { checkedAt: null, ok: null, failedAt: null },
      false,
      NOW,
    );
    expect(shownCheck(first)).toBeNull();
    expect(nextCheckAt(first, false)).toEqual(new Date(NOW.getTime() + HOUR));
    const second = afterCheck(first, false, new Date(NOW.getTime() + HOUR));
    expect(shownCheck(second)?.ok).toBe(false);
  });
});
