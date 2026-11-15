import { desc, eq, like, max, ne, or, sql } from "drizzle-orm";
import { challenges, type ChallengeTip, type Db } from "@repo/db";
import { isAdmin } from "../admins";
import { freeSlug, slugBase } from "../slugs";
import {
  CHALLENGE_LIMITS,
  challengeStatus,
  isHttpsUrl,
  isMonth,
  isSlug,
  monthBounds,
  monthOf,
  type ChallengeInput,
  type ChallengeStatus,
} from "./rules";

/** A field the admin form can mark when core refuses what it holds. */
export type ChallengeField = keyof ChallengeInput;

export type ChallengeSaveRefusal =
  | "not_admin"
  | "not_found"
  | "slug_taken"
  | "month_taken" // rule 1: one challenge a month, so never two running
  | "month_out_of_order" // numbers follow the months: #5 comes after #4
  | "month_past" // its deadline has passed
  | "month_locked" // it has started: people joined for that deadline
  | "slug_locked"; // it has started: its address is out there

export type ChallengeSaveResult =
  | { ok: true; slug: string; number: number }
  | { ok: false; reason: ChallengeSaveRefusal }
  /** Empty, too long, or not the right shape; the form checks the same rules first. */
  | { ok: false; reason: "invalid"; field: ChallengeField };

/** A challenge in the admin list. */
export type AdminChallengeRow = {
  slug: string;
  number: number;
  title: string;
  month: string;
  status: ChallengeStatus;
};

/** A challenge as the admin form edits it. */
export type EditableChallenge = {
  slug: string;
  number: number;
  status: ChallengeStatus;
  input: ChallengeInput;
};

export type AdminResult<T> =
  { ok: true; value: T } | { ok: false; reason: "not_admin" | "not_found" };

type Invalid = { ok: false; reason: "invalid"; field: ChallengeField };

/** Spaces tidied: one line, single spaces; blank becomes null. */
const line = (s: string | null) => s?.trim().replace(/\s+/g, " ") || null;
/** Paragraphs kept; blank becomes null. */
const block = (s: string | null) => s?.replace(/\r\n?/g, "\n").trim() || null;

function clean(
  input: ChallengeInput,
): { ok: true; value: ChallengeInput } | Invalid {
  const invalid = (field: ChallengeField): Invalid => ({
    ok: false,
    reason: "invalid",
    field,
  });
  const L = CHALLENGE_LIMITS;
  const value: ChallengeInput = {
    title: line(input.title) ?? "",
    shortTitle: line(input.shortTitle),
    slug: input.slug?.trim() || null,
    month: input.month.trim(),
    summary: block(input.summary),
    builtFor: line(input.builtFor),
    buildingPhrase: line(input.buildingPhrase),
    intro: block(input.intro),
    scenarioNote: line(input.scenarioNote),
    scenario: block(input.scenario),
    baseLevel: input.baseLevel.map((s) => line(s)).filter((s) => s !== null),
    stretch: input.stretch.map((s) => line(s)).filter((s) => s !== null),
    launchCriteria: input.launchCriteria
      .map((s) => line(s))
      .filter((s) => s !== null),
    launchNote: block(input.launchNote),
    launchCheck: line(input.launchCheck),
    materialsUrl: input.materialsUrl?.trim() || null,
    materialsNote: line(input.materialsNote),
    tips: input.tips
      .map((tip) => ({
        title: line(tip.title) ?? "",
        text: block(tip.text) ?? "",
      }))
      .filter((tip) => tip.title || tip.text),
    juryNote: block(input.juryNote),
  };

  if (!value.title || value.title.length > L.title) return invalid("title");
  if (!isMonth(value.month)) return invalid("month");
  if (value.slug !== null && !isSlug(value.slug)) return invalid("slug");
  const texts = [
    ["shortTitle", L.shortTitle],
    ["summary", L.summary],
    ["builtFor", L.builtFor],
    ["buildingPhrase", L.buildingPhrase],
    ["intro", L.intro],
    ["scenarioNote", L.scenarioNote],
    ["scenario", L.scenario],
    ["launchNote", L.launchNote],
    ["launchCheck", L.launchCheck],
    ["materialsNote", L.materialsNote],
    ["juryNote", L.juryNote],
  ] as const;
  for (const [field, limit] of texts) {
    if ((value[field]?.length ?? 0) > limit) return invalid(field);
  }
  for (const field of ["baseLevel", "stretch", "launchCriteria"] as const) {
    const items = value[field];
    if (
      items.length > L.listItems ||
      items.some((item) => item.length > L.listItem)
    ) {
      return invalid(field);
    }
  }
  if (value.materialsUrl !== null && !isHttpsUrl(value.materialsUrl)) {
    return invalid("materialsUrl");
  }
  if (
    value.tips.length > L.tips ||
    value.tips.some(
      (tip) =>
        !tip.title ||
        !tip.text ||
        tip.title.length > L.tipTitle ||
        tip.text.length > L.tipText,
    )
  ) {
    return invalid("tips");
  }
  return { ok: true, value };
}

const columns = (value: ChallengeInput) => ({
  title: value.title,
  shortTitle: value.shortTitle,
  summary: value.summary,
  builtFor: value.builtFor,
  buildingPhrase: value.buildingPhrase,
  intro: value.intro,
  scenarioNote: value.scenarioNote,
  scenario: value.scenario,
  baseLevel: value.baseLevel,
  stretch: value.stretch,
  launchCriteria: value.launchCriteria,
  launchNote: value.launchNote,
  launchCheck: value.launchCheck,
  materialsUrl: value.materialsUrl,
  materialsNote: value.materialsNote,
  tips: value.tips satisfies ChallengeTip[],
  juryNote: value.juryNote,
});

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function createChallengeAdmin(deps: { db: Db; now: () => Date }) {
  const { db, now } = deps;

  /**
   * Rule 1 for a challenge taking `month`: no other has that month, and the
   * numbers follow the months, so "#5" is never older than "#4".
   */
  const checkMonth = async (
    tx: Tx,
    month: string,
    number: number,
    selfId: string | null,
  ): Promise<ChallengeSaveRefusal | null> => {
    const { startsAt, endsAt } = monthBounds(month);
    if (endsAt < now()) return "month_past";
    const others = await tx
      .select({ number: challenges.number, startsAt: challenges.startsAt })
      .from(challenges)
      .where(selfId ? ne(challenges.id, selfId) : undefined);
    const at = startsAt.getTime();
    if (others.some((o) => monthOf(o.startsAt) === month)) {
      return "month_taken";
    }
    const outOfOrder = others.some((o) =>
      o.number < number ? o.startsAt.getTime() > at : o.startsAt.getTime() < at,
    );
    return outOfOrder ? "month_out_of_order" : null;
  };

  /** Every admin write holds this lock, so two saves can't take one month, number or slug. */
  const lock = (tx: Tx) =>
    tx.execute(sql`select pg_advisory_xact_lock(hashtext('challenges:admin'))`);

  const slugTaken = async (tx: Tx, slug: string, selfId: string | null) => {
    const [row] = await tx
      .select({ id: challenges.id })
      .from(challenges)
      .where(eq(challenges.slug, slug));
    return !!row && row.id !== selfId;
  };

  return {
    /** Every challenge, newest month first. Admins only. */
    all: async (actorId: string): Promise<AdminResult<AdminChallengeRow[]>> => {
      if (!(await isAdmin(db, actorId)))
        return { ok: false, reason: "not_admin" };
      const at = now();
      const rows = await db
        .select({
          slug: challenges.slug,
          number: challenges.number,
          title: challenges.title,
          startsAt: challenges.startsAt,
          endsAt: challenges.endsAt,
        })
        .from(challenges)
        .orderBy(desc(challenges.startsAt));
      return {
        ok: true,
        value: rows.map(({ startsAt, endsAt, ...c }) => ({
          ...c,
          month: monthOf(startsAt),
          status: challengeStatus({ startsAt, endsAt }, at),
        })),
      };
    },

    /** A challenge prefilled for the admin form. Admins only. */
    editable: async (
      slug: string,
      actorId: string,
    ): Promise<AdminResult<EditableChallenge>> => {
      if (!(await isAdmin(db, actorId)))
        return { ok: false, reason: "not_admin" };
      const [row] = await db
        .select()
        .from(challenges)
        .where(eq(challenges.slug, slug));
      if (!row) return { ok: false, reason: "not_found" };
      return {
        ok: true,
        value: {
          slug: row.slug,
          number: row.number,
          status: challengeStatus(row, now()),
          input: {
            title: row.title,
            shortTitle: row.shortTitle,
            slug: row.slug,
            month: monthOf(row.startsAt),
            summary: row.summary,
            builtFor: row.builtFor,
            buildingPhrase: row.buildingPhrase,
            intro: row.intro,
            scenarioNote: row.scenarioNote,
            scenario: row.scenario,
            baseLevel: row.baseLevel,
            stretch: row.stretch,
            launchCriteria: row.launchCriteria,
            launchNote: row.launchNote,
            launchCheck: row.launchCheck,
            materialsUrl: row.materialsUrl,
            materialsNote: row.materialsNote,
            tips: row.tips,
            juryNote: row.juryNote,
          },
        },
      };
    },

    /**
     * A new challenge for a month that hasn't ended, after every other one
     * (rule 1), numbered next. Its deadline is derived from the month. Admins only.
     */
    create: async (
      actorId: string,
      input: ChallengeInput,
    ): Promise<ChallengeSaveResult> => {
      const cleaned = clean(input);
      if (!cleaned.ok) return cleaned;
      const value = cleaned.value;

      return db.transaction(async (tx): Promise<ChallengeSaveResult> => {
        if (!(await isAdmin(tx, actorId)))
          return { ok: false, reason: "not_admin" };
        await lock(tx);
        const [last] = await tx
          .select({ number: max(challenges.number) })
          .from(challenges);
        const number = (last?.number ?? 0) + 1;
        const refusal = await checkMonth(tx, value.month, number, null);
        if (refusal) return { ok: false, reason: refusal };

        let slug = value.slug;
        if (slug === null) {
          const base = slugBase(value.shortTitle ?? value.title, "provocare");
          const taken = await tx
            .select({ slug: challenges.slug })
            .from(challenges)
            .where(
              or(eq(challenges.slug, base), like(challenges.slug, `${base}-%`)),
            );
          slug = freeSlug(base, new Set(taken.map((t) => t.slug)));
        } else if (await slugTaken(tx, slug, null)) {
          return { ok: false, reason: "slug_taken" };
        }

        await tx.insert(challenges).values({
          number,
          slug,
          ...columns(value),
          ...monthBounds(value.month),
          createdAt: now(),
        });
        return { ok: true, slug, number };
      });
    },

    /**
     * Saves an admin's changes. The brief can change at any time; the month
     * and the slug only until the challenge starts. Admins only.
     */
    edit: async (
      actorId: string,
      slug: string,
      input: ChallengeInput,
    ): Promise<ChallengeSaveResult> => {
      const cleaned = clean(input);
      if (!cleaned.ok) return cleaned;
      const value = cleaned.value;

      return db.transaction(async (tx): Promise<ChallengeSaveResult> => {
        if (!(await isAdmin(tx, actorId)))
          return { ok: false, reason: "not_admin" };
        await lock(tx);
        const [current] = await tx
          .select({
            id: challenges.id,
            number: challenges.number,
            startsAt: challenges.startsAt,
            endsAt: challenges.endsAt,
          })
          .from(challenges)
          .where(eq(challenges.slug, slug));
        if (!current) return { ok: false, reason: "not_found" };
        const started = challengeStatus(current, now()) !== "upcoming";

        const newSlug = value.slug ?? slug;
        if (newSlug !== slug) {
          if (started) return { ok: false, reason: "slug_locked" };
          if (await slugTaken(tx, newSlug, current.id)) {
            return { ok: false, reason: "slug_taken" };
          }
        }
        const moved = value.month !== monthOf(current.startsAt);
        if (moved) {
          if (started) return { ok: false, reason: "month_locked" };
          const refusal = await checkMonth(
            tx,
            value.month,
            current.number,
            current.id,
          );
          if (refusal) return { ok: false, reason: refusal };
        }

        await tx
          .update(challenges)
          .set({
            ...columns(value),
            slug: newSlug,
            ...(moved && monthBounds(value.month)),
          })
          .where(eq(challenges.id, current.id));
        return { ok: true, slug: newSlug, number: current.number };
      });
    },
  };
}

export type ChallengeAdmin = ReturnType<typeof createChallengeAdmin>;
