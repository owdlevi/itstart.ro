# Next actions for the owner

Things only the product owner can do: accounts, secrets, settings and decisions. Agents: read this to know what isn't set up yet, and don't work around a missing item. Tick items off here (or delete them) as they're done, and record any decision in `DECISIONS.md`.

State on 2026-11-17: everything through screen 11 is on GitHub's `main` (`owdlevi/itstart.ro`, PR #1) and deployed to production on Vercel (`itstart-ro` in the `owd` team, https://itstart-ro.vercel.app, behind Vercel Authentication), with Neon (`itstart-db`) and Blob (`itstart-ro-blob`). Sign-in is email and password for now (DECISIONS, "Email and password for now"), and no e-mails are sent.

## Now

- [x] **CI on GitHub:** checked 2026-11-17: `main` on GitHub has `screen-01-groundwork` (screen 01 and `.github/workflows/ci.yml`), and its CI run passed. SSH to GitHub works (`git fetch` over `git@github.com:`).
- [ ] **GitHub:** protect `main` (checked 2026-11-17: not protected): require PRs and require the `check` job.
- [ ] **A second Vercel project builds this repo:** `web`, in your personal scope (`dozsa-david-leventes-projects`), was created on 2026-11-14 and is connected to `owdlevi/itstart.ro`. Every push builds it too, and it fails (no database), so each PR shows a red "Vercel – web" check. ITStart's project is `itstart-ro` in `owd`. Disconnect or delete `web` if it isn't needed; the agent left it alone.
- [x] **Push the rest:** PR #1 merged on 2026-11-17 (a merge commit, so each change keeps its commit). New work branches from `main` and goes up as a PR.
- [ ] **Look over screen 11's calls** (decided by the agent under "if in doubt you can decide"; nothing waits on this): a project gets at most one recognition; the community's pick is suggested from the votes (a tie goes to the earlier launch), not set automatically; "Cel mai votat agent AI" shows without waiting for M3's agents; the band's line uses the running challenge's title; new copy, including "Juriul alege recunoașterile în zilele de după termen. Le găsești aici." DECISIONS, "Screen 11 and recognitions". Say if any should change.
- [ ] **Before 30 November:** enter #4's recognitions at `/admin/provocari/frizerie/recunoasteri` once the month ends; until then screen 11 says the jury is choosing.
- [x] **Every open call accepted or decided** (owner, 2026-11-16: "accept all, if in doubt you can decide"): screen 10, the admin's challenges, profile editing, the vote timeline and the M1 pass's copy as built; the agent decided vote abuse (seeing only), zero counts (kept), a way back to the assignments (built), Neon cleanup (the integration only, no GitHub secret), unused screenshots (after M1), OAuth on previews (none) and passwords (removed once magic link is on). DECISIONS, "Owner accepted the open calls".
- [x] **Screens 01–09 accepted as built** (owner, 2026-11-15): every copy review and confirmation for them, and each open "keep it or change it" call, settled as the screens are now. DECISIONS, "Owner accepted screens 01–09".

## First deploy (done 2026-11-17)

- [x] **Neon:** `itstart-db`, Free plan, `fra1` (Frankfurt, Neon's `eu-central-1`), created through Vercel's Neon integration with Neon Auth off (Better Auth is ours), connected to `itstart-ro` for Production, Preview and Development. It injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- [ ] **Neon settings to check in its dashboard** (the CLI can't show them): whether previews get their own database branch (ARCHITECTURE says they do; PR #1's preview migrated before production and both worked, which fits either way), "Automatically delete obsolete Neon branches", and a compute cap of 0.25–0.5 CU so previews can't use up production's hours.
- [x] **Vercel:** `itstart-ro` in `owd`, root directory `apps/web`, production branch `main`. `apps/web/vercel.json` holds the build command (migrate over the unpooled URL, then `turbo run build --filter=web`) and the region (`fra1`). Env vars: `BETTER_AUTH_SECRET` (a different one for Production and Preview), `BETTER_AUTH_URL=https://itstart-ro.vercel.app` (Production only: previews take it from the request), Neon's and Blob's. `DESIGN_FIXTURES` is not set anywhere.
- [ ] **Vercel, left for you:** turn on Web Analytics; decide on Vercel Authentication (on for every deployment except custom domains, so `itstart-ro.vercel.app` asks for a Vercel login); add `itstart.ro` as the domain, then change `BETTER_AUTH_URL` to it.
- [x] **Vercel Blob:** `itstart-ro-blob` (`store_5WehGYs4hW4iCOOf`), public, `fra1`, connected to `itstart-ro` for Production and Preview. The adapter is built (PR #3, DECISIONS "Blob adapter"): deploys take screenshots and profile pictures. The token in `apps/web/.env.local` is refused for writes from a local machine, so local work keeps the local adapter.
- [ ] **Previews write to production's database.** `DATABASE_URL` is one variable for Production, Preview and Development, so every preview reads and writes production's data, and a PR's migration runs on production as soon as its preview builds, before the merge. Turn on Neon's preview branches in the integration (one branch per preview deployment), or give Preview its own database URL. Until then, agents avoid migrations a preview could break production with, and try previews knowing the data is real.
- [ ] **Delete the Blob test from production** (the agent wasn't allowed to touch production's rows): the user "Test Blob" (`/u/test-blob`, `blob-…@example.com`), their project in progress "Blob 64989", and its three files in `itstart-ro-blob` under `capturi/` (`75d7579e-…`, `e6c858ce-…`, `eae24050-…`).
- [ ] **First real admin:** after you sign up once on https://itstart-ro.vercel.app/intra, run `pnpm --filter @repo/db admin:set <your e-mail> admin` with `packages/db/.env.local` pointing at production's unpooled URL.

## Before public launch: sign-in as decided

Email and password has no verification and no reset, so it's for building and testing only.

- [ ] **Resend (Pro):** add and verify the sending domain (DKIM, SPF) in `eu-west-1`, pick the no-reply sender and the reply-to address, and create an API key. Then an agent can write the Resend adapter, turn magic link on, and remove passwords (DECISIONS, "Owner accepted the open calls").
- [ ] **Google OAuth client** (Google Cloud console): redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://itstart.ro/api/auth/callback/google`. Add `GOOGLE_CLIENT_ID`/`SECRET` to Vercel.
- [ ] **GitHub OAuth App:** callback `…/api/auth/callback/github`. GitHub allows one callback per OAuth App, so create one for local and one for production. If you create a GitHub App instead, give it "Email addresses: Read-only". Add `GITHUB_CLIENT_ID`/`SECRET` to Vercel.
- [ ] **E-mails that wait for Resend:** the new-review e-mail (screen 10's closing line promises it) and the review-assignment reminder 48 hours after a launch (§11.3–4). Rule 16's assignments are in the database already, so the reminder needs only the adapter and a workflow.
- [ ] **Legal pages** (HANDOVER §13.8): the privacy policy must name Resend as a US processor of e-mail data.

## After the first preview deploy

- [ ] Work through "Verify during M1 setup" in `DECISIONS.md` (Neon preview URLs at build time, sharp on a 5 MB image, a Resend test send, the Base UI confirm dialog).
- [ ] Check the client-IP header Vercel sends, so Better Auth's per-IP limit doesn't put everyone in one bucket (research 02, §8).
