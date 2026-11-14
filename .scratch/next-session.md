# Next session: screen 04 (Proiect)

Paste everything below the line into a fresh session.

---

Build screen 04 (Proiect, `/proiecte/[slug]`, signed in as andrei-popescu, who voted). Build no screen past it until it's done per HANDOVER §14.

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). Sign-in is email and password for now (DECISIONS, "Email and password for now"). The parts that matter most: HANDOVER §3 (sections hidden until later milestones: on 04 that's the M3 "Deschisă la colaborări" chip and "Scrie-i", and the M2 "Link verificat…" line and "Raportează o problemă"), §5 rules 5, 8, 10–12 and 15–18, §6 screen 04, §7–§10, §13 and §14; `docs/ARCHITECTURE.md` (where code goes; read the gotchas, four are new); DECISIONS "Fixture counts", "Review agent moved out of M1", "Rate limits live in Postgres" (reviews: 10 per hour), and the "Screen 01/02/03 data" and "build" sections; `docs/design/components/*.md` (VoteButton wide, Tag, Avatar 52, AgentBadge, Field for the review form); `docs/design/fixtures.json` (`screenStates`, `reviews`, the project's `build`, `updates`, `description`) and `screens.json`. Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-14

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare`, branched from it, now holds screens 02 and 03. Work on a new branch from it (`screen-04-proiect`). What it added since screen 01:
  - **Screen 02 (done per §14):** schema and seed for the brief, `users.givenName`, `project_updates`; core `challenges.bySlug()`, `participants()`, `projects.inProgress()`; the page, `flags.ts`, SectionHeading, 40px avatars. Finishing it fixed a font bug that affected every screen (next/font's Arial fallback was drawing all diacritics), the 768–983px column order, and the ended-state copy.
  - **Screen 03 (done per §14):** `challenges.shortTitle` (migration `0004_screen_03`), core `projects.board()` and `challenges.started()` (46 PGlite tests), `/lansari` with LinkTabs (shadcn's Base UI tabs on our tokens), FilterChip in per-chip GET forms, Bucharest week groups, the empty state. VoteButton now returns to the page with its query after sign-in.
  - DECISIONS, ARCHITECTURE and NEXT-ACTIONS cover all of it.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; reseed with `pnpm db:seed:fixtures --reset`. The seed loads reviews already; check what screen 04 needs that it doesn't (replies, automated flag, edited time, assignment rows) and extend it.
- **Start the server with `DESIGN_FIXTURES=1 pnpm dev`** in `apps/web`. An SSH tunnel holds `localhost:3000`, so the dev server is reachable only on the LAN IP (`ipconfig getifaddr en0`). That's fine for `capture.mjs`, but pages don't hydrate there. Test interaction on `DESIGN_FIXTURES=1 pnpm build && DESIGN_FIXTURES=1 pnpm start`. Don't change the port or the config; if 3000 is taken by something else, tell me. Stop a production server with `pkill -f next-server`.
- `node docs/tools/capture.mjs app --base http://<LAN IP>:3000 --only 04`. Hidden sections shift everything below them, so whole-page percentages say little. Last session compared element positions in the reference HTML and the app with Playwright, and diffed aligned regions (thumbnails left out) with pixelmatch using capture.mjs's options. Do the same; anything under ~0.6% is antialiasing.
- Expected differences to list in DECISIONS: thumbnails and screenshots (§9.4); the automated review ("Părere automată", out of M1), so "Păreri · 4" may read 3 rows; the hidden M2/M3 parts named above.

## Screen 04

- Core: a project by slug with everything the page shows (owner with city and launch count, all tools, the challenge and launch date, screenshots, description, build story, updates newest first), reviews with one level of replies, human first-level reviews and replies counted (rule 17), automated first (rule 18, for when the agent ships).
- Posting a review (rule 15, any signed-in user) and an owner's reply (one level), with the 10-per-hour limit counted from `reviews` (DECISIONS, "Rate limits live in Postgres"). Refusals are values; the server action maps them to copy. New copy goes in DECISIONS for the owner to review.
- The wide VoteButton (voted = `tint` + 2px `primary` + check), "Deschide proiectul" (external), "Distribuie" (native share, else copy link), the screenshot viewer (16:10 + 3-column strip, selected has a 2px `primary` border), "← Lansări".
- Then the rest of §14: manual pass at 390/768/1024/1280 in both themes with the Hungarian sample; keyboard order; signed out, owner (andrei on scaunul-3), an agent's project, an in-progress project (rule 5: the "în lucru" box, reviews allowed), a project with no reviews.

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer:
- the "Cele mai votate săptămâna asta" heading (§13.1);
- the vote refusal copy, and the new copy from screens 02 and 03;
- "Un minut. Fără parolă." under the join button;
- the board's fixed tag chips.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: screen 06 (`/intra`; it needs the owner's copy for the password form), screen 08's joining (a signed-in participant still sees "Intră în provocare" on 02 until then), the Resend adapter, the review agent, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
