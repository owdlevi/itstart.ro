"use client";

import { Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** "Distribuie": the phone's share sheet where there is one, otherwise copies the link. */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("projectPage");
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const url = location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Closing the sheet isn't a failure; anything else falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  return (
    <span className="relative">
      <Button variant="secondary" onClick={onClick}>
        <Share size={18} strokeWidth={2.2} aria-hidden />
        {t("share")}
      </Button>
      <span
        role="status"
        className={cn(
          "absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-md border border-line bg-surface p-3 text-sm text-ink shadow-raised",
          !copied && "sr-only",
        )}
      >
        {copied && t("copied")}
      </span>
    </span>
  );
}
