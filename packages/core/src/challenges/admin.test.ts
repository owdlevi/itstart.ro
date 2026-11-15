import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { challenges as challengeRows, users } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { makeChallenge, makeUser } from "../test-data";
import { createChallenges } from "./index";
import { monthBounds, monthOf, type ChallengeInput } from "./rules";

// Wednesday 11 November 2026, 07:35 in Bucharest: the design fixtures' moment.
const NOW = new Date("2026-11-11T05:35:00Z");
const NOVEMBER = {
  startsAt: new Date("2026-10-31T22:00:00Z"),
  endsAt: new Date("2026-11-30T21:59:00Z"),
};

const input = (fields: Partial<ChallengeInput> = {}): ChallengeInput => ({
  title: "Site pentru o cafenea",
  shortTitle: "Cafenea",
  slug: null,
  month: "2026-12",
  summary: null,
  builtFor: null,
  buildingPhrase: null,
  intro: null,
  scenarioNote: null,
  scenario: null,
  baseLevel: [],
  stretch: [],
  launchCriteria: [],
  launchNote: null,
  launchCheck: null,
  materialsUrl: null,
  materialsNote: null,
  tips: [],
  juryNote: null,
  ...fields,
});

async function setup() {
  const db = await createTestDb();
  let at = NOW;
  const challenges = createChallenges({ db, now: () => at });
  const admin = await makeUser(db, { role: "admin" });
  const member = await makeUser(db);
  const november = await makeChallenge(db, {
    number: 4,
    slug: "frizerie",
    ...NOVEMBER,
  });
  return {
    db,
    challenges,
    admin,
    member,
    november,
    setNow: (date: string) => (at = new Date(date)),
  };
}

describe("monthBounds", () => {
  test("runs from the 1st at 00:00 to 23:59 on the last day, in Bucharest (rule 1)", () => {
    expect(monthBounds("2026-12")).toEqual({
      startsAt: new Date("2026-11-30T22:00:00Z"),
      endsAt: new Date("2026-12-31T21:59:00Z"),
    });
    // Summer time (+3), and a 29-day February.
    expect(monthBounds("2027-07")).toEqual({
      startsAt: new Date("2027-06-30T21:00:00Z"),
      endsAt: new Date("2027-07-31T20:59:00Z"),
    });
    expect(monthBounds("2028-02").endsAt).toEqual(
      new Date("2028-02-29T21:59:00Z"),
    );
    // The months whose clocks change: October ends in winter time, March in summer.
    expect(monthBounds("2026-10")).toEqual({
      startsAt: new Date("2026-09-30T21:00:00Z"),
      endsAt: new Date("2026-10-31T21:59:00Z"),
    });
    expect(monthBounds("2027-03")).toEqual({
      startsAt: new Date("2027-02-28T22:00:00Z"),
      endsAt: new Date("2027-03-31T20:59:00Z"),
    });
  });

  test("monthOf reads the month in Bucharest", () => {
    expect(monthOf(new Date("2026-10-31T22:00:00Z"))).toBe("2026-11");
    expect(monthOf(new Date("2026-10-31T21:59:00Z"))).toBe("2026-10");
  });
});

describe("challenges.create", () => {
  test("refuses anyone who isn't an admin, by the role in the database", async () => {
    const { db, challenges, member, admin } = await setup();
    expect(await challenges.create(member.id, input())).toEqual({
      ok: false,
      reason: "not_admin",
    });

    // Removing an admin takes effect at once.
    await db
      .update(users)
      .set({ role: "member" })
      .where(eq(users.id, admin.id));
    expect(await challenges.create(admin.id, input())).toMatchObject({
      reason: "not_admin",
    });
  });

  test("numbers it next, takes the slug from the short title and derives the deadline (rule 1)", async () => {
    const { db, challenges, admin } = await setup();

    const result = await challenges.create(
      admin.id,
      input({
        title: "  Site   pentru o cafenea ",
        baseLevel: ["  Meniul ", "", "Programul"],
        tips: [
          { title: "Începe cu meniul", text: "Scrie-l întâi." },
          { title: " ", text: "" },
        ],
      }),
    );

    expect(result).toEqual({ ok: true, slug: "cafenea", number: 5 });
    const [row] = await db
      .select()
      .from(challengeRows)
      .where(eq(challengeRows.slug, "cafenea"));
    expect(row).toMatchObject({
      number: 5,
      title: "Site pentru o cafenea",
      shortTitle: "Cafenea",
      baseLevel: ["Meniul", "Programul"],
      tips: [{ title: "Începe cu meniul", text: "Scrie-l întâi." }],
      startsAt: new Date("2026-11-30T22:00:00Z"),
      endsAt: new Date("2026-12-31T21:59:00Z"),
    });
  });

  test("a slug made from the title gets the first free number; a chosen one that's taken is refused", async () => {
    const { db, challenges, admin } = await setup();
    await makeChallenge(db, {
      number: 3,
      slug: "cafenea",
      startsAt: new Date("2026-09-30T21:00:00Z"),
      endsAt: new Date("2026-10-31T21:59:00Z"),
    });

    expect(await challenges.create(admin.id, input())).toMatchObject({
      slug: "cafenea-2",
    });
    expect(
      await challenges.create(
        admin.id,
        input({ month: "2027-01", slug: "frizerie" }),
      ),
    ).toEqual({ ok: false, reason: "slug_taken" });
    expect(
      await challenges.create(
        admin.id,
        input({ month: "2027-01", slug: "Cu Spații" }),
      ),
    ).toEqual({ ok: false, reason: "invalid", field: "slug" });
  });

  test("refuses a month that already has a challenge, so two never run at once (rule 1)", async () => {
    const { challenges, admin } = await setup();
    expect(
      await challenges.create(admin.id, input({ month: "2026-11" })),
    ).toEqual({ ok: false, reason: "month_taken" });
  });

  test("refuses a month before the last challenge's, so numbers follow the months", async () => {
    const { db, challenges, admin } = await setup();
    await challenges.create(admin.id, input({ month: "2027-02" }));
    await db.delete(challengeRows).where(eq(challengeRows.slug, "frizerie"));

    expect(
      await challenges.create(admin.id, input({ month: "2027-01" })),
    ).toEqual({ ok: false, reason: "month_out_of_order" });
  });

  test("refuses a month whose deadline has passed (rule 1)", async () => {
    const { db, challenges, admin } = await setup();
    await db.delete(challengeRows);
    expect(
      await challenges.create(admin.id, input({ month: "2026-10" })),
    ).toEqual({ ok: false, reason: "month_past" });
    // The month running now is fine: it starts running at once.
    expect(
      await challenges.create(admin.id, input({ month: "2026-11" })),
    ).toMatchObject({ ok: true, number: 1 });
    expect(await challenges.running()).toMatchObject({ slug: "cafenea" });
  });

  test("checks every field's shape and length", async () => {
    const { challenges, admin } = await setup();
    const refused = (fields: Partial<ChallengeInput>) =>
      challenges.create(admin.id, input(fields));

    expect(await refused({ title: "  " })).toMatchObject({ field: "title" });
    expect(await refused({ month: "2026-13" })).toMatchObject({
      field: "month",
    });
    expect(await refused({ materialsUrl: "http://x.example" })).toMatchObject({
      field: "materialsUrl",
    });
    expect(
      await refused({ stretch: Array.from({ length: 13 }, () => "Ceva") }),
    ).toMatchObject({ field: "stretch" });
    expect(
      await refused({ tips: [{ title: "Doar titlu", text: "" }] }),
    ).toMatchObject({ field: "tips" });
    expect(await refused({ summary: "a".repeat(301) })).toMatchObject({
      field: "summary",
    });
  });
});

describe("challenges.edit", () => {
  test("changes the brief of a running challenge, but not its month or slug (rule 1)", async () => {
    const { db, challenges, admin } = await setup();
    const running = input({ month: "2026-11", slug: "frizerie" });

    expect(
      await challenges.edit(admin.id, "frizerie", {
        ...running,
        scenario: "Nea Gică vrea programări.",
        juryNote: "Echipa.",
      }),
    ).toEqual({ ok: true, slug: "frizerie", number: 4 });
    const [row] = await db
      .select()
      .from(challengeRows)
      .where(eq(challengeRows.slug, "frizerie"));
    expect(row).toMatchObject({
      scenario: "Nea Gică vrea programări.",
      ...NOVEMBER,
    });

    expect(
      await challenges.edit(admin.id, "frizerie", {
        ...running,
        month: "2026-12",
      }),
    ).toEqual({ ok: false, reason: "month_locked" });
    expect(
      await challenges.edit(admin.id, "frizerie", {
        ...running,
        slug: "frizerie-noua",
      }),
    ).toEqual({ ok: false, reason: "slug_locked" });
  });

  test("an ended challenge's text can still change (the jury's note comes after)", async () => {
    const { challenges, admin, setNow } = await setup();
    setNow("2026-12-02T10:00:00Z");
    expect(
      await challenges.edit(
        admin.id,
        "frizerie",
        input({
          month: "2026-11",
          slug: "frizerie",
          juryNote: "Juriul a ales.",
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  test("moves an upcoming challenge's month and slug, within rule 1", async () => {
    const { db, challenges, admin } = await setup();
    await challenges.create(admin.id, input({ month: "2027-01" }));

    expect(
      await challenges.edit(
        admin.id,
        "cafenea",
        input({ month: "2026-12", slug: "cafeneaua" }),
      ),
    ).toEqual({ ok: true, slug: "cafeneaua", number: 5 });
    const [row] = await db
      .select()
      .from(challengeRows)
      .where(eq(challengeRows.number, 5));
    expect(row).toMatchObject({ slug: "cafeneaua", ...monthBounds("2026-12") });

    // Its own month again is no clash; November's is.
    expect(
      await challenges.edit(admin.id, "cafeneaua", input({ month: "2026-12" })),
    ).toMatchObject({ ok: true, slug: "cafeneaua" });
    expect(
      await challenges.edit(admin.id, "cafeneaua", input({ month: "2026-11" })),
    ).toEqual({ ok: false, reason: "month_taken" });
    expect(
      await challenges.edit(admin.id, "cafeneaua", input({ month: "2026-10" })),
    ).toEqual({ ok: false, reason: "month_past" });
    expect(
      await challenges.edit(
        admin.id,
        "cafeneaua",
        input({ month: "2026-12", slug: "frizerie" }),
      ),
    ).toEqual({ ok: false, reason: "slug_taken" });
  });

  test("an upcoming challenge can't move before an older-numbered one", async () => {
    const { challenges, admin } = await setup();
    await challenges.create(admin.id, input({ month: "2026-12" }));
    await challenges.create(
      admin.id,
      input({ month: "2027-01", shortTitle: "Atelier" }),
    );

    expect(
      await challenges.edit(admin.id, "cafenea", input({ month: "2027-02" })),
    ).toEqual({ ok: false, reason: "month_out_of_order" });
  });

  test("refuses a member and an unknown slug", async () => {
    const { challenges, member, admin } = await setup();
    expect(
      await challenges.edit(member.id, "frizerie", input({ month: "2026-11" })),
    ).toEqual({ ok: false, reason: "not_admin" });
    expect(await challenges.edit(admin.id, "nu-exista", input())).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("challenges.all and editable", () => {
  test("lists every challenge newest month first, with its status, for admins only", async () => {
    const { db, challenges, admin, member } = await setup();
    await challenges.create(admin.id, input());
    await makeChallenge(db, {
      number: 3,
      slug: "octombrie",
      startsAt: new Date("2026-09-30T21:00:00Z"),
      endsAt: new Date("2026-10-31T21:59:00Z"),
    });

    expect(await challenges.all(member.id)).toEqual({
      ok: false,
      reason: "not_admin",
    });
    const all = await challenges.all(admin.id);
    expect(all.ok && all.value).toEqual([
      expect.objectContaining({
        slug: "cafenea",
        month: "2026-12",
        status: "upcoming",
      }),
      expect.objectContaining({
        slug: "frizerie",
        month: "2026-11",
        status: "running",
      }),
      expect.objectContaining({
        slug: "octombrie",
        month: "2026-10",
        status: "ended",
      }),
    ]);
  });

  test("prefills the form with what was saved", async () => {
    const { challenges, admin, member } = await setup();
    const saved = input({
      intro: "Primul paragraf.\n\nAl doilea.",
      launchCriteria: ["Un link public"],
      tips: [{ title: "Titlu", text: "Text." }],
    });
    await challenges.create(admin.id, saved);

    const editable = await challenges.editable("cafenea", admin.id);
    expect(editable).toEqual({
      ok: true,
      value: {
        slug: "cafenea",
        number: 5,
        status: "upcoming",
        input: { ...saved, slug: "cafenea" },
      },
    });
    expect(await challenges.editable("cafenea", member.id)).toEqual({
      ok: false,
      reason: "not_admin",
    });
    expect(await challenges.editable("nu-exista", admin.id)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
