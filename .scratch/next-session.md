# Next session: the link checker over time

Paste everything below the line into a fresh session.

---

M1 is built. M2 has recognitions and screen 11, the Blob adapter, screen 12 with "Toate provocările", the questions and answers thread on 02 and 08, and the share image with Open Graph tags. Everything is on GitHub's `main` and deployed to production on Vercel. This session builds the **link checker over time** (HANDOVER §3 M2 "link checker", §4 Project `linkCheck {checkedAt, ok}`, §3's hidden-sections table and §6 04: the "Link verificat acum 3 ore. Merge." line under the vote and share buttons; the reference HTML and PNGs of 04):

- **Checks:** re-check every project's live link on a schedule, with the check rule 9 already uses on save (`apps/web/src/server/link-checker.ts`: https GET, 5 s, private addresses refused), and keep the latest result (`checkedAt`, `ok`). Rule 9's check on save should record its result too.
  - Read ADR 0002 and ARCHITECTURE ("A scheduled or delayed job goes in `apps/web/src/workflows/`") first, and the installed `workflow` package's docs. Decide and record: how often, which projects (launched and in progress? ended challenges' too?), how many at once and how long a run may take, what counts as "merge" (status codes, redirects, a timeout), and whether one failure flips it or it takes two in a row.
  - The rule (who is checked when, what a result means) goes in core, behind the `linkChecker` seam; the workflow only sleeps, asks core, checks and reports back.
- **The line on 04:** "Link verificat acum 3 ore. Merge." as the reference shows it, with relative times from `lib/dates.ts`. Decide and record what a failing link shows (to everyone? to the owner only, with what to do?), and what a project never checked shows (probably nothing). Give it its own flag, as `questions` and `shareImage` have, and turn it on once it matches. "Raportează o problemă" next to it is the next session's.
- **Checks:** `capture.mjs --only 04` until the line lines up with the reference; 04's phone gap (192px) shrinks by its height. Record 04's new "Visual check" in DECISIONS. Then a full `--milestone M1` capture: it must stay at what "Share image and Open Graph tags" recorded (11/40 `match`), except 04. Then a manual pass (§9.5) and a keyboard pass. Try the schedule locally (a short interval, a project pointing at a dead address), never against real people's sites in a loop.

Read first: `AGENTS.md` and every doc it points to, and `docs/NEXT-ACTIONS.md` above all. OAuth apps and Resend don't exist, so sign-in stays email and password, and no e-mails are sent. Every stack decision is final. If something truly isn't decided, decide it, record why in `docs/DECISIONS.md`, and list it for me at the end (the owner said "if in doubt you can decide").

## Read this before any migration

**Previews write to production's database** (found 2026-11-17, NEXT-ACTIONS). `DATABASE_URL` is one variable for Production, Preview and Development, so a PR's preview build runs its migration on production **before the merge**, and anything you try on a preview is real production data.

- Check NEXT-ACTIONS first: if the owner has turned on Neon's preview branches, this no longer applies.
- If not, keep any migration additive (new tables and nullable columns only). It must work on production's data as it is, and it must be harmless to production's code still running on `main` until the merge. `linkCheck` fits as two nullable columns on `projects`, or a table of checks.
- Don't sign up or post on a preview; try it locally. If a flow has to be tried deployed, say so to the owner first.

## State on 2026-11-18

- **GitHub:** `owdlevi/itstart.ro`. `main` has everything through the share image (PR #4 screen 12, PR #5 questions, PR #6 the share image, all merge commits). `main` isn't protected yet. Work on a branch from `main` (`link-checker`) and open one PR.
- **CI (`check`) and the `itstart-ro` preview must pass before you merge.** The "Vercel – web" check fails on every PR: that's a second Vercel project in the owner's personal scope with no database (NEXT-ACTIONS). Ignore it.
- **Production:** https://itstart-ro.vercel.app, behind Vercel Authentication. It migrates in the build (`apps/web/vercel.json`); `turbo.json` declares the build's env (strict mode).
  - From the terminal: `vercel curl <url> --scope owd --yes`.
  - From Playwright: pull a development OIDC token into the scratchpad (`vercel env pull <file> --environment development --project itstart-ro --scope owd --yes`) and add `x-vercel-trusted-oidc-idp-token` with `page.route` on the deployment's origin only.
  - Crawlers can't see production while Vercel Authentication is on, so real link previews (WhatsApp, Facebook, LinkedIn) can't be tried there yet; say so rather than working around it.
- **Blob works on deploys.** The browser uploads to `incoming/` through `/api/capturi/token`, and `/api/capturi` resizes into `capturi/`. Locally the local adapter stays, since the store refuses a local machine's writes (DECISIONS, "Blob adapter").

What the last session did (DECISIONS, "Share image and Open Graph tags"):

- **Image:** one 1200×630 card (screen 10's, scaled) drawn by `next/og` from the page's data in the light theme's tokens, for a project, a challenge, a profile, a question and the site's default. Static ttf instances of the brand fonts (`scripts/share-fonts.py`), since `next/og` reads no woff2 or variable axes; the builder's picture goes in as a PNG (Satori fails on webp).
- **Routes:** `…/imagine` next to each page, `?v=<hash of the card>` cached a year (without it five minutes), `&descarca` downloads. The site's default is `app/opengraph-image.tsx`.
- **Tags:** `shareMetadata()` (`server/share-image/version.ts`) on 04, 02/11, 05 and a question's page; `metadataBase` from the request (`server/origin.ts`).
- **Screen 10:** the card (`ShareCardPreview`, the PNG's own JSX in the reference's sizes), "Descarcă imaginea" and the hint; `flags.shareImage` on by itself. The section lines up to the pixel; 10's gaps are 162/179px (the M3 contact section). M1 is 11/40 `match`.
- **No migration.** 217 core tests, 20 web.

## Running it

- **Database:** `orb start`, then `docker start pg-itstart`. Run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset`. Always reseed after trying forms.
- **Dev server:** `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`.
  - If 3000 is taken, see what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`). A leftover `next dev` or `next-server` from this project can be stopped; for anything else, tell me.
  - Through 2026-11-17 it was `~/code/owd/onepage.ro`'s server, so work ran on 3001: `DESIGN_FIXTURES=1 BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001`, with `--base http://localhost:3001` for `capture.mjs`.
  - Run `capture.mjs` from `docs/`: `node tools/capture.mjs app --only 10 --base …`.
- **Fixtures mode** freezes core's clock at 2026-11-11: `cafenea` (#3) has ended and `frizerie` (#4) runs.
  - Flows with new accounts need the real clock (ARCHITECTURE, gotchas).
  - The admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`). A new account becomes admin with `pnpm --filter @repo/db admin:set <e-mail> admin`.
  - Fixture projects' live links are `https://*.example`-style addresses that `withExampleHosts()` answers in fixtures mode; a scheduled check must not fetch them for real.
- **Playwright** is a root dev dependency. A `.cjs` script can `require(require.resolve("playwright", { paths: [<repo root>] }))`.
  - When checking long (Hungarian) text, append it **after** the page hydrates. Before that, React re-renders the original text and Next's dev overlay counts the mismatch as issues.
  - Don't grep a page's HTML for copy: the RSC payload carries every message in `ro.json`. Read the DOM in Playwright instead.
- **Formatting:** format only the files you touch, and check the diff. Prettier reflows lines in files that weren't formatted before; keep only your change.
- **Before `next build`,** stop the dev server you started (by its task, not `pkill`): both use `.next`.

## Still waiting on the owner (NEXT-ACTIONS)

- **Most urgent:**
  - Neon preview branches (previews write to production);
  - deleting the Blob test account from production.
- **GitHub and Vercel:** protecting `main`; the stray `web` project; Neon's compute settings; Vercel's Web Analytics, deployment protection and the `itstart.ro` domain.
- **Sign-in and e-mail:** Resend; the Google and GitHub OAuth apps; the first real admin; the e-mails that wait for Resend (now including "someone answered your question").
- **Content:** the legal pages.
- **Looks over** screen 11's and screen 12's calls (`echipa@itstart.ro` included), the questions thread's and the share image's. Nothing waits on them.
- **A real link preview** once crawlers can reach production.
- **After 30 November:** #4's recognitions.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. Push the branch and open a PR to `main` (the `pr` skill has the body's template). When `check` and the `itstart-ro` preview pass, merge it yourself as a merge commit; never push to `main` directly. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope:

- magic link, and Google and GitHub in the UI;
- the rest of M2, the session after this one: "Raportează" and moderation (hiding questions, answers and reviews included; a hidden project's share image should 404);
- M3 and the review agent;
- every e-mail, and the Resend adapter;
- anything that needs OAuth apps or Resend.

Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
