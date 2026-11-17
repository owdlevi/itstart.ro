"use server";

import type { AnswerResult, AskResult, SolveResult } from "@repo/core";
import { refresh } from "next/cache";
import { answerSchema, askSchema, solveSchema } from "@/lib/schemas/question";
import { core } from "@/server/core";
import { getSession } from "@/server/session";

type Unparsed = { ok: false; reason: "signed_out" | "invalid" };

/** "Pune o întrebare". Returns the new question's slug; the form navigates to it. */
export async function askQuestion(
  input: unknown,
): Promise<AskResult | Unparsed> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  return core.questions.ask({ authorId: session.user.id, ...parsed.data });
}

/** An answer under a question. Every rule is checked in core. */
export async function postAnswer(
  input: unknown,
): Promise<AnswerResult | Unparsed> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const result = await core.questions.answer({
    authorId: session.user.id,
    ...parsed.data,
  });
  if (result.ok) refresh();
  return result;
}

/** The asker marks an answer as the solution, or clears it. */
export async function markSolution(
  input: unknown,
): Promise<SolveResult | Unparsed> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = solveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const result = await core.questions.markSolved({
    userId: session.user.id,
    ...parsed.data,
  });
  if (result.ok) refresh();
  return result;
}
