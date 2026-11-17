import Link from "next/link";

/** A section's H2 with an optional link on the right; wraps on phones. */
export function SectionHeading({
  title,
  link,
}: {
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 className="text-2xl font-bold leading-[1.12] tracking-[-0.02em] md:text-[28px]">
        {title}
      </h2>
      {link && (
        <Link
          href={link.href}
          className="inline-flex min-h-11 items-center text-[15px] font-semibold"
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}
