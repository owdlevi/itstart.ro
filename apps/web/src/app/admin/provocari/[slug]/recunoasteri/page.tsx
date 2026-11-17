import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FlashBanner } from "@/components/flash-banner";
import { RecognitionsForm } from "@/components/recognitions-form";
import {
  RECOGNITION_KINDS,
  RECOGNITIONS_SAVED_PARAM,
  type RecognitionFields,
} from "@/lib/schemas/recognitions";
import { requireAdmin } from "@/server/admin";
import { core } from "@/server/core";
import { FormPage } from "../../form-page";

/**
 * The three recognitions of an ended challenge (no reference design), shown
 * on screen 11. Before the deadline the votes aren't final, so there's no form.
 */
export default async function RecognitionsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const adminId = await requireAdmin(`/admin/provocari/${slug}/recunoasteri`);
  const [result, t] = await Promise.all([
    core.recognitions.editor(adminId, slug),
    getTranslations("admin.recognitions"),
  ]);
  if (!result.ok) notFound();
  const { challenge, current, candidates } = result.value;
  const suggested =
    candidates.find((c) => c.id === result.value.suggestedCommunity) ?? null;
  // Nothing entered yet: the community's pick starts as the votes suggest.
  const defaults = Object.fromEntries(
    RECOGNITION_KINDS.map((kind) => [
      kind,
      current[kind] ??
        (kind === "community" &&
        suggested &&
        RECOGNITION_KINDS.every((k) => !current[k])
          ? {
              projectId: suggested.id,
              reason: t("community.reason", { votes: suggested.votes }),
            }
          : { projectId: "", reason: "" }),
    ]),
  ) as RecognitionFields;

  return (
    <FormPage title={t("title", { number: challenge.number })} lead={t("lead")}>
      <p className="-mt-3 mb-6">
        <a href={`/provocari/${challenge.slug}`}>{t("view")}</a>
      </p>
      {query[RECOGNITIONS_SAVED_PARAM] !== undefined && (
        <div className="-mt-4 mb-6 md:-mt-6">
          <FlashBanner param={RECOGNITIONS_SAVED_PARAM}>
            {t("saved")}
          </FlashBanner>
        </div>
      )}
      {!challenge.ended ? (
        <p className="text-muted">{t("notEnded")}</p>
      ) : candidates.length === 0 ? (
        <p className="text-muted">{t("noCandidates")}</p>
      ) : (
        <RecognitionsForm
          slug={challenge.slug}
          defaults={defaults}
          candidates={candidates}
          suggestedCommunity={suggested}
        />
      )}
    </FormPage>
  );
}
