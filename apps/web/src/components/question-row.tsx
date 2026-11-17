import type { QuestionRow as Question } from "@repo/core";
import { Check } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Avatar } from "./avatar";
import { StatusChip } from "./status-chip";

/**
 * A question in "Întrebări și ajutor" (screens 02 and 08): the title, the
 * asker and the answer count, and "Rezolvat" once the asker marked a solution.
 * The title's link covers the whole row, so the row is the tap target.
 */
export async function QuestionRow({
  question,
  href,
}: {
  question: Question;
  href: string;
}) {
  const t = await getTranslations("questions.row");
  return (
    <li className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3.5">
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
        <Link
          href={href}
          className="text-base font-semibold leading-[23px] text-ink no-underline after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:text-ink hover:underline"
        >
          {question.title}
        </Link>
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-muted">
          <Avatar person={question.author} size={22} />
          <span className="min-w-0">
            {question.author.name} · {t("answers", { n: question.answerCount })}
          </span>
        </span>
      </div>
      {question.solved && (
        <StatusChip
          icon={
            <Check
              size={15}
              strokeWidth={2.2}
              aria-hidden
              className="flex-none"
            />
          }
        >
          {t("solved")}
        </StatusChip>
      )}
    </li>
  );
}
