# VoteButton

Shows a project's vote count and lets a signed-in person add or remove their vote. Unvoted is a `surface` button with a `border` edge; voted fills with `primary`.

- The count is always visible, with tabular numerals so it does not jump.
- The state is never colour alone: `aria-pressed` and the label change too.
- `wide` is the row layout for the project page header. There it is a secondary action next to "Deschide proiectul", so its voted state is a `tint` fill with a `primary` border, not a solid green.
- When voting is not possible, render `VoteCount` instead: your own project and closed challenges show a plain count; a project "În lucru" shows the `wip` box. Never render a disabled button.
- A signed-out visitor always sees the unvoted state; tapping it leads to sign-in.
- The consumer provides `count`, `voted` and `onToggle`; update optimistically.

```tsx
"use client";
import { ArrowUp, Check } from "lucide-react";
import { cn } from "@/lib/cn";

type VoteButtonProps = { count: number; voted: boolean; onToggle: () => void; wide?: boolean };

export function VoteButton({ count, voted, onToggle, wide }: VoteButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={voted}
      aria-label={`${voted ? "Ai votat" : "Votează"} · ${count} voturi`}
      onClick={onToggle}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border font-bold leading-5 tabular-nums",
        wide ? "min-h-12 gap-2 px-5" : "min-h-[60px] w-14 flex-col gap-0.5",
        !voted && "border-border bg-surface text-ink hover:bg-tint",
        voted && !wide && "border-primary bg-primary text-on-primary",
        voted && wide && "border-2 border-primary bg-tint text-ink",
      )}
    >
      {voted && wide ? <Check size={18} strokeWidth={2.6} aria-hidden /> : <ArrowUp size={18} strokeWidth={2.6} aria-hidden />}
      <span>{wide ? `${voted ? "Ai votat" : "Votează"} · ${count}` : count}</span>
    </button>
  );
}

type VoteCountProps = { count: number; reason: "own" | "closed" | "wip" };

export function VoteCount({ count, reason }: VoteCountProps) {
  if (reason === "wip") {
    return (
      <div role="img" aria-label="În lucru, încă nu intră la vot" className="flex min-h-[60px] w-14 shrink-0 items-center justify-center rounded-md bg-warning-bg text-center text-xs font-bold leading-[15px] text-warning-ink">
        în<br />lucru
      </div>
    );
  }
  return (
    <div role="img" aria-label={`${count} voturi · ${reason === "own" ? "proiectul tău" : "votul s-a încheiat"}`} className="flex min-h-[60px] w-14 shrink-0 flex-col items-center justify-center rounded-md bg-tint tabular-nums">
      <span className="font-bold leading-5">{count}</span>
      <span className="text-[11px] font-semibold leading-[14px] text-muted">voturi</span>
    </div>
  );
}
```
