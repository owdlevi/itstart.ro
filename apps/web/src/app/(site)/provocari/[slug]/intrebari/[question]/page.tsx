import type { Answer } from "@repo/core";
import { ArrowLeft, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";
import { AnswerForm } from "@/components/answer-form";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { SolutionButton } from "@/components/solution-button";
import { StatusChip } from "@/components/status-chip";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { core, now } from "@/server/core";
import { getSession } from "@/server/session";

const getQuestion = cache(async (slug: string, questionSlug: string) => {
  const challenge = await core.challenges.bySlug(slug);
  if (!challenge) return null;
  const question = await core.questions.bySlug(challenge.id, questionSlug);
  return question && { challenge, question };
});

export async function generateMetadata({
  params,
}: PageProps<"/provocari/[slug]/intrebari/[question]">): Promise<Metadata> {
  const { slug, question } = await params;
  const found = await getQuestion(slug, question);
  if (!found) return {};
  return {
    title: found.question.title,
    description: found.question.body || undefined,
  };
}

/**
 * One question and its answers (M2). No reference design: a page per
 * question, so each has a link to share, built from screen 04's reviews
 * (DECISIONS, "Questions and answers"). The asker marks the solution, which
 * comes first.
 */
export default async function QuestionPage({
  params,
}: PageProps<"/provocari/[slug]/intrebari/[question]">) {
  const { slug, question: questionSlug } = await params;
  const found = await getQuestion(slug, questionSlug);
  if (!found) notFound();
  const { challenge, question } = found;
  const [t, session] = await Promise.all([
    getTranslations("questions"),
    getSession(),
  ]);
  const viewerId = session?.user.id ?? null;
  const isAsker = viewerId === question.author.id;
  const href = `/provocari/${challenge.slug}/intrebari/${question.slug}`;
  const closed = challenge.status === "ended";

  return (
    <Container className="max-w-[760px]">
      <div className="pt-3 md:pt-6">
        <Link
          href={`/provocari/${challenge.slug}/intrebari`}
          className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold"
        >
          <ArrowLeft size={18} strokeWidth={2.2} aria-hidden />
          {t("page.back")}
        </Link>
      </div>
      <article className="flex flex-col gap-3 pb-6 pt-4 md:pb-8 md:pt-6">
        <p className="text-[13px] font-bold uppercase leading-[18px] tracking-[0.06em] text-primary">
          {t("page.eyebrow", { number: challenge.number })}
        </p>
        <h1 className="text-[28px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[40px] md:leading-[1.12]">
          {question.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex min-w-0 items-center gap-2 text-sm text-muted">
            <Avatar person={question.author} size={22} />
            <When
              date={question.createdAt}
              template={(when) =>
                t("page.asked", { name: question.author.name, when })
              }
            />
          </span>
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
              {t("row.solved")}
            </StatusChip>
          )}
        </div>
        {question.body && (
          <p className="whitespace-pre-line leading-6">{question.body}</p>
        )}
      </article>

      <section
        id="raspunsuri"
        className="flex scroll-mt-6 flex-col gap-5 pb-10 md:pb-[72px]"
      >
        <h2 className="text-[22px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[26px]">
          {t("page.answersTitle", { n: question.answerCount })}
        </h2>
        {isAsker && !question.solved && question.answers.length > 0 && (
          <p className="-mt-2 text-[15px] leading-[23px] text-muted">
            {t("page.solutionHint")}
          </p>
        )}
        {question.answers.map((answer) => (
          <AnswerItem
            key={answer.id}
            answer={answer}
            questionId={question.id}
            isSolution={answer.id === question.solvedAnswerId}
            canMark={isAsker}
          />
        ))}
        {closed ? (
          <p className="text-muted">{t("page.closed")}</p>
        ) : session?.user.onboardedAt ? (
          <AnswerForm questionId={question.id} />
        ) : (
          <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-4 md:p-5">
            <p className="text-[15px] font-bold leading-6">
              {t("page.answer")}
            </p>
            <Button
              href={`${session ? "/bun-venit" : "/intra"}?next=${encodeURIComponent(`${href}#raspunsuri`)}`}
              variant="secondary"
              className="w-full md:w-auto md:self-end"
            >
              {t("page.signIn")}
            </Button>
          </div>
        )}
      </section>
    </Container>
  );
}

/** "acum 2 ore", "ieri", or the date after a week, as on reviews (screen 04). */
async function When({
  date,
  template,
}: {
  date: Date;
  template: (when: string) => string;
}) {
  const [t, format] = await Promise.all([
    getTranslations("projectPage.reviews"),
    getFormatter(),
  ]);
  const ago = timeAgo(date, now());
  return (
    <span className="min-w-0">
      {template(
        ago
          ? t("ago", ago)
          : format.dateTime(date, { day: "numeric", month: "long" }),
      )}
    </span>
  );
}

async function AnswerItem({
  answer,
  questionId,
  isSolution,
  canMark,
}: {
  answer: Answer;
  questionId: string;
  isSolution: boolean;
  canMark: boolean;
}) {
  const t = await getTranslations("questions");
  return (
    <article
      className={cn(
        "flex items-start gap-3",
        isSolution &&
          "rounded-lg border-2 border-primary bg-surface p-4 md:p-5",
      )}
    >
      <Avatar person={answer.author} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 leading-6">
          <span id={`raspuns-${answer.id}`} className="text-[15px] font-bold">
            {answer.author.name}
          </span>
          <span className="text-[13px] text-muted">
            <When date={answer.createdAt} template={(when) => when} />
          </span>
          {isSolution && (
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
              {t("page.solution")}
            </StatusChip>
          )}
        </div>
        <p className="whitespace-pre-line text-[15px] leading-[23px]">
          {answer.body}
        </p>
        {canMark && (
          <SolutionButton
            questionId={questionId}
            answerId={answer.id}
            isSolution={isSolution}
            describedBy={`raspuns-${answer.id}`}
          />
        )}
      </div>
    </article>
  );
}
