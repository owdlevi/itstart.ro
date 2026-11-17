# Next session: the share image and Open Graph tags

Paste everything below the line into a fresh session.

---

M1 is built. M2 has recognitions and screen 11, the Blob adapter, screen 12 with "Toate provocările", and the questions and answers thread on 02 and 08. Everything is on GitHub's `main` and deployed to production on Vercel. This session builds the **share image and Open Graph tags** (HANDOVER §3 M2 "share image + Open Graph tags", §3's hidden-sections table "Arată-l oamenilor" on screen 10, §6 10; the section in the reference HTML and PNGs of 10):

- **Image:** the "Arată-l oamenilor" share image for a project, as screen 10's reference shows it, with its download button and the line under the copy-link field (`launched.share.hint`, shown only with `flags.shareImage`).
  - Generate it on the server from the project's data. Check what the installed Next.js offers first (`node_modules/next/dist/docs/`, `next/og` / `ImageResponse`), and whether it can take the brand fonts as they are in `src/app/fonts/` (woff2); record what you chose and why.
  - Colours from the tokens only (HANDOVER §2.2), in the light theme unless you decide otherwise; Romanian diacritics must render (ș ț with comma below).
  - Decide and record: the size, what it shows (name, pitch, builder, challenge, screenshot?), caching, and what a project in progress or without screenshots gets.
- **Open Graph tags** (title, description, image) on the pages people share: a project (04), a challenge (02/11), a profile (05), a question's page, and the site's defaults. The image above is the project's; decide the others' and record it.
- **Flag:** give `flags.shareImage` its own switch, as `challengeArchive` and `questions` have, and turn it on once it matches.
- **Checks:** `capture.mjs --only 10` until the section lines up with the reference; 10's height gaps (621/489px) shrink by the section's height. Record 10's new "Visual check" in DECISIONS. Then a full `--milestone M1` capture: it must stay at what "Questions and answers" recorded (11/40 `match`), except 10. Then a manual pass (§9.5) and a keyboard pass. Check the tags with a real crawler's view if you can do it without posting anything (e.g. fetch the page and read the `<head>`).

Read first: `AGENTS.md` and every doc it points to, and `docs/NEXT-ACTIONS.md` above all. OAuth apps and Resend don't exist, so sign-in stays email and password, and no e-mails are sent. Every stack decision is final. If something truly isn't decided, decide it, record why in `docs/DECISIONS.md`, and list it for me at the end (the owner said "if in doubt you can decide").

## Read this before any migration

**Previews write to production's database** (found 2026-11-17, NEXT-ACTIONS). `DATABASE_URL` is one variable for Production, Preview and Development, so a PR's preview build runs its migration on production **before the merge**, and anything you try on a preview is real production data.

- Check NEXT-ACTIONS first: if the owner has turned on Neon's preview branches, this no longer applies.
- If not, keep any migration additive (new tables and nullable columns only). It must work on production's data as it is, and it must be harmless to production's code still running on `main` until the merge. The share image may need no migration at all.
- Don't sign up or post on a preview; try it locally. If a flow has to be tried deployed, say so to the owner first.

## State on 2026-11-17

- **GitHub:** `owdlevi/itstart.ro`. `main` has everything through the questions thread (PR #3 the Blob adapter, PR #4 screen 12, PR #5 questions, all merge commits). `main` isn't protected yet. Work on a branch from `main` (`share-image`) and open one PR.
- **CI (`check`) and the `itstart-ro` preview must pass before you merge.** The "Vercel – web" check fails on every PR: that's a second Vercel project in the owner's personal scope with no database (NEXT-ACTIONS). Ignore it.
- **Production:** https://itstart-ro.vercel.app, behind Vercel Authentication. It migrates in the build (`apps/web/vercel.json`); `turbo.json` declares the build's env (strict mode).
  - From the terminal: `vercel curl <url> --scope owd --yes`.
  - From Playwright: pull a development OIDC token into the scratchpad (`vercel env pull <file> --environment development --project itstart-ro --scope owd --yes`) and add `x-vercel-trusted-oidc-idp-token` with `page.route` on the deployment's origin only.
  - Crawlers can't see production while Vercel Authentication is on, so real link previews (WhatsApp, Facebook, LinkedIn) can't be tried there yet; say so rather than working around it.
- **Blob works on deploys.** The browser uploads to `incoming/` through `/api/capturi/token`, and `/api/capturi` resizes into `capturi/`. Locally the local adapter stays, since the store refuses a local machine's writes (DECISIONS, "Blob adapter").

What the last session did (DECISIONS, "Questions and answers"):

- **Core:** `questions` (`list`, `bySlug`, `ask`, `answer`, `markSolved`), 20 tests. Anyone signed in with a name asks and answers until the deadline; agents are refused; only the asker marks the solution, also after the deadline; no editing; title 120, details and answers 2000; 10 questions and answers an hour together. `slugBase` takes an optional length (60 for questions).
- **Data:** `0009_questions`, additive (two tables, two `fixture_count_extras` metrics).
- **Pages:** the section on 02 and 08 (latest three by activity, "Pune o întrebare" in place), `/provocari/<slug>/intrebari` (all), and a page per question at `/provocari/<slug>/intrebari/<question>`. `flags.questions` is on by itself.
- **Seed:** the three questions with details and 12 answers (`QUESTION_THREADS`), 11 extras for "14".
- **Capture:** the section lines up to the pixel. 02 and 08 desktop have the reference's height now; phones are 336px short (the M3 agents panel). M1 is 11/40 `match`.
- **Core tests** have a 20 s timeout (PGlite per test). 217 core tests, 13 web.

## Running it

- **Database:** `orb start`, then `docker start pg-itstart`. Run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset`. Always reseed after trying forms.
- **Dev server:** `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`.
  - If 3000 is taken, see what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`). A leftover `next dev` or `next-server` from this project can be stopped; for anything else, tell me.
  - Through 2026-11-17 it was `~/code/owd/onepage.ro`'s server, so work ran on 3001: `DESIGN_FIXTURES=1 BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001`, with `--base http://localhost:3001` for `capture.mjs`.
  - Run `capture.mjs` from `docs/`: `node tools/capture.mjs app --only 10 --base …`.
- **Fixtures mode** freezes core's clock at 2026-11-11: `cafenea` (#3) has ended and `frizerie` (#4) runs.
  - Flows with new accounts need the real clock (ARCHITECTURE, gotchas).
  - The admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`). A new account becomes admin with `pnpm --filter @repo/db admin:set <e-mail> admin`.
  - Screen 10 renders Tuns la Fix as of its launch (HANDOVER §9.4); the share image should too.
- **Playwright** is a root dev dependency. A `.cjs` script can `require(require.resolve("playwright", { paths: [<repo root>] }))`.
  - When checking long (Hungarian) text, append it **after** the page hydrates. Before that, React re-renders the original text and Next's dev overlay counts the mismatch as issues.
  - Don't grep a page's HTML for copy: the RSC payload carries every message in `ro.json`. Read the DOM in Playwright instead.
- **Formatting:** format only the files you touch, and check the diff. Prettier reflows lines in files that weren't formatted before (`provocari/[slug]/page.tsx` is one); keep only your change.

## Still waiting on the owner (NEXT-ACTIONS)

- **Most urgent:**
  - Neon preview branches (previews write to production);
  - deleting the Blob test account from production.
- **GitHub and Vercel:** protecting `main`; the stray `web` project; Neon's compute settings; Vercel's Web Analytics, deployment protection and the `itstart.ro` domain.
- **Sign-in and e-mail:** Resend; the Google and GitHub OAuth apps; the first real admin; the e-mails that wait for Resend (now including "someone answered your question").
- **Content:** the legal pages.
- **Looks over** screen 11's and screen 12's calls (`echipa@itstart.ro` included), and the questions thread's. Nothing waits on them.
- **After 30 November:** #4's recognitions.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. Push the branch and open a PR to `main` (the `pr` skill has the body's template). When `check` and the `itstart-ro` preview pass, merge it yourself as a merge commit; never push to `main` directly. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope:

- magic link, and Google and GitHub in the UI;
- the rest of M2, one session each after this one: the link checker over time, "Raportează" and moderation (hiding questions, answers and reviews included);
- M3 and the review agent;
- every e-mail, and the Resend adapter;
- anything that needs OAuth apps or Resend.

Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
