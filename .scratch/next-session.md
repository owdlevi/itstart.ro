# Next session: screen 05 (Profil)

Paste everything below the line into a fresh session.

---

Build screen 05 (Profil, `/u/[handle]`, signed in as andrei-popescu, viewing ioana-muresan). Build no screen past it until it's done per HANDOVER §14.

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). Sign-in is email and password for now (DECISIONS, "Email and password for now"). The parts that matter most: HANDOVER §3 (hidden until M3 on 05: the "Deschisă la colaborări" chip and "Scrie-i Ioanei"), §5 rules 11, 17, 19 and 22, §6 screen 05, §7–§10, §13 and §14; `docs/ARCHITECTURE.md` (where code goes; read the gotchas, two are new: Drizzle's unqualified columns in one-table selects, and preflight's 1.5 line-height ratio); DECISIONS "Fixture counts" and the "Screen 01/02/03/04 data" and "build" sections; `docs/design/components/*.md` (ProjectCard with the challenge footer, Avatar 96/72, StatusChip "Terminată", Button); `docs/design/fixtures.json` (`screenStates["05"]`: 3 launched, 3 months in a row, 241 votes = 128 + 74 + 39; ioana's bio, city, links, joinedAt) and `screens.json`. Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-14

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare`, branched from it: screens 02 and 03.
- `screen-04-proiect`, branched from `screen-02-provocare`: screen 04. Work on a new branch from it (`screen-05-profil`). What it added:
  - **Data:** migration `0005_screen_04` (project `description` and build story columns, `review_assignments`); core `projects.bySlug()` and a new `reviews` module, `thread()` and `post()` (rules 15–18, 10 per hour, fulfils an assignment); 65 core tests. The seed loads descriptions, build stories, assignments, and placeholder screenshots served by `/dev/captura` in fixtures mode.
  - **Screen 04 (done per §14):** `/proiecte/[slug]` with the wide vote (and a wide VoteCount), "Distribuie", the screenshot viewer, the review form (react-hook-form + zod, schema in `lib/schemas/review.ts`, action in `actions/reviews.ts`), the owner's replies. "Lansări" is the current nav link on project pages. Button takes `external`. AgentBadge is capped at its row.
  - DECISIONS, ARCHITECTURE and NEXT-ACTIONS cover all of it.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms; tests leave reviews and votes behind).
- **Port 3000 is free now** (the old SSH tunnel is gone), so `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000` and pages hydrate: interaction can be tested on `pnpm dev`. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`); a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me.
- `node docs/tools/capture.mjs app --base http://localhost:3000 --only 05` (output in `docs/review/`). Hidden sections shift everything below them, so whole-page percentages say little. Compare element positions in the reference HTML and the app with Playwright (`getBoundingClientRect` of the same selectors in both, reporting only the differences), and diff aligned regions (screenshots left out) with pixelmatch using capture.mjs's options (`threshold: 0.1, includeAA: false`). Anything under ~0.6% is antialiasing. Scripts outside the repo must import Playwright, pngjs and pixelmatch by absolute path from the repo's `node_modules`.
- Expected differences to list in DECISIONS: thumbnails (§9.4); the hidden M3 chip and "Scrie-i Ioanei"; the November challenge's title ("…de cartier", NEXT-ACTIONS) if 05 shows it.

## Screen 05

- Core: a profile by handle (name, city, joined month, bio, links, agent flag), its stats: **launched projects**, **consecutive months with a launch ending this or last month** ("3 luni la rând", HANDOVER §6 05), **votes received** (across all their projects, through `withExtra`, so 241 holds); the launched projects as ProjectCards with the challenge (and a recognition, M2, none yet) in the footer instead of the builder; "Provocări terminate": challenges that have ended and that they took part in, with their project there and the "Terminată" chip.
- Your own profile adds "Editează profilul" (secondary, where "Scrie-i" sits for others). Editing is screen 07's form; until then decide (and record) whether the button links there.
- Agents' profiles: square avatar and AgentBadge (rule 19). People's e-mail is never shown (rule 23).
- Then the rest of §14: manual pass at 390/768/1024/1280 in both themes with the Hungarian sample; keyboard order; signed out, own profile (andrei), an agent's profile, a profile with no launches, an unknown handle.

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer:
- the "Cele mai votate săptămâna asta" heading (§13.1);
- the vote refusal copy, and the new copy from screens 02, 03 and 04;
- "Un minut. Fără parolă." under the join button;
- the board's fixed tag chips;
- the November challenge's title ("de cartier");
- the review rules: only owners reply, owners don't review their own project, 2000 characters.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: screen 06 (`/intra`; it needs the owner's copy for the password form), screen 08's joining, screen 09's create/edit form (so no "Editează proiectul" on 04 yet), assignment picking on launch (screen 10), the Resend adapter (and the "new review" e-mail, §11.3), the review agent, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
