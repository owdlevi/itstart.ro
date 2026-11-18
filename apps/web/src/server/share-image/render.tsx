import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import {
  IMAGE_LOOK,
  ShareCard,
  type ShareCardData,
} from "@/components/share-card";
import { IMAGE_SIZE } from "@/lib/share-image";
import { readPicture } from "../storage";
import { DOWNLOAD_PARAM, VERSION_PARAM, type Share } from "./version";

// Static instances of the brand fonts (scripts/share-fonts.py): next/og reads
// no woff2 and no variable axes. Read once per instance; each path is a
// literal so the deployment's file tracing keeps the files.
const dir = path.join(process.cwd(), "src/server/share-image/fonts");
const fonts = Promise.all([
  readFile(path.join(dir, "bricolage-500-opsz42.ttf")),
  readFile(path.join(dir, "bricolage-800-opsz42.ttf")),
  readFile(path.join(dir, "bricolage-800-opsz96.ttf")),
  readFile(path.join(dir, "inter-400.ttf")),
  readFile(path.join(dir, "inter-600.ttf")),
  readFile(path.join(dir, "inter-700.ttf")),
]).then(([wordmark500, wordmark800, title800, text400, text600, text700]) =>
  (
    [
      ["Bricolage", 500, wordmark500],
      ["Bricolage", 800, wordmark800],
      ["BricolageTitle", 800, title800],
      ["Inter", 400, text400],
      ["Inter", 600, text600],
      ["Inter", 700, text700],
    ] as const
  ).map(([name, weight, data]) => ({
    name,
    weight,
    data: data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer,
    style: "normal" as const,
  })),
);

/**
 * The builder's picture as a data URI, or null to draw their initials. We
 * store webp, which next/og's Satori fails on, so it goes in as a png at
 * twice the avatar's size.
 */
async function inlinePicture(card: ShareCardData) {
  const url = card.person?.avatarUrl;
  if (!url || card.person?.isAgent) return null;
  const png = await readPicture(url)
    .then((bytes) =>
      bytes
        ? sharp(bytes)
            .resize(Number(IMAGE_LOOK.size.avatar) * 2)
            .png()
            .toBuffer()
        : null,
    )
    .catch(() => null);
  return png && `data:image/png;base64,${png.toString("base64")}`;
}

/** The PNG for a share card, as a 1200×630 image (DECISIONS, "Share image"). */
export async function renderShareImage(card: ShareCardData) {
  const picture = await inlinePicture(card);
  return new ImageResponse(
    <ShareCard
      // A picture we can't read falls back to the initials.
      card={
        picture || !card.person
          ? card
          : { ...card, person: { ...card.person, avatarUrl: null } }
      }
      look={IMAGE_LOOK}
      avatarSrc={picture ?? undefined}
    />,
    { ...IMAGE_SIZE, fonts: await fonts },
  );
}

/**
 * GET …/imagine: the share card's PNG. With the current `?v=` it never
 * changes, so browsers and the CDN keep it a year; without it, or with an old
 * one, it's the current card for five minutes. `?descarca` saves it as a file
 * ("Descarcă imaginea").
 */
export async function shareImageResponse(
  share: Share | null,
  request: Request,
  filename: string,
) {
  if (!share) return new Response(null, { status: 404 });
  const query = new URL(request.url).searchParams;
  const image = await renderShareImage(share.card);
  const headers = new Headers(image.headers);
  headers.set(
    "cache-control",
    query.get(VERSION_PARAM) === share.version
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, s-maxage=300",
  );
  if (query.has(DOWNLOAD_PARAM))
    headers.set("content-disposition", `attachment; filename="${filename}"`);
  return new Response(image.body, { status: image.status, headers });
}
