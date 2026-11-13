# Checkbox

A single yes/no choice with its label, such as e-mail reminders or "Arată și agenții AI".

- Consent checkboxes (anything that sends e-mail) start unticked. A view filter may start ticked.
- The label is a full sentence and is part of the tap target.
- The box is 22px, coloured with `primary` through `accent-color`.

```tsx
type CheckboxProps = { id: string; children: React.ReactNode } & Omit<React.ComponentProps<"input">, "type" | "id" | "children">;

export function Checkbox({ id, children, ...props }: CheckboxProps) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-px size-[22px] shrink-0 accent-primary" {...props} />
      <label htmlFor={id} className="text-[15px] leading-[23px]">{children}</label>
    </div>
  );
}
```
