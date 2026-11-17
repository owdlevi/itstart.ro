"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { checkLiveUrl, saveProject } from "@/app/actions/projects";
import {
  BUILD_DURATIONS,
  draftSchema,
  OWN_PROJECT,
  PROJECT_LIMITS,
  projectSchema,
  type ProjectFields,
} from "@/lib/schemas/project";
import { cn } from "@/lib/utils";
import { Avatar, type AvatarPerson } from "./avatar";
import { Button } from "./button";
import { Field, Input, noteId, Select, Textarea } from "./field";
import { FilterChip } from "./filter-chip";
import { LaunchRowFrame } from "./launch-row-frame";
import type { UploadVia } from "@/server/storage";
import { ScreenshotPicker, type UploadError } from "./screenshot-picker";
import { Tag } from "./tag";
import { ToolChips } from "./tool-chips";
import { VoteCount } from "./vote-button";

export type ChallengeChoice = {
  slug: string;
  label: string;
  /** The last line of "Înainte să lansezi" for this brief. */
  launchCheck: string | null;
};

const groupLabel = "text-[15px] font-bold leading-[22px]";

function Note({
  id,
  error,
  hint,
  spaced,
}: {
  id: string;
  error?: string | null;
  hint?: string;
  /** Inside a block with the control: the note brings its own gap. */
  spaced?: boolean;
}) {
  return (
    // Always present, so an error replacing the hint is announced (§10).
    <div aria-live="polite">
      {error ? (
        <span
          id={id}
          className={cn(
            "flex items-start gap-1.5 text-sm font-semibold text-warning-ink",
            spaced && "mt-2",
          )}
        >
          <CircleAlert
            size={18}
            strokeWidth={2.2}
            aria-hidden
            className="shrink-0"
          />
          {error}
        </span>
      ) : (
        hint && (
          <span
            id={id}
            className={cn("block text-sm text-muted", spaced && "mt-2")}
          >
            {hint}
          </span>
        )
      )}
    </div>
  );
}

/**
 * Screen 09's form and sidebar: a new project (`slug` null) or its owner's
 * edit. The action re-parses it and core checks every rule.
 */
export function ProjectForm({
  slug,
  defaults,
  challenges,
  allowOwn,
  launched,
  nextVersion,
  owner,
  votes,
  draftKey,
  uploadVia,
}: {
  slug: string | null;
  defaults: ProjectFields;
  /** The challenges it can be for: the running one, or the one it's in. */
  challenges: ChallengeChoice[];
  /** "Fără provocare" is offered (not for a launched project in a challenge). */
  allowOwn: boolean;
  /** Launched already: no stage to choose, no way back (rule 6). */
  launched: boolean;
  /** Editing: the version an update would get (rule 8). */
  nextVersion: number | null;
  owner: AvatarPerson;
  votes: number;
  /** Where "Salvează ciorna" keeps the form in this browser; null when editing. */
  draftKey: string | null;
  uploadVia: UploadVia;
}) {
  const t = useTranslations("launch");
  const router = useRouter();
  const id = useId();
  const ids = {
    challenge: `${id}-challenge`,
    name: `${id}-name`,
    pitch: `${id}-pitch`,
    liveUrl: `${id}-live`,
    screenshots: `${id}-shots`,
    description: `${id}-description`,
    tools: `${id}-tools`,
    build: `${id}-build`,
    duration: `${id}-duration`,
    hardestPart: `${id}-hardest`,
    prompt: `${id}-prompt`,
    stage: `${id}-stage`,
    update: `${id}-update`,
  };
  const [refusal, setRefusal] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<"saved" | "restored" | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  // One server check per address.
  const checked = useRef(new Map<string, string | null>());

  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    getValues,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ProjectFields>({
    resolver: zodResolver(projectSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });
  const values = useWatch({ control });
  const stage = values.stage ?? defaults.stage;

  // A draft saved on this device comes back (after hydration, so the server's
  // HTML and the first render agree).
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      const draft = raw && draftSchema.safeParse(JSON.parse(raw));
      if (draft && draft.success) {
        reset(draft.data);
        setDraftStatus("restored");
      }
    } catch {
      // No storage (private mode): no draft.
    }
  }, [draftKey, reset]);

  const saveDraft = () => {
    if (!draftKey) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(getValues()));
      setDraftStatus("saved");
    } catch {
      setRefusal(t("errors.other"));
    }
  };
  const discardDraft = () => {
    if (!draftKey) return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {}
    reset(defaults);
    setDraftStatus(null);
  };

  const linkMessage = (reason: string) =>
    reason === "needs_account" ? "needs_account" : "unreachable";

  const checkLink = async (url: string) => {
    const trimmed = url.trim();
    if (!checked.current.has(trimmed)) {
      setChecking(true);
      const answer = await checkLiveUrl(trimmed).catch(() => null);
      setChecking(false);
      // No answer at all (signed out, offline): leave it to the save.
      if (!answer) return;
      checked.current.set(
        trimmed,
        answer.ok ? null : linkMessage(answer.reason),
      );
    }
    const problem = checked.current.get(trimmed);
    // Still the address in the field?
    if (problem && getValues("liveUrl").trim() === trimmed) {
      setError("liveUrl", { message: problem });
    }
  };

  const onSubmit = handleSubmit(async (fields) => {
    setRefusal(null);
    setDraftStatus(null);
    const result = await saveProject({ slug, fields }).catch(() => null);
    if (result?.ok) {
      // Saved: the draft has done its job.
      try {
        if (draftKey) window.localStorage.removeItem(draftKey);
      } catch {}
      router.push(result.href);
      return;
    }
    const focus = { shouldFocus: true };
    switch (result?.reason) {
      case "name_empty":
      case "name_too_long":
        setError("name", { message: result.reason.slice(5) }, focus);
        break;
      case "pitch_empty":
      case "pitch_too_long":
        setError("pitch", { message: result.reason.slice(6) }, focus);
        break;
      case "link_invalid":
        setError("liveUrl", { message: "invalid" }, focus);
        break;
      case "link_unreachable":
        setError("liveUrl", { message: "unreachable" }, focus);
        break;
      case "link_needs_account":
        setError("liveUrl", { message: "needs_account" }, focus);
        break;
      case "screenshot_unknown":
      case "too_many_screenshots":
        setError("screenshots", { message: "unknown" }, focus);
        break;
      case "description_too_long":
        setError("description", { message: "too_long" }, focus);
        break;
      case "hardest_part_too_long":
        setError("hardestPart", { message: "too_long" }, focus);
        break;
      case "prompt_too_long":
        setError("prompt", { message: "too_long" }, focus);
        break;
      case "too_many_tools":
      case "tool_too_long":
        setError("tools", { message: "too_many" }, focus);
        break;
      case "update_too_long":
        setError("update", { message: "too_long" }, focus);
        break;
      case "challenge_not_running":
        setError("challengeSlug", { message: "not_running" }, focus);
        break;
      case "challenge_locked":
        setError("challengeSlug", { message: "locked" }, focus);
        break;
      case "incomplete":
        for (const field of result.missing) {
          setError(field, { message: "launch" });
        }
        setError(result.missing[0]!, { message: "launch" }, focus);
        break;
      case "already_launched":
        setRefusal(t("errors.alreadyLaunched"));
        break;
      case "not_onboarded":
        setRefusal(t("errors.notOnboarded"));
        break;
      default:
        setRefusal(t("errors.other"));
    }
    // Throwing keeps isSubmitSuccessful false, so the button comes back.
    throw new Error("refused");
  });

  const tooLong = (max: number) => t("errors.tooLong", { max });
  const error = {
    challengeSlug:
      errors.challengeSlug &&
      (errors.challengeSlug.message === "locked"
        ? t("errors.challengeLocked")
        : t("errors.challengeNotRunning")),
    name:
      errors.name &&
      (errors.name.message === "empty"
        ? t("errors.nameEmpty")
        : tooLong(PROJECT_LIMITS.name)),
    pitch:
      errors.pitch &&
      (errors.pitch.message === "empty"
        ? t("errors.pitchEmpty")
        : tooLong(PROJECT_LIMITS.pitch)),
    liveUrl:
      (errors.liveUrl &&
        {
          empty: t("errors.linkEmpty"),
          unreachable: t("errors.linkUnreachable"),
          needs_account: t("errors.linkNeedsAccount"),
        }[errors.liveUrl.message ?? ""]) ??
      (errors.liveUrl ? t("errors.linkInvalid") : null),
    screenshots:
      errors.screenshots &&
      ({
        launch: t("errors.screenshotsLaunch"),
        type: t("errors.screenshotType"),
        too_large: t("errors.screenshotTooLarge"),
        unavailable: t("errors.screenshotUnavailable"),
        failed: t("errors.screenshotFailed"),
      }[errors.screenshots.message ?? ""] ??
        t("errors.screenshotUnknown")),
    description:
      errors.description &&
      (errors.description.message === "launch"
        ? t("errors.descriptionLaunch")
        : tooLong(PROJECT_LIMITS.description)),
    tools:
      errors.tools && t("errors.toolsTooMany", { max: PROJECT_LIMITS.tools }),
    duration: errors.duration && t("errors.durationLaunch"),
    hardestPart:
      errors.hardestPart &&
      (errors.hardestPart.message === "launch"
        ? t("errors.hardestPartLaunch")
        : tooLong(PROJECT_LIMITS.hardestPart)),
    prompt: errors.prompt && tooLong(PROJECT_LIMITS.prompt),
    update: errors.update && tooLong(PROJECT_LIMITS.update),
  };
  const described = (field: keyof typeof ids, hint: boolean) =>
    error[field as keyof typeof error] || hint ? noteId(ids[field]) : undefined;
  const invalid = (field: keyof typeof error) =>
    error[field] ? true : undefined;

  const busy = isSubmitting || isSubmitSuccessful;
  const choice = challenges.find((c) => c.slug === values.challengeSlug);
  const firstTools = (values.tools ?? []).slice(0, 2);

  return (
    <div className="flex flex-wrap items-start gap-6 pb-10 md:gap-10 md:pb-[72px]">
      <section className="flex min-w-0 flex-[999_1_520px] flex-col gap-4 rounded-lg border border-line bg-surface p-5 md:p-8">
        <form
          onSubmit={(event) => onSubmit(event).catch(() => {})}
          noValidate
          className="flex flex-col gap-[22px]"
        >
          {draftStatus === "restored" && (
            <p
              role="status"
              className="flex flex-wrap items-center gap-x-3 rounded-lg bg-tint px-4 py-2 text-[15px] leading-[22px]"
            >
              {t("draft.restored")}
              <button
                type="button"
                onClick={discardDraft}
                className="min-h-11 font-semibold text-primary underline"
              >
                {t("draft.discard")}
              </button>
            </p>
          )}

          <Field
            id={ids.challenge}
            label={t("challenge.label")}
            hint={launched && !allowOwn ? t("challenge.locked") : undefined}
            error={error.challengeSlug}
          >
            <Select
              id={ids.challenge}
              aria-invalid={invalid("challengeSlug")}
              aria-describedby={described("challenge", launched && !allowOwn)}
              {...register("challengeSlug")}
            >
              {challenges.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
              {allowOwn && (
                <option value={OWN_PROJECT}>{t("challenge.own")}</option>
              )}
            </Select>
          </Field>

          <Field id={ids.name} label={t("name.label")} error={error.name}>
            <Input
              id={ids.name}
              type="text"
              aria-invalid={invalid("name")}
              aria-describedby={described("name", false)}
              {...register("name")}
            />
          </Field>

          <Field
            id={ids.pitch}
            label={t("pitch.label")}
            hint={t("pitch.hint", {
              count: (values.pitch ?? "").length,
              max: PROJECT_LIMITS.pitch,
            })}
            error={error.pitch}
          >
            <Input
              id={ids.pitch}
              type="text"
              aria-invalid={invalid("pitch")}
              aria-describedby={described("pitch", true)}
              {...register("pitch")}
            />
          </Field>

          <Field
            id={ids.liveUrl}
            label={t("liveUrl.label")}
            hint={checking ? t("liveUrl.checking") : t("liveUrl.hint")}
            error={error.liveUrl}
          >
            <Input
              id={ids.liveUrl}
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              aria-invalid={invalid("liveUrl")}
              aria-describedby={described("liveUrl", true)}
              {...register("liveUrl", {
                onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
                  // After the format check above passes (rule 9).
                  if (
                    projectSchema.shape.liveUrl.safeParse(event.target.value)
                      .success
                  ) {
                    void checkLink(event.target.value);
                  }
                },
              })}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <span id={`${ids.screenshots}-label`} className={groupLabel}>
              {t("screenshots.label")}
            </span>
            <Controller
              control={control}
              name="screenshots"
              render={({ field }) => (
                <ScreenshotPicker
                  uploadVia={uploadVia}
                  value={field.value}
                  onChange={(urls) => {
                    field.onChange(urls);
                    if (
                      errors.screenshots?.message === "launch" &&
                      urls.length >= 2
                    ) {
                      clearErrors("screenshots");
                    }
                  }}
                  onUploadError={(problem: UploadError | null) =>
                    problem
                      ? setError("screenshots", { message: problem })
                      : clearErrors("screenshots")
                  }
                  addRef={field.ref}
                  labelId={`${ids.screenshots}-label`}
                  describedBy={noteId(ids.screenshots)}
                  invalid={!!error.screenshots}
                />
              )}
            />
            <Note
              id={noteId(ids.screenshots)}
              error={error.screenshots}
              hint={t("screenshots.hint")}
            />
          </div>

          <Field
            id={ids.description}
            label={t("description.label")}
            hint={t("description.hint")}
            error={error.description}
          >
            <Textarea
              id={ids.description}
              rows={5}
              aria-invalid={invalid("description")}
              aria-describedby={described("description", true)}
              {...register("description")}
            />
          </Field>

          <div
            role="group"
            aria-labelledby={`${ids.tools}-label`}
            aria-describedby={error.tools ? noteId(ids.tools) : undefined}
            className="flex flex-col gap-2"
          >
            <span id={`${ids.tools}-label`} className={groupLabel}>
              {t("tools.label")}
            </span>
            {/* A block, not a flex item: an empty live region adds no gap. */}
            <div>
              <Controller
                control={control}
                name="tools"
                render={({ field }) => (
                  <ToolChips
                    value={field.value}
                    onChange={(tools) => {
                      field.onChange(tools);
                      if (tools.length <= PROJECT_LIMITS.tools)
                        clearErrors("tools");
                    }}
                    firstRef={field.ref}
                  />
                )}
              />
              <Note id={noteId(ids.tools)} error={error.tools} spaced />
            </div>
          </div>

          <div
            role="group"
            aria-labelledby={`${ids.build}-label`}
            className="flex flex-col gap-[22px] border-t border-line pt-[22px]"
          >
            <div className="flex flex-col gap-1">
              <h2
                id={`${ids.build}-label`}
                className="text-[22px] font-bold leading-[1.12] tracking-[-0.02em]"
              >
                {t("build.title")}
              </h2>
              <p className="text-sm text-muted">{t("build.lead")}</p>
            </div>
            <Field
              id={ids.duration}
              label={t("build.duration.label")}
              error={error.duration}
            >
              <Select
                id={ids.duration}
                aria-invalid={invalid("duration")}
                aria-describedby={described("duration", false)}
                {...register("duration")}
              >
                {!values.duration && (
                  <option value="" disabled>
                    {t("build.duration.choose")}
                  </option>
                )}
                {BUILD_DURATIONS.map((duration) => (
                  <option key={duration} value={duration}>
                    {t(`build.duration.${duration}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id={ids.hardestPart}
              label={t("build.hardestPart.label")}
              error={error.hardestPart}
            >
              <Input
                id={ids.hardestPart}
                type="text"
                aria-invalid={invalid("hardestPart")}
                aria-describedby={described("hardestPart", false)}
                {...register("hardestPart")}
              />
            </Field>
            <Field
              id={ids.prompt}
              label={t("build.prompt.label")}
              optional
              optionalLabel={t("optional")}
              error={error.prompt}
            >
              <Textarea
                id={ids.prompt}
                rows={3}
                aria-invalid={invalid("prompt")}
                aria-describedby={described("prompt", false)}
                {...register("prompt")}
              />
            </Field>
          </div>

          {!launched && (
            <div
              role="group"
              aria-labelledby={`${ids.stage}-label`}
              aria-describedby={noteId(ids.stage)}
              className="flex flex-col gap-2"
            >
              <span id={`${ids.stage}-label`} className={groupLabel}>
                {t("stage.label")}
              </span>
              <Controller
                control={control}
                name="stage"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {(["in_progress", "launched"] as const).map((option, i) => (
                      <FilterChip
                        key={option}
                        ref={i === 0 ? field.ref : undefined}
                        type="button"
                        selected={field.value === option}
                        onClick={() => {
                          field.onChange(option);
                          // What "Lansat" asked for doesn't apply to "În lucru".
                          if (option === "in_progress") {
                            clearErrors([
                              "screenshots",
                              "description",
                              "duration",
                              "hardestPart",
                            ]);
                          }
                        }}
                      >
                        {t(`stage.${option}`)}
                      </FilterChip>
                    ))}
                  </div>
                )}
              />
              <span id={noteId(ids.stage)} className="text-sm text-muted">
                {t("stage.hint")}
              </span>
            </div>
          )}

          {nextVersion !== null && (
            <Field
              id={ids.update}
              label={t("update.label")}
              optional
              optionalLabel={t("optional")}
              hint={t("update.hint", {
                max: PROJECT_LIMITS.update,
                version: nextVersion,
              })}
              error={error.update}
            >
              <Input
                id={ids.update}
                type="text"
                aria-invalid={invalid("update")}
                aria-describedby={described("update", true)}
                {...register("update")}
              />
            </Field>
          )}

          <div className="flex flex-col">
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                type="submit"
                disabled={busy}
                className="w-full md:w-auto"
              >
                {t("submit", {
                  // Saving a launched project isn't launching it again.
                  stage: launched ? "in_progress" : stage,
                })}
              </Button>
              {draftKey && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={saveDraft}
                  className="w-full md:w-auto"
                >
                  {t("draft.save")}
                </Button>
              )}
            </div>
            {/* Always present, so a refusal or the draft is announced (§10). */}
            <div aria-live="polite">
              {refusal ? (
                <p className="mt-2.5 flex items-start gap-1.5 text-sm font-semibold text-warning-ink">
                  <CircleAlert
                    size={18}
                    strokeWidth={2.2}
                    aria-hidden
                    className="shrink-0"
                  />
                  {refusal}
                </p>
              ) : (
                draftStatus === "saved" && (
                  <p className="mt-2.5 text-sm text-muted">
                    {t("draft.saved")}
                  </p>
                )
              )}
            </div>
          </div>
        </form>
      </section>

      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
        <section className="flex flex-col gap-2.5">
          <h2 className="font-sans text-[13px] font-bold uppercase leading-[18px] tracking-[0.06em] text-muted">
            {t("preview.title")}
          </h2>
          <LaunchRowFrame
            compact
            thumbnail={values.screenshots?.[0] ?? null}
            title={
              <span className={cn(!values.name?.trim() && "text-muted")}>
                {values.name?.trim() || t("preview.name")}
              </span>
            }
            pitch={values.pitch}
            tags={firstTools.map((tool) => (
              <Tag key={tool}>{tool}</Tag>
            ))}
            meta={
              <span className="inline-flex items-center gap-1.5 text-[13px] leading-5 text-muted">
                <Avatar person={owner} size={22} />
                {owner.name}
              </span>
            }
            vote={
              <VoteCount
                count={votes}
                reason={stage === "launched" ? "own" : "wip"}
              />
            }
          />
        </section>
        <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
          <h2 className="font-sans text-base font-bold leading-6">
            {t("checklist.title")}
          </h2>
          <ul className="flex flex-col gap-2">
            {[
              t("checklist.link"),
              t("checklist.phone"),
              ...(choice?.launchCheck ? [choice.launchCheck] : []),
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-[15px] leading-[23px]"
              >
                <span className="inline-flex pt-[3px] text-primary">
                  <Check
                    size={18}
                    strokeWidth={2.6}
                    aria-hidden
                    className="flex-none"
                  />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">{t("checklist.note")}</p>
        </section>
      </aside>
    </div>
  );
}
