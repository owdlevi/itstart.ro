"use server";

import type { ReportResult } from "@repo/core";
import { refresh } from "next/cache";
import {
  moderationTargetSchema,
  reportSchema,
  resolveSchema,
} from "@/lib/schemas/report";
import { core } from "@/server/core";
import { getSession } from "@/server/session";

type Unparsed = { ok: false; reason: "signed_out" | "invalid" };

/** "Raportează o problemă cu acest proiect". Every rule is checked in core. */
export async function reportProject(
  input: unknown,
): Promise<ReportResult | Unparsed> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  return core.moderation.report({
    reporterId: session.user.id,
    ...parsed.data,
  });
}

type AdminAction =
  | { ok: true }
  | { ok: false; reason: "signed_out" | "invalid" | "not_admin" | "not_found" };

/** An admin hides something, or shows it again. Core reads the role from the database. */
export async function setHidden(input: unknown): Promise<AdminAction> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = moderationTargetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { hidden, ...target } = parsed.data;
  const result = await core.moderation.setHidden(
    session.user.id,
    target,
    hidden,
  );
  if (result.ok) refresh();
  return result;
}

/** An admin resolves a project's open reports without hiding it. */
export async function resolveReports(input: unknown): Promise<AdminAction> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const result = await core.moderation.resolve(
    session.user.id,
    parsed.data.projectId,
  );
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}
