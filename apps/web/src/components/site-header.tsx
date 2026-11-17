import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getRunningChallenge } from "@/server/challenge";
import { getSession } from "@/server/session";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { Container } from "./container";
import { NavLinks } from "./nav-links";
import { Wordmark } from "./wordmark";

/** HANDOVER §6 "Shared shell": one row on desktop, two on phones. */
export async function SiteHeader() {
  const [t, session, challenge] = await Promise.all([
    getTranslations("shell"),
    getSession(),
    getRunningChallenge(),
  ]);
  const user = session?.user;

  const links = [
    {
      href: challenge ? `/provocari/${challenge.slug}` : "/provocari",
      label: t("nav.challenge"),
      // Every challenge and the archive (screens 11 and 12 show it current).
      also: ["/provocari"],
    },
    // A project page belongs to the board (screen 04 shows "Lansări" current).
    {
      href: "/lansari",
      label: t("nav.launches"),
      also: ["/proiecte", "/lanseaza"],
    },
  ];
  const nav = (className: string, linkClassName?: string) => (
    <NavLinks
      links={links}
      label={t("navLabel")}
      className={className}
      linkClassName={linkClassName}
    />
  );

  const right = user ? (
    <div className="flex items-center gap-3">
      <Button href="/lanseaza" size="sm" className="hidden md:inline-flex">
        <Plus size={18} strokeWidth={2.2} aria-hidden />
        {t("launchProject")}
      </Button>
      <Link
        // Until onboarding is done there's no profile, and maybe no name yet.
        href={
          user.onboardedAt && user.handle ? `/u/${user.handle}` : "/bun-venit"
        }
        aria-label={
          user.onboardedAt
            ? t("profileLabel", { name: user.name })
            : t("finishProfile")
        }
        className="inline-flex size-11 items-center justify-center rounded-full no-underline"
      >
        <Avatar
          person={{
            id: user.id,
            name: user.name,
            avatarUrl: user.image ?? null,
            avatarFill: user.avatarFill ?? null,
            isAgent: user.isAgent,
          }}
        />
      </Link>
    </div>
  ) : (
    <Button href="/intra" variant="secondary" size="sm">
      <span className="md:hidden">{t("signInShort")}</span>
      <span className="hidden md:inline">{t("signIn")}</span>
    </Button>
  );

  return (
    <header className="border-b border-line bg-surface">
      <Container>
        <div className="flex min-h-14 items-center justify-between gap-3 md:min-h-[72px] md:flex-wrap md:gap-6">
          <div className="flex flex-wrap items-center gap-8">
            <Link
              href="/"
              aria-label={t("homeLabel")}
              className="inline-flex min-h-11 items-center no-underline"
            >
              <Wordmark className="text-[24px] md:text-[26px]" />
            </Link>
            {nav("hidden gap-1 md:flex")}
          </div>
          {right}
        </div>
        {nav("flex gap-2 pb-2 md:hidden", "flex-1")}
      </Container>
    </header>
  );
}

/** The wordmark alone, for sign-in and onboarding (screens 06 and 07). */
export async function BareHeader() {
  const t = await getTranslations("shell");
  return (
    <header className="border-b border-line bg-surface">
      <Container>
        <div className="flex min-h-14 items-center md:min-h-[72px]">
          <Link
            href="/"
            aria-label={t("homeLabel")}
            className="inline-flex min-h-11 items-center no-underline"
          >
            <Wordmark className="text-[24px] md:text-[26px]" />
          </Link>
        </div>
      </Container>
    </header>
  );
}
