# Next session: M2 begins with the month's end (recognitions and screen 11), and Blob if confirmed

Paste everything below the line into a fresh session.

---

M1 is built and accepted, as far as it goes without outside accounts: screens 01–10, the admin's challenges, profile editing, the vote timeline, and an end-to-end pass. Every open call is settled (DECISIONS, "Owner accepted the open calls"); what's left in M1 is accounts only. The first real challenge ends on 30 November, so M2 starts with what closes a month. This session has two parts, in this order:

1. **The Blob adapter, only if I've confirmed the store** in `docs/NEXT-ACTIONS.md` ("Vercel Blob" ticked): the upload-token route, the browser upload in `ScreenshotPicker` and `AvatarPicker` (both post to `/api/capturi` today; the picture adds `shape=avatar`), sharp → webp after the upload (400px square for a picture), and `owns()` for the store's URL. `BLOB_READ_WRITE_TOKEN` is in `apps/web/.env.local`; don't use it until the item is ticked. If it isn't, skip this part.
2. **Recognitions and screen 11** (HANDOVER §3 M2, §6 11, rules 7 and 20; `docs/design/screens.json` "11", `fixtures.json` → `challenges[cafenea].recognitions`, `bestAgentProject`, `humansAboveBestAgent`, `displayCounts`):
   - **Core:** a `recognitions` table (challenge, kind `community | jury | first_project`, project, reason) and its rules: one per kind per challenge, only after the deadline, never an agent's project (rule 20) or a late launch (rule 7), "first project" only for someone's first launch ever; "community" suggested from the most votes (ties: decide and record). Admins only, checked in core like `challenges.edit()`. The best agent shown separately, and how many people's projects beat it.
   - **Admin:** entering the three recognitions (project + one-line reason) on an ended challenge, under `/admin/provocari/<slug>`; functional styling like the rest of the admin.
   - **Screen 11:** `/provocari/<slug>` after the deadline replaces today's ended layout (DECISIONS "Screen 02 build", "Ended challenge"): "Încheiată" chip, three stat tiles, "Trei recunoașteri" (ProjectCards with plain counts and the reason), the jury note with its criteria, "Cel mai votat agent AI" (behind `flags.builderAgents`? decide: agents' projects are M3 on 02/03/08, but 11 is about results; record it), "Toate cele N lansări" with "După termen" on late ones, the green band to the running challenge. No ranks anywhere. Screen 05's cards get the recognition in their footer ("Provocarea #3 · Alegerea juriului"), as DECISIONS "Screen 05 build" promised.
   - **Seed:** load the fixtures' recognitions. Then `capture.mjs --only 11` until every variant is `match` or an expected difference, recorded in DECISIONS like every screen's "Visual check", and a manual pass (§9.5) and keyboard pass.

Read first: `AGENTS.md` and every doc it points to, `docs/NEXT-ACTIONS.md` above all (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). Every stack decision is final. If something truly isn't decided, decide it, record why in `docs/DECISIONS.md`, and list it for me at the end (the owner said "if in doubt you can decide").

## State on 2026-11-16

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare` (02, 03) → `screen-04-proiect` (04) → … → `screen-10-lansat` (10) → `admin-challenges` → `profile-edit` → `m1-pass`, each branched from the one before. Work on a new branch from `m1-pass` (`blob` first if part 1 runs, then `screen-11-incheiata` from it). What `m1-pass` did (DECISIONS, "M1 end-to-end pass" and "Owner accepted the open calls"):
  - a full capture (every variant as recorded), a real month on the real clock, and a keyboard pass over the newest pages;
  - fixes: "1 vot", card grids on `auto-fill`, "Nicio părere încă." for an owner, the admin nav's current section;
  - the way back to the assignments: `reviews.post()` returns `nextAssignment`, and the form says "Mai ai o părere de dat: <project>." with a link. 176 core tests;
  - the agent's calls on vote abuse, zero counts, Neon cleanup, unused screenshots, OAuth on previews and passwords.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms).
- `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`): a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me. On 2026-11-15 and 16 it was `~/code/owd/onepage.ro`'s server, so work ran on 3001 (`BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001`, `--base http://localhost:3001` for `capture.mjs`).
- Fixtures mode freezes core's clock at 2026-11-11, when `cafenea` (#3) has ended and `frizerie` (#4) runs: screen 11 is `/provocari/cafenea`. Flows with new accounts need the real clock (ARCHITECTURE, gotchas). The admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`); a new account becomes admin with `pnpm --filter @repo/db admin:set <e-mail> admin`.
- Playwright is a root dev dependency; a `.cjs` script can `require(require.resolve("playwright", { paths: [<repo root>] }))`.
- Format only the files you touch, and check the diff: prettier reflows lines in files that weren't formatted before; keep only your change.

## Still waiting on me (NEXT-ACTIONS)

Accounts only: `gh` scopes and branch protection, the Blob store, Neon, Vercel, Resend, the Google and GitHub OAuth apps, the first real admin, and the legal pages' content.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: magic link, Google and GitHub in the UI, the rest of M2 (screen 12 and the archive, questions and answers, the share image and Open Graph tags, the link checker over time, "Raportează" and moderation; one session each, after this one), M3, the review agent, every e-mail and the Resend adapter, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
