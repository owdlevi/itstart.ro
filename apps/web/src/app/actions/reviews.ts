"use server";

import type { ReviewResult } from "@repo/core";
import { refresh } from "next/cache";
import { reviewSchema } from "@/lib/schemas/review";
import { core } from "@/server/core";
import { getSession } from "@/server/session";

export type PostReviewResult =
  ReviewResult | { ok: false; reason: "signed_out" | "invalid" };

/** Posts a review or the owner's reply (rules 15–17). Every rule is checked in core. */
export async function postReview(input: unknown): Promise<PostReviewResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const result = await core.reviews.post({
    authorId: session.user.id,
    ...parsed.data,
  });
  if (result.ok) refresh();
  return result;
}
