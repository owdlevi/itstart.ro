"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { saveProfile } from "@/app/actions/profile";
import {
  INTEREST_TOOLS,
  INTEREST_UNSURE,
  PROFILE_LIMITS,
  profileSchema,
  type ProfileFields,
} from "@/lib/schemas/profile";
import { AvatarPicker, type AvatarUploadError } from "./avatar-picker";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Field, Input, noteId, Textarea } from "./field";
import { FilterChip } from "./filter-chip";

type Tool = ProfileFields["toolsInterest"][number];

/** "Încă nu știu" and the tools exclude each other, as on screen 07. */
function toggle(tools: Tool[], tool: Tool): Tool[] {
  if (tools.includes(tool)) return tools.filter((t) => t !== tool);
  if (tool === INTEREST_UNSURE) return [tool];
  return [...tools.filter((t) => t !== INTEREST_UNSURE), tool];
}

const AVATAR_ERRORS = {
  type: "avatarType",
  too_large: "avatarTooLarge",
  unavailable: "avatarUnavailable",
  failed: "avatarFailed",
  unknown: "avatarUnknown",
} as const;

/**
 * "Editează profilul" (no reference design): screen 07's fields and
 * components, plus what a profile shows (picture, bio, links). The action
 * re-parses it and core checks every rule.
 */
export function ProfileForm({
  person,
  handle,
  defaults,
}: {
  /** For the picture's preview: initials and fill follow the id and name. */
  person: { id: string; avatarFill: string | null };
  handle: string;
  defaults: ProfileFields;
}) {
  const t = useTranslations("profile.form");
  const tOnboarding = useTranslations("onboarding");
  const id = useId();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<
    AvatarUploadError | "unknown" | null
  >(null);
  const [navigating, startNavigation] = useTransition();
  const avatarGroup = useRef<HTMLDivElement>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFields>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const values = useWatch({ control });

  const onSubmit = handleSubmit(async (fields) => {
    setRefusal(null);
    const result = await saveProfile(fields).catch(() => null);
    if (result?.ok) {
      startNavigation(() => router.push(result.href));
      return;
    }
    const focus = { shouldFocus: true };
    switch (result?.reason) {
      case "invalid":
        if (result.field === "links") {
          setError("links.0", { message: "invalid" }, focus);
        } else if (result.field === "toolsInterest") {
          setRefusal(t("errors.tools"));
        } else if (result.field === "avatarUrl") {
          setAvatarError("unknown");
        } else {
          setError(result.field, { message: "invalid" }, focus);
        }
        break;
      case "avatar_unknown":
        setAvatarError("unknown");
        avatarGroup.current?.querySelector("button")?.focus();
        break;
      case "not_onboarded":
        setRefusal(t("errors.notOnboarded"));
        break;
      default:
        setRefusal(t("errors.other"));
    }
  });

  const tooLong = (max: number) => t("errors.tooLong", { max });
  const nameError =
    errors.name &&
    (errors.name.message === "empty"
      ? t("errors.nameEmpty")
      : tooLong(PROFILE_LIMITS.name));
  const givenNameError = errors.givenName && tooLong(PROFILE_LIMITS.givenName);
  const cityError = errors.city && tooLong(PROFILE_LIMITS.city);
  const bioError = errors.bio && tooLong(PROFILE_LIMITS.bio);
  const linkError = (n: number) => {
    const error = errors.links?.[n];
    if (!error) return null;
    return error.message === "too_long"
      ? tooLong(PROFILE_LIMITS.link)
      : t("errors.linkInvalid");
  };

  const ids = {
    avatar: `${id}-avatar`,
    name: `${id}-name`,
    givenName: `${id}-given-name`,
    city: `${id}-city`,
    bio: `${id}-bio`,
    links: `${id}-links`,
    tools: `${id}-tools`,
    reminders: `${id}-reminders`,
  };
  const name = values.name?.trim() || defaults.name;
  const busy = isSubmitting || navigating;

  return (
    <form
      onSubmit={(event) => onSubmit(event).catch(() => {})}
      noValidate
      className="flex flex-col gap-5"
    >
      <div ref={avatarGroup}>
        <AvatarPicker
          id={ids.avatar}
          person={{
            id: person.id,
            name,
            avatarUrl: values.avatarUrl ?? null,
            avatarFill: person.avatarFill,
            isAgent: false,
          }}
          onChange={(url) => setValue("avatarUrl", url, { shouldDirty: true })}
          error={avatarError && t(`errors.${AVATAR_ERRORS[avatarError]}`)}
          onError={setAvatarError}
        />
      </div>

      <Field
        id={ids.name}
        label={t("name.label")}
        hint={t("name.hint", { handle })}
        error={nameError}
      >
        <Input
          id={ids.name}
          type="text"
          autoComplete="name"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={noteId(ids.name)}
          {...register("name")}
        />
      </Field>

      <Field
        id={ids.givenName}
        label={t("givenName.label")}
        hint={t("givenName.hint", {
          name: values.givenName?.trim() || name.split(" ")[0] || "",
        })}
        error={givenNameError}
        optional
        optionalLabel={t("optional")}
      >
        <Input
          id={ids.givenName}
          type="text"
          autoComplete="given-name"
          aria-invalid={givenNameError ? true : undefined}
          aria-describedby={noteId(ids.givenName)}
          {...register("givenName")}
        />
      </Field>

      <Field
        id={ids.city}
        label={t("city.label")}
        error={cityError}
        optional
        optionalLabel={t("optional")}
      >
        <Input
          id={ids.city}
          type="text"
          autoComplete="address-level2"
          aria-invalid={cityError ? true : undefined}
          aria-describedby={cityError ? noteId(ids.city) : undefined}
          {...register("city")}
        />
      </Field>

      <Field
        id={ids.bio}
        label={t("bio.label")}
        hint={t("bio.hint", {
          count: (values.bio ?? "").length,
          max: PROFILE_LIMITS.bio,
        })}
        error={bioError}
        optional
        optionalLabel={t("optional")}
      >
        <Textarea
          id={ids.bio}
          rows={4}
          aria-invalid={bioError ? true : undefined}
          aria-describedby={noteId(ids.bio)}
          {...register("bio")}
        />
      </Field>

      <fieldset
        aria-describedby={noteId(ids.links)}
        className="flex flex-col gap-2"
      >
        <legend className="mb-1.5 text-[15px] font-bold leading-[22px]">
          {t("links.label")}
          <span className="font-normal text-muted"> {t("optional")}</span>
        </legend>
        {defaults.links.map((_, n) => {
          const linkId = `${ids.links}-${n}`;
          const error = linkError(n);
          return (
            <div key={linkId}>
              <label htmlFor={linkId} className="sr-only">
                {t("links.item", { n: n + 1 })}
              </label>
              <Input
                id={linkId}
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? noteId(linkId) : undefined}
                {...register(`links.${n}`)}
              />
              <div aria-live="polite">
                {error && (
                  <span
                    id={noteId(linkId)}
                    className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-warning-ink"
                  >
                    <CircleAlert
                      size={18}
                      strokeWidth={2.2}
                      aria-hidden
                      className="shrink-0"
                    />
                    {error}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <span id={noteId(ids.links)} className="text-sm text-muted">
          {t("links.hint", { max: PROFILE_LIMITS.links })}
        </span>
      </fieldset>

      <div
        role="group"
        aria-labelledby={`${ids.tools}-label`}
        aria-describedby={noteId(ids.tools)}
        className="flex flex-col gap-2"
      >
        <span
          id={`${ids.tools}-label`}
          className="text-[15px] font-bold leading-[22px]"
        >
          {tOnboarding("tools.label")}
        </span>
        <Controller
          control={control}
          name="toolsInterest"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {[...INTEREST_TOOLS, INTEREST_UNSURE].map((tool) => (
                <FilterChip
                  key={tool}
                  type="button"
                  selected={field.value.includes(tool)}
                  onClick={() => field.onChange(toggle(field.value, tool))}
                >
                  {tool === INTEREST_UNSURE
                    ? tOnboarding("tools.unsure")
                    : tool}
                </FilterChip>
              ))}
            </div>
          )}
        />
        <span id={noteId(ids.tools)} className="text-sm text-muted">
          {tOnboarding("tools.hint")}
        </span>
      </div>

      <Checkbox id={ids.reminders} {...register("remindersOptIn")}>
        {tOnboarding("reminders")}
      </Checkbox>

      <div className="flex flex-col">
        <div className="flex flex-col gap-2.5 md:flex-row">
          <Button type="submit" disabled={busy} className="w-full md:w-auto">
            {t("submit")}
          </Button>
          <Button
            href={`/u/${handle}`}
            variant="secondary"
            className="w-full md:w-auto"
          >
            {t("cancel")}
          </Button>
        </div>
        {/* Always present, so a refusal is announced (§10). */}
        <div aria-live="polite">
          {refusal && (
            <p className="mt-2.5 flex items-start gap-1.5 text-sm font-semibold text-warning-ink">
              <CircleAlert
                size={18}
                strokeWidth={2.2}
                aria-hidden
                className="shrink-0"
              />
              {refusal}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
