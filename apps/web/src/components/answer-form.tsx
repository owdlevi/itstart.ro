"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { QUESTION_LIMITS } from "@repo/core/question-rules";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { postAnswer } from "@/app/actions/questions";
import { answerSchema, type AnswerInput } from "@/lib/schemas/question";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * "Răspunsul tău" under a question. Like the review form: a refusal replaces
 * the hint under the field, and the new answer appears after a refresh.
 */
export function AnswerForm({ questionId }: { questionId: string }) {
  const t = useTranslations("questions");
  const router = useRouter();
  const id = useId();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AnswerInput>({
    resolver: zodResolver(answerSchema),
    defaultValues: { questionId, body: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setRefusal(null);
    setSent(false);
    const result = await postAnswer(values);
    if (result.ok) {
      reset();
      setSent(true);
      return;
    }
    if (result.reason === "signed_out") {
      router.push(`/intra?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setRefusal(
      result.reason === "rate_limited" ||
        result.reason === "closed" ||
        result.reason === "empty" ||
        result.reason === "too_long"
        ? t(`errors.${result.reason}`, { max: QUESTION_LIMITS.answer })
        : t("errors.other"),
    );
  });

  const fieldError = errors.body?.message;
  const error =
    fieldError === "empty" || fieldError === "too_long"
      ? t(`errors.${fieldError}`, { max: QUESTION_LIMITS.answer })
      : (refusal ?? (fieldError ? t("errors.other") : null));
  const noteId = `${id}-note`;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-4 md:p-5"
    >
      <label htmlFor={id} className="text-[15px] font-bold leading-6">
        {t("page.answer")}
      </label>
      {/* A block, not a flex column: the empty live region below adds no gap. */}
      <div>
        <textarea
          id={id}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? noteId : undefined}
          className="box-border block w-full resize-y rounded-md border border-border bg-surface p-3 text-base leading-6 text-ink aria-[invalid=true]:border-warning-ink"
          {...register("body")}
        />
        {/* Always present, so a refusal from the server is announced (§10). */}
        <div aria-live="polite">
          {error && (
            <span
              id={noteId}
              className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-warning-ink"
            >
              <CircleAlert
                size={18}
                strokeWidth={2.2}
                aria-hidden
                className="shrink-0"
              />
              {error}
            </span>
          )}
        </div>
      </div>
      <p role="status" className={cn("text-sm text-muted", !sent && "sr-only")}>
        {sent && t("page.sent")}
      </p>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          disabled={isSubmitting}
          className="w-full md:w-auto"
        >
          {t("page.send")}
        </Button>
      </div>
    </form>
  );
}
