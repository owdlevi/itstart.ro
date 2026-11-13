# StatusChip

States a status in a word: "Lansat", "În desfășurare", "Terminată", "Mai sunt 9 zile". `success` for done and live states, `warning` for deadlines.

- Always text, optionally with a 15px icon. Never colour alone.
- `warning` is for time running out, not for errors.

```tsx
import { cn } from "@/lib/cn";

type StatusChipProps = { tone?: "success" | "warning"; icon?: React.ReactNode; children: React.ReactNode };

export function StatusChip({ tone = "success", icon, children }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-1 text-[13px] font-bold leading-5",
        tone === "success" ? "bg-success-bg text-success-ink" : "bg-warning-bg text-warning-ink",
      )}
    >
      {icon}
      {children}
    </span>
  );
}
```
