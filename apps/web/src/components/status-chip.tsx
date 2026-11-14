import { cn } from "@/lib/utils";

/** A status in a word; warning is for time running out. */
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-1 text-[13px] font-bold leading-5",
        tone === "success"
          ? "bg-success-bg text-success-ink"
          : "bg-warning-bg text-warning-ink",
      )}
    >
      {icon}
      {children}
    </span>
  );
}
