import {
  isHttpsUrl,
  missingToLaunch,
  PROJECT_LIMITS,
  type ProjectEdit,
} from "@repo/core/project-rules";
import { z } from "zod";

export { PROJECT_LIMITS };

/** "Unelte folosite": the reference's chips, in its order. "+ Alta" adds any other. */
export const PROJECT_TOOLS = [
  "Claude",
  "Next.js",
  "Supabase",
  "Tailwind CSS",
  "Vercel",
  "Cursor",
];

export const BUILD_DURATIONS = ["under_10h", "10_30h", "over_30h"] as const;

/** The query flag that shows "Am salvat proiectul." once on its page. */
export const SAVED_PARAM = "salvat";

/** The select's value for "Fără provocare · proiect propriu". */
export const OWN_PROJECT = "";

const text = (max: number) => z.string().trim().max(max, { error: "too_long" });

/**
 * The launch form (screen 09), parsed in the browser and again in the action;
 * core checks every rule once more. Errors are codes, mapped to copy by the form.
 */
export const projectSchema = z
  .object({
    challengeSlug: z.string().max(200),
    name: text(PROJECT_LIMITS.name).min(1, { error: "empty" }),
    pitch: text(PROJECT_LIMITS.pitch).min(1, { error: "empty" }),
    liveUrl: z
      .string()
      .trim()
      .min(1, { error: "empty" })
      .refine(isHttpsUrl, { error: "invalid" }),
    screenshots: z.array(z.string().max(2000)).max(PROJECT_LIMITS.screenshots),
    description: text(PROJECT_LIMITS.description),
    tools: z
      .array(z.string().trim().min(1).max(PROJECT_LIMITS.tool))
      .max(PROJECT_LIMITS.tools, { error: "too_many" }),
    duration: z.enum([...BUILD_DURATIONS, ""]),
    hardestPart: text(PROJECT_LIMITS.hardestPart),
    prompt: text(PROJECT_LIMITS.prompt),
    stage: z.enum(["in_progress", "launched"]),
    /** Editing only: one line on what changed (rule 8). */
    update: text(PROJECT_LIMITS.update),
  })
  .superRefine((fields, ctx) => {
    if (fields.stage !== "launched") return;
    // Rule 4, with core's own check, each on its field.
    const paths = {
      screenshots: "screenshots",
      description: "description",
      duration: "duration",
      hardestPart: "hardestPart",
    } as const;
    for (const missing of missingToLaunch(toProjectInput(fields))) {
      ctx.addIssue({
        code: "custom",
        path: [paths[missing]],
        message: "launch",
      });
    }
  });

export type ProjectFields = z.infer<typeof projectSchema>;

export const emptyProjectFields = (
  challengeSlug: string | null,
): ProjectFields => ({
  challengeSlug: challengeSlug ?? OWN_PROJECT,
  name: "",
  pitch: "",
  liveUrl: "",
  screenshots: [],
  description: "",
  tools: [],
  duration: "",
  hardestPart: "",
  prompt: "",
  stage: "in_progress",
  update: "",
});

/** The form's fields as core takes them. */
export function toProjectInput(fields: ProjectFields): ProjectEdit {
  return {
    challengeSlug: fields.challengeSlug || null,
    name: fields.name,
    pitch: fields.pitch,
    liveUrl: fields.liveUrl,
    screenshots: fields.screenshots,
    description: fields.description.trim() || null,
    tools: fields.tools,
    build: {
      duration: fields.duration || null,
      hardestPart: fields.hardestPart.trim() || null,
      prompt: fields.prompt.trim() || null,
    },
    stage: fields.stage,
    update: fields.update.trim() || null,
  };
}

/** The other way: a saved project prefilling its edit form. */
export function toProjectFields(
  input: Omit<ProjectEdit, "update">,
): ProjectFields {
  return {
    challengeSlug: input.challengeSlug ?? OWN_PROJECT,
    name: input.name,
    pitch: input.pitch,
    liveUrl: input.liveUrl,
    screenshots: input.screenshots,
    description: input.description ?? "",
    tools: input.tools,
    duration: input.build.duration ?? "",
    hardestPart: input.build.hardestPart ?? "",
    prompt: input.build.prompt ?? "",
    stage: input.stage,
    update: "",
  };
}

/** The action's input: a new project (slug null) or an edit. */
export const saveProjectSchema = z.object({
  slug: z.string().max(200).nullable(),
  fields: projectSchema,
});

/**
 * A draft kept in this browser ("Salvează ciorna"): the form's fields as they
 * were, unchecked, since a draft may be half done. Anything else is ignored.
 */
export const draftSchema = z.object({
  challengeSlug: z.string(),
  name: z.string(),
  pitch: z.string(),
  liveUrl: z.string(),
  screenshots: z.array(z.string()).max(PROJECT_LIMITS.screenshots),
  description: z.string(),
  tools: z.array(z.string()),
  duration: z.enum([...BUILD_DURATIONS, ""]),
  hardestPart: z.string(),
  prompt: z.string(),
  stage: z.enum(["in_progress", "launched"]),
  update: z.string(),
});
