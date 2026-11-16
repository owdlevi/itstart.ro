# Next actions for the owner

Things only the product owner can do: accounts, secrets, settings and decisions. Agents: read this to know what isn't set up yet, and don't work around a missing item. Tick items off here (or delete them) as they're done, and record any decision in `DECISIONS.md`.

State on 2026-11-16 (screens 02 and 03 built locally on `screen-02-provocare`, screen 04 on `screen-04-proiect`, branched from it, screen 05 on `screen-05-profil`, branched from that, screen 06 on `screen-06-intra`, branched from that, screen 07 on `screen-07-bun-venit`, branched from that, screen 08 on `screen-08-inscris`, branched from that, screen 09 on `screen-09-lanseaza`, branched from that, screen 10 on `screen-10-lansat`, branched from that, the admin's challenges on `admin-challenges`, branched from that, profile editing and the admin's vote timeline on `profile-edit`, branched from that, and an M1 end-to-end pass with its fixes on `m1-pass`, branched from that): `main` on GitHub (`owdlevi/itstart.ro`) has the M1 foundation: database, Better Auth, composition root and local environment. Sign-in is email and password for now (DECISIONS, "Email and password for now"), so local work needs no outside accounts.

## Now

- [ ] **Let `gh` push workflow files:** run `gh auth refresh -h github.com -s workflow`. Without the `workflow` scope GitHub rejects any push that touches `.github/workflows/`, so the `screen-01-groundwork` branch (which adds CI) can't be pushed yet. The owner is pushing it by hand; `screen-02-provocare` is branched from it and goes up after it.
- [ ] **Let plain `git push` work:** run `gh auth setup-git` once. HTTPS has no credential helper yet, and SSH fails GitHub's host-key check.
- [ ] **GitHub:** once the CI workflow (`.github/workflows/ci.yml`, on the `screen-01-groundwork` branch) is on `main`, protect `main`: require PRs and require the `check` job.
- [x] **Every open call accepted or decided** (owner, 2026-11-16: "accept all, if in doubt you can decide"): screen 10, the admin's challenges, profile editing, the vote timeline and the M1 pass's copy as built; the agent decided vote abuse (seeing only), zero counts (kept), a way back to the assignments (built), Neon cleanup (the integration only, no GitHub secret), unused screenshots (after M1), OAuth on previews (none) and passwords (removed once magic link is on). DECISIONS, "Owner accepted the open calls".
- [x] **Screens 01–09 accepted as built** (owner, 2026-11-15): every copy review and confirmation for them, and each open "keep it or change it" call, settled as the screens are now. DECISIONS, "Owner accepted screens 01–09".

## Before the first deploy

- [ ] **Neon:** create a project in `eu-central-1` (Free plan). Connect it to Vercel with the Neon-Managed integration. Turn on "Automatically delete obsolete Neon branches", and cap compute at 0.25–0.5 CU so previews can't use up production's 100 CU-hours.
- [ ] **Vercel (Pro):**
  - Import the repo with root directory `apps/web` and function region `fra1`.
  - Build command: `pnpm --filter @repo/db db:migrate && turbo run build --filter=web`. The migration runs outside turbo's cache, over the unpooled URL.
  - Env vars for Production and Preview: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`, a different one per environment) and `BETTER_AUTH_URL`. Set `DESIGN_FIXTURES=1` on Preview only, if previews should show the fixtures. Neon injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
  - Turn on Web Analytics.
- [ ] **Vercel Blob:** _2026-11-15: the owner has a store, `onepage-media`, and `BLOB_READ_WRITE_TOKEN` is in `apps/web/.env.local`. Check before relying on it: the name suggests onepage.ro's store; ITStart's should be its own, public, in `fra1`, and connected to this project for Production and Preview. To unblock: create ITStart's own store (or say `onepage-media` is it), put its token in `apps/web/.env.local`, and tick this; "accept all" on 2026-11-16 didn't cover it, since it's a fact about the account, not a call._ Then an agent can write the Blob adapter: the upload-token route, the browser upload in `ScreenshotPicker`, sharp → webp after the upload, and `owns()` for the store's URL. Until then a deploy refuses screenshot uploads ("Aici nu se pot încărca imagini încă."); locally, files go to `apps/web/.data/capturi`.
- [ ] **First real admin:** after you sign up once on production, run `pnpm --filter @repo/db admin:set <your e-mail> admin` with `packages/db/.env.local` pointing at production's unpooled URL.

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
