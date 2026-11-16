import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/container";
import { NavLinks } from "@/components/nav-links";
import { Wordmark } from "@/components/wordmark";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("metadataTitle"), robots: { index: false } };
}

/**
 * The admin shell (no reference design): the wordmark, the admin's links and
 * the page. It checks nothing itself: a layout doesn't stop its page
 * rendering, so every page calls requireAdmin() and core checks the role again.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <Container className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 md:min-h-[72px]">
          <div className="flex flex-wrap items-center gap-x-6">
            <Link
              href="/"
              aria-label={t("nav.site")}
              className="inline-flex min-h-11 items-center no-underline"
            >
              <Wordmark className="text-[24px] md:text-[26px]" />
            </Link>
            <NavLinks
              label={t("nav.label")}
              className="flex flex-wrap"
              links={[
                { href: "/admin/provocari", label: t("nav.challenges") },
                { href: "/admin/voturi", label: t("nav.votes") },
              ]}
            />
          </div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-[15px] font-semibold"
          >
            {t("nav.site")}
          </Link>
        </Container>
      </header>
      <main id="continut" className="flex-1 pb-16">
        {children}
      </main>
    </div>
  );
}
