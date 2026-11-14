"use server";

import type { VoteResult } from "@repo/core";
import { z } from "zod";
import { core } from "@/server/core";
import { getSession } from "@/server/session";

export type ToggleVoteResult =
  VoteResult | { ok: false; reason: "signed_out" | "invalid" };

/** Casts or removes the viewer's vote (rule 10). Every rule is checked in core. */
export async function toggleVote(
  projectId: unknown,
): Promise<ToggleVoteResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = z.uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  return core.votes.toggle(session.user.id, parsed.data);
}
