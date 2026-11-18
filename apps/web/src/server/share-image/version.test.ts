import { describe, expect, it } from "vitest";
import { excerpt, imagePath, share, shareMetadata } from "./version";

const card = {
  label: "Provocarea #4 · noiembrie 2026",
  title: "Tuns la Fix",
  line: "Programări online pentru frizeria din cartier, fără telefoane.",
  byline: "Construit și lansat de Ioana Mureșan",
  person: {
    id: "u1",
    name: "Ioana Mureșan",
    avatarUrl: null,
    avatarFill: "#FFD84D",
    isAgent: false,
  },
};

describe("share", () => {
  it("keeps the version while the card is the same", () => {
    expect(share(card, "a").version).toBe(share({ ...card }, "b").version);
  });

  it("changes the version when anything the card shows changes", () => {
    const v = share(card, "").version;
    expect(share({ ...card, title: "Tuns la Fix!" }, "").version).not.toBe(v);
    expect(
      share({ ...card, person: { ...card.person, avatarUrl: "/x.webp" } }, "")
        .version,
    ).not.toBe(v);
  });

  it("puts the version in the image's address", () => {
    const s = share(card, "");
    expect(imagePath("/proiecte/tuns-la-fix", s)).toBe(
      `/proiecte/tuns-la-fix/imagine?v=${s.version}`,
    );
  });
});

describe("shareMetadata", () => {
  it("gives Open Graph and Twitter the same 1200×630 image", () => {
    const s = share(card, "Imagine de distribuit");
    const m = shareMetadata({
      title: "ITStart · Tuns la Fix",
      shareTitle: "Tuns la Fix",
      description: "Programări",
      path: "/proiecte/tuns-la-fix",
      share: s,
    });
    const image = {
      url: imagePath("/proiecte/tuns-la-fix", s),
      width: 1200,
      height: 630,
      alt: "Imagine de distribuit",
      type: "image/png",
    };
    expect(m.title).toBe("ITStart · Tuns la Fix");
    expect(m.openGraph).toMatchObject({
      title: "Tuns la Fix",
      url: "/proiecte/tuns-la-fix",
      siteName: "ITStart",
      images: [image],
    });
    expect(m.twitter).toMatchObject({
      card: "summary_large_image",
      images: [image],
    });
  });
});

describe("excerpt", () => {
  it("keeps short text whole, on one line", () => {
    expect(excerpt("Un rând\n\nși altul")).toBe("Un rând și altul");
  });

  it("cuts long text at the limit with an ellipsis", () => {
    const cut = excerpt("a".repeat(300));
    expect(cut).toHaveLength(200);
    expect(cut.endsWith("…")).toBe(true);
  });
});
