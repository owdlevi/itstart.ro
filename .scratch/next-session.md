# Next session: screen 10 (Lansat)

Paste everything below the line into a fresh session.

---

Build screen 10 (Lansat: `/proiecte/<slug>/lansat`), with review assignments on launch (rule 16). Build no screen past it until it's done per HANDOVER §14.

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps, Resend or Blob yet: build and test locally only). The parts that matter most: HANDOVER §3 (what's hidden on 10 in M1: the share image is M2, "Vrei să te poată contacta cineva?" is M3, the copy-link field stays), §4 (ReviewAssignment), §5 rules 5, 11, 15–17, §6 screen 10 (and 04, where "Scrie prima părere" goes), §9.4 (screen 10 shows Tuns la Fix at its launch: 0 votes, 0 reviews), §7–§10 and §14; `docs/ARCHITECTURE.md` (core modules, `reviews`, the gotchas); DECISIONS "Screen 04 data" (`review_assignments`, `reviews.post()` fulfils one), "Screen 04 build" (the review form, `#pareri`, "Am copiat linkul."), "Screen 09 data" and "Screen 09 build" (how a launch lands here: `saveProject` returns `/proiecte/<slug>/lansat` when `launched`); `docs/design/components/*.md` (LaunchRow, StatusChip, VoteButton/VoteCount, Button); `screens.json` and the `Lansat*` references; `fixtures.json → screenStates["10"]` and `reviewAssignments`. Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-15

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare` (02, 03) → `screen-04-proiect` (04) → `screen-05-profil` (05) → `screen-06-intra` (06) → `screen-07-bun-venit` (07) → `screen-08-inscris` (08) → `screen-09-lanseaza` (09), each branched from the one before. Work on a new branch from `screen-09-lanseaza` (`screen-10-lansat`). What 09 added:
  - **Core:** `projects.create()`, `edit()` and `editable()` (rules 4, 6–9; refusals in `SaveRefusal`; 124 core tests, 10 in web). `projects.is_late` (migration `0007_screen_09`) and `challenges.launch_check`. The database-free rules are `@repo/core/project-rules`. Seams: `linkChecker` (`createCannedLinkChecker` in tests) and `storage` (`owns()`, `createPrefixStorage` in tests), both failing closed. A project saved for the running challenge joins it.
  - **App:** `/lanseaza` and `/proiecte/<slug>/editeaza` (`ProjectForm`, `ScreenshotPicker`, `ToolChips`, `LaunchRowFrame`), `saveProject` (returns `{ ok: true, href }`; the form navigates) and `checkLiveUrl`. The local storage adapter (`POST /api/capturi`, files in `apps/web/.data/capturi`, served by `/dev/captura/<name>`), the real link checker (private addresses refused). The owner's "Editează proiectul" and "Am salvat proiectul." (`?salvat=1`) on the project page.
  - **A launch today redirects to `/proiecte/<slug>/lansat`, which is a 404** until this screen exists.
  - DECISIONS ("Screen 09 data/build"), ARCHITECTURE and NEXT-ACTIONS cover all of it.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms; projects, uploads, joins and updates leave rows behind).
- `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`, and pages hydrate. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`): a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me. On 2026-11-15 it was another project's server (`~/code/owd/onepage.ro`), so 09 ran on 3001 (ARCHITECTURE gotcha: `BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001`, and `--base http://localhost:3001` for `capture.mjs`).
- `node docs/tools/capture.mjs app --base http://localhost:3000 --only 10` (output in `docs/review/`). Compare element positions in the reference HTML and the app with Playwright (`getBoundingClientRect` of the same selectors in both), and diff aligned regions with pixelmatch using capture.mjs's options (`threshold: 0.1, includeAA: false`). Anything under ~0.6% is antialiasing. Scripts outside the repo must import Playwright, pngjs and pixelmatch by absolute path from the repo's `node_modules`.
- Better Auth's rate limiter is off in `pnpm dev` (ARCHITECTURE gotcha). A password account: `/intra?cont=nou`, then `/bun-venit`.
- To launch for real locally: sign in as someone onboarded, `/lanseaza`, upload two images, fill the build story, pick "Lansat". `.example` live links open in fixtures mode; anything else is fetched for real.

## Screen 10

- **Core, rule 16:** when a project becomes "Lansat" (in `projects.create()` and `edit()`, inside the same transaction), its builder gets **two** ReviewAssignments: launched projects in the same challenge with the fewest human reviews, not their own, not agents', not already reviewed by them, and not already assigned to them. Decide and record: ties (oldest launch first?), fewer than two candidates, a project of its own (no challenge: none?), a late launch, and a relaunch never happening (rule 6). One test per rule. `reviews.post()` already sets `doneAt`.
- **A read for the page** (`projects.launched(slug, viewerId)` or similar): the project as a LaunchRow with a plain count (rule 11, "0 voturi · proiectul tău"), the builder's open and done assignments ("0 din 2", success "2 din 2" when both are done), each assigned project as a LaunchRow. Owner only: decide what anyone else sees (the project page?), and what a project in progress or a project with no assignments shows.
- **The page** (HANDOVER §6 10): container 680px, chip "Lansat", H1 "E lansat. Bravo, {name}!" (how to address them: `givenName`, as on 08's banner), the line, the LaunchRow, "Mai ai un pas: dă două păreri" with the warning chip, the explanation, the two rows, primary "Scrie prima părere" (→ the first open assignment's `#pareri`) and secondary "Vezi proiectul tău", "Arată-l oamenilor" with only the copy-link field in M1 (M2 share image hidden; reuse screen 04's "Am copiat linkul."), the M3 contact section hidden, the closing line. Status for screen readers: the launch is a status message (§10).
- **The capture:** `screens.json` opens `/proiecte/tuns-la-fix/lansat` as `ioana-muresan`; the fixtures hold Tuns la Fix's later state (128 votes, 3 reviews). §9.4 suggests rendering it with the counts as of `launchedAt` in fixtures mode; decide and record, or list it as the expected difference. The seed already loads Ioana's two open assignments (scaunul-3, la-fix).
- Then the rest of §14: manual pass at 390/768/1024/1280 in both themes with the Hungarian sample; keyboard order; signed out, someone else, a project in progress, a project of its own, all assignments done.

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer:
- the "Cele mai votate săptămâna asta" heading (§13.1);
- the vote refusal copy, and the new copy from screens 02–09;
- screen 09's calls: the draft in the browser only, joining on save, the locked challenge, the fixed slug, the placeholder limits; and the owner's "Editează proiectul" button on 04;
- the password sign-in copy (screen 06) and "Durează un minut." under the join button;
- the show-password button's `aria-pressed` with a changing label;
- what happens to someone who skips onboarding (empty name on reviews);
- "Ești înscris/ă", or a stored grammatical gender (§13.3);
- the board's fixed tag chips;
- the November challenge's title ("de cartier");
- the review rules: only owners reply, owners don't review their own project, 2000 characters;
- the Blob store, and cleaning up unused screenshots.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: magic link, Google and GitHub in the UI (they wait for Resend and the OAuth apps), profile editing (`/u/<handle>/editeaza`), the share image (M2) and contact consent (M3) on screen 10, the review agent and its job on launch, reminder and review-assignment e-mails and the Resend adapter, the real Blob adapter, and anything that needs Vercel, Neon, OAuth apps, Resend or Blob. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
