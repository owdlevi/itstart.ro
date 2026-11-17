import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { AskEntry } from "@/components/ask-entry";
import { Container } from "@/components/container";
import { QuestionRow } from "@/components/question-row";
import { core } from "@/server/core";
import { getSession } from "@/server/session";

const getChallenge = cache((slug: string) => core.challenges.bySlug(slug));

export async function generateMetadata({
  params,
}: PageProps<"/provocari/[slug]/intrebari">): Promise<Metadata> {
  const { slug } = await params;
  const [challenge, t] = await Promise.all([
    getChallenge(slug),
    getTranslations("questions"),
  ]);
  if (!challenge) return {};
  return { title: t("metaTitle", { title: challenge.title }) };
}

/**
 * "Vezi toate" from "Întrebări și ajutor" (screens 02 and 08): every question
 * in the challenge, latest activity first. No reference design; it reuses the
 * section's rows (DECISIONS, "Questions and answers").
 */
export default async function QuestionsPage({
  params,
}: PageProps<"/provocari/[slug]/intrebari">) {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  if (!challenge) notFound();
  const [t, session, { questions }] = await Promise.all([
    getTranslations("questions"),
    getSession(),
    core.questions.list(challenge.id),
  ]);
  const href = `/provocari/${challenge.slug}/intrebari`;

  return (
    <Container className="max-w-[960px]">
      <div className="pt-3 md:pt-6">
        <Link
          href={`/provocari/${challenge.slug}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold"
        >
          <ArrowLeft size={18} strokeWidth={2.2} aria-hidden />
          {t("list.back")}
        </Link>
      </div>
      <div className="flex flex-col gap-2 pb-5 pt-4 md:pb-8 md:pt-6">
        <h1 className="text-[36px] font-bold leading-[1.12] tracking-[-0.02em] md:text-5xl md:leading-[1.12]">
          {t("list.title")}
        </h1>
        <p className="text-[17px] leading-[26px] text-muted">
          {t("list.lead", { number: challenge.number, title: challenge.title })}
        </p>
      </div>
      <div className="flex flex-col gap-4 pb-10 md:pb-[72px]">
        {questions.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {questions.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                href={`${href}/${question.slug}`}
              />
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t("section.none")}</p>
        )}
        {challenge.status === "ended" ? (
          <p className="text-muted">{t("list.closed")}</p>
        ) : (
          <AskEntry
            challengeId={challenge.id}
            challengeSlug={challenge.slug}
            session={session}
            returnTo={href}
          />
        )}
      </div>
    </Container>
  );
}
