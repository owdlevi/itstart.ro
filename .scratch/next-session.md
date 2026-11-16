# Next session: the owner's answers, and the Blob adapter if confirmed

Paste everything below the line into a fresh session.

---

Everything in M1 that needs no outside account is built, and an end-to-end pass over it is done (`m1-pass`). What's left in M1 waits on me: answers in `docs/NEXT-ACTIONS.md`, and the accounts (Blob, Neon, Vercel, Resend, OAuth apps). This session has two parts, in this order:

1. **The owner's answers.** Read `docs/NEXT-ACTIONS.md` first. For every item I've ticked or answered since 2026-11-16 (the M1 pass's two items included: a way back to screen 10's assignments, and the new copy), apply the answer (copy changes, a call reversed, the way back built as I chose) and record it in `docs/DECISIONS.md`. Don't change any item I haven't answered.
2. **The Blob adapter, only if I've confirmed the store** in NEXT-ACTIONS ("Vercel Blob"): the upload-token route, the browser upload in `ScreenshotPicker` and `AvatarPicker` (both post to `/api/capturi` today; the picture adds `shape=avatar`), sharp → webp after the upload (400px square for a picture), and `owns()` for the store's URL. `BLOB_READ_WRITE_TOKEN` is in `apps/web/.env.local`; don't use it until the item is confirmed.

If neither part has anything to do, say so and stop: don't start M2 or anything that needs an account.

Read first: `AGENTS.md` and every doc it points to, `docs/NEXT-ACTIONS.md` above all (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-16

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare` (02, 03) → `screen-04-proiect` (04) → … → `screen-10-lansat` (10) → `admin-challenges` → `profile-edit` → `m1-pass`, each branched from the one before. Work on a new branch from `m1-pass`. What `m1-pass` did (DECISIONS, "M1 end-to-end pass"):
  - one `capture.mjs app --milestone M1` run: every variant as its screen's "Visual check" lists; identical again after the fixes;
  - one real month locally on the real clock (sign-up from the challenge, onboarding, a project in progress, launched, both reviews, a second account voting a day old, the profile edited, the admin's timelines);
  - a keyboard pass over `/u/<handle>/editeaza`, `/admin/voturi` and its timelines;
  - fixes, one commit each: "1 vot" (vote strings had no singular), card grids on `auto-fill` (a lone card stretched across the page), "Nicio părere încă." for the owner of a project with no reviews, and the admin nav on `NavLinks` (current section marked);
  - a gotcha in ARCHITECTURE: fixtures mode's frozen clock and Better Auth's real `created_at` don't meet, so try flows with new accounts on the real clock.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms).
- `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`): a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me. On 2026-11-15 and 16 it was `~/code/owd/onepage.ro`'s server, so work ran on 3001 (`BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001`, `--base http://localhost:3001` for `capture.mjs`).
- New accounts: run without `DESIGN_FIXTURES` (ARCHITECTURE, gotchas). A new account becomes admin with `pnpm --filter @repo/db admin:set <e-mail> admin`; in fixtures mode the admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`).
- Playwright is a root dev dependency; a `.cjs` script can `require(require.resolve("playwright", { paths: [<repo root>] }))`.
- Format only the files you touch, and check the diff: prettier reflows lines in files that weren't formatted before; keep only your change.

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer: screen 10's copy and calls; a way back to screen 10's assignments; the M1 pass's new copy; the admin's challenge calls; profile editing's calls and copy; the vote timeline's calls; what an admin can do about vote abuse; zero counts on a new challenge; the Blob store; passwords vs magic link later; OAuth on previews; the Neon secret; cleaning up unused screenshots.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: magic link, Google and GitHub in the UI, M2 (recognitions, the challenge's end, the archive, reports), the review agent, every e-mail and the Resend adapter, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
