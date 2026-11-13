# Where do rate-limit counters live?

Type: grilling
Status: resolved

## Question

Better Auth's built-in limiter counts per IP and path only, skips server actions, and defaults to in-memory storage, which doesn't work on Vercel. We need limits for:
- magic-link sends: per e-mail, 30 s resend, an hourly cap;
- vote toggles (today counted from `vote_events` in core);
- reviews;
- M3: the contact form, per sender and per recipient.

Do all limits live in Postgres (Better Auth's `database` storage plus a small `rate_limit` table or event counts in core), or do we add a Redis store such as Upstash? Upstash would count against "at most one extra paid vendor".

Input from "Is Resend acceptable for e-mail?": Resend Pro now uses M1's one extra paid vendor slot. Upstash on a paid plan would exceed it; Upstash's free tier, or Postgres, would not.

## Answer

Decided with the owner on 2026-11-13: **every M1 rate limit is counted in Neon Postgres. No Redis, no Upstash.**

- **Store:** Postgres only. Traffic is small (a few hundred users around a deadline), Neon is already on every request path, and the paid-vendor slot is taken by Resend. If a hot path ever needs Redis, that's a new ticket.
- **Pattern: count domain rows, not a generic counter.** Each limit lives in its core module, reads the injected `clock`, and counts rows that already record the action. The rows double as an audit trail (rule 14: "admins can see vote timelines"). The only generic counter table is Better Auth's own `rateLimit` table, for its per-IP limits.
- **Sign-in links, two layers:**
  - The `/intra` form calls Better Auth's HTTP endpoint (`authClient.signIn.magicLink`), not `auth.api` from a server action, so the built-in per-IP limit applies (default 5 per 60 s), with `rateLimit.storage: "database"`.
  - Inside `sendMagicLink`, a per-address check: **1 send per 30 s** (matches the "Trimite din nou" timer) and **5 per hour**, counted from a new `sign_in_link_sends` table (e-mail, sent_at). Over the limit it throws an `APIError` before calling Resend, and the UI shows a calm "try again in a moment" message.
- **Votes:** unchanged. Core already counts `vote_events` (toggles and retractions; default 30 per 10 min, configurable).
- **Reviews:** **10 per hour per user**, reviews and replies counted together from the `reviews` table. Refused with reason `rate_limited`, the same shape as votes. The numbers live in core config.
- **M3 contact form:** only the pattern is fixed now: count relayed-message rows per sender and per recipient in Postgres. The numbers and spam protection are decided in M3, and nothing is built for it in M1.
