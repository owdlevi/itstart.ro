"use client";

import { Link as LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Field, Input, noteId } from "./field";

/**
 * "Linkul proiectului" on screen 10: the address without its scheme, as the
 * reference shows it, and a button that copies the full https link.
 */
export function CopyLink({
  url,
  hint,
}: {
  url: string;
  /** M2: the line about the share image. */
  hint?: string;
}) {
  const t = useTranslations("launched.share");
  const tPage = useTranslations("projectPage");
  const [copied, setCopied] = useState(false);
  const shown = url.replace(/^https?:\/\//, "").replace(/^www\./, "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Without clipboard access the field is still there to copy by hand.
      setCopied(false);
    }
  };

  return (
    <Field id="project-link" label={t("linkLabel")} hint={hint}>
      <div className="flex flex-wrap gap-2.5">
        <div className="min-w-0 flex-[1_1_240px]">
          <Input
            id="project-link"
            type="text"
            readOnly
            value={shown}
            aria-describedby={hint ? noteId("project-link") : undefined}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
        <Button variant="secondary" onClick={copy} className="w-full md:w-auto">
          <LinkIcon size={18} strokeWidth={2.2} aria-hidden />
          {t("copy")}
        </Button>
      </div>
      <p
        role="status"
        className={cn("mt-1.5 text-sm text-success-ink", !copied && "sr-only")}
      >
        {copied && tPage("copied")}
      </p>
    </Field>
  );
}
