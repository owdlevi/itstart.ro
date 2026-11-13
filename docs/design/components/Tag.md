# Tag

A quiet label for a tool or a challenge on a project: "Next.js", "Claude", "Provocarea #4". `tint` fill, `ink` text.

- A link: it opens the launch board filtered by that tag. Pass the `href`.
- Two or three per project in lists; all of them on the project page.
- Never wraps inside; a row of tags wraps.

```tsx
import Link from "next/link";

export function Tag({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="whitespace-nowrap rounded-sm bg-tint px-[9px] py-[3px] text-[13px] font-semibold leading-5 text-ink no-underline hover:bg-line">
      {children}
    </Link>
  );
}
```
