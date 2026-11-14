"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

/**
 * Tabs whose state lives in the URL. Each tab is a link with tab semantics:
 * arrow keys move between tabs once hydrated, and the link works before.
 * `children` is the selected tab's panel; the server renders only that one.
 */
export function LinkTabs({
  label,
  value,
  tabs,
  children,
}: {
  label: string;
  value: string;
  tabs: { value: string; label: string; href: string }[];
  children: React.ReactNode;
}) {
  return (
    <Tabs value={value}>
      <TabsList aria-label={label}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            nativeButton={false}
            render={<Link href={tab.href} scroll={false} />}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={value}>{children}</TabsContent>
    </Tabs>
  );
}
