"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm, type FieldError } from "react-hook-form";
import { saveChallenge } from "@/app/actions/admin-challenges";
import {
  CHALLENGE_LIMITS,
  challengeSchema,
  type ChallengeFields,
} from "@/lib/schemas/challenge";
import { Button } from "./button";
import { Field, Input, noteId, Select, Textarea } from "./field";

type TextField = Exclude<keyof ChallengeFields, "tips" | "month">;

const LIMITS: Record<TextField, number> = {
  title: CHALLENGE_LIMITS.title,
  shortTitle: CHALLENGE_LIMITS.shortTitle,
  slug: CHALLENGE_LIMITS.slug,
  summary: CHALLENGE_LIMITS.summary,
  builtFor: CHALLENGE_LIMITS.builtFor,
  buildingPhrase: CHALLENGE_LIMITS.buildingPhrase,
  intro: CHALLENGE_LIMITS.intro,
  scenarioNote: CHALLENGE_LIMITS.scenarioNote,
  scenario: CHALLENGE_LIMITS.scenario,
  baseLevel: CHALLENGE_LIMITS.listItems,
  stretch: CHALLENGE_LIMITS.listItems,
  launchCriteria: CHALLENGE_LIMITS.listItems,
  launchNote: CHALLENGE_LIMITS.launchNote,
  launchCheck: CHALLENGE_LIMITS.launchCheck,
  materialsUrl: CHALLENGE_LIMITS.materialsUrl,
  materialsNote: CHALLENGE_LIMITS.materialsNote,
  juryNote: CHALLENGE_LIMITS.juryNote,
};

const LISTS = ["baseLevel", "stretch", "launchCriteria"] as const;

const panel =
  "flex flex-col gap-5 rounded-lg border border-line bg-surface p-5 md:p-8";
const h2 = "font-display text-[22px] font-bold leading-7 tracking-[-0.01em]";

/**
 * The admin's challenge form (no reference design): every field of HANDOVER
 * §4's Challenge that the public pages show. The action re-parses it and core
 * checks every rule.
 */
export function ChallengeForm({
  slug,
  defaults,
  months,
  locked,
}: {
  /** Null for a new challenge. */
  slug: string | null;
  defaults: ChallengeFields;
  /** The months it can take, labelled ("decembrie 2026"). */
  months: { value: string; label: string; taken: boolean }[];
  /** It has started: the month and the slug stay as they are. */
  locked: boolean;
}) {
  const t = useTranslations("admin.form");
  const id = useId();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | null>(null);
  // Busy until the saved page has rendered; this form stays mounted on an edit.
  const [navigating, startNavigation] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChallengeFields>({
    resolver: zodResolver(challengeSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const tips = useFieldArray({ control, name: "tips" });
  // Removing a card moves the focus here, which is always shown after a removal.
  const addTip = useRef<HTMLButtonElement>(null);

  const onSubmit = handleSubmit(async (fields) => {
    setRefusal(null);
    const result = await saveChallenge({ slug, fields }).catch(() => null);
    if (result?.ok) {
      startNavigation(() => router.push(result.href));
      return;
    }
    const focus = { shouldFocus: true };
    switch (result?.reason) {
      case "slug_taken":
        setError("slug", { message: "taken" }, focus);
        break;
      case "slug_locked":
        setError("slug", { message: "locked" }, focus);
        break;
      case "month_taken":
      case "month_out_of_order":
      case "month_past":
      case "month_locked":
        setError("month", { message: result.reason.slice(6) }, focus);
        break;
      case "invalid":
        if (result.field === "tips") setRefusal(t("errors.tips"));
        else setError(result.field, { message: "invalid" }, focus);
        break;
      case "not_admin":
        setRefusal(t("errors.notAdmin"));
        break;
      case "not_found":
        setRefusal(t("errors.notFound"));
        break;
      default:
        setRefusal(t("errors.other"));
    }
  });

  const message = (field: TextField | "month", error?: FieldError) => {
    const code = error?.message;
    if (!code) return null;
    if (field === "month") {
      return (
        {
          empty: t("errors.monthEmpty"),
          taken: t("errors.monthTaken"),
          out_of_order: t("errors.monthOutOfOrder"),
          past: t("errors.monthPast"),
          locked: t("month.locked"),
        }[code] ?? t("errors.monthEmpty")
      );
    }
    if (field === "slug") {
      if (code === "taken") return t("errors.slugTaken");
      if (code === "locked") return t("slug.locked");
      return t("errors.slugInvalid");
    }
    if (field === "title" && code === "empty") return t("errors.titleEmpty");
    if (field === "materialsUrl") return t("errors.urlInvalid");
    if ((LISTS as readonly string[]).includes(field)) {
      return code === "item_too_long"
        ? t("errors.listItemTooLong", { max: CHALLENGE_LIMITS.listItem })
        : t("errors.listTooMany", { max: CHALLENGE_LIMITS.listItems });
    }
    return t("errors.tooLong", { max: LIMITS[field] });
  };

  /** One text field: a label, a hint the error replaces, and the control. */
  const text = (
    field: TextField,
    opts: {
      hint?: string;
      optional?: boolean;
      rows?: number;
      readOnly?: boolean;
      type?: string;
    } = {},
  ) => {
    const fieldId = `${id}-${field}`;
    const error = message(field, errors[field]);
    const control = {
      id: fieldId,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error || opts.hint ? noteId(fieldId) : undefined,
      ...register(field),
    };
    return (
      <Field
        id={fieldId}
        label={t(`${field}.label`)}
        hint={opts.hint}
        error={error}
        optional={opts.optional}
        optionalLabel={t("optional")}
      >
        {opts.rows ? (
          <Textarea rows={opts.rows} {...control} />
        ) : (
          <Input
            type={opts.type ?? "text"}
            readOnly={opts.readOnly}
            className={opts.readOnly ? "bg-tint" : undefined}
            {...control}
          />
        )}
      </Field>
    );
  };

  const monthId = `${id}-month`;
  const monthError = message("month", errors.month);
  const busy = isSubmitting || navigating;

  return (
    <form
      onSubmit={(event) => onSubmit(event).catch(() => {})}
      noValidate
      className="flex flex-col gap-6"
    >
      <section className={panel} aria-labelledby={`${id}-basics`}>
        <h2 id={`${id}-basics`} className={h2}>
          {t("sections.basics")}
        </h2>
        {text("title", { hint: t("title.hint") })}
        {text("shortTitle", { hint: t("shortTitle.hint"), optional: true })}
        {text("slug", {
          optional: !locked,
          readOnly: locked,
          hint: locked ? t("slug.locked") : t("slug.hint"),
        })}
        <Field
          id={monthId}
          label={t("month.label")}
          hint={locked ? t("month.locked") : t("month.hint")}
          error={monthError}
        >
          <Select
            id={monthId}
            aria-invalid={monthError ? true : undefined}
            aria-describedby={noteId(monthId)}
            {...register("month")}
          >
            {months.map((month) => (
              <option
                key={month.value}
                value={month.value}
                disabled={month.taken}
              >
                {month.label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className={panel} aria-labelledby={`${id}-phrases`}>
        <h2 id={`${id}-phrases`} className={h2}>
          {t("sections.phrases")}
        </h2>
        {text("summary", { hint: t("summary.hint"), optional: true, rows: 3 })}
        {text("builtFor", { hint: t("builtFor.hint"), optional: true })}
        {text("buildingPhrase", {
          hint: t("buildingPhrase.hint"),
          optional: true,
        })}
      </section>

      <section className={panel} aria-labelledby={`${id}-brief`}>
        <h2 id={`${id}-brief`} className={h2}>
          {t("sections.brief")}
        </h2>
        {text("intro", { hint: t("intro.hint"), optional: true, rows: 3 })}
        {text("scenarioNote", { hint: t("scenarioNote.hint"), optional: true })}
        {text("scenario", { optional: true, rows: 6 })}
        {LISTS.map((field) => (
          <div key={field}>
            {text(field, { hint: t(`${field}.hint`), optional: true, rows: 5 })}
          </div>
        ))}
        {text("launchNote", { optional: true, rows: 2 })}
        {text("launchCheck", { hint: t("launchCheck.hint"), optional: true })}
        {text("materialsUrl", {
          hint: t("materialsUrl.hint"),
          optional: true,
          type: "url",
        })}
        {text("materialsNote", { optional: true })}
      </section>

      <section className={panel} aria-labelledby={`${id}-tips`}>
        <div className="flex flex-col gap-1.5">
          <h2 id={`${id}-tips`} className={h2}>
            {t("sections.tips")}
          </h2>
          <p className="text-sm text-muted">{t("tips.hint")}</p>
        </div>
        {tips.fields.map((tip, index) => {
          const n = index + 1;
          const titleId = `${id}-tip-${tip.id}-title`;
          const textId = `${id}-tip-${tip.id}-text`;
          const tipErrors = errors.tips?.[index];
          const tipMessage = (error?: FieldError, kind?: "title" | "text") =>
            !error?.message
              ? null
              : error.message === "empty"
                ? t(
                    kind === "title"
                      ? "errors.tipTitleEmpty"
                      : "errors.tipTextEmpty",
                  )
                : t("errors.tooLong", {
                    max:
                      kind === "title"
                        ? CHALLENGE_LIMITS.tipTitle
                        : CHALLENGE_LIMITS.tipText,
                  });
          const titleError = tipMessage(tipErrors?.title, "title");
          const textError = tipMessage(tipErrors?.text, "text");
          return (
            <fieldset
              key={tip.id}
              className="flex min-w-0 flex-col gap-4 rounded-lg border border-line p-4"
            >
              <legend className="px-1 text-[13px] font-bold uppercase leading-[18px] tracking-[0.06em] text-muted">
                {t("tips.card", { n })}
              </legend>
              <Field id={titleId} label={t("tips.title")} error={titleError}>
                <Input
                  id={titleId}
                  aria-invalid={titleError ? true : undefined}
                  aria-describedby={titleError ? noteId(titleId) : undefined}
                  {...register(`tips.${index}.title`)}
                />
              </Field>
              <Field id={textId} label={t("tips.text")} error={textError}>
                <Textarea
                  id={textId}
                  rows={3}
                  aria-invalid={textError ? true : undefined}
                  aria-describedby={textError ? noteId(textId) : undefined}
                  {...register(`tips.${index}.text`)}
                />
              </Field>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label={t("tips.removeLabel", { n })}
                  onClick={() => {
                    tips.remove(index);
                    requestAnimationFrame(() => addTip.current?.focus());
                  }}
                >
                  <X size={18} strokeWidth={2.2} aria-hidden />
                  {t("tips.remove")}
                </Button>
              </div>
            </fieldset>
          );
        })}
        {tips.fields.length < CHALLENGE_LIMITS.tips && (
          <div>
            <Button
              ref={addTip}
              type="button"
              variant="secondary"
              size="sm"
              // The new card's title gets the focus.
              onClick={() => tips.append({ title: "", text: "" })}
            >
              <Plus size={18} strokeWidth={2.2} aria-hidden />
              {t("tips.add")}
            </Button>
          </div>
        )}
      </section>

      <section className={panel} aria-labelledby={`${id}-jury`}>
        <h2 id={`${id}-jury`} className={h2}>
          {t("sections.jury")}
        </h2>
        {text("juryNote", {
          hint: t("juryNote.hint"),
          optional: true,
          rows: 4,
        })}
      </section>

      <div className="flex flex-col">
        <Button
          type="submit"
          disabled={busy}
          className="w-full md:w-auto md:self-start"
        >
          {slug ? t("submitEdit") : t("submitNew")}
        </Button>
        {/* Always present, so a refusal is announced (§10). */}
        <div aria-live="polite">
          {refusal && (
            <p className="mt-2.5 flex items-start gap-1.5 text-sm font-semibold text-warning-ink">
              <CircleAlert
                size={18}
                strokeWidth={2.2}
                aria-hidden
                className="shrink-0"
              />
              {refusal}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
