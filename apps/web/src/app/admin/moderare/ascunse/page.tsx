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

/** Everything hidden now, to show again what was hidden by mistake. */
export default async function ModerationHiddenRoute() {
  const adminId = await requireAdmin("/admin/moderare/ascunse");
  const [result, t] = await Promise.all([
    core.moderation.hiddenItems(adminId),
    getTranslations("admin.moderation.hidden"),
  ]);
  if (!result.ok) notFound();
  return (
    <ModerationShell current="hidden" lead={t("lead")}>
      <ItemList items={result.value} empty={t("empty")} />
    </ModerationShell>
  );
}
