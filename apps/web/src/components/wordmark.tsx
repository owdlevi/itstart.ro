import { cn } from "@/lib/utils";

/** "IT" 500 in ink + "Start" 800 in primary, live text, no space. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-display leading-none tracking-[-0.02em]",
        className,
      )}
    >
      <span className="font-medium text-ink">IT</span>
      <span className="font-extrabold text-primary">Start</span>
    </span>
  );
}
