/**
 * A yes/no choice with a full-sentence label that's part of the tap target
 * (Checkbox spec). Consent starts unticked (rule 22).
 */
export function Checkbox({
  id,
  children,
  ...props
}: { id: string; children: React.ReactNode } & Omit<
  React.ComponentProps<"input">,
  "type" | "id" | "children"
>) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        // The references draw the native box white in both themes (their
        // pages declare no dark color-scheme); accent-color fills it when ticked.
        className="mt-px size-[22px] shrink-0 accent-primary scheme-light"
        {...props}
      />
      <label htmlFor={id} className="text-[15px] leading-[23px]">
        {children}
      </label>
    </div>
  );
}
