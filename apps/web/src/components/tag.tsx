import Link from "next/link";
import { cn } from "@/lib/utils";

const tag =
  "max-w-full truncate rounded-sm bg-tint px-[9px] py-[3px] text-[13px] font-semibold leading-5 text-ink no-underline";

/**
 * A tool or challenge label; opens the launch board filtered by it. Never
 * wraps inside (spec); a name longer than its row is cut with an ellipsis.
 * Without `href` it's plain text: the launch form's preview, where a link
 * would leave an unsaved form.
 */
export function Tag({
  href,
  children,
}: {
  href?: string;
  children: React.ReactNode;
}) {
  if (!href) return <span className={tag}>{children}</span>;
  return (
    <Link href={href} className={cn(tag, "hover:bg-line hover:text-ink")}>
      {children}
    </Link>
  );
}
