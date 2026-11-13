# Tabs

Switches between two or three views of the same list, such as "Din provocări" and "Proiecte proprii" on the launch board. Underlined, not boxed.

- Two or three tabs at most. More than that is a filter: use FilterChip.
- Each tab is 48px tall. The selected one is `ink`, bold, with a 3px `primary` underline.
- Use real tab semantics (`role="tablist"`, `role="tab"`, `aria-selected`) and arrow-key movement. Radix Tabs gives both.

```tsx
"use client";
import * as RadixTabs from "@radix-ui/react-tabs";

export const Tabs = RadixTabs.Root;
export const TabsContent = RadixTabs.Content;

export function TabsList(props: RadixTabs.TabsListProps) {
  return <RadixTabs.List className="flex border-b border-line" {...props} />;
}

export function TabsTrigger(props: RadixTabs.TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className="mr-5 min-h-12 border-b-[3px] border-transparent px-1 font-semibold text-muted data-[state=active]:border-primary data-[state=active]:font-bold data-[state=active]:text-ink"
      {...props}
    />
  );
}
```
