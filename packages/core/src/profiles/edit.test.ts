import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { users } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { createProjects } from "../projects";
import { createPrefixStorage } from "../storage";
import { makeUser } from "../test-data";
import { createProfiles, type ProfileInput } from "./index";

const NOW = new Date("2026-11-11T05:35:00Z");

async function setup() {
  const db = await createTestDb();
  const now = () => NOW;
  const profiles = createProfiles({
    db,
    now,
    projects: createProjects({ db, now }),
    storage: createPrefixStorage("/dev/captura/"),
  });
  const user = await makeUser(db, {
    name: "Ioana Mureșan",
    handle: "ioana-muresan",
    city: "Cluj-Napoca",
    bio: "Contabilă.",
    links: ["https://github.com/ioanamuresan"],
    toolsInterest: ["Claude"],
    onboardedAt: NOW,
  });
  const read = async (id: string) =>
    (await db.select().from(users).where(eq(users.id, id)))[0]!;
  return { db, profiles, user, read };
}

const input: ProfileInput = {
  name: "Ioana Mureșan",
  givenName: null,
  city: "Cluj-Napoca",
  bio: "Contabilă care face site-uri cu AI.",
  links: ["https://github.com/ioanamuresan", "https://ioana.ro"],
  avatarUrl: null,
  toolsInterest: ["Claude", "Cursor"],
  remindersOptIn: false,
};

describe("editable", () => {
  test("gives the owner their profile as the form edits it", async () => {
    const { profiles, user } = await setup();
    const result = await profiles.editable("ioana-muresan", user.id);
    expect(result).toEqual({
      ok: true,
      value: {
        id: user.id,
        handle: "ioana-muresan",
        avatarFill: null,
        input: {
          name: "Ioana Mureșan",
          givenName: null,
          city: "Cluj-Napoca",
          bio: "Contabilă.",
          links: ["https://github.com/ioanamuresan"],
          avatarUrl: null,
          toolsInterest: ["Claude"],
          remindersOptIn: false,
        },
      },
    });
  });

  test("refuses anyone else, an unknown handle, and someone not onboarded", async () => {
    const { db, profiles, user } = await setup();
    const other = await makeUser(db, { handle: "andrei", onboardedAt: NOW });
    expect(await profiles.editable("ioana-muresan", other.id)).toEqual({
      ok: false,
      reason: "not_owner",
    });
    expect(await profiles.editable("nimeni", user.id)).toEqual({
      ok: false,
      reason: "not_found",
    });
    const bianca = await makeUser(db, { handle: "bianca-radu" });
    expect(await profiles.editable("bianca-radu", bianca.id)).toEqual({
      ok: false,
      reason: "not_onboarded",
    });
  });
});

describe("edit", () => {
  test("saves every field, tidied", async () => {
    const { profiles, user, read } = await setup();
    const result = await profiles.edit(user.id, {
      ...input,
      name: "  Ioana   Mureșan-Pop ",
      givenName: " Ioana ",
      city: "  ",
      bio: "  Contabilă   care face\nsite-uri cu AI. ",
      links: [" https://ioana.ro ", "", "https://ioana.ro"],
      remindersOptIn: true,
    });
    expect(result).toEqual({ ok: true, handle: "ioana-muresan" });
    expect(await read(user.id)).toMatchObject({
      name: "Ioana Mureșan-Pop",
      givenName: "Ioana",
      city: null,
      bio: "Contabilă care face site-uri cu AI.",
      links: ["https://ioana.ro"],
      toolsInterest: ["Claude", "Cursor"],
      remindersOptIn: true,
    });
  });

  test("keeps the handle when the name changes: profile links are shared", async () => {
    const { profiles, user, read } = await setup();
    await profiles.edit(user.id, { ...input, name: "Ioana Pop" });
    expect((await read(user.id)).handle).toBe("ioana-muresan");
  });

  test("keeps the bio at 240 characters (HANDOVER §4)", async () => {
    const { profiles, user } = await setup();
    expect(
      await profiles.edit(user.id, { ...input, bio: "a".repeat(240) }),
    ).toMatchObject({ ok: true });
    expect(
      await profiles.edit(user.id, { ...input, bio: "a".repeat(241) }),
    ).toEqual({ ok: false, reason: "invalid", field: "bio" });
  });

  test("allows at most three links, each https (HANDOVER §4)", async () => {
    const { profiles, user } = await setup();
    const links = (n: number) =>
      Array.from({ length: n }, (_, i) => `https://site${i}.ro`);
    expect(
      await profiles.edit(user.id, { ...input, links: links(3) }),
    ).toMatchObject({ ok: true });
    for (const bad of [
      links(4),
      ["http://ioana.ro"],
      ["javascript:alert(1)"],
      ["ioana.ro"],
      [`https://ioana.ro/${"a".repeat(200)}`],
    ]) {
      expect(await profiles.edit(user.id, { ...input, links: bad })).toEqual({
        ok: false,
        reason: "invalid",
        field: "links",
      });
    }
  });

  test("refuses an empty or long name, a long city or given name", async () => {
    const { profiles, user } = await setup();
    const refused = (field: string) => ({
      ok: false,
      reason: "invalid",
      field,
    });
    expect(await profiles.edit(user.id, { ...input, name: "  " })).toEqual(
      refused("name"),
    );
    expect(
      await profiles.edit(user.id, { ...input, name: "a".repeat(61) }),
    ).toEqual(refused("name"));
    expect(
      await profiles.edit(user.id, { ...input, city: "a".repeat(61) }),
    ).toEqual(refused("city"));
    expect(
      await profiles.edit(user.id, { ...input, givenName: "a".repeat(31) }),
    ).toEqual(refused("givenName"));
  });

  test("refuses unknown tools, and „Încă nu știu” with a tool", async () => {
    const { profiles, user } = await setup();
    for (const toolsInterest of [["Excel"], ["unsure", "Claude"]]) {
      expect(await profiles.edit(user.id, { ...input, toolsInterest })).toEqual(
        { ok: false, reason: "invalid", field: "toolsInterest" },
      );
    }
  });

  test("saves reminders exactly as ticked, off included (rule 22)", async () => {
    const { profiles, user, read } = await setup();
    await profiles.edit(user.id, { ...input, remindersOptIn: true });
    expect((await read(user.id)).remindersOptIn).toBe(true);
    await profiles.edit(user.id, { ...input, remindersOptIn: false });
    expect((await read(user.id)).remindersOptIn).toBe(false);
  });

  test("takes a picture only from our storage, keeps the one they have, and removes it", async () => {
    const { db, profiles, user, read } = await setup();
    expect(
      await profiles.edit(user.id, {
        ...input,
        avatarUrl: "https://evil.example/a.png",
      }),
    ).toEqual({ ok: false, reason: "avatar_unknown" });

    await profiles.edit(user.id, {
      ...input,
      avatarUrl: "/dev/captura/poza.webp",
    });
    expect((await read(user.id)).avatarUrl).toBe("/dev/captura/poza.webp");

    // A provider's picture, from before: kept on save.
    await db
      .update(users)
      .set({ avatarUrl: "https://lh3.googleusercontent.com/a" })
      .where(eq(users.id, user.id));
    expect(
      await profiles.edit(user.id, {
        ...input,
        avatarUrl: "https://lh3.googleusercontent.com/a",
      }),
    ).toMatchObject({ ok: true });

    await profiles.edit(user.id, { ...input, avatarUrl: null });
    expect((await read(user.id)).avatarUrl).toBeNull();
  });

  test("refuses someone not onboarded: /bun-venit comes first", async () => {
    const { db, profiles } = await setup();
    const bianca = await makeUser(db, { handle: "bianca-radu" });
    expect(await profiles.edit(bianca.id, input)).toEqual({
      ok: false,
      reason: "not_onboarded",
    });
  });

  test("never touches the e-mail, the role or the agent flag", async () => {
    const { profiles, user, read } = await setup();
    const before = await read(user.id);
    await profiles.edit(user.id, {
      ...input,
      // Extra keys a request could carry.
      ...({ email: "x@y.ro", role: "admin", isAgent: true } as object),
    });
    const after = await read(user.id);
    expect(after.email).toBe(before.email);
    expect(after.role).toBe("member");
    expect(after.isAgent).toBe(false);
  });
});
