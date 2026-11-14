# Next actions for the owner

Things only the product owner can do: accounts, secrets, settings and decisions. Agents: read this to know what isn't set up yet, and don't work around a missing item. Tick items off here (or delete them) as they're done, and record any decision in `DECISIONS.md`.

State on 2026-11-14: `main` on GitHub (`owdlevi/itstart.ro`) has the M1 foundation: database, Better Auth, composition root and local environment. Sign-in is email and password for now (DECISIONS, "Email and password for now"), so local work needs no outside accounts.

## Now

- [ ] **Decide: "Un minut. Fără parolă."** under the join button on screen 02 (and 08). It's the reference copy, but it isn't true while sign-in is email and password. Keep it, or change it until magic link is back?
- [ ] **Free port 3000 for `pnpm dev`.** An SSH tunnel on this Mac listens on `localhost:3000`, so the dev server is only reachable on the LAN IP while it runs. Better Auth expects `http://localhost:3000` (`BETTER_AUTH_URL`). On the LAN IP, Next 16 also blocks its dev resources, so pages render but never hydrate: buttons (voting, later the forms) do nothing under `pnpm dev`. Agents worked around it with `next build && next start`.
- [ ] **Let `gh` push workflow files:** run `gh auth refresh -h github.com -s workflow`. Without the `workflow` scope GitHub rejects any push that touches `.github/workflows/`, so the `screen-01-groundwork` branch (which adds CI) can't be pushed yet. The owner is pushing it by hand; `screen-02-provocare` is branched from it and goes up after it.
- [ ] **Let plain `git push` work:** run `gh auth setup-git` once. HTTPS has no credential helper yet, and SSH fails GitHub's host-key check.
- [ ] **GitHub:** once the CI workflow (`.github/workflows/ci.yml`, on the `screen-01-groundwork` branch) is on `main`, protect `main`: require PRs and require the `check` job.
- [ ] **Decide: Home's "Cele mai votate săptămâna asta"** (HANDOVER §13.1). It shows the top 3 of the running challenge. Keep the heading, or change it to "Cele mai votate luna asta"?
- [ ] **Review the vote refusal copy** in DECISIONS, "Screen 01 build" (it has no reference design).

## Before the first deploy

- [ ] **Neon:** create a project in `eu-central-1` (Free plan). Connect it to Vercel with the Neon-Managed integration. Turn on "Automatically delete obsolete Neon branches", and cap compute at 0.25–0.5 CU so previews can't use up production's 100 CU-hours.
- [ ] **Decide: Neon branch cleanup needs a GitHub secret.** `neondatabase/delete-branch-action` needs a Neon API key in GitHub, but DECISIONS says "GitHub holds no app secrets". Allow this one secret, or rely only on the integration's auto-delete.
- [ ] **Vercel (Pro):**
  - Import the repo with root directory `apps/web` and function region `fra1`.
  - Build command: `pnpm --filter @repo/db db:migrate && turbo run build --filter=web`. The migration runs outside turbo's cache, over the unpooled URL.
  - Env vars for Production and Preview: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`, a different one per environment) and `BETTER_AUTH_URL`. Set `DESIGN_FIXTURES=1` on Preview only, if previews should show the fixtures. Neon injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
  - Turn on Web Analytics.
- [ ] **First real admin:** after you sign up once on production, run `pnpm --filter @repo/db admin:set <your e-mail> admin` with `packages/db/.env.local` pointing at production's unpooled URL.

## Before public launch: sign-in as decided

Email and password has no verification and no reset, so it's for building and testing only.

- [ ] **Resend (Pro):** add and verify the sending domain (DKIM, SPF) in `eu-west-1`, pick the no-reply sender and the reply-to address, and create an API key. Then an agent can write the Resend adapter and turn magic link on.
- [ ] **Google OAuth client** (Google Cloud console): redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://itstart.ro/api/auth/callback/google`. Add `GOOGLE_CLIENT_ID`/`SECRET` to Vercel.
- [ ] **GitHub OAuth App:** callback `…/api/auth/callback/github`. GitHub allows one callback per OAuth App, so create one for local and one for production. If you create a GitHub App instead, give it "Email addresses: Read-only". Add `GITHUB_CLIENT_ID`/`SECRET` to Vercel.
- [ ] **Decide: OAuth on preview deploys.** Previews get a new `*.vercel.app` URL each time, but OAuth apps need fixed redirect URIs. The options are Better Auth's `oauth-proxy` plugin (one registered URI, proxied to previews) or no provider sign-in on previews. `trustedOrigins` also has to allow the preview hosts.
- [ ] **Decide: what happens to passwords** when magic link and OAuth come back: keep them (adding verification and reset) or remove them. DECISIONS, "Email and password for now", lists what breaks for unverified password users.
- [ ] **Legal pages** (HANDOVER §13.8): the privacy policy must name Resend as a US processor of e-mail data.

## After the first preview deploy

- [ ] Work through "Verify during M1 setup" in `DECISIONS.md` (Neon preview URLs at build time, sharp on a 5 MB image, a Resend test send, the Base UI confirm dialog).
- [ ] Check the client-IP header Vercel sends, so Better Auth's per-IP limit doesn't put everyone in one bucket (research 02, §8).
