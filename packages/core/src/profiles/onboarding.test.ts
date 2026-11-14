import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { users } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { createProjects } from "../projects";
import { makeUser } from "../test-data";
import { createProfiles, freeHandle, handleBase } from "./index";

const NOW = new Date("2026-11-11T05:35:00Z");

async function setup() {
  const db = await createTestDb();
  const now = () => NOW;
  const profiles = createProfiles({
    db,
    now,
    projects: createProjects({ db, now }),
  });
  // A password sign-up: no name, no handle (screen 06).
  const newcomer = () => makeUser(db, { name: "", handle: null });
  const read = async (id: string) =>
    (await db.select().from(users).where(eq(users.id, id)))[0]!;
  return { db, profiles, newcomer, read };
}

const input = {
  name: "Bianca Radu",
  city: "Oradea",
  toolsInterest: ["Claude", "Lovable"],
  remindersOptIn: false,
};

describe("handles", () => {
  test("fold diacritics and join words", () => {
    expect(handleBase("Bianca Radu")).toBe("bianca-radu");
    expect(handleBase("  Ioana Mureșan ")).toBe("ioana-muresan");
    expect(handleBase("Kovács Réka")).toBe("kovacs-reka");
    expect(handleBase("Szőke Ődön-Űr")).toBe("szoke-odon-ur");
    expect(handleBase("Țuțu Ștefănescu-Âlbă")).toBe("tutu-stefanescu-alba");
  });

  test("have a fallback and a length cap", () => {
    expect(handleBase("✨✨")).toBe("constructor");
    expect(handleBase("a".repeat(30) + " " + "b".repeat(30))).toBe(
      "a".repeat(30) + "-" + "b".repeat(9),
    );
  });

  test("are numbered when taken", () => {
    expect(freeHandle("ana-pop", new Set())).toBe("ana-pop");
    expect(freeHandle("ana-pop", new Set(["ana-pop", "ana-pop-2"]))).toBe(
      "ana-pop-3",
    );
  });
});

describe("onboard", () => {
  test("saves the profile, makes a handle and marks the user onboarded", async () => {
    const { profiles, newcomer, read } = await setup();
    const user = await newcomer();
    expect(await profiles.onboard(user.id, input)).toEqual({
      ok: true,
      handle: "bianca-radu",
    });
    const row = await read(user.id);
    expect(row).toMatchObject({
      name: "Bianca Radu",
      city: "Oradea",
      toolsInterest: ["Claude", "Lovable"],
      handle: "bianca-radu",
      onboardedAt: NOW,
    });
  });

  test("keeps reminders off unless ticked (rule 22)", async () => {
    const { profiles, newcomer, read } = await setup();
    const off = await newcomer();
    await profiles.onboard(off.id, input);
    expect((await read(off.id)).remindersOptIn).toBe(false);
    const on = await newcomer();
    await profiles.onboard(on.id, { ...input, remindersOptIn: true });
    expect((await read(on.id)).remindersOptIn).toBe(true);
  });

  test("numbers a handle someone already has", async () => {
    const { db, profiles, newcomer } = await setup();
    await makeUser(db, { handle: "bianca-radu" });
    await makeUser(db, { handle: "bianca-radu-2" });
    const user = await newcomer();
    expect(await profiles.onboard(user.id, input)).toEqual({
      ok: true,
      handle: "bianca-radu-3",
    });
  });

  test("keeps a handle the user already has", async () => {
    const { db, profiles, read } = await setup();
    const user = await makeUser(db, { name: "Bianca", handle: "bianca" });
    expect(await profiles.onboard(user.id, input)).toEqual({
      ok: true,
      handle: "bianca",
    });
    expect((await read(user.id)).name).toBe("Bianca Radu");
  });

  test("tidies spaces and leaves an empty city out", async () => {
    const { profiles, newcomer, read } = await setup();
    const user = await newcomer();
    await profiles.onboard(user.id, {
      ...input,
      name: "  Bianca   Radu ",
      city: "   ",
      toolsInterest: ["Claude", "Claude"],
    });
    expect(await read(user.id)).toMatchObject({
      name: "Bianca Radu",
      city: null,
      toolsInterest: ["Claude"],
    });
  });

  test("stores 'Încă nu știu', but never with a tool", async () => {
    const { profiles, newcomer, read } = await setup();
    const unsure = await newcomer();
    await profiles.onboard(unsure.id, { ...input, toolsInterest: ["unsure"] });
    expect((await read(unsure.id)).toolsInterest).toEqual(["unsure"]);
    const both = await newcomer();
    expect(
      await profiles.onboard(both.id, {
        ...input,
        toolsInterest: ["unsure", "Claude"],
      }),
    ).toEqual({ ok: false, reason: "unknown_tool" });
  });

  test("refuses bad input", async () => {
    const { profiles, newcomer } = await setup();
    const user = await newcomer();
    const refusal = (reason: string) => ({ ok: false, reason });
    expect(await profiles.onboard(user.id, { ...input, name: "  " })).toEqual(
      refusal("name_empty"),
    );
    expect(
      await profiles.onboard(user.id, { ...input, name: "a".repeat(61) }),
    ).toEqual(refusal("name_too_long"));
    expect(
      await profiles.onboard(user.id, { ...input, city: "a".repeat(61) }),
    ).toEqual(refusal("city_too_long"));
    expect(
      await profiles.onboard(user.id, { ...input, toolsInterest: ["Excel"] }),
    ).toEqual(refusal("unknown_tool"));
  });

  test("happens once", async () => {
    const { profiles, newcomer, read } = await setup();
    const user = await newcomer();
    await profiles.onboard(user.id, input);
    expect(
      await profiles.onboard(user.id, { ...input, name: "Altcineva" }),
    ).toEqual({ ok: false, reason: "already_onboarded" });
    expect((await read(user.id)).name).toBe("Bianca Radu");
  });
});
