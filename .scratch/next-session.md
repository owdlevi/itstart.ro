# Next session: screen 06 (Înscriere: cont)

Paste everything below the line into a fresh session.

---

Build screen 06 (Înscriere: cont, `/intra`, signed out). Build no screen past it until it's done per HANDOVER §14.

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). Sign-in is email and password for now (DECISIONS, "Email and password for now"): the reference shows Google, GitHub and the magic-link form, so the password form has no reference design. The parts that matter most: HANDOVER §3, §6 screen 06 (and 07, where a first sign-in goes next), §7–§10, §13 and §14; `docs/ARCHITECTURE.md` (sign-in goes through Better Auth's HTTP endpoint via `authClient`, not `auth.api`, so the per-IP limit applies; read the gotchas); DECISIONS "Sign-in", "Email and password for now", and the "Screen 01–05 data" and "build" sections; `docs/design/components/*.md` (Field, Button, Checkbox); `screens.json` and the `Autentificare*` references. Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-14

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare`, branched from it: screens 02 and 03.
- `screen-04-proiect`, branched from `screen-02-provocare`: screen 04.
- `screen-05-profil`, branched from `screen-04-proiect`: screen 05. Work on a new branch from it (`screen-06-intra`). What it added:
  - **Core:** a `profiles` module, `byHandle()` (stats: launched, months in a row in Bucharest, votes received with the fixture extras; the launched projects; "Provocări terminate" = the challenges they launched in, running ones included, decided by the owner), and `projects.launchedBy()`; 80 core tests. No migration.
  - **Screen 05 (done per §14):** `/u/[handle]`. ProjectCard takes `meta` (the challenge instead of the builder). Avatar has a 72px size. "Editează profilul" links to `/u/<handle>/editeaza`, which screen 07's form will serve later.
  - DECISIONS, ARCHITECTURE and NEXT-ACTIONS cover all of it.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms; sign-ups leave users behind).
- `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`, and pages hydrate. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`); a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me.
- `node docs/tools/capture.mjs app --base http://localhost:3000 --only 06` (output in `docs/review/`). Screen 06 will report `differs` while sign-in is password-based (DECISIONS): say what differs and why. Compare element positions in the reference HTML and the app with Playwright (`getBoundingClientRect` of the same selectors in both), and diff aligned regions with pixelmatch using capture.mjs's options (`threshold: 0.1, includeAA: false`). Anything under ~0.6% is antialiasing. Scripts outside the repo must import Playwright, pngjs and pixelmatch by absolute path from the repo's `node_modules`.

## Screen 06

- The copy and behaviour of the password form are decided: DECISIONS, "Screen 06 copy: password sign-in" (two modes on one panel, Google/GitHub hidden, no reset link, show-password button, every string and error). Build to it word for word.
- `?next=<path>` returns to that page after sign-in (rule 12: votes, reviews). `?provocare=<slug>` should join that challenge after sign-in (HANDOVER §6 06), but joining is screen 08's: decide and record whether 06 only carries the slug on for now.
- A first sign-in (no handle yet) goes to `/bun-venit` (screen 07), which doesn't exist yet.
- Then the rest of §14: manual pass at 390/768/1024/1280 in both themes with the Hungarian sample; keyboard order; errors announced; signed in already (redirect away).

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer:
- the "Cele mai votate săptămâna asta" heading (§13.1);
- the vote refusal copy, and the new copy from screens 02, 03, 04 and 05;
- "Un minut. Fără parolă." under the join button;
- the board's fixed tag chips;
- the November challenge's title ("de cartier");
- the review rules: only owners reply, owners don't review their own project, 2000 characters.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: magic link, Google and GitHub in the UI (they wait for Resend and the OAuth apps), screen 07's form and profile editing, screen 08's joining, screen 09's create/edit form, assignment picking on launch (screen 10), the Resend adapter, the review agent, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
