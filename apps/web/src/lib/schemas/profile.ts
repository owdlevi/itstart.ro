import type { ProfileInput } from "@repo/core";
import {
  INTEREST_TOOLS,
  INTEREST_UNSURE,
  isHttpsUrl,
  PROFILE_LIMITS,
} from "@repo/core/profile-rules";
import { z } from "zod";

export { INTEREST_TOOLS, INTEREST_UNSURE, PROFILE_LIMITS };

/** The query flag that shows "Am salvat profilul." once on the profile. */
export const PROFILE_SAVED_PARAM = "salvat";

const L = PROFILE_LIMITS;
const text = (max: number) => z.string().trim().max(max, { error: "too_long" });

/**
 * "Editează profilul" (/u/<handle>/editeaza), parsed in the browser and again
 * in the action; core checks every rule once more. Errors are codes, mapped
 * to copy by the form.
 */
export const profileSchema = z.object({
  name: text(L.name).min(1, { error: "empty" }),
  givenName: text(L.givenName),
  city: text(L.city),
  bio: text(L.bio),
  /** One field per link; empty ones are dropped on save. */
  links: z
    .array(
      z
        .string()
        .trim()
        .max(L.link, { error: "too_long" })
        .refine((value) => !value || isHttpsUrl(value), { error: "invalid" }),
    )
    .max(L.links),
  avatarUrl: z.string().max(2000).nullable(),
  toolsInterest: z.array(z.enum([...INTEREST_TOOLS, INTEREST_UNSURE])),
  remindersOptIn: z.boolean(),
});

export type ProfileFields = z.infer<typeof profileSchema>;

/** The form's values: always three link fields. */
export const toProfileFields = (input: ProfileInput): ProfileFields => ({
  name: input.name,
  givenName: input.givenName ?? "",
  city: input.city ?? "",
  bio: input.bio ?? "",
  links: Array.from({ length: L.links }, (_, i) => input.links[i] ?? ""),
  avatarUrl: input.avatarUrl,
  toolsInterest: profileSchema.shape.toolsInterest
    .catch([])
    .parse(input.toolsInterest),
  remindersOptIn: input.remindersOptIn,
});

export const toProfileInput = (fields: ProfileFields): ProfileInput => ({
  ...fields,
  givenName: fields.givenName || null,
  city: fields.city || null,
  bio: fields.bio || null,
  links: fields.links.filter(Boolean),
});
