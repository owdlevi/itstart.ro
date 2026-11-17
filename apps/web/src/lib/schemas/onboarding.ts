import {
  INTEREST_TOOLS,
  INTEREST_UNSURE,
  PROFILE_LIMITS,
} from "@repo/core/profile-rules";
import { z } from "zod";

/** Core's limits and choices, checked early in the browser. */
export const NAME_MAX_LENGTH = PROFILE_LIMITS.name;
export const CITY_MAX_LENGTH = PROFILE_LIMITS.city;
export { INTEREST_TOOLS, INTEREST_UNSURE };

/** /bun-venit's fields (screen 07). Parsed in the form and again in the action. */
export const onboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "empty" })
    .max(NAME_MAX_LENGTH, { error: "too_long" }),
  city: z.string().trim().max(CITY_MAX_LENGTH, { error: "too_long" }),
  toolsInterest: z.array(z.enum([...INTEREST_TOOLS, INTEREST_UNSURE])),
  remindersOptIn: z.boolean(),
});

export type OnboardingFields = z.infer<typeof onboardingSchema>;

/** The action's input: the fields, and where to go after (DECISIONS, "Screen 06 build"). */
export const completeOnboardingSchema = z.object({
  fields: onboardingSchema,
  next: z.string().max(2000).nullable(),
  challengeSlug: z.string().max(200).nullable(),
});
