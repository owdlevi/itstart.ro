import { addMonths, monthOf } from "@repo/core";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChallengeForm } from "@/components/challenge-form";
import { emptyChallengeFields } from "@/lib/schemas/challenge";
import { requireAdmin } from "@/server/admin";
import { core, now } from "@/server/core";
import { FormPage } from "../form-page";
import { monthOptions } from "../months";

/** A new challenge (no reference design). */
export default async function NewChallengeRoute() {
  const adminId = await requireAdmin("/admin/provocari/noua");
  const [all, t, format] = await Promise.all([
    core.challenges.all(adminId),
    getTranslations("admin.form"),
    getFormatter(),
  ]);
  if (!all.ok) notFound();

  const taken = all.value.map((c) => c.month);
  // The month after the newest challenge, or this month when there's none
  // or it's long gone: the one core is most likely to take.
  const latest = all.value[0]?.month;
  const current = monthOf(now());
  const suggested =
    latest && addMonths(latest, 1) > current ? addMonths(latest, 1) : current;
  return (
    <FormPage title={t("newTitle")} lead={t("newLead")}>
      <ChallengeForm
        slug={null}
        defaults={emptyChallengeFields(suggested)}
        months={monthOptions({
          now: now(),
          own: null,
          taken,
          label: (at) =>
            format.dateTime(at, { month: "long", year: "numeric" }),
        })}
        locked={false}
      />
    </FormPage>
  );
}
