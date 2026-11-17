import { describe, expect, test } from "vitest";
import { blobPaths } from "./blob-paths";

const paths = blobPaths("vercel_blob_rw_5WehGYs4hW4iCOOf_secret");
const store = "https://5wehgys4hw4icoof.public.blob.vercel-storage.com";
const finished = `${store}/capturi/0b6f0c1e-4f4a-4a3e-9d9a-2b1c3d4e5f60.webp`;

describe("blobPaths (the Blob adapter's URLs)", () => {
  test("owns a finished picture in our store", () => {
    expect(paths.owns(finished)).toBe(true);
  });

  test("owns nothing elsewhere, or outside capturi/", () => {
    for (const url of [
      finished.replace("5wehgys4hw4icoof", "otherstore"),
      finished.replace("https:", "http:"),
      `${finished}?x=1`,
      `${store}/incoming/screenshot-abc.png`,
      `${store}/capturi/not-a-uuid.webp`,
      `${store}/capturi/../capturi/0b6f0c1e-4f4a-4a3e-9d9a-2b1c3d4e5f60.webp`,
      "/dev/captura/0b6f0c1e-4f4a-4a3e-9d9a-2b1c3d4e5f60.webp",
      "not a url",
    ]) {
      expect(paths.owns(url), url).toBe(false);
    }
  });

  test("knows an original waiting under incoming/", () => {
    expect(paths.isIncoming(`${store}/incoming/avatar-x1Y2.jpg`)).toBe(true);
    expect(paths.isIncoming(finished)).toBe(false);
    expect(
      paths.isIncoming("https://example.com/incoming/avatar-x1Y2.jpg"),
    ).toBe(false);
  });
});
