# Next session: profile editing, and the admin's vote timeline

Paste everything below the line into a fresh session.

---

Every M1 screen (01–10) and the admin's challenges are built. Two M1 pieces are left that need no outside account:

1. **Profile editing**, `/u/<handle>/editeaza` (HANDOVER §3 M1 "profile", §4 User, §6 05 "Editează profilul"). The button on your own profile links there and it's still a 404. No reference design.
2. **The admin's vote timeline** (rule 14: "admins can see vote timelines"), in the `admin/` route group. `vote_events` already records every toggle (DECISIONS "Vote anti-abuse defaults").

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). The parts that matter most: HANDOVER §4 (User: bio ≤ 240, links ≤ 3, avatar), §5 rules 14, 19, 22 and 23, §6 05, §10 and §14; `docs/ARCHITECTURE.md` (`profiles` and `votes` in core, "Admin checks", the gotchas); DECISIONS "Admins", "Screen 05 build" ("Editează profilul"), "Screen 07 data/build" (handles, `onboard()`, tools, the skipped-onboarding gap), "Owner accepted screens 01–09" and "Admin: challenges". Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-15

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare` (02, 03) → `screen-04-proiect` (04) → … → `screen-10-lansat` (10) → `admin-challenges`, each branched from the one before. Work on a new branch from `admin-challenges` (`profile-edit`). What `admin-challenges` added:
  - **Core:** `challenges.all()`, `editable()`, `create()` and `edit()` (`challenges/admin.ts`, rules in `challenges/rules.ts`, exported as `@repo/core/challenge-rules`). The admin picks a month and `monthBounds()` gives the start and deadline (rule 1). One challenge a month, numbers follow months, nothing that has ended, and the month and slug are fixed once it starts. `core.admins.isAdmin()` reads the role from the database. 154 core tests.
  - **App:** `/admin/provocari`, `/noua`, `/<slug>` (`ChallengeForm`, `saveChallenge`). `requireAdmin(path)` (`server/admin.ts`) at the top of every admin page: signed out → sign-in, a member → 404. The layout checks nothing, per Next's guide. `FlashBanner` now drops its flag on every render.
  - DECISIONS ("Admin: challenges"), ARCHITECTURE and NEXT-ACTIONS cover all of it.
- Open for me in NEXT-ACTIONS: screen 10's copy and calls, the admin's challenge calls, and zero counts on a new challenge.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms).
- `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`): a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me. On 2026-11-15 it was `~/code/owd/onepage.ro`'s server, so work ran on 3001 (`BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001`, `--base http://localhost:3001` for `capture.mjs`).
- The admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`). Playwright is a root dev dependency; a `.cjs` script can `require(require.resolve("playwright", { paths: [<repo root>] }))`.
- Format only the files you touch, and check the diff: prettier reflows lines in files that weren't formatted before (`flash-banner.tsx` was); keep only your change.

## Profile editing

- **Core** (`profiles`): `edit(userId, input)` and the form's read. Decide and record, one test per rule: which fields (name, `givenName`?, city, bio ≤ 240, links ≤ 3 https, tools, reminders as ticked, rule 22), whether the handle changes with the name (profile links are shared, like a challenge's slug), and the avatar (needs storage: local adapter only until Blob).
- **App:** `/u/<handle>/editeaza`, the owner only (others → the profile, signed out → sign-in), one form (react-hook-form + zod shared with the action), screen 07's components. Copy under `profile` in `ro.json`.
- DECISIONS "Screen 07 build" left a gap: someone who skips onboarding can still review with an empty name. The owner accepted it; don't change it.

## Vote timeline (rule 14)

- **Core** (`votes`): an admin-only read over `vote_events` (a project's or a user's toggles, newest first), refusing `not_admin` like `challenges.all()`.
- **App:** a page under `/admin`, linked from the admin nav. Decide what an admin needs to spot abuse (bursts, new accounts) and record it.

## Also waiting, if I confirm the Blob store

`BLOB_READ_WRITE_TOKEN` is in `apps/web/.env.local` (store `onepage-media`). If I confirm in NEXT-ACTIONS that it's ITStart's own public `fra1` store, the Blob adapter can come next: the upload-token route, the browser upload in `ScreenshotPicker`, sharp → webp, and `owns()` for the store's URL. Don't use the token until then.

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer: screen 10's copy and calls; the admin's challenge calls; zero counts on a new challenge; the Blob store; passwords vs magic link later; OAuth on previews; the Neon secret; cleaning up unused screenshots.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: magic link, Google and GitHub in the UI, recognitions (M2), the review agent, every e-mail and the Resend adapter, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
