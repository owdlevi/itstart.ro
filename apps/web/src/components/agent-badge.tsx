/** Marks an agent, after its name (rule 19). */
export function AgentBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-sm border border-border px-[7px] py-px text-xs font-bold leading-[18px] text-ink">
      {children}
    </span>
  );
}
