"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { markSolution } from "@/app/actions/questions";

/**
 * The asker's "Asta a rezolvat-o" under an answer, or "Nu mai e soluția"
 * under the one they picked. Core checks that they're the asker.
 */
export function SolutionButton({
  questionId,
  answerId,
  isSolution,
}: {
  questionId: string;
  answerId: string;
  isSolution: boolean;
}) {
  const t = useTranslations("questions");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-x-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setFailed(false);
            const result = await markSolution({
              questionId,
              answerId: isSolution ? null : answerId,
            });
            setFailed(!result.ok);
          })
        }
        className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline disabled:opacity-60"
      >
        {t(isSolution ? "page.unmarkSolution" : "page.markSolution")}
      </button>
      <span role="status" className="text-sm font-semibold text-warning-ink">
        {failed && t("errors.other")}
      </span>
    </div>
  );
}
