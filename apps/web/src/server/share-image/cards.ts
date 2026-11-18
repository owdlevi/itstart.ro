import "server-only";
import type { Challenge, Profile, ProjectPage, QuestionPage } from "@repo/core";
import { getFormatter, getTranslations } from "next-intl/server";
import { share } from "./version";

/**
 * Each shared page's card (DECISIONS, "Share image and Open Graph tags"):
 * built from the data the page already loaded, so the page's tags and its
 * image route agree on the version.
 */

/** Screen 10's card: the project, its challenge's month, its builder. */
export async function projectShare(project: ProjectPage) {
  const [t, format] = await Promise.all([
    getTranslations("share"),
    getFormatter(),
  ]);
  const { challenge, owner } = project;
  const launched = project.stage === "launched";
  return share(
    {
      label: challenge
        ? t("challengeLabel", {
            number: challenge.number,
            month: format.dateTime(challenge.startsAt, {
              month: "long",
              year: "numeric",
            }),
          })
        : t("ownProject"),
      title: project.name,
      line: project.pitch,
      byline: t(launched ? "launchedBy" : "buildingBy", { name: owner.name }),
      person: {
        id: owner.id,
        name: owner.name,
        avatarUrl: owner.avatarUrl,
        avatarFill: owner.avatarFill,
        isAgent: owner.isAgent,
      },
    },
    t("projectAlt", {
      stage: project.stage,
      name: project.name,
      builder: owner.name,
    }),
  );
}

/** Screens 02 and 11: the brief's title and summary, and where it stands. */
export async function challengeShare(challenge: Challenge) {
  const [t, format] = await Promise.all([
    getTranslations("share"),
    getFormatter(),
  ]);
  const day = (at: Date) =>
    format.dateTime(at, { day: "numeric", month: "long" });
  return share(
    {
      label: t("challengeLabel", {
        number: challenge.number,
        month: format.dateTime(challenge.startsAt, {
          month: "long",
          year: "numeric",
        }),
      }),
      title: challenge.title,
      line: challenge.summary,
      byline:
        challenge.status === "ended"
          ? t("challengeEnded")
          : challenge.status === "upcoming"
            ? t("challengeUpcoming", { date: day(challenge.startsAt) })
            : t("challengeRunning", { date: day(challenge.endsAt) }),
      person: null,
    },
    t("challengeAlt", { number: challenge.number, title: challenge.title }),
  );
}

/** Screen 05: the person, their bio, their city and launches. */
export async function profileShare(profile: Profile) {
  const t = await getTranslations("share");
  return share(
    {
      label: t("profileLabel", { agent: String(profile.isAgent) }),
      title: profile.name,
      line: profile.bio,
      byline: [profile.city, t("launched", { n: profile.stats.launched })]
        .filter(Boolean)
        .join(" · "),
      person: {
        id: profile.id,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        avatarFill: profile.avatarFill,
        isAgent: profile.isAgent,
      },
    },
    t("profileAlt", { name: profile.name }),
  );
}

/** A question's page: the question, who asked, how far it got. */
export async function questionShare(
  challenge: Pick<Challenge, "number">,
  question: QuestionPage,
) {
  const t = await getTranslations("share");
  const { author } = question;
  return share(
    {
      label: t("questionLabel", { number: challenge.number }),
      title: question.title,
      line: null,
      byline: t("questionBy", {
        solved: String(question.solved),
        name: author.name,
        n: question.answerCount,
      }),
      person: {
        id: author.id,
        name: author.name,
        avatarUrl: author.avatarUrl,
        avatarFill: author.avatarFill,
        isAgent: author.isAgent,
      },
    },
    t("questionAlt", { title: question.title }),
  );
}
