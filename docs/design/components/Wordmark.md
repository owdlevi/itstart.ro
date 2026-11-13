# Wordmark

The ITStart name as live type: "IT" in `ink` at weight 500, "Start" in `primary` at weight 800, no space. Shown here next to the icon.

- Sizes: 24–26px in the header, 20px in the footer.
- Never recolour the halves, add a space, or set it in all caps.
- In the header it links to the home page with the label "ITStart, pagina principală".
- The icon is a brand asset, not a component: export it from the brand canvas as `app/icon.png` and `app/apple-icon.png`.

```tsx
import { cn } from "@/lib/cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-2xl leading-none tracking-[-0.02em]", className)}>
      <span className="font-medium text-ink">IT</span>
      <span className="font-extrabold text-primary">Start</span>
    </span>
  );
}
```
