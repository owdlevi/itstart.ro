# Next session: before the first public challenge

Paste everything below the line into a fresh session.

---

M1 and M2 are built: every screen from 01 to 12, recognitions, the archive, questions and answers, the share image, the link checker, and "Raportează" with the moderation queue (PR #8). Everything is on GitHub's `main` and deployed to production on Vercel. What's left before the first public challenge is mostly the owner's (accounts, content, settings); this session does the agent's part of it.

**Check `docs/NEXT-ACTIONS.md` first.** If the owner has set up Resend (a verified sending domain and an API key), the session is **sign-in as decided and the e-mails** instead: the Resend adapter, magic link in the UI, removing passwords (DECISIONS, "Owner accepted the open calls"), and §11's e-mails. If the OAuth apps exist too, Google and GitHub. Plan that from HANDOVER §11 and DECISIONS "Sign-in" before starting, and stop here.

Otherwise, a **launch-readiness pass**:

- **Romanian error pages:** there's no `not-found.tsx` or `error.tsx`, so every 404 (an unknown slug, a hidden project, a hidden question) shows Next's English "This page could not be found." Add both in the site's shell, with copy from `ro.json` (no reference design: decide it, record it, list the copy for the owner), and a `global-error.tsx`. Read Next 16's docs in `node_modules/next/dist/docs/` first.
- **Performance (HANDOVER §2.7):** LCP under 2.5 s on a mid-range phone on 4G, and as little JS as the stack allows on content pages. Measure 01, 02, 03 and 04 with Lighthouse (mobile, throttled) on `next build && next start`, and fix what's ours. Record the numbers in DECISIONS.
- **Accessibility (HANDOVER §10, WCAG 2.2 AA):** an axe run over every screen in both themes, signed in and out, fixing what it finds; the skip link, landmarks and headings on the admin pages too.
- **"Verify during M1 setup"** in DECISIONS: what can be checked without Resend (the Base UI confirm on a preview, read-only).

Read first: `AGENTS.md` and every doc it points to, and `docs/NEXT-ACTIONS.md` above all. Every stack decision is final. If something truly isn't decided, decide it, record why in `docs/DECISIONS.md`, and list it for me at the end (the owner said "if in doubt you can decide").

## Read this before any migration

**Previews write to production's database** (found 2026-11-17, NEXT-ACTIONS). `DATABASE_URL` is one variable for Production, Preview and Development, so a PR's preview build runs its migration on production **before the merge**, and anything you try on a preview is real production data.

- Check NEXT-ACTIONS first: if the owner has turned on Neon's preview branches, this no longer applies.
- If not, keep any migration additive: it must work on production's data as it is, and be harmless to `main`'s code until the merge.
- Don't sign up, post or report on a preview; try it locally. If a flow has to be tried deployed, say so to the owner first.

## State on 2026-11-18

- **GitHub:** `owdlevi/itstart.ro`. `main` has everything through moderation (PR #7 the link checker, PR #8 moderation, merge commits). `main` isn't protected yet. Work on a branch from `main` and open one PR.
- **CI (`check`) and the `itstart-ro` preview must pass before you merge.** The "Vercel – web" check fails on every PR: a second Vercel project in the owner's personal scope with no database (NEXT-ACTIONS). Ignore it.
- **Production:** https://itstart-ro.vercel.app, behind Vercel Authentication. It migrates in the build (`apps/web/vercel.json`); `turbo.json` declares the build's env (strict mode).
  - From the terminal: `vercel curl <url> --scope owd --yes`.
  - From Playwright: pull a development OIDC token into the scratchpad (`vercel env pull <file> --environment development --project itstart-ro --scope owd --yes`) and add `x-vercel-trusted-oidc-idp-token` with `page.route` on the deployment's origin only.
- **The hourly link check** needs `CRON_SECRET` in Vercel's Production env, which the owner adds. Don't add it yourself.

What the last session did (DECISIONS, "Raportează and moderation"):

- **Reporting:** 04's link (to the pixel) goes to `/proiecte/<slug>/raporteaza`: signed in, not the owner or an agent, six reasons, details required for "Altceva", one open report per person and project, 5 an hour. The owner isn't told.
- **Moderation:** `/admin/moderare` (open reports by project: hide, or resolve), `/recente` (the newest 40 reviews, replies, questions and answers) and `/ascunse` (show again). Core's `moderation` module; migration `0011_moderation` (`reports`, `projects.hidden`).
- **Hidden:** a project leaves every list, count, recognition, assignment and the link checker; its page and share image are 404s except to its owner (a notice) and admins. A hidden review takes its replies from every count (`reviews/visible.ts`).
- `MILESTONE` is 2. M1 capture: 11/40 `match`; 04's phone gap is 108px (only the M3 section). 248 core tests (17 new), 20 web.

## Running it

- **Database:** `orb start`, then `docker start pg-itstart`. Run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset`. Always reseed after trying forms.
- **Dev server:** `DESIGN_FIXTURES=1 BETTER_AUTH_URL=http://localhost:<port> pnpm next dev --port <port>` in `apps/web`, with `--base http://localhost:<port>` for `capture.mjs`.
  - **Ports are crowded on this machine.** An SSH tunnel (not this project's) has listened on `127.0.0.1:3000–3015`, and other projects' servers sit on 3000 and 3100. Check a port with `lsof -nP -iTCP:<port> -sTCP:LISTEN` first, leave the others alone, and pick a free one (3217 was free on 2026-11-18).
  - Run `capture.mjs` from `docs/`: `node tools/capture.mjs app --only 04 --base …`. Heights in its table are device pixels (phones at scale 2): divide by 2.
- **Fixtures mode** freezes core's clock at 2026-11-11: `cafenea` (#3) has ended and `frizerie` (#4) runs.
  - Flows with new accounts need the real clock (ARCHITECTURE, gotchas).
  - The admin is `echipa-itstart` (`/dev/login-as/echipa-itstart`). A new account becomes admin with `pnpm --filter @repo/db admin:set <e-mail> admin`.
- **Playwright** is a root dev dependency. A `.cjs` script can `require(require.resolve("playwright", { paths: [<repo root>] }))`.
  - Append long (Hungarian) text **after** hydration, and read copy from the DOM, not the HTML (the RSC payload carries every message).
  - `page.waitForURL("**/proiecte/x**")` also matches `/proiecte/x/raporteaza`: wait for something only the next page has (a query flag).
- **Formatting:** format only the files you touch, and check the diff.
- **Before `next build`,** stop the dev server you started (by its task, not `pkill`): both use `.next`.

## Still waiting on the owner (NEXT-ACTIONS)

- **Most urgent:** Neon preview branches (previews write to production); `CRON_SECRET` on Vercel; deleting the Blob test account from production.
- **Before public launch:** Resend and the OAuth apps (sign-in as decided, every e-mail); the first real admin; the legal pages and the footer's Despre, Reguli and Contact (404s now); the `itstart.ro` domain, deployment protection off, Web Analytics; protecting `main`; the stray `web` project; Neon's compute settings.
- **Looks over** the agent's calls: screens 11 and 12 (`echipa@itstart.ro` included), questions, the share image, the link checker, moderation. Nothing waits on them.
- **A real link preview** once crawlers can reach production.
- **After 30 November:** #4's recognitions.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. Push the branch and open a PR to `main` (the `pr` skill has the body's template). When `check` and the `itstart-ro` preview pass, merge it yourself as a merge commit; never push to `main` directly. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: M3 and the review agent; anything that needs Resend or the OAuth apps unless NEXT-ACTIONS says they exist. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
