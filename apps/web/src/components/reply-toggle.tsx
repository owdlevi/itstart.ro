"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ReviewForm } from "./review-form";

/** The owner's "Răspunde" under a review; opens the reply form in place (rule 15). */
export function ReplyToggle({
  projectId,
  parentId,
}: {
  projectId: string;
  parentId: string;
}) {
  const t = useTranslations("projectPage.reviews");
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <ReviewForm
        projectId={projectId}
        parentId={parentId}
        autoFocus
        onSent={() => setOpen(false)}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-primary underline"
    >
      {t("reply")}
    </button>
  );
}
