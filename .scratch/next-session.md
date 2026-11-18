# Next session: "Raportează" and moderation

Paste everything below the line into a fresh session.

---

M1 is built. M2 has recognitions and screen 11, the Blob adapter, screen 12 with "Toate provocările", the questions and answers thread on 02 and 08, the share image with Open Graph tags, and the link checker over time. Everything is on GitHub's `main` and deployed to production on Vercel. This session builds the last of M2, **"Raportează" and the moderation queue** (HANDOVER §3 M2 "„Raportează” + moderation queue", §4 Report `{projectId, reporterId?, reason, createdAt, resolvedAt?}` and the `hidden` flags on Project and Review, §3's hidden-sections table and §6 04: "Raportează o problemă cu acest proiect" at the end of the sidebar; §12: "A person (admin) can hide an automated review"; the reference HTML and PNGs of 04):

- **Reporting:** "Raportează o problemă cu acest proiect" on 04, as the reference shows it (the link's look; the form behind it has no reference design, so decide it and record it). Decide and record: who may report (signed in only, or visitors too, given `reporterId?`), the reasons offered, a rate limit (counted from the reports' own rows, DECISIONS "Rate limits live in Postgres"), what the reporter sees after, and whether the owner is told (no e-mails: Resend doesn't exist).
- **Moderation:** an admin queue under `admin/` (functional styling, like the other admin pages; `requireAdmin()` first, and every admin method in core takes the actor's id). An admin can hide and unhide a project, a review or reply (the automated review included), a question and an answer, and resolve a report. Decide and record what hidden means everywhere: lists, counts (they must never drift, §4), the project page (404 or a notice?), profiles, screen 11's results and recognitions, the board, the share images (a hidden project's should 404), the link checker (`linkChecks.due()` should leave hidden projects out), and what the owner sees of their own hidden project.
  - The rules go in core (a `moderation` module, or each owning module's `hide()`), one test per rule.
- **Checks:** `capture.mjs --only 04` until the link lines up with the reference; 04's phone gap (168px) shrinks by its 60px. Record 04's new "Visual check" in DECISIONS. Then a full `--milestone M1` capture: it must stay at what "Link checker" recorded (11/40 `match`), except 04. Then a manual pass (§9.5) and a keyboard pass of the report form and the queue.

Read first: `AGENTS.md` and every doc it points to, and `docs/NEXT-ACTIONS.md` above all. OAuth apps and Resend don't exist, so sign-in stays email and password, and no e-mails are sent. Every stack decision is final. If something truly isn't decided, decide it, record why in `docs/DECISIONS.md`, and list it for me at the end (the owner said "if in doubt you can decide").

## Read this before any migration

**Previews write to production's database** (found 2026-11-17, NEXT-ACTIONS). `DATABASE_URL` is one variable for Production, Preview and Development, so a PR's preview build runs its migration on production **before the merge**, and anything you try on a preview is real production data.

- Check NEXT-ACTIONS first: if the owner has turned on Neon's preview branches, this no longer applies.
- If not, keep any migration additive. It must work on production's data as it is, and be harmless to production's code still running on `main` until the merge. A `reports` table is new; `hidden` on `projects`, `reviews`, `questions` and `answers` must be nullable, or `not null default false` (Postgres adds it without a rewrite, and `main`'s code never writes it). Check whether `reviews.hidden` exists already (`reviews.thread()` leaves hidden ones out).
- Don't sign up, post or report on a preview; try it locally. If a flow has to be tried deployed, say so to the owner first.

## State on 2026-11-18

- **GitHub:** `owdlevi/itstart.ro`. `main` has everything through the link checker (PR #5 questions, PR #6 the share image, PR #7 the link checker, all merge commits). `main` isn't protected yet. Work on a branch from `main` (`moderation`) and open one PR.
- **CI (`check`) and the `itstart-ro` preview must pass before you merge.** The "Vercel – web" check fails on every PR: that's a second Vercel project in the owner's personal scope with no database (NEXT-ACTIONS). Ignore it.
- **Production:** https://itstart-ro.vercel.app, behind Vercel Authentication. It migrates in the build (`apps/web/vercel.json`); `turbo.json` declares the build's env (strict mode).
  - From the terminal: `vercel curl <url> --scope owd --yes`.
  - From Playwright: pull a development OIDC token into the scratchpad (`vercel env pull <file> --environment development --project itstart-ro --scope owd --yes`) and add `x-vercel-trusted-oidc-idp-token` with `page.route` on the deployment's origin only.
- **The hourly link check** needs `CRON_SECRET` in Vercel's Production env, which the owner adds (NEXT-ACTIONS). Until then `/api/cron/verifica-linkuri` refuses every call on Vercel. Don't add it yourself: the last session wasn't allowed to.

What the last session did (DECISIONS, "Link checker"):

- **Schedule:** a Vercel Cron (`vercel.json`, hourly) calls `/api/cron/verifica-linkuri`, which starts the `checkLinks` workflow (`src/workflows/link-checks.ts`): `core.linkChecks.due()`, then `check()` ten at a time per step, at most 60 a run.
- **Rules** (`core/link-checks/rules.ts`): every 6 hours, a day for ended challenges, an hour after a failure; a failure shows on the second in a row; rule 9's check on save records its pass. Three nullable columns on `projects` (`link_checked_at`, `link_ok`, `link_failed_at`, migration `0010_link_checks`).
- **Screen 04:** "Link verificat acum 3 ore. Merge." (`flags.linkCheck`, on by itself) lines up to the pixel; a failing link reads "Nu se deschide." in `warning-ink` for everyone, with a hint for the owner. M1 is 11/40 `match`; 04's phone gap is 168px.
- 231 core tests (14 new), 20 web.

## Running it

- **Database:** `orb start`, then `docker start pg-itstart`. Run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset`. Always reseed after trying forms.
- **Dev server:** `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`.
  - **Ports are crowded on this machine.** On 2026-11-18 an SSH tunnel (`ssh`, not this project's) listened on `127.0.0.1:3000–3015`, so `localhost` on those ports reached the tunnel, not the dev server (a 404 for every page), and `~/code/owd/onepage.ro`'s `next-server` sat on 3000 and later took 3100. Check a port with `lsof -nP -iTCP:<port> -sTCP:LISTEN` before using it, leave other projects' servers and the tunnel alone, and pick a free one: the last session ran on 3100, then 3217 (`DESIGN_FIXTURES=1 BETTER_AUTH_URL=http://localhost:<port> pnpm next dev --port <port>`, with `--base http://localhost:<port>` for `capture.mjs`).
  - Run `capture.mjs` from `docs/`: `node tools/capture.mjs app --only 04 --base …`. Heights in its table are device pixels (phones are captured at scale 2): divide by 2 for CSS pixels.
- **Fixtures mode** freezes core's clock at 2026-11-11: `cafenea` (#3) has ended and `frizerie` (#4) runs.
  - Flows with new accounts need the real clock (ARCHITECTURE, gotchas).
  - The admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`). A new account becomes admin with `pnpm --filter @repo/db admin:set <e-mail> admin`.
  - Fixture projects' live links are `https://*.example`-style addresses that `withExampleHosts()` answers in fixtures mode; the seed marks them checked at 04:35 on 11 November.
- **Playwright** is a root dev dependency. A `.cjs` script can `require(require.resolve("playwright", { paths: [<repo root>] }))`.
  - When checking long (Hungarian) text, append it **after** the page hydrates. Before that, React re-renders the original text and Next's dev overlay counts the mismatch as issues.
  - Don't grep a page's HTML for copy: the RSC payload carries every message in `ro.json`. Read the DOM in Playwright instead.
- **Formatting:** format only the files you touch, and check the diff. Prettier reflows lines in files that weren't formatted before; keep only your change.
- **Before `next build`,** stop the dev server you started (by its task, not `pkill`): both use `.next`.

## Still waiting on the owner (NEXT-ACTIONS)

- **Most urgent:**
  - Neon preview branches (previews write to production);
  - `CRON_SECRET` on Vercel (the hourly link check);
  - deleting the Blob test account from production.
- **GitHub and Vercel:** protecting `main`; the stray `web` project; Neon's compute settings; Vercel's Web Analytics, deployment protection and the `itstart.ro` domain.
- **Sign-in and e-mail:** Resend; the Google and GitHub OAuth apps; the first real admin; the e-mails that wait for Resend.
- **Content:** the legal pages.
- **Looks over** screen 11's and screen 12's calls (`echipa@itstart.ro` included), the questions thread's, the share image's and the link checker's. Nothing waits on them.
- **A real link preview** once crawlers can reach production.
- **After 30 November:** #4's recognitions.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. Push the branch and open a PR to `main` (the `pr` skill has the body's template). When `check` and the `itstart-ro` preview pass, merge it yourself as a merge commit; never push to `main` directly. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope:

- magic link, and Google and GitHub in the UI;
- M3 and the review agent;
- every e-mail, and the Resend adapter;
- anything that needs OAuth apps or Resend.

Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session (M2 is then done: say what's left before the first public challenge), and tell me what's left.
