"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { REPORT_LIMITS, REPORT_REASONS } from "@repo/core/moderation-rules";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { reportProject } from "@/app/actions/moderation";
import {
  REPORTED_PARAM,
  reportSchema,
  type ReportInput,
} from "@/lib/schemas/report";
import { Button } from "./button";
import { Field, noteId, Textarea } from "./field";

type FieldError = "reason_empty" | "details_empty" | "too_long";
const fieldErrors = new Set<string>([
  "reason_empty",
  "details_empty",
  "too_long",
]);

/**
 * "Raportează o problemă cu acest proiect" (no reference design): a reason
 * from a short list and optional details ("Altceva" needs them). After
 * sending, the project page thanks them once.
 */
export function ReportForm({
  projectId,
  slug,
}: {
  projectId: string;
  slug: string;
}) {
  const t = useTranslations("report");
  const router = useRouter();
  const id = useId();
  const detailsId = `${id}-details`;
  const reasonsNote = `${id}-reasons-note`;
  const [refusal, setRefusal] = useState<string | null>(null);
  const [leaving, start] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: { projectId, details: "" },
    shouldFocusError: true,
  });

  const message = (code: string | undefined) =>
    code && fieldErrors.has(code)
      ? t(`errors.${code as FieldError}`, { max: REPORT_LIMITS.details })
      : code
        ? t("errors.other")
        : null;

  const onSubmit = handleSubmit(async (values) => {
    setRefusal(null);
    const result = await reportProject(values);
    if (result.ok) {
      start(() => router.push(`/proiecte/${slug}?${REPORTED_PARAM}=1`));
      return;
    }
    if (result.reason === "signed_out") {
      router.push(`/intra?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (result.reason === "details_empty" || result.reason === "too_long") {
      setError("details", { message: result.reason });
      setFocus("details");
      return;
    }
    setRefusal(
      result.reason === "already" ||
        result.reason === "rate_limited" ||
        result.reason === "not_found"
        ? t(`errors.${result.reason}`)
        : t("errors.other"),
    );
  });

  const reasonError = message(errors.reason?.message);
  const detailsError = message(errors.details?.message);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <fieldset
        className="flex flex-col gap-1"
        aria-describedby={reasonError ? reasonsNote : undefined}
      >
        <legend className="mb-2 text-[15px] font-bold leading-[22px]">
          {t("reasonsLabel")}
        </legend>
        {REPORT_REASONS.map((reason) => (
          <label
            key={reason}
            className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] leading-[23px]"
          >
            <input
              type="radio"
              value={reason}
              {...register("reason")}
              aria-invalid={reasonError ? true : undefined}
              className="size-[22px] shrink-0 accent-primary scheme-light"
            />
            {t(`reasons.${reason}`)}
          </label>
        ))}
        <div aria-live="polite">
          {reasonError && (
            <span
              id={reasonsNote}
              className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-warning-ink"
            >
              <CircleAlert
                size={18}
                strokeWidth={2.2}
                aria-hidden
                className="shrink-0"
              />
              {reasonError}
            </span>
          )}
        </div>
      </fieldset>

      <Field
        id={detailsId}
        label={t("details")}
        optional
        optionalLabel={t("optional")}
        hint={t("detailsHint", { max: REPORT_LIMITS.details })}
        error={detailsError}
      >
        <Textarea
          id={detailsId}
          rows={4}
          aria-invalid={detailsError ? true : undefined}
          aria-describedby={noteId(detailsId)}
          {...register("details")}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={isSubmitting || leaving}
            className="w-full md:w-auto"
          >
            {t("submit")}
          </Button>
          <Button
            href={`/proiecte/${slug}`}
            variant="secondary"
            className="w-full md:w-auto"
          >
            {t("cancel")}
          </Button>
        </div>
        <p role="status" className="text-sm font-semibold text-warning-ink">
          {refusal}
        </p>
      </div>
    </form>
  );
}
