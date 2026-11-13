# Countdown

Time left until a challenge deadline, in three cells: zile, ore, minute. Digits in the display face, tabular. No seconds: a ticking second counter adds pressure and nothing else when the deadline is days away.

- The consumer provides the deadline as an ISO date. Render the first frame on the server from the same clock to avoid a hydration jump, or render after mount.
- `role="timer"` with a spoken label that leaves out seconds.
- After the deadline, replace it with a StatusChip ("Încheiată").

```tsx
"use client";
import { useEffect, useState } from "react";

const split = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
};

export function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const [d, h, m] = split(now === null ? 0 : new Date(deadline).getTime() - now);
  const cells: [number, string][] = [[d, "zile"], [h, "ore"], [m, "minute"]];
  return (
    <div role="timer" aria-label={`Mai sunt ${d} zile, ${h} ore și ${m} minute`} className="grid grid-cols-3 gap-2">
      {cells.map(([n, label]) => (
        <div key={label} className="flex flex-col items-center gap-0.5 rounded-md border border-line bg-bg px-1 py-2.5">
          <span className="font-display text-[32px] font-bold leading-[1.1] tabular-nums">
            {now === null ? "··" : String(n).padStart(2, "0")}
          </span>
          <span className="text-xs font-semibold text-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}
```
