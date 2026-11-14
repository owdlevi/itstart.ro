"use client";

import { Check } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * A status line shown once after an action ("Ești în provocare, Bianca…",
 * screen 08), carried by a query flag. The flag is dropped from the address
 * as soon as the page is up, so a reload, a bookmark or a shared link doesn't
 * show it again. `role="status"` (HANDOVER §10).
 */
export function FlashBanner({
  param,
  tone = "success",
  children,
}: {
  /** The query flag that asked for it, dropped once shown. */
  param: string;
  tone?: "success" | "quiet";
  children: React.ReactNode;
}) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(param)) return;
    url.searchParams.delete(param);
    // Next.js keeps its router in step with replaceState.
    window.history.replaceState(window.history.state, "", url);
  }, [param]);

  return (
    <div
      role="status"
      className={cn(
        "mt-4 flex items-start gap-2.5 rounded-lg px-4 py-3.5 font-semibold md:mt-6 md:px-5 md:py-4",
        tone === "success" ? "bg-success-bg text-success-ink" : "bg-tint text-ink",
      )}
    >
      {tone === "success" && (
        <span className="inline-flex pt-[3px]">
          <Check size={18} strokeWidth={2.8} aria-hidden className="flex-none" />
        </span>
      )}
      <span>{children}</span>
    </div>
  );
}
