"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { completeOnboarding } from "@/app/actions/onboarding";
import {
  CITY_MAX_LENGTH,
  INTEREST_TOOLS,
  INTEREST_UNSURE,
  NAME_MAX_LENGTH,
  onboardingSchema,
  type OnboardingFields,
} from "@/lib/schemas/onboarding";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Field, Input, noteId } from "./field";
import { FilterChip } from "./filter-chip";

type Tool = OnboardingFields["toolsInterest"][number];

/**
 * "Încă nu știu" and the tools exclude each other: picking one clears the
 * other kind.
 */
function toggle(tools: Tool[], tool: Tool): Tool[] {
  if (tools.includes(tool)) return tools.filter((t) => t !== tool);
  if (tool === INTEREST_UNSURE) return [tool];
  return [...tools.filter((t) => t !== INTEREST_UNSURE), tool];
}

/** Screen 07's form. The action re-parses it and core checks every rule. */
export function OnboardingForm({
  defaults,
  next,
  challengeSlug,
}: {
  defaults: OnboardingFields;
  next: string | null;
  challengeSlug: string | null;
}) {
  const t = useTranslations("onboarding");
  const id = useId();
  const [refusal, setRefusal] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<OnboardingFields>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: defaults,
  });

  const onSubmit = handleSubmit(async (fields) => {
    setRefusal(false);
    // Redirects when it works.
    const result = await completeOnboarding({
      fields,
      next,
      challengeSlug,
    }).catch(() => null);
    if (result?.reason === "name_empty") {
      setError("name", { message: "empty" }, { shouldFocus: true });
    } else if (result?.reason === "name_too_long") {
      setError("name", { message: "too_long" }, { shouldFocus: true });
    } else if (result?.reason === "city_too_long") {
      setError("city", { message: "too_long" }, { shouldFocus: true });
    } else {
      setRefusal(true);
    }
    // Throwing keeps isSubmitSuccessful false, so the button comes back.
    throw new Error("refused");
  });

  const tooLong = (max: number) => t("errors.tooLong", { max });
  const nameError =
    errors.name?.message === "empty"
      ? t("errors.nameEmpty")
      : errors.name && tooLong(NAME_MAX_LENGTH);
  const cityError = errors.city && tooLong(CITY_MAX_LENGTH);
  const nameId = `${id}-name`;
  const cityId = `${id}-city`;
  const toolsId = `${id}-tools`;
  const remindersId = `${id}-reminders`;
  // Busy from the submit until the next page has loaded.
  const busy = isSubmitting || isSubmitSuccessful;

  return (
    <form
      onSubmit={(event) => onSubmit(event).catch(() => {})}
      noValidate
      className="flex flex-col gap-5"
    >
      <Field id={nameId} label={t("name.label")} error={nameError}>
        <Input
          id={nameId}
          type="text"
          autoComplete="name"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? noteId(nameId) : undefined}
          {...register("name")}
        />
      </Field>

      <Field
        id={cityId}
        label={t("city.label")}
        optional
        optionalLabel={t("optional")}
        error={cityError}
      >
        <Input
          id={cityId}
          type="text"
          autoComplete="address-level2"
          aria-invalid={cityError ? true : undefined}
          aria-describedby={cityError ? noteId(cityId) : undefined}
          {...register("city")}
        />
      </Field>

      <div
        role="group"
        aria-labelledby={`${toolsId}-label`}
        aria-describedby={noteId(toolsId)}
        className="flex flex-col gap-2"
      >
        <span
          id={`${toolsId}-label`}
          className="text-[15px] font-bold leading-[22px]"
        >
          {t("tools.label")}
        </span>
        <Controller
          control={control}
          name="toolsInterest"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {[...INTEREST_TOOLS, INTEREST_UNSURE].map((tool) => (
                <FilterChip
                  key={tool}
                  type="button"
                  selected={field.value.includes(tool)}
                  onClick={() => field.onChange(toggle(field.value, tool))}
                >
                  {tool === INTEREST_UNSURE ? t("tools.unsure") : tool}
                </FilterChip>
              ))}
            </div>
          )}
        />
        <span id={noteId(toolsId)} className="text-sm text-muted">
          {t("tools.hint")}
        </span>
      </div>

      <Checkbox id={remindersId} {...register("remindersOptIn")}>
        {t("reminders")}
      </Checkbox>

      <div className="flex flex-col">
        <Button type="submit" full disabled={busy}>
          {t("submit", { context: challengeSlug ? "challenge" : "community" })}
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
              {t("errors.other")}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
