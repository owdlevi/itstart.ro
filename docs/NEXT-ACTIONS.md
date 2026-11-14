# Next actions for the owner

Things only the product owner can do: accounts, secrets, settings and decisions. Agents: read this to know what isn't set up yet, and don't work around a missing item. Tick items off here (or delete them) as they're done, and record any decision in `DECISIONS.md`.

State on 2026-11-14: the code is on GitHub (`owdlevi/itstart.ro`). The M1 foundation (database, Better Auth, composition root, local environment) is on `feat/m1-foundation`, which isn't merged yet.

## Now

- [ ] **Merge the foundation.** Open a PR from `feat/m1-foundation` into `main` and merge it. It also carries `docs/session-handoff`. The next agent session starts from `main`.
- [ ] **Free port 3000 for `pnpm dev`.** An SSH tunnel on this Mac listens on `localhost:3000`, so the dev server is only reachable on the LAN IP while it runs. Better Auth expects `http://localhost:3000` (`BETTER_AUTH_URL`).

## Decisions needed

- [ ] **OAuth on preview deploys.** Google and GitHub need fixed redirect URIs, but previews get a new `*.vercel.app` URL each time. The options are Better Auth's `oauth-proxy` plugin (one registered URI, proxied to previews) or magic link only on previews. `trustedOrigins` also has to allow the preview hosts.
- [ ] **Neon branch cleanup needs a GitHub secret.** `neondatabase/delete-branch-action` needs a Neon API key in GitHub, but DECISIONS says "GitHub holds no app secrets". Allow this one secret, or rely only on the integration's auto-delete.

## Accounts and settings

- [ ] **GitHub:** once the next session adds the CI workflow (`pnpm lint`, `pnpm check-types`, `pnpm test`), protect `main`: require PRs and require that check.
- [ ] **Neon:** create a project in `eu-central-1` (Free plan). Connect it to Vercel with the Neon-Managed integration. Turn on "Automatically delete obsolete Neon branches", and cap compute at 0.25–0.5 CU so previews can't use up production's 100 CU-hours.
- [ ] **Vercel (Pro):**
  - Import the repo with root directory `apps/web` and function region `fra1`.
  - Build command: `pnpm --filter @repo/db db:migrate && turbo run build --filter=web`. The migration runs outside turbo's cache, over the unpooled URL.
  - Env vars for Production and Preview: `BETTER_AUTH_SECRET` (`openssl rand -base64 32`, a different one per environment), `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET`. Set `DESIGN_FIXTURES=1` on Preview only, if previews should show the fixtures. Neon injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
  - Turn on Web Analytics.
- [ ] **Google OAuth client** (Google Cloud console): redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://itstart.ro/api/auth/callback/google`.
- [ ] **GitHub OAuth App:** callback `…/api/auth/callback/github`. GitHub allows one callback per OAuth App, so create one for local and one for production. If you create a GitHub App instead, give it "Email addresses: Read-only".
- [ ] **Resend (Pro):** add and verify the sending domain (DKIM, SPF) in `eu-west-1`, pick the no-reply sender and the reply-to address, and create an API key. Then an agent can write the Resend adapter.
- [ ] **First real admin:** after you sign in once on production, run `pnpm --filter @repo/db admin:set <your e-mail> admin` with `packages/db/.env.local` pointing at production's unpooled URL.

## After the first preview deploy

- [ ] Work through "Verify during M1 setup" in `DECISIONS.md` (Neon preview URLs at build time, sharp on a 5 MB image, a Resend test send, the Base UI confirm dialog).
- [ ] Check the client-IP header Vercel sends, so Better Auth's per-IP limit doesn't put everyone in one bucket (research 02, §8).
