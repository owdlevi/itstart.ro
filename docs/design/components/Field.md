# Field

A labelled form control: text input, textarea or select, with an optional hint underneath.

- The label is always visible, above the control. No placeholder-only fields.
- Optional fields say "(opțional)" after the label; required is the default and is not marked.
- The hint is one short sentence in `muted`. Use it for limits ("46 din 80 de caractere") and for what makes a good answer.
- Controls are 48px tall, 16px text (so phones do not zoom), `border` edge, `radius-md`.
- Errors replace the hint, in `warning-ink` with an icon, and the control gets `aria-invalid` and `aria-describedby`.

```tsx
import { cn } from "@/lib/cn";

const control = "box-border w-full rounded-md border border-border bg-surface px-3.5 text-base text-ink aria-[invalid=true]:border-warning-ink";

type FieldProps = { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: React.ReactNode };

export function Field({ id, label, hint, error, optional, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-bold leading-[22px]">
        {label}
        {optional && <span className="font-normal text-muted"> (opțional)</span>}
      </label>
      {children}
      {(error || hint) && (
        <span id={`${id}-note`} className={cn("text-sm", error ? "font-semibold text-warning-ink" : "text-muted")}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, "min-h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "resize-y py-3 leading-6", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(control, "min-h-12", className)} {...props} />;
}
```
