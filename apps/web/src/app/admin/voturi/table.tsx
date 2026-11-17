import { cn } from "@/lib/utils";

/**
 * A data table that scrolls sideways inside its own box on a phone, never
 * the page. The box takes the focus, so a keyboard can scroll it too.
 */
export function Table({
  labelledBy,
  children,
}: {
  labelledBy: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-line bg-surface"
    >
      <table className="w-full border-collapse text-left text-[15px] leading-6">
        {children}
      </table>
    </div>
  );
}

export function Th({
  numeric,
  children,
}: {
  numeric?: boolean;
  children: React.ReactNode;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-line px-4 py-3 text-[13px] font-bold uppercase leading-[18px] tracking-[0.06em] text-muted",
        numeric && "text-right",
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  numeric,
  className,
  children,
}: {
  numeric?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <td
      className={cn(
        "border-b border-line px-4 py-2.5 align-top",
        numeric && "text-right tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}
