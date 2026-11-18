import type { DueLink, LinkCheckOutcome } from "@repo/core";
import { core } from "@/server/core";

/** Checks in one step, side by side: at most 10 × 20 s (5 s, 3 redirects). */
const AT_ONCE = 10;

/**
 * The link check over time (HANDOVER §3 M2). The cron route starts one run an
 * hour; core says which links are due and what each answer means.
 */
export async function checkLinks() {
  "use workflow";

  const due = await dueLinks();
  const outcomes: Partial<Record<LinkCheckOutcome, number>> = {};
  for (let i = 0; i < due.length; i += AT_ONCE) {
    for (const outcome of await checkSome(due.slice(i, i + AT_ONCE))) {
      outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    }
  }
  return { checked: due.length, outcomes };
}

async function dueLinks(): Promise<DueLink[]> {
  "use step";
  return core.linkChecks.due();
}

async function checkSome(links: DueLink[]): Promise<LinkCheckOutcome[]> {
  "use step";
  return Promise.all(links.map((link) => core.linkChecks.check(link)));
}
