import { addMonths, monthBounds, monthOf } from "@repo/core";

/** How far ahead the month picker reaches. */
const MONTHS_AHEAD = 12;

/**
 * The month picker's options: from this month to a year ahead, plus `own`
 * (the challenge's month, wherever it is). Months other challenges hold are
 * marked taken; core refuses them anyway (rule 1).
 */
export function monthOptions({
  now,
  own,
  taken,
  label,
}: {
  now: Date;
  own: string | null;
  taken: string[];
  label: (startsAt: Date) => string;
}) {
  const first = monthOf(now);
  const values = Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) =>
    addMonths(first, i),
  );
  if (own && !values.includes(own)) values.unshift(own);
  return values.map((value) => ({
    value,
    label: label(monthBounds(value).startsAt),
    taken: value !== own && taken.includes(value),
  }));
}
