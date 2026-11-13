# FilterChip

A toggle chip. Used in filter rows on the launch board (challenge, tag, stage, sort) and as a multi-select in forms (tools used, stage of a project). Selected is a `tint` fill with a 2px `primary` border and a check icon, so the state never depends on colour alone.

- Group chips in a `role="group"` with a label ("Provocare", "Etichete"). "Toate" is first.
- On phones the row scrolls sideways instead of wrapping (`flex-nowrap overflow-x-auto`).
- 44px tall. Uses `aria-pressed`.

```tsx
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type FilterChipProps = { selected?: boolean } & React.ComponentProps<"button">;

export function FilterChip({ selected, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      className={cn(
        "min-h-11 shrink-0 rounded-md border px-3.5 text-sm font-semibold",
        "inline-flex items-center gap-1.5",
        selected ? "border-2 border-primary bg-tint text-ink" : "border-border bg-surface text-ink hover:bg-tint",
        className,
      )}
      {...props}
    >
      {selected && <Check size={15} strokeWidth={2.8} aria-hidden />}
      {children}
    </button>
  );
}
```
