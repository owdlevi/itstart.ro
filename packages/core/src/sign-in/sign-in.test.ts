import { describe, expect, test } from "vitest";
import { createTestDb } from "@repo/db/testing";
import { createSignIn, type SignInConfig } from "./index";

const SECOND = 1000;
const MINUTE = 60_000;

async function setup(config?: SignInConfig) {
  const db = await createTestDb();
  let now = new Date("2026-11-20T12:00:00Z");
  const signIn = createSignIn({ db, now: () => now, config });
  return {
    signIn,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

describe("signIn.requestLink", () => {
  test("allows a first link", async () => {
    const { signIn } = await setup();

    expect(await signIn.requestLink("ioana@example.com")).toEqual({
      ok: true,
    });
  });

  test("refuses a second link to the same address within 30 seconds", async () => {
    const { signIn, advance } = await setup();
    await signIn.requestLink("ioana@example.com");

    advance(10 * SECOND);
    expect(await signIn.requestLink(" Ioana@Example.com ")).toEqual({
      ok: false,
      reason: "too_soon",
      retryAfter: 20,
    });
    expect(await signIn.requestLink("andrei@example.com")).toEqual({
      ok: true,
    });

    advance(20 * SECOND);
    expect(await signIn.requestLink("ioana@example.com")).toEqual({
      ok: true,
    });
  });

  test("refuses a sixth link to the same address within an hour", async () => {
    const { signIn, advance } = await setup();
    for (let i = 0; i < 5; i++) {
      expect(await signIn.requestLink("ioana@example.com")).toEqual({
        ok: true,
      });
      advance(MINUTE);
    }

    // First send was 5 minutes ago, so the cap lifts in 55 minutes.
    expect(await signIn.requestLink("ioana@example.com")).toEqual({
      ok: false,
      reason: "too_many",
      retryAfter: 55 * 60,
    });

    advance(55 * MINUTE);
    expect(await signIn.requestLink("ioana@example.com")).toEqual({
      ok: true,
    });
  });

  test("refuses .invalid addresses, which agents use", async () => {
    const { signIn } = await setup();

    expect(
      await signIn.requestLink("agent-claude@agents.itstart.invalid"),
    ).toEqual({ ok: false, reason: "undeliverable" });
  });
});
