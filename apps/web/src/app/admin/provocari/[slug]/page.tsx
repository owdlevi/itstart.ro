import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChallengeForm } from "@/components/challenge-form";
import { FlashBanner } from "@/components/flash-banner";
import {
  CHALLENGE_SAVED_PARAM,
  toChallengeFields,
} from "@/lib/schemas/challenge";
import { requireAdmin } from "@/server/admin";
import { core, now } from "@/server/core";
import { FormPage } from "../form-page";
import { monthOptions } from "../months";

/** Editing a challenge (no reference design): the brief always, the month and slug until it starts. */
export default async function EditChallengeRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const adminId = await requireAdmin(`/admin/provocari/${slug}`);
  const [result, all, t, format] = await Promise.all([
    core.challenges.editable(slug, adminId),
    core.challenges.all(adminId),
    getTranslations("admin.form"),
    getFormatter(),
  ]);
  if (!result.ok || !all.ok) notFound();
  const challenge = result.value;
  const locked = challenge.status !== "upcoming";
  const label = (at: Date) =>
    format.dateTime(at, { month: "long", year: "numeric" });
  const months = monthOptions({
    now: now(),
    own: challenge.input.month,
    taken: all.value.map((c) => c.month),
    label,
  });

  return (
    <FormPage
      title={t("editTitle", { number: challenge.number })}
      lead={t("editLead")}
    >
      <p className="-mt-3 mb-6 flex flex-wrap gap-x-6">
        <a href={`/provocari/${challenge.slug}`}>{t("view")}</a>
        {challenge.status === "ended" && (
          <a href={`/admin/provocari/${challenge.slug}/recunoasteri`}>
            {t("recognitions")}
          </a>
        )}
      </p>
      {query[CHALLENGE_SAVED_PARAM] !== undefined && (
        <div className="-mt-4 mb-6 md:-mt-6">
          <FlashBanner param={CHALLENGE_SAVED_PARAM}>{t("saved")}</FlashBanner>
        </div>
      )}
      <ChallengeForm
        // A new slug is a new page: start from what was saved.
        key={challenge.slug}
        slug={challenge.slug}
        defaults={toChallengeFields(challenge.input)}
        months={
          locked
            ? months.filter((m) => m.value === challenge.input.month)
            : months
        }
        locked={locked}
      />
    </FormPage>
  );
}
