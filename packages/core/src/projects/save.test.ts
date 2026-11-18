import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { participations, projects as projectRows } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { createChallenges } from "../challenges";
import { createCannedLinkChecker } from "../link-checker";
import { createPrefixStorage } from "../storage";
import {
  addUpdate,
  join,
  makeChallenge,
  makeProject,
  makeUser,
} from "../test-data";
import { createProjects, type ProjectInput } from "./index";

// Wednesday 11 November 2026, 07:35 in Bucharest: the design fixtures' moment.
const NOW = new Date("2026-11-11T05:35:00Z");
const LIVE = "https://tunslafix.example";
const shot = (n: number) => `https://storage.test/${n}.webp`;

async function setup() {
  const db = await createTestDb();
  let at = NOW;
  const linkChecker = createCannedLinkChecker({
    [LIVE]: { ok: true },
    "https://alt.example": { ok: true },
    "https://cont.example": { ok: false, reason: "needs_account" },
  });
  const projects = createProjects({
    db,
    now: () => at,
    linkChecker,
    storage: createPrefixStorage("https://storage.test/"),
  });
  const challenges = createChallenges({ db, now: () => at });
  const challenge = await makeChallenge(db, { slug: "frizerie" });
  const owner = await makeUser(db, {
    handle: "ioana-muresan",
    name: "Ioana Mureșan",
    onboardedAt: new Date("2026-09-01T10:00:00Z"),
  });
  const setNow = (next: Date) => {
    at = next;
  };
  return { db, projects, challenges, challenge, owner, linkChecker, setNow };
}

/** "În lucru" with only what rule 4 asks for. */
const minimal = (fields: Partial<ProjectInput> = {}): ProjectInput => ({
  challengeSlug: "frizerie",
  name: "Tuns la Fix",
  pitch: "Programări online pentru frizeria din cartier, fără telefoane.",
  liveUrl: LIVE,
  screenshots: [],
  description: null,
  tools: [],
  build: { duration: null, hardestPart: null, prompt: null },
  stage: "in_progress",
  ...fields,
});

/** Everything "Lansat" needs. */
const complete = (fields: Partial<ProjectInput> = {}): ProjectInput =>
  minimal({
    screenshots: [shot(1), shot(2)],
    description: "Alegi tunsoarea și ora.",
    tools: ["Next.js", "Claude"],
    build: {
      duration: "10_30h",
      hardestPart: "Să nu se suprapună două programări.",
      prompt: null,
    },
    stage: "launched",
    ...fields,
  });

const row = async (db: Awaited<ReturnType<typeof setup>>["db"], slug: string) =>
  (await db.select().from(projectRows).where(eq(projectRows.slug, slug)))[0]!;

describe("projects.create", () => {
  test("saves a project in progress with only a name, pitch and live link (rule 4)", async () => {
    const { db, projects, owner } = await setup();

    const result = await projects.create(owner.id, minimal());

    expect(result).toEqual({
      ok: true,
      slug: "tuns-la-fix",
      stage: "in_progress",
      launched: false,
    });
    const saved = await row(db, "tuns-la-fix");
    expect(saved.stage).toBe("in_progress");
    expect(saved.launchedAt).toBeNull();
  });

  test("refuses to launch without 2 screenshots, a description and a build story, and names what's missing (rule 4)", async () => {
    const { projects, owner } = await setup();

    const result = await projects.create(
      owner.id,
      minimal({ stage: "launched", screenshots: [shot(1)] }),
    );

    expect(result).toEqual({
      ok: false,
      reason: "incomplete",
      missing: ["screenshots", "description", "duration", "hardestPart"],
    });
  });

  test("launches with everything in the launch criteria and sets launchedAt (rules 4 and 6)", async () => {
    const { db, projects, owner } = await setup();

    const result = await projects.create(owner.id, complete());

    expect(result).toMatchObject({
      ok: true,
      stage: "launched",
      launched: true,
    });
    const saved = await row(db, "tuns-la-fix");
    expect(saved.launchedAt).toEqual(NOW);
    expect(saved.isLate).toBe(false);
    expect(saved.tools).toEqual(["Next.js", "Claude"]);
  });

  test("refuses a live link that isn't https, and checks nothing then (rule 9)", async () => {
    const { projects, owner, linkChecker } = await setup();

    for (const liveUrl of [
      "http://tunslafix.example",
      "tunslafix.example",
      "https://user:parola@tunslafix.example",
      "https://localhost",
    ]) {
      expect(await projects.create(owner.id, minimal({ liveUrl }))).toEqual({
        ok: false,
        reason: "link_invalid",
      });
    }
    expect(linkChecker.checked).toEqual([]);
  });

  test("refuses a live link that doesn't answer, or asks for an account (rule 9)", async () => {
    const { projects, owner, linkChecker } = await setup();

    expect(
      await projects.create(
        owner.id,
        minimal({ liveUrl: "https://nu-merge.example" }),
      ),
    ).toEqual({ ok: false, reason: "link_unreachable" });
    expect(
      await projects.create(
        owner.id,
        minimal({ liveUrl: "https://cont.example" }),
      ),
    ).toEqual({ ok: false, reason: "link_needs_account" });
    expect(linkChecker.checked).toEqual([
      "https://nu-merge.example",
      "https://cont.example",
    ]);
  });

  test("keeps HANDOVER §4's limits: name 60, pitch 80", async () => {
    const { projects, owner } = await setup();

    expect(
      await projects.create(owner.id, minimal({ name: "a".repeat(61) })),
    ).toEqual({ ok: false, reason: "name_too_long" });
    expect(
      await projects.create(owner.id, minimal({ pitch: "a".repeat(81) })),
    ).toEqual({ ok: false, reason: "pitch_too_long" });
    expect(await projects.create(owner.id, minimal({ name: "  " }))).toEqual({
      ok: false,
      reason: "name_empty",
    });
    expect(
      await projects.create(owner.id, minimal({ name: "a".repeat(60) })),
    ).toMatchObject({ ok: true });
  });

  test("takes at most 4 screenshots, and only files we stored", async () => {
    const { projects, owner } = await setup();

    expect(
      await projects.create(
        owner.id,
        minimal({ screenshots: [1, 2, 3, 4, 5].map(shot) }),
      ),
    ).toEqual({ ok: false, reason: "too_many_screenshots" });
    expect(
      await projects.create(
        owner.id,
        minimal({ screenshots: ["https://altundeva.example/a.png"] }),
      ),
    ).toEqual({ ok: false, reason: "screenshot_unknown" });
  });

  test("caps a custom tool's length and the number of tools, and keeps each tool once", async () => {
    const { db, projects, owner } = await setup();

    expect(
      await projects.create(owner.id, minimal({ tools: ["a".repeat(31)] })),
    ).toEqual({ ok: false, reason: "tool_too_long" });
    expect(
      await projects.create(
        owner.id,
        minimal({ tools: Array.from({ length: 9 }, (_, i) => `T${i}`) }),
      ),
    ).toEqual({ ok: false, reason: "too_many_tools" });

    await projects.create(
      owner.id,
      minimal({ tools: ["Claude", " Astro  ", "claude", ""] }),
    );
    expect((await row(db, "tuns-la-fix")).tools).toEqual(["Claude", "Astro"]);
  });

  test("makes a unique slug from the name", async () => {
    const { projects, owner } = await setup();

    await projects.create(owner.id, minimal({ name: "Țuică & Cod" }));
    const second = await projects.create(
      owner.id,
      minimal({ name: "Țuică  & Cod!" }),
    );

    expect(second).toMatchObject({ ok: true, slug: "tuica-cod-2" });
  });

  test("puts the builder in the running challenge, back in if they had left (rule 2)", async () => {
    const { db, projects, challenge, owner } = await setup();
    await join(db, owner.id, challenge.id, new Date("2026-11-05T10:00:00Z"));

    await projects.create(owner.id, minimal());

    const [participation] = await db
      .select()
      .from(participations)
      .where(
        and(
          eq(participations.userId, owner.id),
          eq(participations.challengeId, challenge.id),
        ),
      );
    expect(participation).toMatchObject({ leftAt: null, joinedAt: NOW });
  });

  test("takes only the running challenge, or none", async () => {
    const { db, projects, owner } = await setup();
    await makeChallenge(db, {
      slug: "cafenea",
      startsAt: new Date("2026-09-30T21:00:00Z"),
      endsAt: new Date("2026-10-31T21:59:00Z"),
    });

    expect(
      await projects.create(owner.id, minimal({ challengeSlug: "cafenea" })),
    ).toEqual({ ok: false, reason: "challenge_not_running" });
    expect(
      await projects.create(owner.id, minimal({ challengeSlug: "nu-exista" })),
    ).toEqual({ ok: false, reason: "challenge_not_running" });
    const own = await projects.create(
      owner.id,
      minimal({ challengeSlug: null }),
    );
    expect(own).toMatchObject({ ok: true });
    expect((await row(db, "tuns-la-fix")).challengeId).toBeNull();
  });

  test("refuses someone who hasn't finished onboarding", async () => {
    const { db, projects } = await setup();
    const fresh = await makeUser(db, { name: "" });

    expect(await projects.create(fresh.id, minimal())).toEqual({
      ok: false,
      reason: "not_onboarded",
    });
  });
});

describe("projects.edit", () => {
  async function inProgress() {
    const ctx = await setup();
    await ctx.projects.create(ctx.owner.id, minimal());
    return ctx;
  }

  test("refuses anyone but the owner", async () => {
    const { db, projects } = await inProgress();
    const other = await makeUser(db);

    expect(
      await projects.edit(other.id, "tuns-la-fix", {
        ...minimal(),
        update: null,
      }),
    ).toEqual({ ok: false, reason: "not_owner" });
    expect(
      await projects.edit(other.id, "nu-exista", {
        ...minimal(),
        update: null,
      }),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  test("launches a project in progress once it has everything, setting launchedAt once (rule 6)", async () => {
    const { db, projects, owner, setNow } = await inProgress();

    const incomplete = await projects.edit(owner.id, "tuns-la-fix", {
      ...minimal({ stage: "launched" }),
      update: null,
    });
    expect(incomplete).toMatchObject({ ok: false, reason: "incomplete" });

    const launched = await projects.edit(owner.id, "tuns-la-fix", {
      ...complete(),
      update: null,
    });
    expect(launched).toMatchObject({ ok: true, launched: true });

    setNow(new Date("2026-11-12T10:00:00Z"));
    const again = await projects.edit(owner.id, "tuns-la-fix", {
      ...complete({ name: "Tuns la Fix 2" }),
      update: null,
    });
    expect(again).toMatchObject({ ok: true, launched: false });
    const saved = await row(db, "tuns-la-fix");
    expect(saved.launchedAt).toEqual(NOW);
    // The slug stays, so shared links keep working.
    expect(saved.name).toBe("Tuns la Fix 2");
  });

  test("offers no way back to În lucru once launched (rule 6)", async () => {
    const { projects, owner } = await setup();
    await projects.create(owner.id, complete());

    expect(
      await projects.edit(owner.id, "tuns-la-fix", {
        ...complete({ stage: "in_progress" }),
        update: null,
      }),
    ).toEqual({ ok: false, reason: "already_launched" });
  });

  test("allows a launch after the deadline and flags it late (rule 7)", async () => {
    const { db, projects, owner, setNow } = await inProgress();
    setNow(new Date("2026-12-01T08:00:00Z"));

    const result = await projects.edit(owner.id, "tuns-la-fix", {
      ...complete(),
      update: null,
    });

    expect(result).toMatchObject({ ok: true, launched: true });
    const saved = await row(db, "tuns-la-fix");
    expect(saved.isLate).toBe(true);
    expect(saved.stage).toBe("launched");
  });

  test("keeps editing a launched project open, and adds an update as the next version (rule 8)", async () => {
    const { db, projects, owner, setNow } = await setup();
    await projects.create(owner.id, complete());
    const { id } = await row(db, "tuns-la-fix");
    await addUpdate(db, id, 1, new Date("2026-11-10T10:00:00Z"));
    // After the deadline too.
    setNow(new Date("2026-12-03T08:00:00Z"));

    const result = await projects.edit(owner.id, "tuns-la-fix", {
      ...complete({ pitch: "Altă frază." }),
      update: "  Am reparat butonul pe ecrane mici. ",
    });

    expect(result).toMatchObject({ ok: true });
    const editable = await projects.editable("tuns-la-fix", owner.id);
    expect(editable).toMatchObject({
      ok: true,
      project: { nextVersion: 3, input: { pitch: "Altă frază." } },
    });
    const page = await projects.bySlug("tuns-la-fix");
    expect(page?.updates[0]).toMatchObject({
      version: 2,
      text: "Am reparat butonul pe ecrane mici.",
    });
  });

  test("caps an update at 140 characters (rule 8)", async () => {
    const { projects, owner } = await inProgress();

    expect(
      await projects.edit(owner.id, "tuns-la-fix", {
        ...minimal(),
        update: "a".repeat(141),
      }),
    ).toEqual({ ok: false, reason: "update_too_long" });
  });

  test("checks the live link again only when it changes or the project launches (rule 9)", async () => {
    const { projects, owner, linkChecker } = await inProgress();
    linkChecker.checked.length = 0;

    await projects.edit(owner.id, "tuns-la-fix", {
      ...minimal({ pitch: "Altă frază." }),
      update: null,
    });
    expect(linkChecker.checked).toEqual([]);

    expect(
      await projects.edit(owner.id, "tuns-la-fix", {
        ...minimal({ liveUrl: "https://nu-merge.example" }),
        update: null,
      }),
    ).toEqual({ ok: false, reason: "link_unreachable" });

    await projects.edit(owner.id, "tuns-la-fix", {
      ...complete(),
      update: null,
    });
    expect(linkChecker.checked).toEqual(["https://nu-merge.example", LIVE]);
  });

  test("records rule 9's check as the latest link check, only when it ran", async () => {
    const { db, projects, owner, setNow } = await inProgress();
    const created = await row(db, "tuns-la-fix");
    expect(created).toMatchObject({
      linkCheckedAt: NOW,
      linkOk: true,
      linkFailedAt: null,
    });

    // The scheduled check had found the old link down once.
    await db
      .update(projectRows)
      .set({ linkOk: false, linkFailedAt: null })
      .where(eq(projectRows.slug, "tuns-la-fix"));
    const later = new Date(NOW.getTime() + 3_600_000);
    setNow(later);
    await projects.edit(owner.id, "tuns-la-fix", {
      ...minimal({ pitch: "Altă frază." }),
      update: null,
    });
    expect((await row(db, "tuns-la-fix")).linkOk).toBe(false);

    await projects.edit(owner.id, "tuns-la-fix", {
      ...minimal({ liveUrl: "https://alt.example" }),
      update: null,
    });
    expect(await row(db, "tuns-la-fix")).toMatchObject({
      linkCheckedAt: later,
      linkOk: true,
      linkFailedAt: null,
    });
  });

  test("moves a project in progress between the running challenge and none, but not a launched one", async () => {
    const { db, projects, owner } = await inProgress();

    expect(
      await projects.edit(owner.id, "tuns-la-fix", {
        ...minimal({ challengeSlug: null }),
        update: null,
      }),
    ).toMatchObject({ ok: true });
    expect((await row(db, "tuns-la-fix")).challengeId).toBeNull();

    const launched = await makeProject(db, {
      ownerId: owner.id,
      slug: "brici",
      challengeId: (await row(db, "tuns-la-fix")).challengeId,
    });
    expect(
      await projects.edit(owner.id, launched.slug, {
        ...complete({ challengeSlug: "frizerie" }),
        update: null,
      }),
    ).toEqual({ ok: false, reason: "challenge_locked" });
  });

  test("keeps an ended challenge on a project in progress that stays in it", async () => {
    const { db, projects, owner, challenge, setNow } = await inProgress();
    setNow(new Date("2026-12-01T08:00:00Z"));

    expect(
      await projects.edit(owner.id, "tuns-la-fix", {
        ...minimal({ pitch: "Încă lucrez." }),
        update: null,
      }),
    ).toMatchObject({ ok: true });
    expect((await row(db, "tuns-la-fix")).challengeId).toBe(challenge.id);
  });
});

describe("projects.editable", () => {
  test("gives the owner the form's values, and refuses anyone else", async () => {
    const { db, projects, owner } = await setup();
    await projects.create(
      owner.id,
      complete({ description: "Unu.\r\n\r\nDoi." }),
    );
    const other = await makeUser(db);

    const result = await projects.editable("tuns-la-fix", owner.id);

    expect(result).toMatchObject({
      ok: true,
      project: {
        stage: "launched",
        votes: 0,
        challenge: { slug: "frizerie" },
        nextVersion: 1,
        input: {
          challengeSlug: "frizerie",
          description: "Unu.\n\nDoi.",
          screenshots: [shot(1), shot(2)],
          build: { duration: "10_30h" },
        },
      },
    });
    expect(await projects.editable("tuns-la-fix", other.id)).toEqual({
      ok: false,
      reason: "not_owner",
    });
  });
});
