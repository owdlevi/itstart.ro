"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

/** The header's two links; the current section gets `tint` and aria-current. */
export function NavLinks({
  links,
  label,
  className,
  linkClassName,
}: {
  links: NavLink[];
  label: string;
  className?: string;
  linkClassName?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={className}>
      {links.map((link) => {
        const current =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-md px-3.5 text-[15px] font-semibold leading-5 text-ink no-underline hover:bg-tint hover:text-ink",
              current && "bg-tint",
              linkClassName,
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
