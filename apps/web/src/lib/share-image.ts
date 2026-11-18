/**
 * The share image's colours: the light theme's tokens (HANDOVER §2.2), in
 * both themes, since the image is one picture for every viewer (screen 10's
 * dark reference keeps them too). share-image.test.ts checks them against
 * tokens.json.
 */
export const SHARE_COLORS = {
  band: "#0E7A43",
  onBand: "#FFFFFF",
  ink: "#14201A",
  bg: "#F4F6EF",
  onAccent: "#14201A",
};

/** Open Graph's usual size, and screen 10's reference card (1200 / 630). */
export const IMAGE_SIZE = { width: 1200, height: 630 };
