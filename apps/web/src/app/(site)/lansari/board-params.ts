// The launch board's state lives in the URL, so a filtered board can be shared
// (HANDOVER §6 03). Romanian names, defaults left out of the URL:
//   tip=proprii           tab "Proiecte proprii" (default "Din provocări")
//   provocare=<slug>      one challenge; "toate" for every one (default: the running challenge)
//   eticheta=<tool>       one tool (default: any)
//   stadiu=in-lucru       projects in progress (default: launched)
//   sortare=voturi        most votes first (default: newest first)

export type BoardParams = {
  tab: "challenges" | "own";
  /** A challenge's slug, or null for every challenge. */
  challenge: string | null;
  tool: string | null;
  stage: "launched" | "in_progress";
  sort: "newest" | "votes";
};

const ALL = "toate";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || null;

/** Reads the board's state; anything unknown falls back to the default. */
export function parseBoardParams(
  query: SearchParams,
  runningSlug: string | null,
): BoardParams {
  const challenge = one(query.provocare);
  return {
    tab: one(query.tip) === "proprii" ? "own" : "challenges",
    challenge: challenge === ALL ? null : (challenge ?? runningSlug),
    tool: one(query.eticheta),
    stage: one(query.stadiu) === "in-lucru" ? "in_progress" : "launched",
    sort: one(query.sortare) === "voturi" ? "votes" : "newest",
  };
}

/** The query that gives `params`, without the defaults. */
export function boardQuery(
  params: BoardParams,
  runningSlug: string | null,
): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.tab === "own") query.tip = "proprii";
  // "Proiecte proprii" has no challenge row (HANDOVER §13.4).
  else if (params.challenge !== runningSlug)
    query.provocare = params.challenge ?? ALL;
  if (params.tool) query.eticheta = params.tool;
  if (params.stage === "in_progress") query.stadiu = "in-lucru";
  if (params.sort === "votes") query.sortare = "voturi";
  return query;
}

export function boardHref(params: BoardParams, runningSlug: string | null) {
  const query = new URLSearchParams(boardQuery(params, runningSlug));
  return query.size ? `/lansari?${query}` : "/lansari";
}
