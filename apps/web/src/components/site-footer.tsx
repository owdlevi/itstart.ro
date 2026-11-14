import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "./container";
import { Wordmark } from "./wordmark";

export async function SiteFooter() {
  const t = await getTranslations("shell.footer");
  const links = [
    { href: "/despre", label: t("about") },
    { href: "/reguli", label: t("rules") },
    { href: "/contact", label: t("contact") },
  ];
  return (
    <footer className="border-t border-line bg-surface">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5">
          <div className="flex flex-col gap-1">
            <Wordmark className="text-[20px]" />
            <span className="text-sm text-muted">{t("tagline")}</span>
          </div>
          <nav aria-label={t("navLabel")} className="flex gap-5">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-ink no-underline hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
