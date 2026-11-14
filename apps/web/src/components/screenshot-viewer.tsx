"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The project page's screenshots: one large (16:10) and a three-column strip
 * to pick it. The `tint` behind each image is the placeholder until it loads.
 */
export function ScreenshotViewer({
  name,
  screenshots,
}: {
  name: string;
  screenshots: string[];
}) {
  const t = useTranslations("projectPage.screenshots");
  const [selected, setSelected] = useState(0);
  return (
    <section aria-label={t("label")} className="flex flex-col gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- Blob serves resized webp already */}
      <img
        src={screenshots[selected]}
        alt={t("alt", { name })}
        className="aspect-[16/10] w-full rounded-lg border border-line bg-tint object-cover"
      />
      {screenshots.length > 1 && (
        <div className="grid grid-cols-3 gap-3">
          {screenshots.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={t("thumb", { n: i + 1 })}
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
              className={cn(
                "overflow-hidden rounded-md border-2",
                i === selected ? "border-primary" : "border-line",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
              <img
                src={src}
                alt=""
                className="block h-16 w-full bg-tint object-cover md:h-24"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
