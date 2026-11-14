# Next session: screen 09 (Lansează un proiect)

Paste everything below the line into a fresh session.

---

Build screen 09 (Lansează un proiect: `/lanseaza`, and `/proiecte/<slug>/editeaza` for editing). Build no screen past it until it's done per HANDOVER §14.

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). The parts that matter most: HANDOVER §3, §4 (Project, ProjectUpdate), §5 rules 4–9, §6 screen 09 (and 10, where a launch goes next), §7–§10 and §14; `docs/ARCHITECTURE.md` (core modules and seams, especially `storage` and `linkChecker`; "Uploads"; "Forms"; the gotchas); DECISIONS "Screen 01 data" (screenshots as a `text[]`, tools on cards), "Screen 02 build" (tags capped at their row; cap a custom tool's length), "Screen 04 data" (the build story columns, `buildDuration`), "Screen 06 build" (Field), "Screen 07 build" (FilterChips in a `role="group"`, Checkbox) and "Screen 08 build" (how the challenge page links here); `docs/design/components/*.md` (Field, FilterChip, LaunchRow, Tag); `screens.json` and the `Lanseaza*` references; `fixtures.json → screenStates["09"]`. Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-14

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare` (02, 03) → `screen-04-proiect` (04) → `screen-05-profil` (05) → `screen-06-intra` (06) → `screen-07-bun-venit` (07) → `screen-08-inscris` (08), each branched from the one before. Work on a new branch from `screen-08-inscris` (`screen-09-lanseaza`). What 08 added:
  - **Core:** `challenges.join()`, `leave()`, `participation()` and `steps()` (rule 2; refusals `ended`, `not_onboarded`, `not_joined`, `not_found`; 102 core tests). `participants()` keeps the viewer in join order.
  - **Joining:** the page's join button (a server action for someone onboarded; `/bun-venit?provocare=` for someone who isn't; `/intra?provocare=` signed out), and on sign-in in `finishSignIn` / `completeOnboarding`. A join lands on `/provocari/<slug>?inscris=1`; `FlashBanner` shows "Ești în provocare, …" once and drops the flag.
  - **The participant's page:** chip "Ești înscris/ă", "Pașii tăi" from real data, primary "Adaugă proiectul" → `/lanseaza` (a 404 until this screen), "Renunță la provocare" with shadcn's `alert-dialog` on Base UI (`components/ui/alert-dialog.tsx`).
  - **Seed:** Bianca joins `frizerie` a minute before the frozen clock, on top of the extras, so every screen reads 87 (decided by me); she also has a vote on Tuns la Fix.
  - DECISIONS ("Screen 08 data/build"), ARCHITECTURE and NEXT-ACTIONS cover all of it.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms; sign-ups and joins leave rows behind).
- `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`, and pages hydrate. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`); a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me.
- `node docs/tools/capture.mjs app --base http://localhost:3000 --only 09` (output in `docs/review/`). Compare element positions in the reference HTML and the app with Playwright (`getBoundingClientRect` of the same selectors in both), and diff aligned regions with pixelmatch using capture.mjs's options (`threshold: 0.1, includeAA: false`). Anything under ~0.6% is antialiasing. Scripts outside the repo must import Playwright, pngjs and pixelmatch by absolute path from the repo's `node_modules`.
- Better Auth's rate limiter is off in `pnpm dev` (ARCHITECTURE gotcha). A password account: `/intra?cont=nou`, then `/bun-venit`.

## Screen 09

- **Core, in `projects`:** create and edit (owner only), saving "În lucru" with only a name, pitch and live link, and "Lansat" only with everything in the launch criteria: 2+ screenshots, description, build story (rule 4). `launchedAt` set once, no way back to "În lucru" in M1 (rule 6). A launch after the challenge's deadline is allowed and flagged late (rule 7; `isLate` may need a column). Editing a launched project is always allowed, with an optional one-line update (≤ 140) that becomes the next version (rule 8). The live link must be https and answer one short server-side request (rule 9), through the `linkChecker` seam (real: `fetch` with a short timeout; fake: canned answers in tests). Limits from §4: name ≤ 60, pitch ≤ 80; slug unique, from the name. Refusals as values; one test per rule.
- **Screenshots (2–4, png/jpg/webp ≤ 5 MB, resized server-side, first is the thumbnail, drag to reorder):** the decided path is browser → Vercel Blob through the token route, then sharp → webp. There's no Blob token yet, so decide and record a local `storage` adapter (e.g. files on disk served by a dev-only route, like `/dev/captura`) behind the same seam, and keep the Blob adapter for when the owner sets it up (NEXT-ACTIONS).
- **The form** (HANDOVER §6 09): Field, FilterChips ("+ Alta" opens a small text input; cap its length), the "Cum l-ai construit" fields (`buildDuration`'s three options), the stage chips, "Lansează proiectul" / "Salvează" (by stage) and "Salvează ciorna". Decide what "Salvează ciorna" means next to "În lucru" (§4 has no draft stage) and record it. Validation inline, on blur and on submit; the first invalid field gets the focus; errors replace hints; react-hook-form + zod, the schema shared with the server action. "Pentru ce provocare?" lists the running challenge and "Fără provocare · proiect propriu"; decide whether choosing a challenge you haven't joined joins it.
- **Sidebar:** the live LaunchRow preview ("AȘA VA APĂREA PE PANOU", no vote control) and "Înainte să lansezi".
- **After saving:** a launch goes to `/proiecte/<slug>/lansat` (screen 10, not built yet); "În lucru" to the project page. `/proiecte/<slug>/editeaza` reuses the form, prefilled, owner only.
- **The capture:** `screens.json` opens `/lanseaza` as `ioana-muresan`, and the reference shows the form filled with Tuns la Fix's data. Fixtures mode may prefill from `screenStates` (§9.1); decide how and record it. In the product the form starts empty.
- Then the rest of §14: manual pass at 390/768/1024/1280 in both themes with the Hungarian sample; keyboard order (chips, the screenshot tiles and their reorder, "+ Alta"); errors announced; signed out (→ `/intra?next=/lanseaza`), not onboarded, editing someone else's project (refused), a project in progress, a late launch.

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer:
- the "Cele mai votate săptămâna asta" heading (§13.1);
- the vote refusal copy, and the new copy from screens 02–08;
- the password sign-in copy (screen 06) and "Durează un minut." under the join button;
- the show-password button's `aria-pressed` with a changing label;
- what happens to someone who skips onboarding (empty name on reviews);
- "Ești înscris/ă", or a stored grammatical gender (§13.3);
- the board's fixed tag chips;
- the November challenge's title ("de cartier");
- the review rules: only owners reply, owners don't review their own project, 2000 characters.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: magic link, Google and GitHub in the UI (they wait for Resend and the OAuth apps), profile editing (`/u/<handle>/editeaza`), screen 10 (`/proiecte/<slug>/lansat`) and assignment picking on launch (rule 16), the review agent and its job on launch, reminder e-mails and the Resend adapter, the real Blob adapter, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
