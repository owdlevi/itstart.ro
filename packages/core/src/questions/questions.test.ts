import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { answers as answersTable, questions as questionsTable } from "@repo/db";
import { createTestDb } from "@repo/db/testing";
import { addExtra, ask, makeChallenge, makeUser } from "../test-data";
import {
  createQuestions,
  QUESTION_LIMITS,
  type QuestionsConfig,
} from "./index";

const MINUTE = 60_000;
// 23:59 Europe/Bucharest on 30 November: makeChallenge's deadline.
const DEADLINE = new Date("2026-11-30T21:59:00Z");

async function setup(config?: QuestionsConfig) {
  const db = await createTestDb();
  let now = new Date("2026-11-11T05:35:00Z");
  const questions = createQuestions({ db, now: () => now, config });
  const challenge = await makeChallenge(db);
  const onboarded = { onboardedAt: new Date("2026-09-01T00:00:00Z") };
  const asker = await makeUser(db, { name: "Andrei Popescu", ...onboarded });
  const helper = await makeUser(db, { name: "Ioana Mureșan", ...onboarded });
  return {
    db,
    questions,
    challenge,
    asker,
    helper,
    onboarded,
    at: (date: Date) => (now = date),
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

async function asked(
  s: Awaited<ReturnType<typeof setup>>,
  title = "Cum trimit SMS fără să plătesc?",
) {
  const result = await s.questions.ask({
    authorId: s.asker.id,
    challengeId: s.challenge.id,
    title,
  });
  if (!result.ok) throw new Error(result.reason);
  return result;
}

async function answered(
  s: Awaited<ReturnType<typeof setup>>,
  questionId: string,
  authorId = s.helper.id,
  body = "Cu Twilio, pe contul de test.",
) {
  const result = await s.questions.answer({ authorId, questionId, body });
  if (!result.ok) throw new Error(result.reason);
  return result;
}

describe("questions.ask", () => {
  test("a signed-in person asks; the slug comes from the title, unique in the challenge", async () => {
    const s = await setup();
    const first = await asked(s);
    const second = await asked(s);
    expect(first.slug).toBe("cum-trimit-sms-fara-sa-platesc");
    expect(second.slug).toBe("cum-trimit-sms-fara-sa-platesc-2");

    const page = await s.questions.bySlug(s.challenge.id, first.slug);
    expect(page).toMatchObject({
      title: "Cum trimit SMS fără să plătesc?",
      body: "",
      solved: false,
      answerCount: 0,
      author: { id: s.asker.id, name: "Andrei Popescu" },
    });
  });

  test("keeps up to 60 characters of the title in the slug", async () => {
    const s = await setup();
    const { slug } = await asked(
      s,
      "Cum fac să nu se suprapună două programări în același minut?",
    );
    expect(slug).toBe(
      "cum-fac-sa-nu-se-suprapuna-doua-programari-in-acelasi-minut",
    );
  });

  test("trims the title and details and refuses them empty or too long", async () => {
    const s = await setup();
    const input = { authorId: s.asker.id, challengeId: s.challenge.id };
    expect(await s.questions.ask({ ...input, title: "   " })).toEqual({
      ok: false,
      reason: "title_empty",
    });
    expect(
      await s.questions.ask({
        ...input,
        title: "a".repeat(QUESTION_LIMITS.title + 1),
      }),
    ).toEqual({ ok: false, reason: "title_too_long" });
    expect(
      await s.questions.ask({
        ...input,
        title: "Supabase sau Firebase?",
        body: "b".repeat(QUESTION_LIMITS.body + 1),
      }),
    ).toEqual({ ok: false, reason: "body_too_long" });

    const ok = await s.questions.ask({
      ...input,
      title: "  Supabase sau Firebase?  ",
      body: "  Pentru programări.  ",
    });
    expect(ok.ok).toBe(true);
    const page = await s.questions.bySlug(
      s.challenge.id,
      "supabase-sau-firebase",
    );
    expect(page).toMatchObject({
      title: "Supabase sau Firebase?",
      body: "Pentru programări.",
    });
  });

  test("refuses agents, and people without a name yet", async () => {
    const s = await setup();
    const agent = await makeUser(s.db, { isAgent: true, ...s.onboarded });
    const newcomer = await makeUser(s.db);
    const input = { challengeId: s.challenge.id, title: "Întrebare?" };
    expect(await s.questions.ask({ ...input, authorId: agent.id })).toEqual({
      ok: false,
      reason: "agent",
    });
    expect(await s.questions.ask({ ...input, authorId: newcomer.id })).toEqual({
      ok: false,
      reason: "not_onboarded",
    });
  });

  test("closes at the challenge's deadline, 23:59 in Bucharest (rule 1)", async () => {
    const s = await setup();
    const input = {
      authorId: s.asker.id,
      challengeId: s.challenge.id,
      title: "Întrebare?",
    };
    s.at(DEADLINE);
    expect((await s.questions.ask(input)).ok).toBe(true);
    s.at(new Date(DEADLINE.getTime() + MINUTE));
    expect(await s.questions.ask({ ...input, title: "Alta?" })).toEqual({
      ok: false,
      reason: "closed",
    });
  });

  test("is open before the challenge starts", async () => {
    const s = await setup();
    s.at(new Date("2026-10-20T10:00:00Z"));
    expect((await asked(s)).slug).toBeTruthy();
  });

  test("refuses an unknown challenge, and throws for an unknown author", async () => {
    const s = await setup();
    expect(
      await s.questions.ask({
        authorId: s.asker.id,
        challengeId: crypto.randomUUID(),
        title: "Întrebare?",
      }),
    ).toEqual({ ok: false, reason: "not_found" });
    await expect(
      s.questions.ask({
        authorId: crypto.randomUUID(),
        challengeId: s.challenge.id,
        title: "Întrebare?",
      }),
    ).rejects.toThrow("unknown user");
  });
});

describe("questions.answer", () => {
  test("anyone signed in answers, the asker included", async () => {
    const s = await setup();
    const q = await asked(s);
    await answered(s, q.id);
    s.advance(MINUTE);
    await answered(s, q.id, s.asker.id, "Am găsit: SMS prin e-mail.");
    const page = await s.questions.bySlug(s.challenge.id, q.slug);
    expect(page?.answerCount).toBe(2);
    expect(page?.answers.map((a) => a.author.id)).toEqual([
      s.helper.id,
      s.asker.id,
    ]);
  });

  test("refuses an empty or too long answer, and an unknown or hidden question", async () => {
    const s = await setup();
    const q = await asked(s);
    const input = { authorId: s.helper.id, questionId: q.id };
    expect(await s.questions.answer({ ...input, body: " " })).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(
      await s.questions.answer({
        ...input,
        body: "x".repeat(QUESTION_LIMITS.answer + 1),
      }),
    ).toEqual({ ok: false, reason: "too_long" });
    expect(
      await s.questions.answer({
        ...input,
        questionId: crypto.randomUUID(),
        body: "Da.",
      }),
    ).toEqual({ ok: false, reason: "not_found" });
    await s.db
      .update(questionsTable)
      .set({ hidden: true })
      .where(eq(questionsTable.id, q.id));
    expect(await s.questions.answer({ ...input, body: "Da." })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  test("closes at the deadline, like asking (rule 1)", async () => {
    const s = await setup();
    const q = await asked(s);
    s.at(new Date(DEADLINE.getTime() + MINUTE));
    expect(
      await s.questions.answer({
        authorId: s.helper.id,
        questionId: q.id,
        body: "Da.",
      }),
    ).toEqual({ ok: false, reason: "closed" });
  });

  test("refuses agents", async () => {
    const s = await setup();
    const q = await asked(s);
    const agent = await makeUser(s.db, { isAgent: true, ...s.onboarded });
    expect(
      await s.questions.answer({
        authorId: agent.id,
        questionId: q.id,
        body: "Da.",
      }),
    ).toEqual({ ok: false, reason: "agent" });
  });
});

describe("rate limit", () => {
  test("counts questions and answers together, 10 an hour per person", async () => {
    const s = await setup({ rateLimit: { max: 3, windowMinutes: 60 } });
    const q = await asked(s);
    await answered(s, q.id, s.asker.id);
    await answered(s, q.id, s.asker.id);
    expect(
      await s.questions.answer({
        authorId: s.asker.id,
        questionId: q.id,
        body: "Încă una.",
      }),
    ).toEqual({ ok: false, reason: "rate_limited" });
    expect(
      await s.questions.ask({
        authorId: s.asker.id,
        challengeId: s.challenge.id,
        title: "Încă una?",
      }),
    ).toEqual({ ok: false, reason: "rate_limited" });
    // Someone else isn't limited by it.
    await answered(s, q.id);

    s.advance(60 * MINUTE + 1);
    expect((await asked(s, "Încă una?")).ok).toBe(true);
  });

  test("defaults to 10 an hour", async () => {
    const s = await setup();
    const q = await asked(s);
    for (let i = 0; i < 9; i++) await answered(s, q.id, s.asker.id);
    expect(
      await s.questions.answer({
        authorId: s.asker.id,
        questionId: q.id,
        body: "A unsprezecea.",
      }),
    ).toEqual({ ok: false, reason: "rate_limited" });
  });
});

describe("questions.markSolved", () => {
  test("only the asker marks an answer as the solution; it comes first", async () => {
    const s = await setup();
    const q = await asked(s);
    const first = await answered(s, q.id);
    s.advance(MINUTE);
    const second = await answered(s, q.id, s.asker.id, "Merge cu Twilio.");

    expect(
      await s.questions.markSolved({
        userId: s.helper.id,
        questionId: q.id,
        answerId: first.id,
      }),
    ).toEqual({ ok: false, reason: "not_author" });

    expect(
      await s.questions.markSolved({
        userId: s.asker.id,
        questionId: q.id,
        answerId: second.id,
      }),
    ).toEqual({ ok: true });
    const page = await s.questions.bySlug(s.challenge.id, q.slug);
    expect(page?.solved).toBe(true);
    expect(page?.solvedAnswerId).toBe(second.id);
    expect(page?.answers.map((a) => a.id)).toEqual([second.id, first.id]);
    const { questions: rows } = await s.questions.list(s.challenge.id);
    expect(rows[0]?.solved).toBe(true);
  });

  test("the asker can change or clear it, also after the deadline", async () => {
    const s = await setup();
    const q = await asked(s);
    const a = await answered(s, q.id);
    const b = await answered(s, q.id);
    s.at(new Date(DEADLINE.getTime() + 60 * MINUTE));
    const mark = (answerId: string | null) =>
      s.questions.markSolved({
        userId: s.asker.id,
        questionId: q.id,
        answerId,
      });
    expect(await mark(a.id)).toEqual({ ok: true });
    expect(await mark(b.id)).toEqual({ ok: true });
    expect(
      (await s.questions.bySlug(s.challenge.id, q.slug))?.solvedAnswerId,
    ).toBe(b.id);
    expect(await mark(null)).toEqual({ ok: true });
    expect((await s.questions.bySlug(s.challenge.id, q.slug))?.solved).toBe(
      false,
    );
  });

  test("refuses an answer from another question", async () => {
    const s = await setup();
    const q = await asked(s);
    const other = await asked(s, "Alta?");
    const elsewhere = await answered(s, other.id);
    expect(
      await s.questions.markSolved({
        userId: s.asker.id,
        questionId: q.id,
        answerId: elsewhere.id,
      }),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  test("a hidden solution no longer solves the question", async () => {
    const s = await setup();
    const q = await asked(s);
    const a = await answered(s, q.id);
    await s.questions.markSolved({
      userId: s.asker.id,
      questionId: q.id,
      answerId: a.id,
    });
    await s.db
      .update(answersTable)
      .set({ hidden: true })
      .where(eq(answersTable.id, a.id));
    const page = await s.questions.bySlug(s.challenge.id, q.slug);
    expect(page).toMatchObject({
      solved: false,
      solvedAnswerId: null,
      answers: [],
      answerCount: 0,
    });
    const { questions: rows } = await s.questions.list(s.challenge.id);
    expect(rows[0]?.solved).toBe(false);
  });
});

describe("questions.list", () => {
  test("latest activity first: a new answer brings a question up", async () => {
    const s = await setup();
    const older = await asked(s, "Prima?");
    s.advance(MINUTE);
    await asked(s, "A doua?");
    s.advance(MINUTE);
    const { questions: before } = await s.questions.list(s.challenge.id);
    expect(before.map((q) => q.title)).toEqual(["A doua?", "Prima?"]);

    await answered(s, older.id);
    const { questions: after } = await s.questions.list(s.challenge.id, {
      limit: 1,
    });
    expect(after.map((q) => q.title)).toEqual(["Prima?"]);
    expect(after[0]?.lastActivityAt).toEqual(new Date("2026-11-11T05:37:00Z"));
  });

  test("counts come from the rows, never drifting (§4), plus the design fixtures' extras", async () => {
    const s = await setup();
    const q = await asked(s);
    await answered(s, q.id);
    const hidden = await ask(s.db, s.challenge.id, { hidden: true });
    const elsewhere = await makeChallenge(s.db);
    await ask(s.db, elsewhere.id);

    let list = await s.questions.list(s.challenge.id);
    expect(list.total).toBe(1);
    expect(list.questions.map((r) => r.id)).toEqual([q.id]);
    expect(list.questions[0]?.answerCount).toBe(1);

    await addExtra(s.db, s.challenge.id, "questions", 11);
    await addExtra(s.db, q.id, "answers", 3);
    list = await s.questions.list(s.challenge.id);
    expect(list.total).toBe(12);
    expect(list.questions[0]?.answerCount).toBe(4);
    expect(await s.questions.bySlug(s.challenge.id, hidden.slug)).toBeNull();
  });

  test("an empty challenge has no questions", async () => {
    const s = await setup();
    expect(await s.questions.list(s.challenge.id)).toEqual({
      questions: [],
      total: 0,
    });
  });
});
