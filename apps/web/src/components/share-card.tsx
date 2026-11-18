import { IMAGE_SIZE, SHARE_COLORS } from "@/lib/share-image";
import { fillFor, initials } from "./avatar";

/** What a share image says; the same data draws the PNG and screen 10's preview. */
export type ShareCardData = {
  /** Top right: "Provocarea #4 · noiembrie 2026". */
  label: string;
  title: string;
  /** Under the title: a pitch, a summary, a bio. */
  line: string | null;
  /** The bottom row: "Construit și lansat de Ioana Mureșan". */
  byline: string;
  /** Beside the byline. */
  person: {
    id: string;
    name: string;
    avatarUrl: string | null;
    avatarFill: string | null;
    isAgent: boolean;
  } | null;
};

/** A length in px (the PNG), or a CSS value (the page sets it per breakpoint). */
type Size = number | string;

export type ShareCardLook = {
  size: {
    padding: Size;
    wordmark: Size;
    label: Size;
    title: Size;
    titleGap: Size;
    line: Size;
    byline: Size;
    bylineGap: Size;
    avatar: Size;
    initials: Size;
    /** The initials' line: the reference's 24px body line, at every width. */
    initialsLeading: Size;
  };
  font: { wordmark: string; title: string; text: string };
  /** The PNG has no rounded corners; the preview does. */
  radius: Size;
  /** A browser clamps lines in a -webkit-box; Satori in a block. */
  clamp: "block" | "box";
};

/** Screen 10's desktop reference, scaled to 1200px: the PNG. */
const k = IMAGE_SIZE.width / 680;
export const IMAGE_LOOK: ShareCardLook = {
  size: {
    padding: Math.round(32 * k),
    wordmark: Math.round(24 * k),
    label: Math.round(14 * k),
    title: Math.round(56 * k),
    titleGap: Math.round(8 * k),
    line: Math.round(20 * k),
    byline: Math.round(16 * k),
    bylineGap: Math.round(12 * k),
    avatar: Math.round(36 * k),
    initials: Math.round(13 * k),
    initialsLeading: Math.round(24 * k),
  },
  // Families registered in server/share-image (static instances).
  font: { wordmark: "Bricolage", title: "BricolageTitle", text: "Inter" },
  radius: 0,
  clamp: "block",
};

/** A long title steps down so it still fits the picture. */
const titleScale = (title: string) =>
  title.length <= 22 ? 1 : title.length <= 40 ? 0.75 : 0.6;

/** Styles that cut text after `lines` lines with an ellipsis. */
const clamp = (look: ShareCardLook, lines: number) =>
  ({
    display: look.clamp === "box" ? "-webkit-box" : "block",
    WebkitBoxOrient: "vertical",
    lineClamp: lines,
    WebkitLineClamp: lines,
    overflow: "hidden",
  }) as const;

const times = (size: Size, by: number): Size =>
  typeof size === "number" ? Math.round(size * by) : `calc(${size} * ${by})`;

/**
 * The "Arată-l oamenilor" card (screen 10): wordmark and label, the title and
 * its line, the builder. Inline styles and flexbox only, so next/og (Satori)
 * draws the same element the page shows.
 */
export function ShareCard({
  card,
  look,
  avatarSrc,
}: {
  card: ShareCardData;
  look: ShareCardLook;
  /** The PNG inlines the picture's bytes; the page uses its URL. */
  avatarSrc?: string;
}) {
  const { size, font } = look;
  const person = card.person;
  const avatar = person && (
    <Avatar
      person={person}
      src={avatarSrc ?? person.avatarUrl}
      size={size.avatar}
      fontSize={size.initials}
      leading={size.initialsLeading}
      font={font.text}
    />
  );
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        borderRadius: look.radius,
        background: SHARE_COLORS.band,
        color: SHARE_COLORS.onBand,
        padding: size.padding,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        fontFamily: font.text,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: size.bylineGap,
        }}
      >
        <span
          style={{
            display: "flex",
            fontFamily: font.wordmark,
            fontSize: size.wordmark,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          <span style={{ fontWeight: 500 }}>IT</span>
          <span style={{ fontWeight: 800 }}>Start</span>
        </span>
        <span
          style={{ fontSize: size.label, lineHeight: 1.3, fontWeight: 600 }}
        >
          {card.label}
        </span>
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", gap: size.titleGap }}
      >
        <span
          style={{
            ...clamp(look, 3),
            fontFamily: font.title,
            fontSize: times(size.title, titleScale(card.title)),
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          {card.title}
        </span>
        {card.line && (
          <span
            style={{
              ...clamp(look, 2),
              fontSize: size.line,
              lineHeight: 1.35,
              maxWidth: "80%",
            }}
          >
            {card.line}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: size.bylineGap,
          fontSize: size.byline,
          fontWeight: 600,
        }}
      >
        {avatar}
        <span>{card.byline}</span>
      </div>
    </div>
  );
}

/** Avatar's three looks (rule 19), drawn with inline styles for Satori. */
function Avatar({
  person,
  src,
  size,
  fontSize,
  leading,
  font,
}: {
  person: NonNullable<ShareCardData["person"]>;
  src: string | null;
  size: Size;
  fontSize: Size;
  leading: Size;
  font: string;
}) {
  const box = {
    width: size,
    height: size,
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: font,
    fontSize,
    fontWeight: 700,
    lineHeight: leading,
  } as const;
  if (person.isAgent) {
    return (
      <span
        aria-hidden
        style={{
          ...box,
          borderRadius: "28%",
          background: SHARE_COLORS.ink,
          color: SHARE_COLORS.bg,
        }}
      >
        AI
      </span>
    );
  }
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Satori draws only <img>
      <img
        src={src}
        alt=""
        width={typeof size === "number" ? size : undefined}
        height={typeof size === "number" ? size : undefined}
        style={{ ...box, borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        ...box,
        borderRadius: "50%",
        background: person.avatarFill ?? fillFor(person.id),
        color: SHARE_COLORS.onAccent,
      }}
    >
      {initials(person.name)}
    </span>
  );
}

const v = (name: string) => `var(--share-${name})`;

/** Screen 10's preview: the reference's sizes, phone and desktop. */
const PAGE_LOOK: ShareCardLook = {
  size: {
    padding: v("padding"),
    wordmark: v("wordmark"),
    label: v("label"),
    title: v("title"),
    titleGap: v("title-gap"),
    line: v("line"),
    byline: v("byline"),
    bylineGap: v("byline-gap"),
    avatar: v("avatar"),
    initials: v("initials"),
    initialsLeading: "24px",
  },
  font: {
    wordmark: "var(--font-display)",
    title: "var(--font-display)",
    text: "var(--font-sans)",
  },
  radius: 12,
  clamp: "box",
};

/**
 * "Arată-l oamenilor" on screen 10: the share image as the page draws it,
 * from the same card as the PNG, in the reference's sizes.
 */
export function ShareCardPreview({
  card,
  alt,
}: {
  card: ShareCardData;
  alt: string;
}) {
  return (
    <div
      role="img"
      aria-label={alt}
      className="aspect-[1200/630] min-h-0 overflow-hidden rounded-lg [--share-avatar:24px] [--share-byline-gap:8px] [--share-byline:12px] [--share-initials:9px] [--share-label:11px] [--share-line:13px] [--share-padding:18px] [--share-title-gap:4px] [--share-title:30px] [--share-wordmark:18px] md:[--share-avatar:36px] md:[--share-byline-gap:12px] md:[--share-byline:16px] md:[--share-initials:13px] md:[--share-label:14px] md:[--share-line:20px] md:[--share-padding:32px] md:[--share-title-gap:8px] md:[--share-title:56px] md:[--share-wordmark:24px]"
    >
      <ShareCard card={card} look={PAGE_LOOK} />
    </div>
  );
}
