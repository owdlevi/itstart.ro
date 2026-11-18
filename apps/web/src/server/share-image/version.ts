import { createHash } from "node:crypto";
import type { Metadata } from "next";
import type { ShareCardData } from "@/components/share-card";
import { IMAGE_SIZE } from "../../lib/share-image";

export const VERSION_PARAM = "v";
export const DOWNLOAD_PARAM = "descarca";

/** A page's share card, with what describes it. */
export type Share = {
  card: ShareCardData;
  /** The image's alt text. */
  alt: string;
  /** Changes whenever anything the card shows changes. */
  version: string;
};

export function share(card: ShareCardData, alt: string): Share {
  const version = createHash("sha256")
    .update(JSON.stringify(card))
    .digest("base64url")
    .slice(0, 12);
  return { card, alt, version };
}

/** `/proiecte/tuns-la-fix` → its image, versioned so link previews refresh. */
export const imagePath = (pagePath: string, { version }: Share) =>
  `${pagePath}/imagine?${VERSION_PARAM}=${version}`;

/**
 * Open Graph and Twitter tags for a shared page: its title, description,
 * address and card. Next replaces `openGraph` whole, so each page repeats the
 * site's fields (layout.tsx).
 */
export function shareMetadata({
  title,
  shareTitle = title,
  description,
  path,
  share: s,
  type = "website",
}: {
  /** The document's title. */
  title: string;
  /** The preview's, without "ITStart ·" (og:site_name says it). */
  shareTitle?: string;
  description: string;
  path: string;
  share: Share;
  type?: "website" | "article" | "profile";
}): Metadata {
  const image = {
    url: imagePath(path, s),
    ...IMAGE_SIZE,
    alt: s.alt,
    type: "image/png",
  };
  return {
    title,
    description,
    openGraph: {
      type,
      siteName: "ITStart",
      locale: "ro_RO",
      url: path,
      title: shareTitle,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [image],
    },
  };
}

/** A preview's description: the first 200 characters, on one line. */
export function excerpt(text: string, max = 200) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
}
