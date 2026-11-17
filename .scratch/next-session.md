# Next session: the Blob adapter, then screen 12 (the challenge archive)

Paste everything below the line into a fresh session.

---

M1 is built, M2 has begun (recognitions and screen 11), and everything is on GitHub's `main` and deployed to production on Vercel (DECISIONS, "First deploy"). This session has two parts, in this order:

1. **The Blob adapter.** The store is confirmed: `itstart-ro-blob`, public, `fra1`, connected to `itstart-ro` for Production and Preview. Its token is in `apps/web/.env.local` and in Vercel's env. Build:
   - the upload-token route;
   - the browser upload in `ScreenshotPicker` and `AvatarPicker`. Both post to `/api/capturi` today, and the picture adds `shape=avatar`;
   - sharp → webp after the upload (400px square for a picture);
   - `owns()` for the store's URL.

   Keep the local adapter for local work without a token (ARCHITECTURE, uploads). Try it on a PR preview: a screenshot and a profile picture, end to end. Record what you decide in DECISIONS, and tick the adapter in NEXT-ACTIONS.
2. **Screen 12 · Toate provocările** (HANDOVER §3 M2 and §6 12; `docs/design/screens.json` "12"; the reference HTML and PNGs):
   - **Core:** the list of challenges for the archive, newest first, upcoming ones left out (decide and record):
     - the running one with its live counts;
     - each ended one with the jury's pick (`recognitions`: project, builder, reason) and its counts.

     Reuse `challenges.started()` and `recognitions` where they fit. Test the rules it touches (1, 3, 20) with their numbers in the test names.
   - **Page:** `/provocari`, in a 960px container:
     - the running row has a 2px `primary` border, its live counts and a primary button;
     - ended rows show the jury's pick and a secondary "Vezi rezultatele";
     - the closing line carries "Propune un brief". Prefer a mailto until Resend exists; decide and record.

     No ranks. Its empty state: no challenges yet.
   - **Turn on "Toate provocările"** on 02, 08 and 11: `flags.challengeArchive`. `flags.ts` ties every flag to one `MILESTONE`, and the other M2 flags (questions, share image) aren't built. So give this flag its own switch, and record it.
     - Screens 02 and 08 kept their header's height for this link. Check that their captures still line up.
     - Screen 11's phone capture should lose its 22px gap. Update each screen's "Visual check" in DECISIONS.
   - **Header nav:** does "Provocarea" stay current on `/provocari`? Check the reference, decide and record.
   - **Seed:** whatever screen 12's reference shows that the seed doesn't load yet. `fixtures.json` has recognitions only for `cafenea`; if the reference shows a jury's pick for #2 `mester-local` or #1 `pagina-personala`, seed it from the reference HTML (like `JURY_NOTE`) and record it.
   - **Checks:** `capture.mjs --only 12` until every variant is `match` or an expected difference, recorded in DECISIONS. Then a full `--milestone M1` capture: it must stay at what "M1 end-to-end pass" recorded, except where the link changes 02, 08 and 11. Then a manual pass (§9.5) and a keyboard pass.

Read first: `AGENTS.md` and every doc it points to, and `docs/NEXT-ACTIONS.md` above all. Vercel, Neon and Blob exist now. OAuth apps and Resend don't, so sign-in stays email and password, and no e-mails are sent. Every stack decision is final. If something truly isn't decided, decide it, record why in `docs/DECISIONS.md`, and list it for me at the end (the owner said "if in doubt you can decide").

## State on 2026-11-17

- **GitHub:** `owdlevi/itstart.ro`. `main` has everything through screen 11 (PR #1, merged as a merge commit), plus the first-deploy docs. `main` isn't protected yet. Work on a branch from `main`: `blob` first, then `screen-12-provocari`. Open one PR per part. CI (`check`) and the `itstart-ro` preview must pass before you merge.
- **The "Vercel – web" check fails on every PR:** that's a second Vercel project in my personal scope that builds this repo with no database (NEXT-ACTIONS). Ignore it.
- **Production:** https://itstart-ro.vercel.app, behind Vercel Authentication. It migrates in the build (`apps/web/vercel.json`); `turbo.json` declares the build's env (strict mode). To reach a protected deployment from the terminal, use `vercel curl <url> --scope owd --yes`. Nothing was tried signed in there yet, and there's no admin or challenge in production yet.

What `screen-11-incheiata` did (DECISIONS, "Screen 11 and recognitions"):
- `recognitions` in core, with 14 tests:
  - one per kind per challenge, a project at most once;
  - after the deadline only;
  - never a late launch or an agent's project (rules 7 and 20);
  - "first project" only for a first launch ever;
  - the community's pick suggested from the votes.
- `projects.launchedIn()`, and `recognition` on `launchedBy()`.
- The admin's form at `/admin/provocari/<slug>/recunoasteri`.
- Screen 11 replaced the interim ended layout on `/provocari/<slug>`.
- Screen 05's footer names the recognition.
- LaunchRow's agent badge wraps on its own.
- The seed loads the recognitions, a late launch and two new fixture extras: `humans_above_agent`, and a challenge-level `reviews`.
- Migration `0008_screen_11`. 190 core tests, 10 web.

## Running it

- **Database:** `orb start`, then `docker start pg-itstart`. Run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset`. Always reseed after trying forms.
- **Dev server:** `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`): a leftover `next dev` or `next-server` from this project can be stopped; for anything else, tell me. On 2026-11-15 to 17 it was `~/code/owd/onepage.ro`'s server, so work ran on 3001: `BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001`, and `--base http://localhost:3001` for `capture.mjs`. Run `capture.mjs` from `docs/`: `node tools/capture.mjs app --only 12 --base …`.
- **Fixtures mode** freezes core's clock at 2026-11-11: `cafenea` (#3) has ended and `frizerie` (#4) runs. Flows with new accounts need the real clock (ARCHITECTURE, gotchas). The admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`); a new account becomes admin with `pnpm --filter @repo/db admin:set <e-mail> admin`.
- **Playwright** is a root dev dependency. A `.cjs` script can `require(require.resolve("playwright", { paths: [<repo root>] }))`.
- **Formatting:** format only the files you touch, and check the diff. Prettier reflows lines in files that weren't formatted before (`provocari/[slug]/page.tsx` is one); keep only your change.

## Still waiting on me (NEXT-ACTIONS)

Protecting `main`, the stray `web` project, Neon's preview-branch and compute settings, Vercel's Web Analytics, deployment protection and the `itstart.ro` domain, Resend, the Google and GitHub OAuth apps, the first real admin, and the legal pages' content. Also a look over screen 11's calls (nothing waits on it), and #4's recognitions after 30 November.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. Push each part's branch and open a PR to `main`. When `check` and the `itstart-ro` preview pass, merge it yourself as a merge commit; never push to `main` directly. Production migrates on merge, so a migration must work on a database that already has data. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope:
- magic link, and Google and GitHub in the UI;
- the rest of M2, one session each after this one: questions and answers, the share image and Open Graph tags, the link checker over time, "Raportează" and moderation;
- M3 and the review agent;
- every e-mail, and the Resend adapter;
- anything that needs OAuth apps or Resend.

Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
