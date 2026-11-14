import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterChipProps = { selected?: boolean } & Omit<
  React.ComponentProps<"button">,
  "aria-pressed"
>;

/**
 * A toggle chip for filters, sort and multi-selects. Selected is a tint fill,
 * a 2px primary border and a check, so the state never rests on colour alone.
 * A submit button by default: on the launch board each chip submits its own
 * GET form, so filters work before hydration too.
 */
export function FilterChip({
  selected,
  className,
  children,
  ...props
}: FilterChipProps) {
  return (
    <button
      type="submit"
      aria-pressed={!!selected}
      className={cn(
        "inline-flex min-h-11 max-w-full flex-none items-center gap-1.5 rounded-md px-3.5 text-sm font-semibold leading-5 text-ink",
        selected
          ? "border-2 border-primary bg-tint"
          : "border border-border bg-surface hover:bg-tint",
        className,
      )}
      {...props}
    >
      {selected && (
        <Check size={15} strokeWidth={2.8} aria-hidden className="flex-none" />
      )}
      {children}
    </button>
  );
}
