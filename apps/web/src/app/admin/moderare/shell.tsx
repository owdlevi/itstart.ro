import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/container";
import { cn } from "@/lib/utils";

const sections = {
  reports: "/admin/moderare",
  recent: "/admin/moderare/recente",
  hidden: "/admin/moderare/ascunse",
} as const;

/** The moderation pages' title and their three sections (no reference design). */
export async function ModerationShell({
  current,
  lead,
  children,
}: {
  current: keyof typeof sections;
  lead: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin.moderation");
  return (
    <Container className="max-w-[960px] pt-8 md:pt-12">
      <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[40px]">
        {t("title")}
      </h1>
      <nav aria-label={t("tabsLabel")} className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(sections) as (keyof typeof sections)[]).map((key) => (
          <Link
            key={key}
            href={sections[key]}
            aria-current={key === current ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-md border border-line px-3.5 text-[15px] font-semibold leading-5 text-ink no-underline hover:bg-tint hover:text-ink",
              key === current && "border-primary bg-tint",
            )}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>
      <p className="mt-4 max-w-[640px] text-muted">{lead}</p>
      <div className="mt-6">{children}</div>
    </Container>
  );
}
