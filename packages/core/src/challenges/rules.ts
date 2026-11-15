// The admin form's rules that need no database, so the browser checks them
// with the same code (apps/web's zod schema imports "@repo/core/challenge-rules").

import type { ChallengeTip } from "@repo/db";
import { isHttpsUrl } from "../projects/rules";

export { isHttpsUrl };

/** Placeholders, like PROJECT_LIMITS; screen 02 is the reference for what fits. */
export const CHALLENGE_LIMITS = {
  title: 120,
  shortTitle: 30,
  slug: 40,
  summary: 300,
  builtFor: 60,
  buildingPhrase: 80,
  intro: 600,
  scenarioNote: 200,
  scenario: 3000,
  /** Items in each checklist (base level, stretch, launch criteria). */
  listItems: 12,
  listItem: 200,
  launchNote: 300,
  launchCheck: 200,
  materialsUrl: 2000,
  materialsNote: 200,
  /** "Construiește-l cu AI" is a 2×2 grid. */
  tips: 4,
  tipTitle: 80,
  tipText: 300,
  juryNote: 1000,
} as const;

/** What the admin form sends, to create a challenge or edit one. */
export type ChallengeInput = {
  title: string;
  shortTitle: string | null;
  /** Null: made from the short title, or the title. Fixed once it starts. */
  slug: string | null;
  /** "2026-12": the challenge runs for that month (rule 1). Fixed once it starts. */
  month: string;
  summary: string | null;
  builtFor: string | null;
  buildingPhrase: string | null;
  intro: string | null;
  scenarioNote: string | null;
  scenario: string | null;
  baseLevel: string[];
  stretch: string[];
  launchCriteria: string[];
  launchNote: string | null;
  launchCheck: string | null;
  materialsUrl: string | null;
  materialsNote: string | null;
  tips: ChallengeTip[];
  juryNote: string | null;
};

export type ChallengeStatus = "upcoming" | "running" | "ended";

/** Rule 1: a challenge runs from its start until its deadline. */
export function challengeStatus(
  challenge: { startsAt: Date; endsAt: Date },
  at: Date,
): ChallengeStatus {
  if (at < challenge.startsAt) return "upcoming";
  if (at > challenge.endsAt) return "ended";
  return "running";
}

/** Lowercase latin letters and digits, words joined by single "-". */
export function isSlug(value: string): boolean {
  return (
    value.length <= CHALLENGE_LIMITS.slug &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
  );
}

/** "2026-12", a real month. */
export function isMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return !!match && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

const bucharestParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Bucharest",
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** Bucharest's wall clock at `ms`, read as if it were UTC. */
function wallClock(ms: number) {
  const p = Object.fromEntries(
    bucharestParts
      .formatToParts(new Date(ms))
      .map(({ type, value }) => [type, Number(value)]),
  );
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
}

/** The instant a Bucharest wall-clock time names (month 1–12). */
function inBucharest(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle the offset (+2 or +3) for times away from a DST switch,
  // which the 1st at 00:00 and the last day at 23:59 always are.
  let at = wanted - (wallClock(wanted) - wanted);
  at = wanted - (wallClock(at) - at);
  return new Date(at);
}

/**
 * Rule 1: a challenge runs from 00:00 on the month's first day to its deadline,
 * 23:59 on the last day, both in Europe/Bucharest.
 */
export function monthBounds(month: string): { startsAt: Date; endsAt: Date } {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return {
    startsAt: inBucharest(year, m, 1, 0, 0),
    endsAt: inBucharest(year, m, lastDay, 23, 59),
  };
}

/** The Bucharest month `date` falls in: "2026-11". */
export function monthOf(date: Date): string {
  return new Date(wallClock(date.getTime())).toISOString().slice(0, 7);
}

/** `month` moved by `n` months: addMonths("2026-12", 1) is "2027-01". */
export function addMonths(month: string, n: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, m - 1 + n, 1)).toISOString().slice(0, 7);
}
