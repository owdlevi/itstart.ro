"use client";

import { ArrowUp, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleVote } from "@/app/actions/votes";
import { cn } from "@/lib/utils";

type VoteButtonProps = {
  projectId: string;
  count: number;
  voted: boolean;
  /** Signed out: the unvoted state, and a tap goes to sign-in (rule 12). */
  signedIn: boolean;
  wide?: boolean;
};

/**
 * Optimistic toggle (rule 10), reconciled with the server's count. A refusal
 * puts the previous state back and says why, under the button.
 */
export function VoteButton({
  projectId,
  count: initialCount,
  voted: initialVoted,
  signedIn,
  wide,
}: VoteButtonProps) {
  const t = useTranslations("vote");
  const router = useRouter();
  const [state, setState] = useState({
    count: initialCount,
    voted: signedIn && initialVoted,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Back to this exact page after sign-in, query included (a filtered board).
  const signIn = () =>
    router.push(
      `/intra?next=${encodeURIComponent(location.pathname + location.search)}`,
    );

  const onClick = () => {
    if (!signedIn) {
      signIn();
      return;
    }
    const before = state;
    setMessage(null);
    setState({
      voted: !before.voted,
      count: before.count + (before.voted ? -1 : 1),
    });
    startTransition(async () => {
      const result = await toggleVote(projectId);
      if (result.ok) {
        setState({ voted: result.voted, count: result.count });
        return;
      }
      setState(before);
      if (result.reason === "signed_out") {
        signIn();
        return;
      }
      setMessage(
        result.reason === "account_too_new" ||
          result.reason === "rate_limited" ||
          result.reason === "closed"
          ? t(`refused.${result.reason}`)
          : t("refused.other"),
      );
    });
  };

  const { count, voted } = state;
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        aria-pressed={voted}
        aria-label={voted ? t("voted", { count }) : t("vote", { count })}
        onClick={onClick}
        className={cn(
          "flex items-center justify-center rounded-md border font-bold leading-5 tabular-nums",
          wide ? "min-h-12 gap-2 px-5" : "min-h-[60px] w-14 flex-col gap-0.5",
          !voted && "border-border bg-surface text-ink hover:bg-tint",
          voted && !wide && "border-primary bg-primary text-on-primary",
          voted && wide && "border-2 border-primary bg-tint text-ink",
        )}
      >
        {voted && wide ? (
          <Check size={18} strokeWidth={2.6} aria-hidden />
        ) : (
          <ArrowUp size={18} strokeWidth={2.6} aria-hidden />
        )}
        <span aria-hidden>
          {wide ? t(voted ? "wideVoted" : "wideVote", { count }) : count}
        </span>
      </button>
      <span
        role="status"
        className={cn(
          "absolute right-0 top-full z-10 mt-2 w-60 rounded-md border border-line bg-surface p-3 text-sm text-ink shadow-raised",
          !message && "sr-only",
        )}
      >
        {message}
      </span>
    </span>
  );
}

/** A plain count where voting isn't possible: own project, closed, or În lucru. Never a disabled button. */
export function VoteCount({
  count,
  reason,
}: {
  count: number;
  reason: "own" | "closed" | "wip";
}) {
  const t = useTranslations("vote");
  if (reason === "wip") {
    return (
      <div
        role="img"
        aria-label={t("wip")}
        className="flex min-h-[60px] w-14 shrink-0 items-center justify-center rounded-md bg-warning-bg text-center text-xs font-bold leading-[15px] text-warning-ink"
      >
        {t.rich("wipBox", { br: () => <br /> })}
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={t(reason, { count })}
      className="flex min-h-[60px] w-14 shrink-0 flex-col items-center justify-center rounded-md bg-tint tabular-nums"
    >
      <span className="font-bold leading-5">{count}</span>
      <span className="text-[11px] font-semibold leading-[14px] text-muted">
        {t("votes")}
      </span>
    </div>
  );
}
