import { describe, expect, it } from "vitest";
import { safeNext, signInDestination } from "./sign-in-destination";

describe("safeNext", () => {
  it("keeps a path on this site with its query and hash (rule 12)", () => {
    expect(safeNext("/proiecte/tuns-la-fix#pareri")).toBe(
      "/proiecte/tuns-la-fix#pareri",
    );
    expect(safeNext("/lansari?eticheta=Claude&sortare=voturi")).toBe(
      "/lansari?eticheta=Claude&sortare=voturi",
    );
  });

  it("refuses other sites", () => {
    for (const raw of [
      "https://evil.example/",
      "//evil.example/x",
      "/\\evil.example",
      "javascript:alert(1)",
      "proiecte/x",
    ]) {
      expect(safeNext(raw)).toBeNull();
    }
  });

  it("refuses /intra itself and nothing at all", () => {
    expect(safeNext("/intra?next=/intra")).toBeNull();
    expect(safeNext("/intra/confirma")).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("signInDestination", () => {
  it("sends a first sign-in to /bun-venit, carrying the challenge and next on", () => {
    expect(
      signInDestination({ handle: null, next: null, challengeSlug: null }),
    ).toBe("/bun-venit");
    expect(
      signInDestination({
        handle: null,
        next: "/proiecte/brici",
        challengeSlug: "frizerie",
      }),
    ).toBe("/bun-venit?provocare=frizerie&next=%2Fproiecte%2Fbrici");
  });

  it("returns to the page the visitor came from (rule 12)", () => {
    expect(
      signInDestination({
        handle: "andrei-popescu",
        next: "/proiecte/brici#pareri",
        challengeSlug: null,
      }),
    ).toBe("/proiecte/brici#pareri");
  });

  it("goes to the challenge the visitor came to join", () => {
    expect(
      signInDestination({
        handle: "andrei-popescu",
        next: null,
        challengeSlug: "frizerie",
      }),
    ).toBe("/provocari/frizerie");
  });

  it("goes Home from the header, or when next points elsewhere", () => {
    expect(
      signInDestination({ handle: "a", next: null, challengeSlug: null }),
    ).toBe("/");
    expect(
      signInDestination({
        handle: "a",
        next: "https://evil.example",
        challengeSlug: null,
      }),
    ).toBe("/");
  });
});
