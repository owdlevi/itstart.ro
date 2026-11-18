import messages from "../../messages/ro.json";
import { IMAGE_SIZE } from "@/lib/share-image";
import { renderShareImage } from "@/server/share-image/render";

// The site's default share image, for every page without its own (DECISIONS,
// "Share image and Open Graph tags"). The same card as a project's, with the
// site's own words; built once.
export const alt = messages.share.siteAlt;
export const size = IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderShareImage({
    label: messages.home.hero.eyebrow,
    title: messages.home.hero.title,
    line: messages.metadata.description,
    byline: messages.shell.footer.tagline,
    person: null,
  });
}
