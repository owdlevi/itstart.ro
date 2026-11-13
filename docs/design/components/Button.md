# Button

The one way to trigger an action or a main navigation step. `primary` is the single most important action on a screen; everything else is `secondary`.

- One primary button per view (the header's small "Lansează un proiect" is the exception).
- Label starts with a verb, in Romanian, sentence case: "Intră în provocare".
- Minimum height 48px (44px for `size="sm"`). Never a fixed width: long Hungarian labels wrap.
- On phones, stack buttons full width with `full`.
- Pass `href` for navigation; it renders a link that looks the same.
- `inverse` is only for the green call-to-action band.

```tsx
import Link from "next/link";
import { cn } from "@/lib/cn";

type ButtonProps = {
  variant?: "primary" | "secondary" | "inverse";
  size?: "md" | "sm";
  full?: boolean;
  href?: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"button">, "className" | "children">;

const variants = {
  primary: "bg-primary text-on-primary border-primary hover:bg-primary-hover hover:border-primary-hover",
  secondary: "bg-surface text-ink border-border hover:bg-tint",
  inverse: "bg-surface text-ink border-surface dark:bg-primary dark:text-on-primary dark:border-primary",
};

export function Button({ variant = "primary", size = "md", full, href, className, children, ...props }: ButtonProps) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-md border px-5 py-2 text-center font-semibold leading-5",
    size === "sm" ? "min-h-11 px-4 text-[15px]" : "min-h-12 text-base",
    full && "w-full",
    variants[variant],
    className,
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type="button" className={cls} {...props}>{children}</button>;
}
```
