import type { BoardProject, ChallengeOption } from "@repo/core";
import { Plus } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { FilterChip } from "@/components/filter-chip";
import { LaunchRow } from "@/components/launch-row";
import { LinkTabs } from "@/components/link-tabs";
import { ProjectVote } from "@/components/project-vote";
import { flags } from "@/flags";
import { weekDays, weekOf, weeksAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getRunningChallenge } from "@/server/challenge";
import { core, now } from "@/server/core";
import { getSession } from "@/server/session";
import {
  boardHref,
  boardQuery,
  parseBoardParams,
  type BoardParams,
} from "./board-params";

// The Etichete row: the AI builders people start with (screen 07's list) and
// the two stacks most launches use. A tool from a Tag link that isn't here is
// added at the end, selected.
const TOOLS = ["Claude", "Cursor", "v0", "Lovable", "Next.js", "Supabase"];

const PARAM = {
  challenge: "provocare",
  tool: "eticheta",
  stage: "stadiu",
  sort: "sortare",
} as const;
type Field = keyof typeof PARAM;

/** Screen 03 · Lansări (HANDOVER §6). */
export default async function BoardPage({
  searchParams,
}: PageProps<"/lansari">) {
  const [query, session, running, started, t, tShell] = await Promise.all([
    searchParams,
    getSession(),
    getRunningChallenge(),
    core.challenges.started(),
    getTranslations("board"),
    getTranslations("shell"),
  ]);
  const runningSlug = running?.slug ?? null;
  const parsed = parseBoardParams(query, runningSlug);
  // An unknown slug shows every challenge, as "Toate" does.
  const challenge = started.find((c) => c.slug === parsed.challenge) ?? null;
  const params: BoardParams = { ...parsed, challenge: challenge?.slug ?? null };
  const viewerId = session?.user.id ?? null;

  const rows = await core.projects.board({
    scope:
      params.tab === "own"
        ? "own"
        : challenge
          ? { challengeId: challenge.id }
          : "challenges",
    stage: params.stage,
    sort: params.sort,
    tool: params.tool,
    viewerId,
    agents: flags.builderAgents,
  });

  const href = (change: Partial<BoardParams>) =>
    boardHref({ ...params, ...change }, runningSlug);
  // "Șterge filtrele" shows everything launched in this tab, keeping the sort.
  const cleared: BoardParams = {
    ...params,
    challenge: null,
    tool: null,
    stage: "launched",
  };
  const filtered = href({}) !== boardHref(cleared, runningSlug);

  return (
    <Container className="max-w-[960px]">
      <div className="flex flex-col gap-3 pb-4 pt-7 md:pb-5 md:pt-12">
        <h1 className="text-[36px] font-bold leading-[1.12] tracking-[-0.02em] md:text-5xl md:leading-[1.12]">
          {t("title")}
        </h1>
        <p className="text-[17px] leading-[26px] text-muted">{t("lead")}</p>
        {/* Desktop has this button in the header. */}
        {session && (
          <Button href="/lanseaza" full className="md:hidden">
            <Plus size={18} strokeWidth={2.2} aria-hidden />
            {tShell("launchProject")}
          </Button>
        )}
      </div>

      <LinkTabs
        label={t("tabsLabel")}
        value={params.tab}
        tabs={(["challenges", "own"] as const).map((tab) => ({
          value: tab,
          label: t(`tabs.${tab}`),
          // A tab starts from its own defaults, keeping only the sort.
          href: boardHref(
            {
              tab,
              challenge: tab === "challenges" ? runningSlug : null,
              tool: null,
              stage: "launched",
              sort: params.sort,
            },
            runningSlug,
          ),
        }))}
      >
        <div className="flex flex-col gap-3 py-4">
          {/* "Proiecte proprii" is the same board without this row (§13.4). */}
          {params.tab === "challenges" && started.length > 0 && (
            <ChipRow
              label={t("filters.challenge")}
              field="challenge"
              params={params}
              runningSlug={runningSlug}
              options={[
                { value: null, label: t("filters.all") },
                ...started.map((c: ChallengeOption) => ({
                  value: c.slug,
                  label: t("filters.challengeChip", {
                    number: c.number,
                    title: c.shortTitle,
                  }),
                })),
              ]}
            />
          )}
          <ChipRow
            label={t("filters.tags")}
            field="tool"
            params={params}
            runningSlug={runningSlug}
            options={[
              { value: null, label: t("filters.all") },
              ...[
                ...TOOLS,
                ...(params.tool && !TOOLS.includes(params.tool)
                  ? [params.tool]
                  : []),
              ].map((tool) => ({ value: tool, label: tool })),
            ]}
          />
          <ChipRow
            label={t("filters.stage")}
            field="stage"
            params={params}
            runningSlug={runningSlug}
            options={[
              { value: "launched", label: t("filters.launched") },
              { value: "in_progress", label: t("filters.inProgress") },
            ]}
          />
        </div>

        {/* Projects in progress have no votes to sort by (rule 5). The
            "Arată și agenții AI" checkbox joins this row in M3. */}
        {params.stage === "launched" && (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-3">
            <ChipRow
              label={t("sort.label")}
              field="sort"
              params={params}
              runningSlug={runningSlug}
              inline
              options={[
                { value: "newest", label: t("sort.newest") },
                { value: "votes", label: t("sort.votes") },
              ]}
            />
          </div>
        )}

        <div className="flex flex-col gap-7 pb-10 pt-4 md:gap-10 md:pb-[72px] md:pt-6">
          {rows.length === 0 ? (
            <p className="text-muted">
              {t("empty")}{" "}
              {filtered && (
                <Link href={boardHref(cleared, runningSlug)} scroll={false}>
                  {t("clear")}
                </Link>
              )}
            </p>
          ) : (
            byWeek(rows).map(([week, projects]) => (
              <WeekGroup
                key={week}
                week={week}
                stage={params.stage}
                projects={projects}
                viewerId={viewerId}
              />
            ))
          )}
        </div>
      </LinkTabs>
    </Container>
  );
}

/** Rows grouped by Bucharest week, newest week first; each keeps the sort. */
function byWeek(rows: BoardProject[]) {
  const weeks = new Map<string, BoardProject[]>();
  for (const row of rows) {
    const week = weekOf(row.at);
    weeks.set(week, [...(weeks.get(week) ?? []), row]);
  }
  return [...weeks].sort(([a], [b]) => b.localeCompare(a));
}

async function WeekGroup({
  week,
  stage,
  projects,
  viewerId,
}: {
  week: string;
  stage: BoardParams["stage"];
  projects: BoardProject[];
  viewerId: string | null;
}) {
  const [t, format] = await Promise.all([
    getTranslations("board.week"),
    getFormatter(),
  ]);
  const { monday, sunday } = weekDays(week);
  const range = format.dateTimeRange(monday, sunday, {
    day: "numeric",
    month: "long",
  });
  const ago = weeksAgo(week, now());
  const count = t("count", { stage, n: projects.length });
  // This week and last week are named, with the dates beside them; older
  // weeks are headed by their dates.
  const title = ago <= 0 ? t("this") : ago === 1 ? t("last") : range;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[22px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[26px]">
          {title}
        </h2>
        <span className="text-sm text-muted">
          {ago <= 1 ? t("meta", { range, count }) : count}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {projects.map((project) => (
          <LaunchRow
            key={project.id}
            project={project}
            vote={
              <ProjectVote
                project={project}
                viewerId={viewerId}
                votingOpen={project.votingOpen}
              />
            }
          />
        ))}
      </div>
    </section>
  );
}

/**
 * One filter row: a GET form whose chips each submit their own value, with
 * the rest of the board's state in hidden inputs. Works before hydration;
 * next/form makes it a client-side navigation after.
 */
function ChipRow<F extends Field>({
  label,
  field,
  params,
  runningSlug,
  options,
  inline,
}: {
  label: string;
  field: F;
  params: BoardParams;
  runningSlug: string | null;
  options: { value: BoardParams[F]; label: string }[];
  /** Label beside the chips at every width (the sort row). */
  inline?: boolean;
}) {
  const name = PARAM[field];
  const rest = Object.entries(boardQuery(params, runningSlug)).filter(
    ([key]) => key !== name,
  );

  return (
    <Form
      action="/lansari"
      scroll={false}
      role="group"
      aria-label={label}
      className={cn(
        "flex min-w-0",
        inline
          ? "flex-wrap items-center gap-2"
          : "flex-col gap-1.5 md:flex-row md:items-center md:gap-3",
      )}
    >
      <span
        className={cn(
          "flex-none text-[13px] font-bold leading-[18px] text-muted",
          !inline && "md:w-[84px]",
        )}
      >
        {label}
      </span>
      {rest.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div
        className={cn(
          "flex min-w-0 gap-2",
          inline
            ? "contents"
            : // Phones scroll the row sideways instead of wrapping (FilterChip spec).
              "flex-nowrap overflow-x-auto px-0.5 pb-1.5 pt-0.5 md:flex-wrap md:overflow-visible md:p-0",
        )}
      >
        {options.map((option) => {
          // The value this chip puts in the URL; none when it's the default.
          const value = boardQuery(
            { ...params, [field]: option.value },
            runningSlug,
          )[name];
          return (
            <FilterChip
              key={option.label}
              selected={params[field] === option.value}
              name={value ? name : undefined}
              value={value}
            >
              {option.label}
            </FilterChip>
          );
        })}
      </div>
    </Form>
  );
}
