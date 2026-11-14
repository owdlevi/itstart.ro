import Link from "next/link";

/**
 * A tool or challenge label; opens the launch board filtered by it. Never
 * wraps inside (spec); a name longer than its row is cut with an ellipsis.
 */
export function Tag({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="max-w-full truncate rounded-sm bg-tint px-[9px] py-[3px] text-[13px] font-semibold leading-5 text-ink no-underline hover:bg-line hover:text-ink"
    >
      {children}
    </Link>
  );
}
