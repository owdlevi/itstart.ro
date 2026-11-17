"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { RecognitionCandidate } from "@repo/core";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { useForm, type FieldError } from "react-hook-form";
import { saveRecognitions } from "@/app/actions/admin-recognitions";
import {
  RECOGNITION_KINDS,
  RECOGNITION_REASON_MAX,
  recognitionsSchema,
  type RecognitionFields,
  type RecognitionKind,
} from "@/lib/schemas/recognitions";
import { Button } from "./button";
import { Field, Input, noteId, Select } from "./field";

const panel =
  "flex flex-col gap-5 rounded-lg border border-line bg-surface p-5 md:p-8";
const h2 = "font-display text-[22px] font-bold leading-7 tracking-[-0.01em]";

const KIND_KEY = {
  community: "community",
  jury: "jury",
  first_project: "firstProject",
} as const;

/**
 * The admin's three recognitions for an ended challenge (no reference
 * design): a project and a one-line reason each. Only people's launches on
 * time are offered (rules 7 and 20); "Cel mai bun prim proiect" offers only
 * first launches. Core checks it all again.
 */
export function RecognitionsForm({
  slug,
  defaults,
  candidates,
  suggestedCommunity,
}: {
  slug: string;
  defaults: RecognitionFields;
  candidates: RecognitionCandidate[];
  suggestedCommunity: RecognitionCandidate | null;
}) {
  const t = useTranslations("admin.recognitions");
  const id = useId();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [navigating, startNavigation] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecognitionFields>({
    resolver: zodResolver(recognitionsSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (fields) => {
    setRefusal(null);
    const result = await saveRecognitions({ slug, fields }).catch(() => null);
    if (result?.ok) {
      startNavigation(() => {
        router.push(result.href);
        router.refresh();
      });
      return;
    }
    const focus = { shouldFocus: true };
    switch (result?.reason) {
      case "invalid":
        setError(
          result.problem.startsWith("reason")
            ? `${result.kind}.reason`
            : `${result.kind}.projectId`,
          { message: result.problem },
          focus,
        );
        break;
      case "not_ended":
        setRefusal(t("errors.notEnded"));
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

  const message = (error?: FieldError) => {
    switch (error?.message) {
      case undefined:
      case "":
        return null;
      case "empty":
      case "reason_empty":
        return t("errors.reasonEmpty");
      case "too_long":
      case "reason_too_long":
        return t("errors.tooLong", { max: RECOGNITION_REASON_MAX });
      case "not_first_project":
        return t("errors.notFirstProject");
      case "duplicate":
        return t("errors.duplicate");
      default:
        return t("errors.notEligible");
    }
  };

  const busy = isSubmitting || navigating;
  const option = (c: RecognitionCandidate) =>
    t("option", { name: c.name, owner: c.ownerName, votes: c.votes });

  const kind = (k: RecognitionKind) => {
    const key = KIND_KEY[k];
    const projectId = `${id}-${k}-project`;
    const reasonId = `${id}-${k}-reason`;
    const projectError = message(errors[k]?.projectId);
    const reasonError = message(errors[k]?.reason);
    const offered =
      k === "first_project"
        ? candidates.filter((c) => c.firstProject)
        : candidates;
    const projectHint =
      k === "community" && suggestedCommunity
        ? t("community.suggestion", {
            name: suggestedCommunity.name,
            votes: suggestedCommunity.votes,
          })
        : t(`${key}.hint`);
    return (
      <section key={k} className={panel} aria-labelledby={`${id}-${k}`}>
        <h2 id={`${id}-${k}`} className={h2}>
          {t(`${key}.title`)}
        </h2>
        <Field
          id={projectId}
          label={t("project")}
          hint={projectHint}
          error={projectError}
        >
          <Select
            id={projectId}
            aria-invalid={projectError ? true : undefined}
            aria-describedby={noteId(projectId)}
            {...register(`${k}.projectId`)}
          >
            <option value="">{t("none")}</option>
            {offered.map((c) => (
              <option key={c.id} value={c.id}>
                {option(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={reasonId}
          label={t("reason.label")}
          hint={t("reason.hint")}
          error={reasonError}
        >
          <Input
            id={reasonId}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={noteId(reasonId)}
            {...register(`${k}.reason`)}
          />
        </Field>
      </section>
    );
  };

  return (
    <form
      onSubmit={(event) => onSubmit(event).catch(() => {})}
      noValidate
      className="flex flex-col gap-6"
    >
      {RECOGNITION_KINDS.map(kind)}
      <div className="flex flex-col">
        <Button
          type="submit"
          disabled={busy}
          className="w-full md:w-auto md:self-start"
        >
          {t("submit")}
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
