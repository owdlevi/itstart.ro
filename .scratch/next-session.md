# Next session: screen 07 (Înscriere: profil)

Paste everything below the line into a fresh session.

---

Build screen 07 (Înscriere: profil, `/bun-venit`, a first sign-in). Build no screen past it until it's done per HANDOVER §14.

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). The parts that matter most: HANDOVER §3, §4 (User), §5 rule 22, §6 screens 06, 07 and 08 (where 07 goes next), §7–§10, §13 (item 3, gendered Romanian) and §14; `docs/ARCHITECTURE.md` (core modules, forms, the gotchas); DECISIONS "M1 foundation" (users table, `handle` null until onboarding, `onboardedAt`), "Screen 02 data" (`givenName`), "Screen 05 build" ("Editează profilul" → `/u/<handle>/editeaza`, which 07's form will serve), and "Screen 06 build" (what `/bun-venit` receives); `docs/design/components/*.md` (Field, FilterChip, Checkbox, Button); `screens.json` and the `Bun-venit*` references; `fixtures.json → screenStates["07"]`. Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-14

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare` (02, 03) → `screen-04-proiect` (04) → `screen-05-profil` (05) → `screen-06-intra` (06), each branched from the one before. Work on a new branch from `screen-06-intra` (`screen-07-bun-venit`). What 06 added:
  - **Data:** `challenges.buildingPhrase` ("pagina frizeriei"), migration `0006_screen_06`, seeded.
  - **Screen 06 (done per §14):** `/intra` in the `(onboarding)` route group (`BareHeader`, footer). E-mail and password in two modes (`?cont=nou|intra`), `components/field.tsx` (Field, Input, `noteId`), `components/sign-in-form.tsx`. After Better Auth signs someone in, the server action `finishSignIn` redirects through `lib/sign-in-destination.ts`: a first sign-in (no handle) goes to **`/bun-venit?provocare=<slug>&next=<path>`** (either may be missing); anyone else to `next`, else `/provocari/<slug>`, else Home. `safeNext()` keeps `next` on this site. `/intra` redirects signed-in visitors the same way.
  - **Tests:** 80 core tests, and vitest in `apps/web` (7 tests for the destination rules).
  - DECISIONS, ARCHITECTURE and NEXT-ACTIONS cover all of it.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms; sign-ups leave users behind).
- `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`, and pages hydrate. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`); a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me.
- A fresh account: sign up on `/intra?cont=nou` (any address, 8+ characters); it lands on `/bun-venit`. The reference's user is `bianca-radu` (not onboarded in the seed): `/dev/login-as/bianca-radu?next=/bun-venit`.
- `node docs/tools/capture.mjs app --base http://localhost:3000 --only 07` (output in `docs/review/`). Compare element positions in the reference HTML and the app with Playwright (`getBoundingClientRect` of the same selectors in both), and diff aligned regions with pixelmatch using capture.mjs's options (`threshold: 0.1, includeAA: false`). Anything under ~0.6% is antialiasing. Scripts outside the repo must import Playwright, pngjs and pixelmatch by absolute path from the repo's `node_modules`. The reference's panels may size their content box (screen 06's did: `max-width` without `box-sizing`), so check widths.
- Better Auth's rate limiter is off in `pnpm dev` (ARCHITECTURE gotcha).

## Screen 07

- **Core, in `profiles`:** onboarding. Set the name, city (optional), `toolsInterest`, `remindersOptIn` (unticked by default, rule 22: never pre-tick) and `onboardedAt`, and generate a unique, URL-safe `handle` from the name (diacritics folded, collisions numbered). Validation and refusals as values; one test per rule. The same module will serve editing (`/u/<handle>/editeaza`, screen 05's button): decide what this screen builds of it and record it.
- **Page:** `/bun-venit` in `(onboarding)`, using Field, FilterChip (multi-select, `aria-pressed`, in a `fieldset`/`legend` or `role="group"`) and Checkbox. Signed out → `/intra?next=/bun-venit`; already onboarded → on to where they were going. Fixtures mode may prefill Bianca's form from `screenStates["07"]` so the capture compares cleanly; the product starts empty (name prefilled from the provider only, and password users have none).
- **After "Gata, intru în provocare":** carry `provocare` and `next` on with `signInDestination`'s rules. Joining is screen 08's: decide and record what the button does now (e.g. go to `/provocari/<slug>`), and what its label says when there's no `provocare` (from the header).
- **Decide and record:** whether the shell sends signed-in users without a handle back to `/bun-venit` (DECISIONS, "Screen 06 build": until then their name is empty, and the header's avatar label reads "Profilul tău, "); whether to ask for `givenName` (DECISIONS, "Screen 02 data") or a grammatical gender (§13.3, needed by screen 08's "Ești înscris/ă").
- Then the rest of §14: manual pass at 390/768/1024/1280 in both themes with the Hungarian sample; keyboard order; errors announced; every state (signed out, onboarded already, empty, errors).

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer:
- the "Cele mai votate săptămâna asta" heading (§13.1);
- the vote refusal copy, and the new copy from screens 02–06;
- the password sign-in copy (screen 06) and "Durează un minut." under the join button;
- the show-password button's `aria-pressed` with a changing label;
- the board's fixed tag chips;
- the November challenge's title ("de cartier");
- the review rules: only owners reply, owners don't review their own project, 2000 characters.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: magic link, Google and GitHub in the UI (they wait for Resend and the OAuth apps), screen 08's joining and its banner, screen 09's create/edit form, assignment picking on launch (screen 10), avatar uploads, the Resend adapter and reminder e-mails, the review agent, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
