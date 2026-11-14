"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { postReview } from "@/app/actions/reviews";
import {
  REVIEW_MAX_LENGTH,
  reviewSchema,
  type ReviewInput,
} from "@/lib/schemas/review";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * "Scrie o părere", or with `parentId` the owner's reply (one level). The
 * action re-parses with the same schema and core checks every rule; a refusal
 * replaces the hint under the field (Field spec).
 */
export function ReviewForm({
  projectId,
  parentId = null,
  className,
  autoFocus,
  onSent,
}: {
  projectId: string;
  parentId?: string | null;
  className?: string;
  /** Focus the field on mount: a reply form opened from "Răspunde". */
  autoFocus?: boolean;
  onSent?: () => void;
}) {
  const t = useTranslations("projectPage.reviews");
  const router = useRouter();
  const id = useId();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const reply = parentId !== null;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { projectId, parentId, body: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setRefusal(null);
    setSent(false);
    const result = await postReview(values);
    if (result.ok) {
      reset();
      setSent(true);
      onSent?.();
      return;
    }
    if (result.reason === "signed_out") {
      router.push(`/intra?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setRefusal(
      result.reason === "rate_limited" ||
        result.reason === "empty" ||
        result.reason === "too_long"
        ? t(`errors.${result.reason}`, { max: REVIEW_MAX_LENGTH })
        : t("errors.other"),
    );
  });

  const fieldError = errors.body?.message;
  const error =
    fieldError === "empty" || fieldError === "too_long"
      ? t(`errors.${fieldError}`, { max: REVIEW_MAX_LENGTH })
      : (refusal ?? (fieldError ? t("errors.other") : null));
  const noteId = `${id}-note`;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-4 md:p-5",
        className,
      )}
    >
      <label htmlFor={id} className="text-[15px] font-bold leading-6">
        {t(reply ? "replyLabel" : "write")}
      </label>
      {/* A block, not a flex column: the empty live region below adds no gap. */}
      <div>
        <textarea
          id={id}
          rows={3}
          // Opened from "Răspunde": the focus follows the button that disappeared.
          autoFocus={autoFocus}
          placeholder={reply ? undefined : t("placeholder")}
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
        {sent && t(reply ? "replySent" : "sent")}
      </p>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          disabled={isSubmitting}
          className="w-full md:w-auto"
        >
          {t(reply ? "sendReply" : "send")}
        </Button>
      </div>
    </form>
  );
}
