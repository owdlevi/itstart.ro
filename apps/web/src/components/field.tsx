import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** The id of a field's hint or error, for the control's `aria-describedby`. */
export const noteId = (id: string) => `${id}-note`;

/**
 * A label above a control, with a hint below that an error replaces (Field
 * spec). The control is the child: give it `id`, `aria-invalid` and
 * `aria-describedby={noteId(id)}`.
 */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  optionalLabel,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  /** "(opțional)", from the caller's messages. */
  optionalLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-bold leading-[22px]">
        {label}
        {optional && (
          <span className="font-normal text-muted"> {optionalLabel}</span>
        )}
      </label>
      {/* A block, not a flex column: an empty live region adds no gap. */}
      <div>
        {children}
        {/* Always present, so an error replacing the hint is announced (§10). */}
        <div aria-live="polite">
          {error ? (
            <span
              id={noteId(id)}
              className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-warning-ink"
            >
              <CircleAlert
                size={18}
                strokeWidth={2.2}
                aria-hidden
                className="shrink-0"
              />
              {error}
            </span>
          ) : (
            hint && (
              <span id={noteId(id)} className="mt-1.5 block text-sm text-muted">
                {hint}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

const control =
  "box-border block w-full rounded-md border border-border bg-surface px-3.5 text-base leading-6 text-ink aria-[invalid=true]:border-warning-ink";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, "min-h-12", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea className={cn(control, "resize-y py-3", className)} {...props} />
  );
}

/** Native, so phones get their own picker. */
export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select className={cn(control, "min-h-12 px-3", className)} {...props} />
  );
}
