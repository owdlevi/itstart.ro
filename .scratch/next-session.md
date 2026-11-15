# Next session: admin, create and edit a challenge

Paste everything below the line into a fresh session.

---

Every M1 screen (01–10) is built. Build the last M1 feature that needs no outside account: **an admin can create a challenge and edit it** (HANDOVER §3, M1 "admin can create a challenge and edit it"). It has no reference design: functional styling on our tokens and components, in the `admin/` route group (ARCHITECTURE).

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). The parts that matter most: HANDOVER §3, §4 (Challenge: every field), §5 rules 1–3 (exactly one running challenge, the deadline at 23:59 Bucharest on the month's last day), §6 screen 02 (what the brief shows), §10 and §14; `docs/ARCHITECTURE.md` (`challenges` in core, "Admin checks", the gotchas); DECISIONS "Admins", "Screen 01 data" (`builtFor`, derived month label), "Screen 02 data" (`tips`, `launchNote`, `juryNote`, `givenName`), "Screen 09 data" (`launchCheck`), "Owner accepted screens 01–09" and "Screen 10 data/build". Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-15

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare` (02, 03) → `screen-04-proiect` (04) → … → `screen-09-lanseaza` (09) → `screen-10-lansat` (10), each branched from the one before. Work on a new branch from `screen-10-lansat` (`admin-challenges`). What 10 added:
  - **Core:** rule 16 (`reviews/assignments.ts`, `assignOnLaunch`, called inside `projects.create()`/`edit()` when a project launches): two per builder per challenge, fewest human reviews, oldest launch on a tie, later launches top up builders short of two, none for a project of its own or an agent. `projects.launch(slug, viewerId, { countsAtLaunch })`, the page's read. 138 core tests.
  - **App:** `/proiecte/<slug>/lansat` (owner only; others go to the project page), `CopyLink`, `flags.shareImage` (M2) and `flags.contactConsent` (M3). LaunchRow no longer shows "0 comentarii".
  - DECISIONS ("Screen 10 data/build", "Owner accepted screens 01–09"), ARCHITECTURE and NEXT-ACTIONS cover all of it.
- I said "accept all pages": screens 01–09 stay as built (DECISIONS records exactly what that settled). Screen 10's new copy and calls are still open in NEXT-ACTIONS.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms; a launch also tops up every fixture builder's assignments).
- `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`): a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me. On 2026-11-15 it was `~/code/owd/onepage.ro`'s server again, so 10 ran on 3001 (`BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001`, `--base http://localhost:3001` for `capture.mjs`).
- The admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`).
- Format only the files you touch: `prettier --write src` reformats unrelated files.

## Admin: challenges

- **Core** (`challenges`): `create()` and `edit()`, admin only (role read from the database, never the cookie cache). Decide and record, one test per rule: the slug (from the title, fixed after the start?), the number (next free?), the deadline (rule 1: 23:59 Europe/Bucharest on the last day of `startsAt`'s month, derived or entered?), no two challenges running at once (rule 1: refuse overlapping months), what can still change once it's running or ended (the brief yes; dates?), and the list fields (`baseLevel`, `stretch`, `launchCriteria`, `tips`).
- **App:** `/admin/provocari` (the list, newest first, with status) and `/admin/provocari/noua`, `/admin/provocari/<slug>` (one form, react-hook-form + zod shared with the action). Copy in `ro.json` under `admin`. Every action re-checks the role.
- The public pages (01, 02, 08, 09) must show a newly created challenge correctly: try it.
- §14 as far as it applies: no reference, so no capture; a manual pass at 390 and 1280 in both themes, keyboard order, signed out (404 or sign-in?), a member (refused), an admin.

## Also waiting, if I confirm the Blob store

`BLOB_READ_WRITE_TOKEN` is in `apps/web/.env.local` (store `onepage-media`). If I confirm in NEXT-ACTIONS that it's ITStart's own public `fra1` store, the Blob adapter can come next: the upload-token route, the browser upload in `ScreenshotPicker`, sharp → webp, and `owns()` for the store's URL. Don't use the token until then.

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer: screen 10's new copy and calls; the Blob store; passwords vs magic link later; OAuth on previews; the Neon secret; cleaning up unused screenshots.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: magic link, Google and GitHub in the UI, profile editing (`/u/<handle>/editeaza`), recognitions (M2), the review agent, every e-mail and the Resend adapter, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
