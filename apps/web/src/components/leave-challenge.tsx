"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  leaveChallenge,
  type ParticipationActionResult,
} from "@/app/actions/participation";
import { Button } from "@/components/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * "Renunță la provocare": a text button that asks first (HANDOVER §6 08).
 * The dialog opens with the focus on "Rămân", so Enter never leaves by
 * accident. Leaving keeps their projects (rule 2), and the dialog says so.
 */
export function LeaveChallenge({ slug }: { slug: string }) {
  const t = useTranslations("challenge.participation.leave");
  const [result, action, pending] = useActionState<
    ParticipationActionResult,
    FormData
  >(leaveChallenge, null);

  return (
    <AlertDialog>
      <AlertDialogTrigger className="min-h-11 text-sm font-semibold text-muted underline hover:text-ink">
        {t("button")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{t("title")}</AlertDialogTitle>
        <AlertDialogDescription>{t("text")}</AlertDialogDescription>
        <form
          action={action}
          className="flex flex-wrap justify-end gap-3 pt-2"
        >
          <input type="hidden" name="slug" value={slug} />
          <AlertDialogClose
            render={
              <Button variant="secondary" className="grow sm:grow-0">
                {t("stay")}
              </Button>
            }
          />
          <Button
            type="submit"
            className="grow sm:grow-0"
            aria-disabled={pending || undefined}
          >
            {t("confirm")}
          </Button>
          <p role="status" className="w-full text-sm text-muted empty:hidden">
            {result &&
              (result.reason === "ended" ? t("ended") : t("failed"))}
          </p>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
