"use server";

import { isHttpsUrl, type LinkCheck, type SaveResult } from "@repo/core";
import { z } from "zod";
import {
  SAVED_PARAM,
  saveProjectSchema,
  toProjectInput,
} from "@/lib/schemas/project";
import { core, linkChecker } from "@/server/core";
import { getSession } from "@/server/session";

export type SaveProjectResult =
  /** Where to go next; the form clears its draft and goes. */
  | { ok: true; href: string }
  | Exclude<SaveResult, { ok: true }>
  | { ok: false; reason: "signed_out" | "invalid" };

/**
 * "Lansează proiectul" / "Salvează" on screen 09: creates a project (slug
 * null) or saves its owner's edit. A launch goes on to screen 10; anything
 * else to the project's page, with the saved status once. The form navigates,
 * so it knows the save worked before it drops its draft.
 */
export async function saveProject(input: unknown): Promise<SaveProjectResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = saveProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { slug, fields } = parsed.data;
  const { update, ...project } = toProjectInput(fields);
  const result = slug
    ? await core.projects.edit(session.user.id, slug, { ...project, update })
    : await core.projects.create(session.user.id, project);
  if (!result.ok) return result;
  return {
    ok: true,
    href: result.launched
      ? `/proiecte/${result.slug}/lansat`
      : `/proiecte/${result.slug}?${SAVED_PARAM}=1`,
  };
}

/**
 * The live link's check on blur (rule 9), the same one a save makes. Signed
 * in only: it makes a request to the address it's given.
 */
export async function checkLiveUrl(url: unknown): Promise<LinkCheck | null> {
  const session = await getSession();
  const parsed = z.string().trim().max(2000).safeParse(url);
  if (!session || !parsed.success || !isHttpsUrl(parsed.data)) return null;
  return linkChecker.check(parsed.data);
}
