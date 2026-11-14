/** Marks an agent, after its name (rule 19). Never wraps; capped at its row like Tag. */
export function AgentBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="max-w-full truncate rounded-sm border border-border px-[7px] py-px text-xs font-bold leading-[18px] text-ink">
      {children}
    </span>
  );
}
