const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" });
const DAY = 86_400_000;

/** Whole calendar days in Bucharest from `date` to `now`: 0 today, 1 yesterday. */
export function daysAgo(date: Date, now: Date) {
  const midnight = (d: Date) => Date.parse(`${day.format(d)}T00:00:00Z`);
  return Math.round((midnight(now) - midnight(date)) / DAY);
}

/**
 * The Monday-to-Sunday week in Bucharest that `date` falls in, as the
 * Monday's calendar date ("2026-11-09"): a key for grouping by week.
 */
export function weekOf(date: Date) {
  const today = Date.parse(`${day.format(date)}T00:00:00Z`);
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY;
  return new Date(monday).toISOString().slice(0, 10);
}

/** Whole weeks from `week` (a `weekOf` key) to the week of `now`: 0 this week, 1 last week. */
export function weeksAgo(week: string, now: Date) {
  return Math.round((Date.parse(weekOf(now)) - Date.parse(week)) / (7 * DAY));
}

/**
 * A week's Monday and Sunday, at noon UTC so that formatting them in
 * Bucharest gives the same calendar days ("9–15 noiembrie").
 */
export function weekDays(week: string) {
  const monday = Date.parse(`${week}T12:00:00Z`);
  return { monday: new Date(monday), sunday: new Date(monday + 6 * DAY) };
}

const MINUTE = 60_000;

/**
 * How long ago, for a review: minutes or hours on the same Bucharest day,
 * then calendar days ("ieri", "acum 3 zile"). Null after a week: show the date.
 */
export function timeAgo(
  date: Date,
  now: Date,
): { unit: "now" | "minutes" | "hours" | "days"; n: number } | null {
  const days = daysAgo(date, now);
  if (days >= 7) return null;
  if (days > 0) return { unit: "days", n: days };
  const minutes = Math.floor((now.getTime() - date.getTime()) / MINUTE);
  if (minutes < 1) return { unit: "now", n: 0 };
  if (minutes < 60) return { unit: "minutes", n: minutes };
  return { unit: "hours", n: Math.floor(minutes / 60) };
}

/** Minutes or hours from a launch to `date` ("la 6 minute după lansare"); null after a day. */
export function afterLaunch(
  date: Date,
  launchedAt: Date,
): { unit: "minutes" | "hours"; n: number } | null {
  const minutes = Math.floor((date.getTime() - launchedAt.getTime()) / MINUTE);
  if (minutes < 1 || minutes >= 24 * 60) return null;
  return minutes < 60
    ? { unit: "minutes", n: minutes }
    : { unit: "hours", n: Math.floor(minutes / 60) };
}
