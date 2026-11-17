"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { QUESTION_LIMITS } from "@repo/core/question-rules";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { askQuestion } from "@/app/actions/questions";
import { askSchema, type AskInput } from "@/lib/schemas/question";
import { Button } from "./button";
import { Field, Input, noteId, Textarea } from "./field";

type ErrorKey =
  | "title_empty"
  | "title_too_long"
  | "body_too_long"
  | "rate_limited"
  | "closed"
  | "other";

/**
 * "Pune o întrebare" for someone who can ask: opens the form in place, and
 * after sending goes to the new question's page. The action re-parses with
 * the same schema and core checks every rule.
 */
export function AskQuestion({
  challengeId,
  questionsHref,
}: {
  challengeId: string;
  /** /provocari/<slug>/intrebari: the new question's page is under it. */
  questionsHref: string;
}) {
  const t = useTranslations("questions");
  const router = useRouter();
  const id = useId();
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [refusal, setRefusal] = useState<ErrorKey | null>(null);
  const [leaving, startLeaving] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AskInput>({
    resolver: zodResolver(askSchema),
    defaultValues: { challengeId, title: "", body: "" },
  });

  if (!open) {
    return (
      <div className="flex">
        <Button
          ref={opener}
          variant="secondary"
          className="w-full md:w-auto"
          onClick={() => setOpen(true)}
        >
          {t("ask.button")}
        </Button>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setRefusal(null);
    const result = await askQuestion(values);
    if (result.ok) {
      startLeaving(() => router.push(`${questionsHref}/${result.slug}`));
      return;
    }
    if (result.reason === "signed_out") {
      router.push(`/intra?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setRefusal(
      result.reason === "title_empty" ||
        result.reason === "title_too_long" ||
        result.reason === "body_too_long" ||
        result.reason === "rate_limited" ||
        result.reason === "closed"
        ? result.reason
        : "other",
    );
  });

  const message = (key: string | undefined) =>
    key === "title_empty" ||
    key === "title_too_long" ||
    key === "body_too_long" ||
    key === "rate_limited" ||
    key === "closed" ||
    key === "other"
      ? t(`errors.${key}`, {
          max:
            key === "body_too_long"
              ? QUESTION_LIMITS.body
              : QUESTION_LIMITS.title,
        })
      : key
        ? t("errors.other")
        : null;
  // A refusal about the details goes under them; any other under the title.
  const titleError =
    message(errors.title?.message) ??
    (refusal && refusal !== "body_too_long" ? message(refusal) : null);
  const bodyError =
    message(errors.body?.message) ??
    (refusal === "body_too_long" ? message(refusal) : null);
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 md:p-5"
    >
      <Field
        id={titleId}
        label={t("ask.title")}
        hint={t("ask.titleHint", { max: QUESTION_LIMITS.title })}
        error={titleError}
      >
        <Input
          id={titleId}
          autoFocus
          aria-invalid={titleError ? true : undefined}
          aria-describedby={noteId(titleId)}
          {...register("title")}
        />
      </Field>
      <Field
        id={bodyId}
        label={t("ask.body")}
        optional
        optionalLabel={t("ask.optional")}
        hint={t("ask.bodyHint")}
        error={bodyError}
      >
        <Textarea
          id={bodyId}
          rows={4}
          aria-invalid={bodyError ? true : undefined}
          aria-describedby={noteId(bodyId)}
          {...register("body")}
        />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => {
            reset();
            setRefusal(null);
            setOpen(false);
            // Back to the button that opened it, once it's rendered again.
            requestAnimationFrame(() => opener.current?.focus());
          }}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
        >
          {t("ask.cancel")}
        </button>
        <Button
          type="submit"
          variant="secondary"
          disabled={isSubmitting || leaving}
          className="w-full md:w-auto"
        >
          {t("ask.send")}
        </Button>
      </div>
    </form>
  );
}
