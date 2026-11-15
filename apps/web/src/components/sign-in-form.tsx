"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { finishSignIn } from "@/app/actions/sign-in";
import { authClient } from "@/lib/auth-client";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signInSchema,
  signUpSchema,
  type SignInInput,
} from "@/lib/schemas/sign-in";
import { Button } from "./button";
import { Field, Input, noteId } from "./field";

type Refusal = "wrong" | "exists" | "tooMany" | "other";

/** Better Auth's answer, as one of the form's messages. */
function refusalOf(error: { status: number; code?: string }): Refusal {
  if (error.status === 429) return "tooMany";
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") return "wrong";
  if (error.code?.startsWith("USER_ALREADY_EXISTS")) return "exists";
  return "other";
}

/**
 * Screen 06's e-mail and password form, in two modes: "Intră" and "Cont nou"
 * (DECISIONS, "Screen 06 copy: password sign-in"). It calls Better Auth's
 * HTTP endpoints through `authClient`, so the per-IP limit applies, then
 * `finishSignIn` sends the visitor on.
 */
export function SignInForm({
  mode,
  switchHref,
  next,
  challengeSlug,
}: {
  mode: "signIn" | "signUp";
  /** The same page in the other mode. */
  switchHref: string;
  next: string | null;
  challengeSlug: string | null;
}) {
  const t = useTranslations("signIn");
  const id = useId();
  const signUp = mode === "signUp";
  const [shown, setShown] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<SignInInput>({
    // Read on every render, so switching modes switches the checks.
    resolver: zodResolver(signUp ? signUpSchema : signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setRefusal(null);
    const { error } = await (
      signUp
        ? // The name comes on /bun-venit (screen 07).
          authClient.signUp.email({ email, password, name: "" })
        : authClient.signIn.email({ email, password })
    ).catch(() => ({ error: { status: 0, code: undefined } }));
    if (error) {
      // Checked in the browser already; these are for a server that disagrees.
      if (error.code === "INVALID_EMAIL") {
        setError("email", { message: "invalid" }, { shouldFocus: true });
      } else if (error.code === "PASSWORD_TOO_SHORT") {
        setError("password", { message: "too_short" }, { shouldFocus: true });
      } else if (error.code === "PASSWORD_TOO_LONG") {
        setError("password", { message: "too_long" }, { shouldFocus: true });
      } else {
        setRefusal(refusalOf(error));
      }
      // Throwing keeps isSubmitSuccessful false, so the button comes back.
      throw new Error("refused");
    }
    // Redirects, unless the session didn't stick.
    await finishSignIn({ next, challengeSlug });
    setRefusal("other");
    throw new Error("not signed in");
  });

  const emailError = {
    empty: t("errors.emailEmpty"),
    invalid: t("errors.emailInvalid"),
  }[errors.email?.message ?? ""];
  const passwordError = {
    empty: t("errors.passwordEmpty"),
    too_short: t("errors.passwordShort", { min: PASSWORD_MIN_LENGTH }),
    too_long: t("errors.passwordLong", { max: PASSWORD_MAX_LENGTH }),
  }[errors.password?.message ?? ""];
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  // Busy from the submit until the next page has loaded.
  const busy = isSubmitting || isSubmitSuccessful;

  return (
    <form
      onSubmit={(event) => onSubmit(event).catch(() => {})}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field
        id={emailId}
        label={t("email.label")}
        hint={t("email.hint")}
        error={emailError}
      >
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          placeholder={t("email.placeholder")}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={noteId(emailId)}
          {...register("email")}
        />
      </Field>

      <Field
        id={passwordId}
        label={t("password.label")}
        hint={
          signUp ? t("password.hint", { min: PASSWORD_MIN_LENGTH }) : undefined
        }
        error={passwordError}
      >
        {/* Looks like one control; the button sits inside its edge, and a long
            (Hungarian) label wraps rather than pushing it wider. */}
        <div className="flex min-h-12 items-center gap-1 rounded-md border border-border bg-surface has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-primary has-[[aria-invalid=true]]:border-warning-ink">
          <input
            id={passwordId}
            type={shown ? "text" : "password"}
            autoComplete={signUp ? "new-password" : "current-password"}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={
              passwordError || signUp ? noteId(passwordId) : undefined
            }
            className="min-h-12 min-w-[50%] flex-1 rounded-md bg-transparent pl-3.5 text-base leading-6 text-ink focus-visible:outline-none"
            {...register("password")}
          />
          <button
            type="button"
            aria-pressed={shown}
            aria-controls={passwordId}
            onClick={() => setShown(!shown)}
            className="mr-0.5 min-h-11 min-w-0 rounded-sm px-3 py-1 text-right text-sm font-semibold text-primary hover:text-primary-hover"
          >
            {shown ? t("password.hide") : t("password.show")}
          </button>
        </div>
      </Field>

      <div className="flex flex-col">
        <Button type="submit" full disabled={busy}>
          {signUp ? t("submit.signUp") : t("submit.signIn")}
        </Button>
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
              {t(`errors.${refusal}`)}
            </p>
          )}
        </div>
      </div>

      <p className="text-sm">
        {t.rich(signUp ? "switch.toSignIn" : "switch.toSignUp", {
          link: (chunks) => (
            <Link
              href={switchHref}
              replace
              scroll={false}
              onClick={() => {
                clearErrors();
                setRefusal(null);
              }}
              className="inline-flex min-h-11 items-center"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}
