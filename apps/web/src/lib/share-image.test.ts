import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHARE_COLORS } from "./share-image";

const tokens = JSON.parse(
  readFileSync(
    new URL("../../../../docs/design/tokens.json", import.meta.url),
    "utf8",
  ),
) as { color: { tokens: { name: string; value: { light: string } }[] } };

const light = (name: string) =>
  tokens.color.tokens.find((t) => t.name === name)?.value.light;

describe("SHARE_COLORS", () => {
  it("are the light theme's tokens (HANDOVER §2.2)", () => {
    expect(SHARE_COLORS).toEqual({
      band: light("band"),
      onBand: light("on-band"),
      ink: light("ink"),
      bg: light("bg"),
      onAccent: light("on-accent"),
    });
  });
});
