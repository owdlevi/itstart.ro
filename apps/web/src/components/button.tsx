import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = {
  variant?: "primary" | "secondary" | "inverse";
  size?: "md" | "sm";
  /** Full width (phones stack buttons). */
  full?: boolean;
  /** Renders a link that looks the same. */
  href?: string;
  /** With `href`: a plain link to another site, not a client-side navigation. */
  external?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"button">, "className" | "children">;

const variants = {
  primary:
    "border-primary bg-primary text-on-primary hover:border-primary-hover hover:bg-primary-hover",
  secondary: "border-border bg-surface text-ink hover:bg-tint",
  // Only on the green band. Dark mode's band is dark, so the button turns primary.
  inverse:
    "on-band border-surface bg-surface text-ink dark:border-primary dark:bg-primary dark:text-on-primary",
};

export function Button({
  variant = "primary",
  size = "md",
  full,
  href,
  external,
  className,
  children,
  ...props
}: ButtonProps) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-md border py-2 text-center font-semibold leading-5 no-underline",
    size === "sm" ? "min-h-11 px-4 text-[15px]" : "min-h-12 px-5 text-base",
    full && "w-full",
    variants[variant],
    className,
  );
  // A link takes only what describes it (screen 12: "Vezi rezultatele" of which challenge).
  const describedBy = props["aria-describedby"];
  if (href && external) {
    return (
      <a
        href={href}
        rel="noopener"
        aria-describedby={describedBy}
        className={cls}
      >
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} aria-describedby={describedBy} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...props}>
      {children}
    </button>
  );
}
