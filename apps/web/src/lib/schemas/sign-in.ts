import { z } from "zod";

/** Better Auth's password limits (DECISIONS, "Email and password for now"). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const email = z
  .string()
  .trim()
  .min(1, { error: "empty" })
  .pipe(z.email({ error: "invalid" }));

/**
 * "Intră": only "is there a password". Its length is checked against the
 * stored one, and a wrong one gets the same answer as a wrong address.
 */
export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "empty" }),
});

/** "Cont nou": Better Auth's limits, checked in the browser first. */
export const signUpSchema = z.object({
  email,
  password: z
    .string()
    .min(1, { error: "empty" })
    .min(PASSWORD_MIN_LENGTH, { error: "too_short" })
    .max(PASSWORD_MAX_LENGTH, { error: "too_long" }),
});

export type SignInInput = z.infer<typeof signInSchema>;

/** After sign-in: where to go, parsed again in the action. */
export const finishSignInSchema = z.object({
  next: z.string().max(2000).nullable(),
  challengeSlug: z.string().max(200).nullable(),
});
