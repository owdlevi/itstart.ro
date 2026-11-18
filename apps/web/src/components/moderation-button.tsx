"use client";

import type { ModerationKind } from "@repo/core";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { resolveReports, setHidden } from "@/app/actions/moderation";
import { Button } from "./button";

type Action =
  | { type: "hide"; kind: ModerationKind; id: string; hidden: boolean }
  | { type: "resolve"; projectId: string };

/**
 * An admin's hide, show-again or resolve, in the moderation queue. Core reads
 * the role from the database; the page refreshes with the new state.
 */
export function ModerationButton({
  action,
  label,
  describedBy,
  primary,
}: {
  action: Action;
  label: string;
  /** What it acts on: several buttons read alike. */
  describedBy: string;
  primary?: boolean;
}) {
  const t = useTranslations("admin.moderation");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-x-3">
      <Button
        size="sm"
        variant={primary ? "primary" : "secondary"}
        disabled={pending}
        aria-describedby={describedBy}
        onClick={() =>
          start(async () => {
            setFailed(false);
            const result =
              action.type === "hide"
                ? await setHidden({
                    kind: action.kind,
                    id: action.id,
                    hidden: action.hidden,
                  })
                : await resolveReports({ projectId: action.projectId });
            setFailed(!result.ok);
          })
        }
        className="disabled:opacity-60"
      >
        {label}
      </Button>
      <span role="status" className="text-sm font-semibold text-warning-ink">
        {failed && t("error")}
      </span>
    </div>
  );
}
