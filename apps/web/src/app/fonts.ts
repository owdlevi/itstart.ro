import localFont from "next/font/local";

// Self-hosted brand fonts (HANDOVER §2.3). Each family ships as two variable
// files, latin and latin-ext; the unicode-range keeps the browser from
// fetching latin-ext until a page needs ă â î ș ț ő ű. next/font only
// accepts literals, so the ranges are repeated in each call.
const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin-standard-normal.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
    { prop: "font-stretch", value: "75% 100%" },
  ],
});
const bricolageExt = localFont({
  src: "./fonts/bricolage-grotesque-latin-ext-standard-normal.woff2",
  weight: "200 800",
  variable: "--font-bricolage-ext",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
    { prop: "font-stretch", value: "75% 100%" },
  ],
});
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});
const interExt = localFont({
  src: "./fonts/inter-latin-ext-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter-ext",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

export const fontVariables = [bricolage, bricolageExt, inter, interExt]
  .map((font) => font.variable)
  .join(" ");
