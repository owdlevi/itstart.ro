// The launch form's rules that need no database, so the browser checks them
// with the same code (apps/web's zod schema imports "@repo/core/project-rules").

export type BuildDuration = "under_10h" | "10_30h" | "over_30h";
export type ProjectStage = "in_progress" | "launched";

/** HANDOVER §4 (name, pitch, screenshots, updates); the rest are placeholders. */
export const PROJECT_LIMITS = {
  name: 60,
  pitch: 80,
  description: 2000,
  hardestPart: 200,
  prompt: 2000,
  tools: 8,
  tool: 30,
  screenshots: 4,
  /** Rule 4: "2+ screenshots" to launch. */
  screenshotsToLaunch: 2,
  update: 140,
  liveUrl: 2000,
} as const;

/** What the launch form (screen 09) sends, to create a project or edit one. */
export type ProjectInput = {
  /** The running challenge's slug, or null for a project of its own. */
  challengeSlug: string | null;
  name: string;
  pitch: string;
  liveUrl: string;
  /** Stored files (the storage seam), in display order; the first is the thumbnail. */
  screenshots: string[];
  description: string | null;
  /** In the order they were picked; cards show the first two. */
  tools: string[];
  build: {
    duration: BuildDuration | null;
    hardestPart: string | null;
    prompt: string | null;
  };
  stage: ProjectStage;
};

export type ProjectEdit = ProjectInput & {
  /** One line on what changed, which becomes the next version (rule 8). */
  update: string | null;
};

/** What "Lansat" needs beyond a name, pitch and link (rule 4). */
export type LaunchField =
  "screenshots" | "description" | "duration" | "hardestPart";

/** An https address anyone can open: no credentials in it, a real host name. */
export function isHttpsUrl(value: string): boolean {
  if (value.length > PROJECT_LIMITS.liveUrl) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      /\.[a-z0-9-]+$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Rule 4: everything in the launch criteria, beyond a name, pitch and link. */
export function missingToLaunch(input: ProjectInput): LaunchField[] {
  const missing: LaunchField[] = [];
  if (input.screenshots.length < PROJECT_LIMITS.screenshotsToLaunch) {
    missing.push("screenshots");
  }
  if (!input.description) missing.push("description");
  if (!input.build.duration) missing.push("duration");
  if (!input.build.hardestPart) missing.push("hardestPart");
  return missing;
}
