const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" });
const DAY = 86_400_000;

/** Whole calendar days in Bucharest from `date` to `now`: 0 today, 1 yesterday. */
export function daysAgo(date: Date, now: Date) {
  const midnight = (d: Date) => Date.parse(`${day.format(d)}T00:00:00Z`);
  return Math.round((midnight(now) - midnight(date)) / DAY);
}
