import { eq, like, max, or, sql } from "drizzle-orm";
import {
  challenges,
  projects,
  projectUpdates,
  users,
  votes,
  type Db,
} from "@repo/db";
import { challengeStatus, enter } from "../challenges";
import { withExtra } from "../counts";
import type { LinkChecker } from "../link-checker";
import { linkPassed } from "../link-checks";
import { assignOnLaunch } from "../reviews/assignments";
import { freeSlug, slugBase } from "../slugs";
import type { Storage } from "../storage";
import {
  isHttpsUrl,
  missingToLaunch,
  PROJECT_LIMITS,
  type LaunchField,
  type ProjectEdit,
  type ProjectInput,
  type ProjectStage,
} from "./rules";

export type SaveRefusal =
  | "not_onboarded" // a project shows its builder's name
  | "not_found"
  | "not_owner"
  | "name_empty"
  | "name_too_long"
  | "pitch_empty"
  | "pitch_too_long"
  | "link_invalid" // not an https address (rule 9)
  | "link_unreachable" // no answer, or an error status (rule 9)
  | "link_needs_account" // 401 or 403: it must open without an account
  | "too_many_screenshots"
  | "screenshot_unknown" // not a file we stored
  | "description_too_long"
  | "hardest_part_too_long"
  | "prompt_too_long"
  | "too_many_tools"
  | "tool_too_long"
  | "update_too_long"
  | "challenge_not_running" // new projects go to the running challenge, or none
  | "challenge_locked" // a launched project stays in its challenge
  | "already_launched"; // no way back to "În lucru" in M1 (rule 6)

export type SaveResult =
  | {
      ok: true;
      slug: string;
      stage: ProjectStage;
      /** It switched to "Lansat" with this save. */
      launched: boolean;
    }
  | { ok: false; reason: SaveRefusal }
  | { ok: false; reason: "incomplete"; missing: LaunchField[] };

/** A project as its owner edits it: the form's values and what frames them. */
export type EditableProject = {
  id: string;
  slug: string;
  stage: ProjectStage;
  launchedAt: Date | null;
  isLate: boolean;
  votes: number;
  /** Its challenge, which the edit form keeps offering even once it has ended. */
  challenge: {
    slug: string;
    number: number;
    title: string;
    endsAt: Date;
    launchCheck: string | null;
  } | null;
  input: ProjectInput;
  /** The version an update saved now would get. */
  nextVersion: number;
};

export type EditableResult =
  | { ok: true; project: EditableProject }
  | { ok: false; reason: "not_found" | "not_owner" };

type Refusal = Exclude<SaveResult, { ok: true }>;

/** Spaces tidied: one line, single spaces. */
const line = (s: string) => s.trim().replace(/\s+/g, " ");
/** Paragraphs kept; blank becomes null. */
const block = (s: string | null) => s?.replace(/\r\n?/g, "\n").trim() || null;

function clean(
  input: ProjectInput,
  storage: Storage,
): { ok: true; value: ProjectInput } | Refusal {
  const name = line(input.name);
  if (!name) return { ok: false, reason: "name_empty" };
  if (name.length > PROJECT_LIMITS.name) {
    return { ok: false, reason: "name_too_long" };
  }
  const pitch = line(input.pitch);
  if (!pitch) return { ok: false, reason: "pitch_empty" };
  if (pitch.length > PROJECT_LIMITS.pitch) {
    return { ok: false, reason: "pitch_too_long" };
  }
  const liveUrl = input.liveUrl.trim();
  if (!isHttpsUrl(liveUrl)) return { ok: false, reason: "link_invalid" };

  const screenshots = [...new Set(input.screenshots)];
  if (screenshots.length > PROJECT_LIMITS.screenshots) {
    return { ok: false, reason: "too_many_screenshots" };
  }
  if (!screenshots.every((url) => storage.owns(url))) {
    return { ok: false, reason: "screenshot_unknown" };
  }

  const description = block(input.description);
  if (description && description.length > PROJECT_LIMITS.description) {
    return { ok: false, reason: "description_too_long" };
  }
  const hardestPart = input.build.hardestPart
    ? line(input.build.hardestPart) || null
    : null;
  if (hardestPart && hardestPart.length > PROJECT_LIMITS.hardestPart) {
    return { ok: false, reason: "hardest_part_too_long" };
  }
  const prompt = block(input.build.prompt);
  if (prompt && prompt.length > PROJECT_LIMITS.prompt) {
    return { ok: false, reason: "prompt_too_long" };
  }

  // The same tool twice, in any case, is kept once, as first written.
  const tools: string[] = [];
  for (const raw of input.tools) {
    const tool = line(raw);
    if (!tool) continue;
    if (tool.length > PROJECT_LIMITS.tool) {
      return { ok: false, reason: "tool_too_long" };
    }
    if (!tools.some((t) => t.toLowerCase() === tool.toLowerCase())) {
      tools.push(tool);
    }
  }
  if (tools.length > PROJECT_LIMITS.tools) {
    return { ok: false, reason: "too_many_tools" };
  }

  return {
    ok: true,
    value: {
      challengeSlug: input.challengeSlug,
      name,
      pitch,
      liveUrl,
      screenshots,
      description,
      tools,
      build: { duration: input.build.duration, hardestPart, prompt },
      stage: input.stage,
    },
  };
}

export function createSaving(deps: {
  db: Db;
  now: () => Date;
  linkChecker: LinkChecker;
  storage: Storage;
}) {
  const { db, now, linkChecker, storage } = deps;

  const checkLink = async (url: string): Promise<Refusal | null> => {
    const answer = await linkChecker.check(url);
    if (answer.ok) return null;
    return {
      ok: false,
      reason:
        answer.reason === "needs_account"
          ? "link_needs_account"
          : "link_unreachable",
    };
  };

  const challengeBySlug = async (slug: string) => {
    const [row] = await db
      .select({
        id: challenges.id,
        startsAt: challenges.startsAt,
        endsAt: challenges.endsAt,
      })
      .from(challenges)
      .where(eq(challenges.slug, slug));
    return row ?? null;
  };

  /** The running challenge by slug, or a refusal. Null slug: a project of its own. */
  const runningChallenge = async (slug: string | null, at: Date) => {
    if (slug === null) return { ok: true as const, challenge: null };
    const challenge = await challengeBySlug(slug);
    if (!challenge || challengeStatus(challenge, at) !== "running") {
      return { ok: false as const, reason: "challenge_not_running" as const };
    }
    return { ok: true as const, challenge };
  };

  const columns = (value: ProjectInput) => ({
    name: value.name,
    pitch: value.pitch,
    liveUrl: value.liveUrl,
    screenshots: value.screenshots,
    description: value.description,
    tools: value.tools,
    buildDuration: value.build.duration,
    buildHardestPart: value.build.hardestPart,
    buildPrompt: value.build.prompt,
  });

  return {
    /**
     * A new project, "În lucru" with a name, pitch and live link, or "Lansat"
     * with everything rule 4 asks for. A project for the running challenge
     * puts its builder in that challenge (rule 2), back in if they had left.
     */
    create: async (
      ownerId: string,
      input: ProjectInput,
    ): Promise<SaveResult> => {
      const [owner] = await db
        .select({ onboardedAt: users.onboardedAt })
        .from(users)
        .where(eq(users.id, ownerId));
      if (!owner) throw new Error(`projects.create: unknown user ${ownerId}`);
      if (!owner.onboardedAt) return { ok: false, reason: "not_onboarded" };

      const cleaned = clean(input, storage);
      if (!cleaned.ok) return cleaned;
      const value = cleaned.value;
      const at = now();
      const target = await runningChallenge(value.challengeSlug, at);
      if (!target.ok) return target;
      if (value.stage === "launched") {
        const missing = missingToLaunch(value);
        if (missing.length) return { ok: false, reason: "incomplete", missing };
      }
      const link = await checkLink(value.liveUrl);
      if (link) return link;

      return db.transaction(async (tx) => {
        const base = slugBase(value.name, "proiect");
        // Two projects named alike saved at once can't both get `base`.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`slug:${base}`}))`,
        );
        const taken = await tx
          .select({ slug: projects.slug })
          .from(projects)
          .where(or(eq(projects.slug, base), like(projects.slug, `${base}-%`)));
        const slug = freeSlug(base, new Set(taken.map((t) => t.slug)));
        const launched = value.stage === "launched";
        const [created] = await tx
          .insert(projects)
          .values({
            slug,
            ownerId,
            challengeId: target.challenge?.id ?? null,
            ...columns(value),
            stage: value.stage,
            // Only the running challenge takes new projects, so never late.
            launchedAt: launched ? at : null,
            // Rule 9's check just answered: it's the first link check.
            ...linkPassed(at),
            createdAt: at,
          })
          .returning({ id: projects.id });
        if (target.challenge) await enter(tx, ownerId, target.challenge.id, at);
        if (launched) {
          await assignOnLaunch(tx, {
            projectId: created!.id,
            ownerId,
            challengeId: target.challenge?.id ?? null,
            at,
          });
        }
        return { ok: true, slug, stage: value.stage, launched };
      });
    },

    /**
     * Saves the owner's changes (rule 8: a launched project too), with an
     * optional one-line update as the next version. Switching to "Lansat" sets
     * launchedAt once (rule 6) and, after the deadline, flags it late (rule 7).
     */
    edit: async (
      userId: string,
      slug: string,
      input: ProjectEdit,
    ): Promise<SaveResult> => {
      const [current] = await db
        .select({
          id: projects.id,
          ownerId: projects.ownerId,
          stage: projects.stage,
          liveUrl: projects.liveUrl,
          buildDuration: projects.buildDuration,
          challengeId: projects.challengeId,
          challengeSlug: challenges.slug,
          endsAt: challenges.endsAt,
        })
        .from(projects)
        .leftJoin(challenges, eq(challenges.id, projects.challengeId))
        .where(eq(projects.slug, slug));
      if (!current) return { ok: false, reason: "not_found" };
      if (current.ownerId !== userId) return { ok: false, reason: "not_owner" };

      const cleaned = clean(input, storage);
      if (!cleaned.ok) return cleaned;
      const value = cleaned.value;
      const update = input.update ? line(input.update) || null : null;
      if (update && update.length > PROJECT_LIMITS.update) {
        return { ok: false, reason: "update_too_long" };
      }
      const wasLaunched = current.stage === "launched";
      if (wasLaunched && value.stage !== "launched") {
        return { ok: false, reason: "already_launched" };
      }

      const at = now();
      let challenge: { id: string; endsAt: Date } | null =
        current.challengeId && current.endsAt
          ? { id: current.challengeId, endsAt: current.endsAt }
          : null;
      const moved = value.challengeSlug !== (current.challengeSlug ?? null);
      if (moved) {
        // Its votes were cast in that challenge.
        if (wasLaunched) return { ok: false, reason: "challenge_locked" };
        const target = await runningChallenge(value.challengeSlug, at);
        if (!target.ok) return target;
        challenge = target.challenge;
      }

      const launching = !wasLaunched && value.stage === "launched";
      if (value.stage === "launched") {
        const missing = missingToLaunch(value);
        if (missing.length) return { ok: false, reason: "incomplete", missing };
      }
      const checked = value.liveUrl !== current.liveUrl || launching;
      if (checked) {
        const link = await checkLink(value.liveUrl);
        if (link) return link;
      }

      return db.transaction(async (tx) => {
        await tx
          .update(projects)
          .set({
            ...columns(value),
            challengeId: challenge?.id ?? null,
            // The builder's own words describe the old bucket.
            ...(value.build.duration !== current.buildDuration && {
              buildDurationText: null,
            }),
            // Rule 9's check answered: it counts as the latest link check.
            ...(checked && linkPassed(at)),
            ...(launching && {
              stage: "launched" as const,
              launchedAt: at,
              isLate: challenge !== null && at > challenge.endsAt,
            }),
          })
          .where(eq(projects.id, current.id));
        if (update) {
          // The update above holds the project's row until the commit, so
          // two saves can't take one version.
          const [last] = await tx
            .select({ version: max(projectUpdates.version) })
            .from(projectUpdates)
            .where(eq(projectUpdates.projectId, current.id));
          await tx.insert(projectUpdates).values({
            projectId: current.id,
            version: (last?.version ?? 0) + 1,
            text: update,
            createdAt: at,
          });
        }
        if (moved && challenge) await enter(tx, userId, challenge.id, at);
        if (launching) {
          // A late launch too: reviews stay open after the deadline.
          await assignOnLaunch(tx, {
            projectId: current.id,
            ownerId: userId,
            challengeId: challenge?.id ?? null,
            at,
          });
        }
        return {
          ok: true,
          slug,
          stage: value.stage,
          launched: launching,
        };
      });
    },

    /** A project prefilled for its owner's edit form; anyone else is refused. */
    editable: async (slug: string, userId: string): Promise<EditableResult> => {
      const [row] = await db
        .select({
          id: projects.id,
          slug: projects.slug,
          ownerId: projects.ownerId,
          stage: projects.stage,
          launchedAt: projects.launchedAt,
          isLate: projects.isLate,
          name: projects.name,
          pitch: projects.pitch,
          liveUrl: projects.liveUrl,
          screenshots: projects.screenshots,
          description: projects.description,
          tools: projects.tools,
          buildDuration: projects.buildDuration,
          buildHardestPart: projects.buildHardestPart,
          buildPrompt: projects.buildPrompt,
          votes: withExtra(
            sql`select count(*) from ${votes} where ${votes.projectId} = ${projects.id}`,
            projects.id,
            "votes",
          ),
          challenge: {
            slug: challenges.slug,
            number: challenges.number,
            title: challenges.title,
            endsAt: challenges.endsAt,
            launchCheck: challenges.launchCheck,
          },
        })
        .from(projects)
        .leftJoin(challenges, eq(challenges.id, projects.challengeId))
        .where(eq(projects.slug, slug));
      if (!row) return { ok: false, reason: "not_found" };
      if (row.ownerId !== userId) return { ok: false, reason: "not_owner" };
      const [last] = await db
        .select({ version: max(projectUpdates.version) })
        .from(projectUpdates)
        .where(eq(projectUpdates.projectId, row.id));
      // A left join gives an object of nulls when there's no challenge.
      const challenge = row.challenge?.slug
        ? {
            slug: row.challenge.slug,
            number: row.challenge.number!,
            title: row.challenge.title!,
            endsAt: row.challenge.endsAt!,
            launchCheck: row.challenge.launchCheck,
          }
        : null;
      return {
        ok: true,
        project: {
          id: row.id,
          slug: row.slug,
          stage: row.stage,
          launchedAt: row.launchedAt,
          isLate: row.isLate,
          votes: row.votes,
          challenge,
          input: {
            challengeSlug: challenge?.slug ?? null,
            name: row.name,
            pitch: row.pitch,
            liveUrl: row.liveUrl,
            screenshots: row.screenshots,
            description: row.description,
            tools: row.tools,
            build: {
              duration: row.buildDuration,
              hardestPart: row.buildHardestPart,
              prompt: row.buildPrompt,
            },
            stage: row.stage,
          },
          nextVersion: (last?.version ?? 0) + 1,
        },
      };
    },
  };
}
