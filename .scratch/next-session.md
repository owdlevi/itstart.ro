# Next session: questions and answers ("Întrebări și ajutor")

Paste everything below the line into a fresh session.

---

M1 is built. M2 has recognitions and screen 11, the Blob adapter, and screen 12 with the "Toate provocările" link on 02, 08 and 11. Everything is on GitHub's `main` and deployed to production on Vercel. This session builds the **questions and answers thread** (HANDOVER §3 M2, §4 Question / Answer, §6 02 "Întrebări și ajutor · 14"; the section in the reference HTML and PNGs of 02 and 08; `fixtures.json` → `questions`):

- **Core:** a `questions` module.
  - A signed-in person asks (title, body). Someone answers, and the asker marks one answer as the solution (`solvedAnswerId`).
  - Decide and record: who may mark the solution, editing, the length limits, and a rate limit counted from the module's own rows (DECISIONS, "Rate limits live in Postgres").
  - Counts go through `withExtra` (the reference says "14").
  - Test the rules it touches, with their numbers in the test names where §5 has one.
- **Page:** the "Întrebări și ajutor" section on 02 and 08 (`flags.questions`), matching the reference.
  - Where a question is read and answered has no reference design: decide (a page per question, or in place) and record it.
  - Give `flags.questions` its own switch, as `challengeArchive` has: `MILESTONE` would also turn on the share image, which isn't built.
- **Seed:** `fixtures.json`'s three questions for `frizerie` (titles, authors, answer counts, solved), plus whatever the reference shows that the fixtures don't hold.
- **Checks:** `capture.mjs --only 02,08` until the section lines up with the reference; 02's and 08's height gaps shrink by the section's height. Record each screen's new "Visual check" in DECISIONS. Then a full `--milestone M1` capture: it must stay at what "Screen 12" recorded, except 02 and 08. Then a manual pass (§9.5) and a keyboard pass.

Read first: `AGENTS.md` and every doc it points to, and `docs/NEXT-ACTIONS.md` above all. OAuth apps and Resend don't exist, so sign-in stays email and password, and no e-mails are sent (no "someone answered you" e-mail: list it in NEXT-ACTIONS). Every stack decision is final. If something truly isn't decided, decide it, record why in `docs/DECISIONS.md`, and list it for me at the end (the owner said "if in doubt you can decide").

## Read this before any migration

**Previews write to production's database** (found 2026-11-17, NEXT-ACTIONS). `DATABASE_URL` is one variable for Production, Preview and Development, so a PR's preview build runs its migration on production **before the merge**, and anything you try on a preview is real production data.

- Check NEXT-ACTIONS first: if the owner has turned on Neon's preview branches, this no longer applies.
- If not, keep the migration additive (new tables and nullable columns only). It must work on production's data as it is, and it must be harmless to production's code still running on `main` until the merge.
- Don't sign up or post on a preview; try it locally. If a flow has to be tried deployed, say so to the owner first.

## State on 2026-11-17

- **GitHub:** `owdlevi/itstart.ro`. `main` has everything through screen 12 (PR #3 the Blob adapter, PR #4 screen 12, both merge commits). `main` isn't protected yet. Work on a branch from `main` (`questions`) and open one PR.
- **CI (`check`) and the `itstart-ro` preview must pass before you merge.** The "Vercel – web" check fails on every PR: that's a second Vercel project in the owner's personal scope with no database (NEXT-ACTIONS). Ignore it.
- **Production:** https://itstart-ro.vercel.app, behind Vercel Authentication. It migrates in the build (`apps/web/vercel.json`); `turbo.json` declares the build's env (strict mode).
  - From the terminal: `vercel curl <url> --scope owd --yes`.
  - From Playwright: pull a development OIDC token into the scratchpad (`vercel env pull <file> --environment development --project itstart-ro --scope owd --yes`) and add `x-vercel-trusted-oidc-idp-token` with `page.route` on the deployment's origin only.
- **Blob works on deploys.** The browser uploads to `incoming/` through `/api/capturi/token`, and `/api/capturi` resizes into `capturi/`. Locally the local adapter stays, since the store refuses a local machine's writes (DECISIONS, "Blob adapter").

What this session's work did (DECISIONS, "Blob adapter" and "Screen 12 · Toate provocările"):

- **Blob adapter:**
  - the token route; `uploadImage` in both pickers; sharp → webp after the upload; `owns()` for `capturi/<uuid>.webp`, tested in `blob-paths.test.ts`;
  - tried on PR #3's preview with a 4.8 MB png and a profile picture. That test account is on production now (NEXT-ACTIONS).
- **Screen 12:**
  - `challenges.archive()` and `recognitions.juryPicks()`, with 7 rule tests (1, 2, 3, 7, 20);
  - `/provocari`; "Propune un brief" as a mailto to `echipa@itstart.ro`; "Provocarea" current across `/provocari`;
  - `flags.challengeArchive` on by itself, and the chips' 44px holder removed on 02 and 11;
  - the seed adds #2's and #1's jury picks.
  - Capture: 12 is 4/4 `match`, and M1 is 10/40 `match` with the gaps recorded.
- **Core tests** have a 20 s timeout (PGlite per test went over 5 s on CI). 197 core tests, 13 web.

## Running it

- **Database:** `orb start`, then `docker start pg-itstart`. Run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset`. Always reseed after trying forms.
- **Dev server:** `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`.
  - If 3000 is taken, see what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`). A leftover `next dev` or `next-server` from this project can be stopped; for anything else, tell me.
  - Through 2026-11-17 it was `~/code/owd/onepage.ro`'s server, so work ran on 3001: `DESIGN_FIXTURES=1 BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001`, with `--base http://localhost:3001` for `capture.mjs`.
  - Run `capture.mjs` from `docs/`: `node tools/capture.mjs app --only 02,08 --base …`.
- **Fixtures mode** freezes core's clock at 2026-11-11: `cafenea` (#3) has ended and `frizerie` (#4) runs.
  - Flows with new accounts need the real clock (ARCHITECTURE, gotchas).
  - The admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`). A new account becomes admin with `pnpm --filter @repo/db admin:set <e-mail> admin`.
- **Playwright** is a root dev dependency. A `.cjs` script can `require(require.resolve("playwright", { paths: [<repo root>] }))`.
  - When checking long (Hungarian) text, append it **after** the page hydrates. Before that, React re-renders the original text and Next's dev overlay counts the mismatch as issues.
- **Formatting:** format only the files you touch, and check the diff. Prettier reflows lines in files that weren't formatted before (`provocari/[slug]/page.tsx` is one); keep only your change.

## Still waiting on the owner (NEXT-ACTIONS)

- **Most urgent:**
  - Neon preview branches (previews write to production);
  - deleting the Blob test account from production.
- **GitHub and Vercel:** protecting `main`; the stray `web` project; Neon's compute settings; Vercel's Web Analytics, deployment protection and the `itstart.ro` domain.
- **Sign-in and e-mail:** Resend; the Google and GitHub OAuth apps; the first real admin.
- **Content:** the legal pages.
- **Looks over** screen 11's and screen 12's calls, `echipa@itstart.ro` included. Nothing waits on them.
- **After 30 November:** #4's recognitions.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. Push the branch and open a PR to `main` (the `pr` skill has the body's template). When `check` and the `itstart-ro` preview pass, merge it yourself as a merge commit; never push to `main` directly. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope:

- magic link, and Google and GitHub in the UI;
- the rest of M2, one session each after this one: the share image and Open Graph tags, the link checker over time, "Raportează" and moderation;
- M3 and the review agent;
- every e-mail, and the Resend adapter;
- anything that needs OAuth apps or Resend.

Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
