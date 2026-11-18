import { MODERATION } from "@repo/core";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/admin";
import { core } from "@/server/core";
import { ItemList } from "../items";
import { ModerationShell } from "../shell";

export async function generateMetadata() {
  const t = await getTranslations("admin.moderation");
  return { title: t("metaTitle") };
}

/** The newest reviews, replies, questions and answers, to hide what breaks the rules. */
export default async function ModerationRecentRoute() {
  const adminId = await requireAdmin("/admin/moderare/recente");
  const [result, t] = await Promise.all([
    core.moderation.recent(adminId),
    getTranslations("admin.moderation.recent"),
  ]);
  if (!result.ok) notFound();
  return (
    <ModerationShell
      current="recent"
      lead={t("lead", { n: MODERATION.recent })}
    >
      <ItemList items={result.value} empty={t("empty")} />
    </ModerationShell>
  );
}
