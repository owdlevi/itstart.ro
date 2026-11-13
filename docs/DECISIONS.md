# Decisions

Judgment calls made during the build (HANDOVER §2.9): what was unclear, what was chosen, why.

## 2026-11-13 · Server code layout

- **Unclear:** where business rules, database code and the API live in a Turborepo with a Next.js backend.
- **Chosen:** `@repo/db` (Drizzle) ← `@repo/core` (rules as deep modules) ← `apps/web` (thin adapters). Details in `ARCHITECTURE.md`.
- **Why:** §5 requires rules enforced on the server and tested one by one. Keeping them in `core`, behind small interfaces, means every client gets the same enforcement and the tests need no HTTP or Next runtime.
- **Revised the same day:** no Vite app for now, so no `@repo/contracts` either. Admin is a route group inside `apps/web`. A shared-schema package is created only when an HTTP client app appears.

## 2026-11-13 · Tests run on PGlite

- **Chosen:** core tests use an in-memory PGlite with real migrations, instead of mocks or the Docker Postgres.
- **Why:** it's real Postgres semantics (constraints, transactions, `gen_random_uuid`) with no running container, so tests are isolated and run anywhere, CI included.

## 2026-11-13 · Vote anti-abuse defaults (rule 14)

- **Chosen:** account must be 24 h old; at most 30 vote toggles (casts and retractions both count) per 10 minutes per user. Every toggle is appended to `vote_events`, which also backs the admin vote timeline.
- **Why:** counting only current votes would let cast/retract cycles bypass the limit. The numbers are placeholders, configurable through `VotesConfig`.

## 2026-11-13 · Stack (HANDOVER §13.7)

Decided by the product owner. Final. Each line: what, why, and the alternative turned down.

| Area | Chosen | Why | Not chosen |
|---|---|---|---|
| Hosting | Vercel **Pro**, region `fra1` | Next.js host with EU region; ITStart is commercial, and Hobby is non-commercial only | Vercel Hobby |
| Database | Postgres on **Neon** `eu-central-1`, Drizzle ORM | EU region, branch per preview, free tier fits M1 | Docker Postgres in production |
| DB driver | `pg` (node-postgres) on Neon's **pooled** URL, `attachDatabasePool` | Supports `db.transaction`, which `votes.toggle` needs | `drizzle-orm/neon-http`: type-checks but throws on transactions |
| Migrations | `drizzle-kit migrate` in the Vercel build, over the unpooled URL | Schema and code ship together | Migrating by hand |
| Auth | **Better Auth** 1.7.22: magic link, Google, GitHub; users in our Neon | Users stay in our EU database, Drizzle adapter, `testUtils` for dev login | Hosted auth (US data) |
| E-mail | **Resend Pro**, sending from `eu-west-1`, React Email templates | Developer experience and React Email (see the EU exception below) | AWS SES `eu-central-1`, Scaleway TEM, Brevo |
| Files | **Vercel Blob** (public store, `fra1`) + **sharp** → webp | Same vendor; the browser uploads directly | Uploads through a server action (Vercel's 4.5 MB body cap) |
| Background jobs | **Vercel Workflow** in `fra1`, inside `apps/web` | EU, no new vendor, durable `sleep` for reminders | Trigger.dev, Inngest (US data); see ADR 0002 |
| Styling | **Tailwind v4**, tokens as CSS variables; fonts via `next/font/local` | Matches `docs/design/notes/nextjs-tailwind.md`; local fonts per HANDOVER §2.3 | `next/font/google` |
| Primitives | **shadcn on Base UI**, our tokens replace its theme | Base UI is shadcn's default and stable | Radix |
| i18n | **next-intl** without i18n routing, fixed `ro` locale | Copy in `messages/ro.json`; Hungarian later without a rewrite | Hard-coded strings |
| Forms | **react-hook-form** + **zod** (`@hookform/resolvers`); the server action re-parses with the same schema | HANDOVER §2.8 | |
| Icons | lucide-react | | |
| Analytics | Vercel Web Analytics | Cookieless, so no cookie notice (rule 24) | |
| Error tracking | none in M1 | Sentry deferred to v2 by the owner | Sentry |

## 2026-11-13 · EU data residency, and its exceptions

- **Rule:** wherever an EU option exists, use it. A US processor is allowed only when no EU option exists, and it's recorded here with the reason. See ADR 0001.
- **Exception: Resend stores e-mail data in the US.** Sending happens from `eu-west-1`, but recipient addresses, message content and delivery logs are stored in the US, and no plan offers EU storage. The legal basis is Resend's GDPR Art. 28 DPA, Standard Contractual Clauses and the EU-US Data Privacy Framework. EU providers do exist; the owner chose Resend's developer experience and React Email over switching.
  - The privacy policy (Confidențialitate) must name Resend as a US processor of e-mail data.
  - Keep e-mail content minimal: links and short excerpts, never full reviews.
  - Revisit if Resend adds EU storage.
- **Exception: Vercel Workflow hook records default to `iad1`.** These are small metadata records, with no payloads. Run data is pinned to `fra1`.
- **Paid vendors in M1:** Vercel Pro (an existing vendor) and Resend Pro ($20/month, 50,000 e-mails/month, no daily cap). Resend is M1's one extra paid vendor.

## 2026-11-13 · Review agent moved out of M1

- **Unclear:** HANDOVER §3 lists "one AI review agent" under M1.
- **Chosen:** the owner moved the review agent ("Părere automată", §12) out of M1.
- **Planned design for when it's built:** the Claude Agent SDK with a Console API key, Playwright MCP limited to browser tools, `claude-opus-5-5` at medium effort, run inside Vercel Sandbox in `fra1` and started by a workflow. Details in `.scratch/stack/issues/04-review-agent-agent-sdk.md`.
- **Consequence:** M1 needs no Sandbox, no Agent SDK and no Anthropic key.
- **Expected `capture.mjs` difference:** screen 04's reference PNGs show a "Părere automată" review. Until the agent ships, screen 04 reports `differs` there, and that's expected.

## 2026-11-13 · Sign-in

- **Link lifetime:** `expiresIn: 900` (15 minutes; Better Auth's default is 5). Links are single use, and sending a new link doesn't cancel the old one.
- **Link scanners:** the e-mail links to our own confirm page (`/intra/confirma?token=…`) with one "Intră în ITStart" button that verifies the token. A scanner that pre-fetches the URL (e.g. Outlook Safe Links) would otherwise use up the link.
- **Users table:** product fields live on Better Auth's `user` table, with defaults and `input: false`, so clients can't set `role` or `isAgent`. Store tokens hashed (`storeToken: "hashed"`).
- **Provider e-mails:** e-mails from Google and GitHub are marked verified. Otherwise a later magic-link sign-in deletes the provider links.
- **Dev login:** `/dev/login-as/<handle>` uses Better Auth's `testUtils` plugin, only when `DESIGN_FIXTURES=1`.

## 2026-11-13 · Rate limits live in Postgres

- **Chosen:** every limit is counted in Postgres, with no Redis. Each core module counts the rows that already record the action, so the rows double as an audit trail.
  - **Sign-in links, per address:** 1 per 30 s and 5 per hour, counted from `sign_in_link_sends` (e-mail, sent_at) inside `sendMagicLink`, before Resend is called.
  - **Sign-in links, per IP:** Better Auth's limiter (default 5 per 60 s) with `rateLimit.storage: "database"`. The `/intra` form calls the HTTP endpoint (`authClient.signIn.magicLink`), because `auth.api` calls skip the limiter.
  - **Votes:** see "Vote anti-abuse defaults" above.
  - **Reviews and replies:** 10 per hour per user, counted together, refused with reason `rate_limited`. The numbers are in core config.
  - **Contact form (M3):** same pattern, per sender and per recipient. Numbers are decided in M3.
- **Why:** traffic is small, and Neon is already on every request. Better Auth's built-in limiter keys on IP + path only and stores counts in memory by default, which doesn't work on Vercel.

## 2026-11-13 · Admins

- **Chosen:** `pnpm --filter @repo/db admin:set <email> admin|member` grants and removes admins against a database's unpooled URL. The person must have signed in once. There's no env list and no admin-management screen.
- **No jury role:** `role` stays `member | admin`. The jury deliberates outside the product, and an admin enters its pick as the jury recognition.
- **Removal is immediate:** the `admin` layout and every admin server action read `role` from the database on each request, never from Better Auth's cookie cache.
- **Seed:** the design fixtures include one admin user.

## 2026-11-13 · Environments, CI and deploys

- **Env vars:** each workspace that needs them has a gitignored `.env.local` and a committed `.env.example` that lists every key, with no values. Vercel's project env holds the Production and Preview values. Neon's Vercel integration injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for each preview branch, with branch auto-delete, plus `neondatabase/delete-branch-action` on PR close.
- **Remote:** GitHub. Vercel's Git integration deploys: a preview for every PR, and `main` to production. GitHub holds no Vercel token and no app secrets.
- **Checks:** a GitHub Actions workflow runs `pnpm lint`, `pnpm check-types` and `pnpm test` on every PR, and they're required for merging.
- **`capture.mjs`:** runs locally only, before a PR.
- **Neon free plan risk:** 100 CU-hours/month are shared by every branch, and running out suspends production too.

## 2026-11-13 · M1 install list

Install this once the map is closed. Versions are the ones checked during research; packages without one take the current version at install.

**`apps/web`**
- `@repo/core`, `@repo/db` (`workspace:*`): the composition root wires core with real adapters.
- `better-auth@1.7.22`: sign-in, sessions, the `user` table.
- `pg`, plus `@types/pg` as a dev dependency: the app owns the pool so it can register it.
- `@vercel/functions`: `attachDatabasePool` for the pool.
- `workflow`: reminders and e-mail batching (`withWorkflow()` in `next.config`).
- `resend`, `@react-email/components`: the mailer adapter and e-mail templates.
- `@vercel/blob`: direct browser uploads and storage.
- `sharp`: resizes screenshots to webp.
- `next-intl`: copy from `messages/ro.json`.
- `react-hook-form`, `@hookform/resolvers`, `zod`: forms, re-parsed on the server.
- `lucide-react`: icons.
- `@vercel/analytics`: Web Analytics.
- `tailwindcss`, `@tailwindcss/postcss` (dev): styling.
- `pnpm dlx shadcn@latest init -t next -b base`, then `add tabs alert-dialog`. It adds `@base-ui/react`, `clsx`, `tailwind-merge` and `class-variance-authority`. Remove `tw-animate-css` and replace the generated theme with our `globals.css`.
- Remove `@repo/ui`.

**`packages/db`**
- No new dependencies. Generate the Better Auth tables with `pnpm dlx @better-auth/cli@1.7.22 generate` into `src/schema/auth.ts`.
- New scripts: `db:seed:fixtures` (loads `docs/design/fixtures.json`) and `admin:set`.

**`packages/core`**
- No new dependencies.

**Root (dev)**
- `playwright`, `pixelmatch`, `pngjs`: for `docs/tools/capture.mjs`.

**Delete:** `apps/docs` and `packages/ui` (create-turbo demos).

## Verify during M1 setup

Facts the research couldn't confirm. Check each one once, and record the result here.

- **Resend:** one test send. Does DKIM cover the `List-Unsubscribe` headers? Do ă/â/î/ș/ț render correctly in Gmail, Outlook and Apple Mail? Set `lang="ro"`, add a UTF-8 charset meta, and send a text part.
- **sharp:** confirm memory and time for a 5 MB image on a preview deploy.
- **Neon previews:** do preview database URLs exist at build time, so migrations can run? Do preview branches reset on later pushes?
- **Base UI:** confirm `role="alertdialog"` and the focus trap in the leave-challenge confirm (screen 08). That confirm has no reference design, so record its copy and backdrop here.
