"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const MINUTE = 60_000;

const split = (ms: number) => {
  const minutes = Math.max(0, Math.floor(ms / MINUTE));
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
  };
};

/**
 * Time left until the deadline: zile, ore, minute, no seconds. The first frame
 * uses the server's clock (frozen in design-fixtures mode), so there's no
 * hydration jump; after that it advances by the time elapsed in the browser.
 * The label isn't live, so screen readers don't hear it every minute.
 */
export function Countdown({
  deadline,
  serverNow,
}: {
  deadline: string;
  serverNow: string;
}) {
  const t = useTranslations("countdown");
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const mountedAt = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - mountedAt), 30_000);
    return () => clearInterval(id);
  }, []);

  const left = split(
    new Date(deadline).getTime() - new Date(serverNow).getTime() - elapsed,
  );
  const cells = [
    [left.days, t("days", { n: left.days })],
    [left.hours, t("hours", { n: left.hours })],
    [left.minutes, t("minutes", { n: left.minutes })],
  ] as const;

  return (
    <div
      role="timer"
      aria-label={t("label", left)}
      className="grid grid-cols-3 gap-2"
    >
      {cells.map(([n, label]) => (
        <div
          key={label}
          aria-hidden
          className="flex flex-col items-center gap-0.5 rounded-md border border-line bg-bg px-1 py-2 md:py-2.5"
        >
          <span className="font-display text-[28px] font-bold leading-[1.1] tabular-nums md:text-[32px]">
            {n}
          </span>
          <span className="text-xs font-semibold text-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}
