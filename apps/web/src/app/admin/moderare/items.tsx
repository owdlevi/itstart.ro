import type { ModerationItem, ModerationPlace } from "@repo/core";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { AgentBadge } from "@/components/agent-badge";
import { ModerationButton } from "@/components/moderation-button";

export const placeHref = (place: ModerationPlace) =>
  place.kind === "project"
    ? `/proiecte/${place.slug}`
    : `/provocari/${place.challengeSlug}/intrebari/${place.slug}`;

/** Reviews, questions, answers (and hidden projects), each with hide or show again. */
export async function ItemList({
  items,
  empty,
}: {
  items: ModerationItem[];
  empty: string;
}) {
  const [t, tProject, format] = await Promise.all([
    getTranslations("admin.moderation"),
    getTranslations("project"),
    getFormatter(),
  ]);
  if (items.length === 0) return <p className="text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const kind = item.isAutomated
          ? "automated"
          : item.isReply
            ? "reply"
            : item.kind;
        const describedBy = `item-${item.id}`;
        const name =
          item.place.kind === "project" ? item.place.name : item.place.title;
        return (
          <li
            key={`${item.kind}-${item.id}`}
            className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 md:p-5"
          >
            <div
              id={describedBy}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 text-muted"
            >
              <span className="font-bold text-ink">{t(`kinds.${kind}`)}</span>
              {item.kind !== "project" && item.kind !== "question" && (
                <Link href={placeHref(item.place)}>{t("on", { name })}</Link>
              )}
              <span>· {item.author.name}</span>
              {item.author.isAgent && (
                <AgentBadge>{tProject("agentBadge")}</AgentBadge>
              )}
              <span>
                ·{" "}
                {format.dateTime(item.createdAt, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {item.hidden && (
                <span className="rounded-sm bg-warning-bg px-2 font-semibold text-warning-ink">
                  {t("hiddenChip")}
                </span>
              )}
            </div>
            {item.kind === "project" || item.kind === "question" ? (
              <Link
                href={placeHref(item.place)}
                className="text-[15px] font-semibold leading-6"
              >
                {item.text}
              </Link>
            ) : (
              <p className="line-clamp-4 whitespace-pre-line text-[15px] leading-[23px]">
                {item.text}
              </p>
            )}
            <ModerationButton
              action={{
                type: "hide",
                kind: item.kind,
                id: item.id,
                hidden: !item.hidden,
              }}
              label={t(item.hidden ? "show" : "hide")}
              describedBy={describedBy}
            />
          </li>
        );
      })}
    </ul>
  );
}
