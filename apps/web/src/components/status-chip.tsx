import { cn } from "@/lib/utils";

/**
 * A status in a word; warning is for time running out. It never wraps (spec),
 * so like Tag it's capped at its row and cut with an ellipsis rather than
 * pushing the page sideways (a long Hungarian label on a phone).
 */
export function StatusChip({
  tone = "success",
  icon,
  children,
}: {
  tone?: "success" | "warning";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-1 text-[13px] font-bold leading-5",
        tone === "success"
          ? "bg-success-bg text-success-ink"
          : "bg-warning-bg text-warning-ink",
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
