import {
  CHALLENGE_LIMITS,
  isHttpsUrl,
  isMonth,
  isSlug,
  type ChallengeInput,
} from "@repo/core/challenge-rules";
import { z } from "zod";

export { CHALLENGE_LIMITS };

/** The query flag that shows "Am salvat provocarea." once on its edit page. */
export const CHALLENGE_SAVED_PARAM = "salvat";

const L = CHALLENGE_LIMITS;
const text = (max: number) => z.string().trim().max(max, { error: "too_long" });

/** A checklist typed one item per line; blank lines don't count. */
export const listItems = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const list = z
  .string()
  .max(L.listItems * (L.listItem + 2))
  .refine((value) => listItems(value).length <= L.listItems, {
    error: "too_many",
  })
  .refine((value) => listItems(value).every((i) => i.length <= L.listItem), {
    error: "item_too_long",
  });

/**
 * The admin's challenge form, parsed in the browser and again in the action;
 * core checks every rule once more. Errors are codes, mapped to copy by the form.
 */
export const challengeSchema = z.object({
  title: text(L.title).min(1, { error: "empty" }),
  shortTitle: text(L.shortTitle),
  slug: z
    .string()
    .trim()
    .refine((value) => !value || isSlug(value), { error: "invalid" }),
  month: z.string().refine(isMonth, { error: "empty" }),
  summary: text(L.summary),
  builtFor: text(L.builtFor),
  buildingPhrase: text(L.buildingPhrase),
  intro: text(L.intro),
  scenarioNote: text(L.scenarioNote),
  scenario: text(L.scenario),
  baseLevel: list,
  stretch: list,
  launchCriteria: list,
  launchNote: text(L.launchNote),
  launchCheck: text(L.launchCheck),
  materialsUrl: z
    .string()
    .trim()
    .refine((value) => !value || isHttpsUrl(value), { error: "invalid" }),
  materialsNote: text(L.materialsNote),
  tips: z
    .array(
      z
        .object({ title: text(L.tipTitle), text: text(L.tipText) })
        // A card needs both; an empty pair is dropped on save.
        .superRefine((tip, ctx) => {
          if (tip.title && !tip.text) {
            ctx.addIssue({ code: "custom", path: ["text"], message: "empty" });
          }
          if (tip.text && !tip.title) {
            ctx.addIssue({ code: "custom", path: ["title"], message: "empty" });
          }
        }),
    )
    .max(L.tips),
  juryNote: text(L.juryNote),
});

export type ChallengeFields = z.infer<typeof challengeSchema>;

export const emptyChallengeFields = (month: string): ChallengeFields => ({
  title: "",
  shortTitle: "",
  slug: "",
  month,
  summary: "",
  builtFor: "",
  buildingPhrase: "",
  intro: "",
  scenarioNote: "",
  scenario: "",
  baseLevel: "",
  stretch: "",
  launchCriteria: "",
  launchNote: "",
  launchCheck: "",
  materialsUrl: "",
  materialsNote: "",
  tips: [],
  juryNote: "",
});

const orNull = (value: string) => value.trim() || null;

/** The form's fields as core takes them. */
export function toChallengeInput(fields: ChallengeFields): ChallengeInput {
  return {
    title: fields.title,
    shortTitle: orNull(fields.shortTitle),
    slug: orNull(fields.slug),
    month: fields.month,
    summary: orNull(fields.summary),
    builtFor: orNull(fields.builtFor),
    buildingPhrase: orNull(fields.buildingPhrase),
    intro: orNull(fields.intro),
    scenarioNote: orNull(fields.scenarioNote),
    scenario: orNull(fields.scenario),
    baseLevel: listItems(fields.baseLevel),
    stretch: listItems(fields.stretch),
    launchCriteria: listItems(fields.launchCriteria),
    launchNote: orNull(fields.launchNote),
    launchCheck: orNull(fields.launchCheck),
    materialsUrl: orNull(fields.materialsUrl),
    materialsNote: orNull(fields.materialsNote),
    tips: fields.tips,
    juryNote: orNull(fields.juryNote),
  };
}

/** The other way: a saved challenge prefilling its edit form. */
export function toChallengeFields(input: ChallengeInput): ChallengeFields {
  return {
    title: input.title,
    shortTitle: input.shortTitle ?? "",
    slug: input.slug ?? "",
    month: input.month,
    summary: input.summary ?? "",
    builtFor: input.builtFor ?? "",
    buildingPhrase: input.buildingPhrase ?? "",
    intro: input.intro ?? "",
    scenarioNote: input.scenarioNote ?? "",
    scenario: input.scenario ?? "",
    baseLevel: input.baseLevel.join("\n"),
    stretch: input.stretch.join("\n"),
    launchCriteria: input.launchCriteria.join("\n"),
    launchNote: input.launchNote ?? "",
    launchCheck: input.launchCheck ?? "",
    materialsUrl: input.materialsUrl ?? "",
    materialsNote: input.materialsNote ?? "",
    tips: input.tips,
    juryNote: input.juryNote ?? "",
  };
}

/** The action's input: a new challenge (slug null) or an edit. */
export const saveChallengeSchema = z.object({
  slug: z.string().max(200).nullable(),
  fields: challengeSchema,
});
