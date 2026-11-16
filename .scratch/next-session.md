# Next session: the owner's answers, the Blob adapter if confirmed, and an M1 end-to-end pass

Paste everything below the line into a fresh session.

---

Everything in M1 that needs no outside account is built: screens 01–10, the admin's challenges, profile editing and the admin's vote timeline. This session has three parts, in this order:

1. **The owner's answers.** Read `docs/NEXT-ACTIONS.md` first. For every item I've ticked or answered since 2026-11-16, apply the answer (copy changes, a call reversed) and record it in `docs/DECISIONS.md`. Don't change any item I haven't answered.
2. **The Blob adapter, only if I've confirmed the store** in NEXT-ACTIONS ("Vercel Blob"): the upload-token route, the browser upload in `ScreenshotPicker` and `AvatarPicker` (both post to `/api/capturi` today; the picture adds `shape=avatar`), sharp → webp after the upload (400px square for a picture), and `owns()` for the store's URL. `BLOB_READ_WRITE_TOKEN` is in `apps/web/.env.local`; don't use it until the item is confirmed.
3. **An M1 end-to-end pass,** to find what the screen-by-screen work missed:
   - one `capture.mjs app --milestone M1` run: every variant either `match` or a difference already listed in DECISIONS (each screen's "Visual check");
   - one real month locally, through the UI only: a new account at `/intra?provocare=frizerie` → `/bun-venit` → screen 08 → a project in progress → launched → screen 10 → two reviews from "Scrie prima părere" → another account voting (after moving its `created_at` back a day; rule 14) → the profile, edited → the admin's timeline showing those votes;
   - a keyboard-only pass over the newest pages (`/u/<handle>/editeaza`, `/admin/voturi` and its timelines): order, the 3px outline, labels.
   Fix each defect in its own commit; record anything that's a judgment call.

Read first: `AGENTS.md` and every doc it points to, `docs/NEXT-ACTIONS.md` above all (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-16

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare` (02, 03) → `screen-04-proiect` (04) → … → `screen-10-lansat` (10) → `admin-challenges` → `profile-edit`, each branched from the one before. Work on a new branch from `profile-edit` (`m1-pass`). What `profile-edit` added:
  - **Core:** `profiles.editable()` and `edit()` (rules in `profiles/rules.ts`, exported as `@repo/core/profile-rules`): name, `givenName` ("Cum să-ți spunem?"), city, bio ≤ 240, ≤ 3 https links, a picture only from storage, tools, reminders as ticked; the handle never changes. `votes.activity()` and `votes.timeline()` (`votes/timeline.ts`, admins only): toggles newest first, "Cont nou" (under 7 days old at the vote) and "Rafală" (5 in 10 minutes), numbers in `TIMELINE`. `AdminResult` moved to `admins.ts`. 174 core tests.
  - **App:** `/u/<handle>/editeaza` (`ProfileForm`, `AvatarPicker`, `saveProfile`, which calls `refresh()` so the header updates), "Am salvat profilul." once on the profile. `/admin/voturi`, `/admin/voturi/proiecte/<slug>`, `/admin/voturi/oameni/<handle>`, "Voturi" in the admin nav.
  - **Seed:** the fixtures' votes now sit between each launch and the reference moment.
  - DECISIONS ("Profile editing", "Admin: vote timeline"), ARCHITECTURE (and a gotcha: `router.push` keeps the shared layout) and NEXT-ACTIONS cover all of it.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms).
- `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`): a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me. On 2026-11-15 and 16 it was `~/code/owd/onepage.ro`'s server, so work ran on 3001 (`BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001`, `--base http://localhost:3001` for `capture.mjs`).
- The admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`). Playwright is a root dev dependency; a `.cjs` script can `require(require.resolve("playwright", { paths: [<repo root>] }))`.
- Format only the files you touch, and check the diff: prettier reflows lines in files that weren't formatted before; keep only your change.

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer: screen 10's copy and calls; the admin's challenge calls; profile editing's calls and copy; the vote timeline's calls; what an admin can do about vote abuse; zero counts on a new challenge; the Blob store; passwords vs magic link later; OAuth on previews; the Neon secret; cleaning up unused screenshots.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: magic link, Google and GitHub in the UI, M2 (recognitions, the challenge's end, the archive, reports), the review agent, every e-mail and the Resend adapter, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
