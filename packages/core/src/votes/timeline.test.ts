import { describe, expect, test } from "vitest";
import { voteEvents } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { makeProject, makeUser } from "../test-data";
import { createVotes } from "./index";
import { burstFlags } from "./timeline";

const NOW = new Date("2026-11-20T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

async function setup() {
  const db = await createTestDb();
  const votes = createVotes({ db, now: () => NOW });
  const admin = await makeUser(db, { role: "admin", handle: "echipa" });
  const owner = await makeUser(db, { name: "Ioana", handle: "ioana" });
  const project = await makeProject(db, {
    ownerId: owner.id,
    slug: "tuns-la-fix",
    name: "Tuns la Fix",
  });
  const other = await makeProject(db, {
    ownerId: owner.id,
    slug: "la-fix",
    name: "La Fix",
  });
  const voter = (handle: string, createdAt: Date) =>
    makeUser(db, { handle, name: handle, createdAt });
  const toggle = (
    userId: string,
    projectId: string,
    at: Date,
    action: "cast" | "retract" = "cast",
  ) => db.insert(voteEvents).values({ userId, projectId, action, at });
  return { db, votes, admin, owner, project, other, voter, toggle };
}

describe("burstFlags", () => {
  const at = (minutes: number[]) =>
    minutes.map((m) => new Date(NOW.getTime() + m * MINUTE));

  test("marks five toggles within ten minutes, and nothing sparser", () => {
    expect(burstFlags(at([0, 2, 4, 6, 8, 30]))).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(burstFlags(at([0, 3, 6, 9, 12, 15]))).toEqual(Array(6).fill(false));
    expect(burstFlags([])).toEqual([]);
  });
});

describe("timeline (rule 14: admins can see vote timelines)", () => {
  test("refuses anyone but an admin", async () => {
    const { votes, owner } = await setup();
    expect(await votes.timeline(owner.id, { project: "tuns-la-fix" })).toEqual({
      ok: false,
      reason: "not_admin",
    });
    expect(await votes.activity(owner.id)).toEqual({
      ok: false,
      reason: "not_admin",
    });
  });

  test("lists a project's toggles newest first, with a summary", async () => {
    const { votes, admin, project, other, voter, toggle } = await setup();
    const ana = await voter("ana", ago(90 * DAY));
    const dan = await voter("dan", ago(90 * DAY));
    await toggle(ana.id, project.id, ago(3 * HOUR));
    await toggle(dan.id, project.id, ago(2 * HOUR));
    await toggle(ana.id, project.id, ago(HOUR), "retract");
    await toggle(ana.id, other.id, ago(HOUR));

    const result = await votes.timeline(admin.id, { project: "tuns-la-fix" });
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.subject).toEqual({
      kind: "project",
      slug: "tuns-la-fix",
      name: "Tuns la Fix",
      owner: { handle: "ioana", name: "Ioana" },
    });
    expect(result.value.summary).toEqual({
      toggles: 3,
      casts: 2,
      retracts: 1,
      distinct: 2,
      fromNewAccounts: 0,
    });
    expect(result.value.events.map((e) => [e.voter.handle, e.action])).toEqual([
      ["ana", "retract"],
      ["dan", "cast"],
      ["ana", "cast"],
    ]);
  });

  test("lists a user's toggles across projects", async () => {
    const { votes, admin, project, other, voter, toggle } = await setup();
    const ana = await voter("ana", ago(90 * DAY));
    await toggle(ana.id, project.id, ago(2 * HOUR));
    await toggle(ana.id, other.id, ago(HOUR));

    const result = await votes.timeline(admin.id, { user: "ana" });
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.subject).toMatchObject({ kind: "user", handle: "ana" });
    expect(result.value.summary.distinct).toBe(2);
    expect(result.value.events.map((e) => e.project.slug)).toEqual([
      "la-fix",
      "tuns-la-fix",
    ]);
  });

  test("marks toggles from accounts under a week old, by their age then", async () => {
    const { votes, admin, project, voter, toggle } = await setup();
    // Two days old when voting, though more than a week old now.
    const old = await voter("veche", ago(30 * DAY));
    const fresh = await voter("noua", ago(10 * DAY));
    await toggle(old.id, project.id, ago(20 * DAY));
    await toggle(fresh.id, project.id, ago(8 * DAY));

    const result = await votes.timeline(admin.id, { project: "tuns-la-fix" });
    if (!result.ok) throw new Error(result.reason);
    expect(
      result.value.events.map((e) => [
        e.voter.handle,
        e.accountAgeHours,
        e.newAccount,
      ]),
    ).toEqual([
      ["noua", 48, true],
      ["veche", 240, false],
    ]);
    expect(result.value.summary.fromNewAccounts).toBe(1);
  });

  test("marks bursts: five or more toggles within ten minutes", async () => {
    const { votes, admin, project, voter, toggle } = await setup();
    for (let i = 0; i < 5; i++) {
      const v = await voter(`v${i}`, ago(90 * DAY));
      await toggle(v.id, project.id, ago(HOUR - i * MINUTE));
    }
    const late = await voter("tarziu", ago(90 * DAY));
    await toggle(late.id, project.id, ago(10 * MINUTE));

    const result = await votes.timeline(admin.id, { project: "tuns-la-fix" });
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.events.map((e) => e.burst)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  test("answers not_found for an unknown project or handle", async () => {
    const { votes, admin } = await setup();
    expect(await votes.timeline(admin.id, { project: "nimic" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await votes.timeline(admin.id, { user: "nimeni" })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("activity", () => {
  test("ranks projects and voters by toggles in the last day, then the week", async () => {
    const { votes, admin, project, other, voter, toggle } = await setup();
    const ana = await voter("ana", ago(90 * DAY));
    const nou = await voter("nou", ago(2 * DAY));
    // La Fix: busy over the week. Tuns la Fix: busier today.
    for (let i = 0; i < 3; i++)
      await toggle(ana.id, other.id, ago((i + 2) * DAY));
    await toggle(ana.id, project.id, ago(HOUR));
    await toggle(nou.id, project.id, ago(2 * HOUR));
    // Older than a week: left out.
    await toggle(ana.id, other.id, ago(9 * DAY));

    const result = await votes.activity(admin.id);
    if (!result.ok) throw new Error(result.reason);
    expect(
      result.value.projects.map((p) => [
        p.slug,
        p.lastDay,
        p.lastWeek,
        p.voters,
        p.fromNewAccounts,
      ]),
    ).toEqual([
      ["tuns-la-fix", 2, 2, 2, 1],
      ["la-fix", 0, 3, 1, 0],
    ]);
    expect(
      result.value.voters.map((v) => [v.handle, v.lastDay, v.lastWeek]),
    ).toEqual([
      ["ana", 1, 4],
      ["nou", 1, 1],
    ]);
  });
});
