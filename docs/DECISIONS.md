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
| Auth | **Better Auth** 1.7.x: magic link, Google, GitHub; users in our Neon | Users stay in our EU database, Drizzle adapter, `testUtils` for dev login | Hosted auth (US data) |
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

_On hold: sign-in is email and password for now; see "2026-11-14 · Email and password for now". Everything below is still configured and applies again once Resend and the OAuth apps exist._

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
- **Remote:** GitHub, `owdlevi/itstart.ro` (added 2026-11-14). Vercel's Git integration deploys: a preview for every PR, and `main` to production. GitHub holds no Vercel token and no app secrets.
- **Checks:** a GitHub Actions workflow runs `pnpm lint`, `pnpm check-types` and `pnpm test` on every PR, and they're required for merging.
- **`capture.mjs`:** runs locally only, before a PR.
- **Neon free plan risk:** 100 CU-hours/month are shared by every branch, and running out suspends production too.

## 2026-11-13 · M1 install list

Installed on 2026-11-13, with the M1 foundation finished on 2026-11-14; exact versions are in each `package.json`. Still to do, as part of building: adding `tabs` and `alert-dialog` from shadcn when those components are built. Run `pnpm exec playwright install chromium` once per machine for `capture.mjs`.

**`apps/web`**
- `@repo/core`, `@repo/db` (`workspace:*`): the composition root wires core with real adapters.
- `better-auth` 1.7.22: sign-in, sessions, the `users` table. Don't add `minimumReleaseAgeExclude` entries to get a fresh release. Its CLI is the `auth` package at the same version, run through `pnpm --filter web auth:generate` (`@better-auth/cli` is deprecated and stops at 1.4).
- `server-only`: guards the composition root (`src/server/core.ts`).
- `pg`, plus `@types/pg` as a dev dependency: the app owns the pool so it can register it.
- `@vercel/functions`: `attachDatabasePool` for the pool.
- `workflow`: reminders and e-mail batching. `next.config.js` is wrapped in `withWorkflow()`.
- `resend`, `react-email`: the mailer adapter and e-mail templates. `react-email` 6 exports the components (`Html`, `Body`, …); `@react-email/components` is deprecated.
- `@vercel/blob`: direct browser uploads and storage.
- `sharp`: resizes screenshots to webp.
- `next-intl`: copy from `messages/ro.json`.
- `react-hook-form`, `@hookform/resolvers`, `zod`: forms, re-parsed on the server.
- `lucide-react`: icons.
- `@vercel/analytics`: Web Analytics.
- `next-themes`: light/dark through `data-theme` on `<html>` (`docs/design/notes/nextjs-tailwind.md` §3).
- `tailwindcss`, `@tailwindcss/postcss` (dev): styling.
- shadcn, initialised with `pnpm dlx shadcn@latest init -t next -b base`. It adds `@base-ui/react`, `class-variance-authority` and `cn` (shadcn's own replacement for `clsx` + `tailwind-merge`, used by `@/lib/utils`). `shadcn` is a dev dependency, kept only for `shadcn/tailwind.css` (the `data-open`-style variants). `tw-animate-css`, Geist and the generated Button were removed, and the theme was replaced with our `globals.css`, which also turns off Tailwind's default colours, radii and shadows.
- Fonts: the brand woff2 files are copied to `src/app/fonts/` and loaded with `next/font/local`, one face per latin / latin-ext file, split by `unicode-range`.
- Native build scripts for `@parcel/watcher`, `@swc/core` and `cbor-extract` are set to `false` in `pnpm-workspace.yaml`. All three ship prebuilt binaries.
- Remove `@repo/ui`.

**`packages/db`**
- `tsx` (dev): runs `scripts/admin-set.ts` and `scripts/seed-fixtures.ts`. Plain `node` can't resolve the package's extensionless imports.
- Better Auth's tables are generated into `src/schema/auth.ts` (see `apps/web` above).
- Scripts: `db:seed:fixtures` (loads `docs/design/fixtures.json`) and `admin:set`.

**`packages/core`**
- No new dependencies.

**Root (dev)**
- `playwright`, `pixelmatch`, `pngjs`: for `docs/tools/capture.mjs`. Self-test baseline (macOS arm64, Chromium headless shell 158): 52/52 `match`, largest diff 0.61%, from text antialiasing. HANDOVER expects 0%; anything near this baseline is the renderer, not the app.

**Delete:** `apps/docs` and `packages/ui` (create-turbo demos).

## 2026-11-14 · M1 foundation

Judgment calls made while setting up the database, Better Auth and the composition root.

- **Sign-in link limit lives in a new `signIn` core module.** The job is "who may get a sign-in link, and how often", a rule about the sign-in action that counts the action's own rows (`sign_in_link_sends`). `notifications` decides which product e-mails go to members and when, based on consent and activity. A sign-in link is a requested, transactional message, and its limit is anti-abuse. `signIn.requestLink(email)` checks and records in one transaction, under a per-address advisory lock so a double submit can't send two links. It also refuses `.invalid` addresses (agents' placeholders). The mailer seam (`Mailer`, `createMemoryMailer`) lives in core too, because `notifications` will use it.
- **`createAuth(deps)` instead of a module-level instance in `auth.ts`.** The Better Auth CLI refuses any config that imports `server-only`, even transitively, and neither a tsconfig path nor a resolve hook gets past its loader. `auth.ts` holds the config, `core.ts` builds the real instance, and `scripts/auth-generate.ts` builds one with the same options for the CLI, so the generated schema can't drift.
- **User fields:** `handle` is nullable until onboarding (magic-link users arrive with no name), and `onboardedAt` marks a finished `/bun-venit`. `avatarFill` is nullable: the fixtures pin specific fills, and the UI can derive one from the id when it's null. `image` is renamed to `avatarUrl`. Every product field is `input: false`.
- **Generated auth tables keep `timestamp` without time zone**, exactly as the CLI writes them, so `auth.ts` stays regenerable. This also turned `users.created_at` from `timestamptz` into `timestamp`. It's safe while sessions run in UTC (Neon and the container do); see the ARCHITECTURE gotcha.
- **Design-fixtures mode is ignored in production** (`VERCEL_ENV=production`) even if `DESIGN_FIXTURES=1` is set, and the seed refuses to run there.
- **Seed:** the admin is an extra user, `echipa-itstart`, kept out of `fixtures.json` so no reference screen changes. Fixture e-mails are `<handle>@fixtures.itstart.invalid`, and agents use `<handle>@agents.itstart.invalid`. `bianca-radu` isn't onboarded, because screen 07 shows her first sign-in. Past challenges' launched projects have no launch time in the fixtures, so the seed uses their challenge deadline. The seed loads only tables that exist so far (users, challenges, projects, votes); extend it as screens add tables.
- **Local Postgres:** user, password and database are all `itstart`, on port 5432.
- **Mailer:** the in-memory mailer is wired in for now and logs each link to the server console. The Resend adapter waits for the sign-in e-mail template and a verified domain.

## 2026-11-14 · Email and password for now

- **Decided by the owner:** until Resend and the Google/GitHub OAuth apps exist, people sign up and sign in with an e-mail address and password (Better Auth `emailAndPassword`). Magic link, Google and GitHub stay configured in `createAuth`, but nothing in the UI uses them.
- **Why:** both of the decided methods need an outside account first: magic link needs a mailer, and the providers need OAuth apps. Password sign-in needs neither, so screens can be built and tried locally now.
- **Settings:** Better Auth's defaults: passwords 8–128 characters, stored hashed in `accounts.password` (`provider_id = credential`), signed in straight after sign-up. Better Auth's per-IP limiter covers `/sign-in/email` and `/sign-up/email` (database storage). The per-address sign-in link limit doesn't apply to passwords.
- **Known gaps, acceptable before public launch only:**
  - No e-mail verification: anyone can sign up with any address, and `emailVerified` stays `false`.
  - No password reset: a forgotten password can't be recovered.
  - No limit on failed password attempts per account, only per IP.
- **When magic link and OAuth come back,** password users are unverified. That matters in two ways:
  - Google/GitHub won't link to them automatically (`requireLocalEmailVerified`).
  - A magic-link sign-in to one of them deletes their `accounts` rows (the password included) and their sessions (`revokeUnprovenAccountAccess`).
  
  Decide then whether passwords stay (with verification and reset) or go. Either way, mark existing addresses verified only after they've proven them.
- **Screen 06 (`/intra`):** the reference shows Google, GitHub and the link form, so the password form has no reference design. Ask the owner for its copy when that screen is built, and record it here. Until sign-in switches back, expect `capture.mjs` to report `differs` for screen 06.

## 2026-11-14 · Fixture counts

- **Unclear:** HANDOVER §4 says counters are computed from rows and never drift, but the references show counts far above the seeded rows ("86 de oameni · 4 agenți AI · 25 de lansări", 128 votes on Tuns la Fix, "3 comentarii").
- **Decided by the owner:** a fixtures-only table, `fixture_count_extras` (subject id, metric, n). Only `db:seed:fixtures` writes it, with n = the count the fixtures show minus the rows seeded for it. Core's counts are `count(rows) + n`. In production the table is always empty, so every count is rows alone.
- **Why:** filler users and projects would show up in lists on screens 02, 03 and 05, so every list would need a way to exclude them. Extras leave the lists alone and still move with the rows: Andrei retracting his vote turns 128 into 127.
- **Metrics:** `participants` and `agents` (per challenge, people with a participation row who haven't left), `launched` and `in_progress` (per challenge), `votes` and `reviews` (per project; reviews count human reviews and replies, rule 17).

## 2026-11-14 · Screen 01 data

- **Month label is derived, not stored.** HANDOVER §4 lists `monthLabel`. The app formats `startsAt` in Europe/Bucharest with `Intl` ("noiembrie 2026", "noiembrie"), so Hungarian gets month names for free.
- **`challenges.builtFor`** (new, nullable): the phrase after "pentru" that Home uses twice ("Luna asta: o frizerie.", "Luna asta construim pentru o frizerie. Vii?"). It isn't in the fixtures, so the seed sets it per challenge.
- **Screenshots** are a `text[]` of Blob URLs on `projects`, in display order (the first is the thumbnail), not a separate table. There are only 2–4 per project, and they're always read with it.
- **Tools on cards:** `projects.tools` holds every tool, and cards and rows show the first two. The seed puts the fixtures' card tags (`tools`) first, then the rest (`toolsAll`).
- **Participations in the seed:** every owner of a project in a challenge, plus the agents in its agent panel, joined at the challenge's start. Bianca hasn't joined `frizerie`, because screen 08 shows her joining (her "În lucru" project is still seeded).
- **Past challenges' start:** the fixtures have none for #1 and #2, so the seed uses the 1st of the deadline's month.

## 2026-11-14 · Screen 01 build

- **"Cele mai votate săptămâna asta" (HANDOVER §13.1) is flagged, not changed.** The section shows the top 3 by votes in the running challenge (the §13.1 default), but the heading still says "săptămâna asta", word for word from the reference. The owner decides whether it becomes "Cele mai votate luna asta".
- **Vote refusals have new copy** (no reference design): "Poți vota după prima zi în comunitate." (account under 24 h), "Ai votat de multe ori în ultimele minute. Mai încearcă puțin mai târziu." (rate limit), "Votul pentru această provocare s-a încheiat." (closed), "Votul nu a mers. Mai încearcă o dată." (anything else). The vote goes back to its previous state, and the message appears in a small panel under the button (`role="status"`). The owner should review the wording.
- **Empty states on Home** (none are in the PNGs):
  - With no running challenge, the hero keeps only "Vezi lansările", as the primary button, and the challenge card, the top 3 and the green band are hidden.
  - The band is also hidden when the challenge has no `builtFor`.
  - The top-3 section is hidden until the challenge has a launched project.
- **Links to screens that don't exist yet:**
  - Join (hero and band): signed out, `/intra?provocare=<slug>` (screen 06 reads it and joins after sign-in, HANDOVER §6 06); signed in, `/provocari/<slug>`.
  - Vote while signed out: `/intra?next=<path>` (rule 12).
  - Tags: `/lansari?eticheta=<tool>` (screen 03 honours it).
  - Header avatar: `/u/<handle>`, or `/bun-venit` while the user has no handle.
  - Footer: `/despre`, `/reguli` and `/contact`, which wait for the owner's content (§13.8).
- **Countdown:** the first frame uses the server's clock (frozen in fixtures mode), so there's no hydration jump. After that it advances by the time that has passed in the browser, so a fixtures-mode page stays at the reference moment.
- **Skip link** "Sari la conținut" (§10, not in the PNGs): the first focusable element, hidden until focused.
- **Icons are Lucide.** The reference's clock and message icons are drawn slightly differently. The difference is within `capture.mjs`'s threshold.
- **Visual check (`capture.mjs --only 01`, against `pnpm dev`):** mobile light and dark `match` (0.8%). Desktop light and dark report `check` (4.0% and 3.4%), and all of that difference is the thumbnails: placeholder art in the reference against flat `tint` in the app (§9.4, "Thumbnails and screenshots"). Outside the thumbnail strip the difference is 0.51%, under the tool's self-test baseline of 0.61% (text antialiasing).

## 2026-11-14 · Screen 02 data

- **Tips are per-challenge data.** The four "Construiește-l cu AI" cards name Nea Gică and the booking steps, so they belong to the brief: `challenges.tips` (jsonb, `{title, text}[]`, in order). So is the line under the launch criteria (`launchNote`, "…într-o frizerie adevărată").
- **The "Trei recunoașteri la final" panel is fixed copy** in `ro.json`. The three recognitions and "Votul se închide odată cu provocarea" are product rules (§1, rule 3), the same every month. The jury's composition and criteria are per challenge (§13.6) in `challenges.juryNote`, which screen 11 shows in full. If a challenge's jury ever differs from "echipa ITStart și doi invitați", the panel's line needs a per-challenge field too.
- **Not in the fixtures, so the seed sets them:** `tips`, `launchNote` and `materialsUrl` for `frizerie` (an `.example` URL, like the seeded live links), and `juryNote` for every challenge (screen 11's text).
- **Given names:** the participant sentence says "Réka", not "Kovács", so `users.givenName` (nullable) holds what we call someone in a sentence when it isn't the first word of `name`. The seed sets it for Kovács Réka and Szabó Attila. Onboarding (screen 07) only asks for the name, so for now a family-name-first user gets their family name; screen 07 can add the field later if the owner wants it.
- **Project updates** are their own table, `project_updates` (project, version, text, created at), unique per project and version. The seed gives fixture updates, which only have a date, noon in Bucharest that day.
- **Participants are listed earliest-joined first.** The seed spaces the joins a minute apart in fixture order, so the sidebar reads "Ioana, Andrei, Réka…".
- **"23 au lansat deja"** counts people with a launched project in the challenge, a new extras metric, `launchers`. The seed takes the fixtures' 25 launches minus the agents' two (one launch per person).

## 2026-11-14 · Screen 02 build

- **Milestone flags** are plain constants in `apps/web/src/flags.ts`, derived from one `MILESTONE` number (1 for now): `questions` (M2), `challengeArchive` (M2), `builderAgents` (M3). No flags vendor.
- **Agent-built projects are hidden in M1** (HANDOVER §3, "agent-built projects", M3). Lists on 02 pass `agents: flags.builderAgents` to core. Counts still include them ("Proiecte lansate · 25"). In production M1 there are no agent-built projects, so lists and counts agree; only the fixtures show the gap.
- **Launched rows are the four with the most votes** (ties: latest launch first). The reference's order (Tuns la Fix, Scaunul 3, Frizerie Simplă, Brici) puts the agent's 38 votes above Brici's 81, which no rule produces. Screen 03's reference shuffles agent rows the same way. With agents hidden, 02 shows Tuns la Fix, Scaunul 3, Brici, La Fix.
- **"În lucru" rows** are the four most recently updated (or created, before the first update). The update line reads "v2 · ieri: …" in Bucharest calendar days ("azi", "ieri", "acum 3 zile").
- **Participant list:** at most 8 avatars (40px), earliest-joined first, with the viewer first when they're in it (screen 08: "Tu, Ioana…"). The sentence names the first three and says "și încă N", where N is the participant count minus the names shown. The reference shows Bianca's avatar, but the seed has her not joined (screen 08 shows her joining), so 02 shows 7 avatars. That's an expected difference.
- **The sidebar comes first in the DOM,** so phones get the countdown and join button above the brief (§6 02). From 768px it moves right with `order`. On desktop, keyboard focus therefore reaches the sidebar before the brief. A single DOM can't match both references' order, and phones come first (§2.5).
- **Join button:** `/intra?provocare=<slug>` for everyone until screen 08 adds joining.
- **Statuses other than running** (no reference until screen 11): an ended challenge shows the outlined "Încheiată" badge and no time-left panel, and its vote counts are plain counts (rule 3). An upcoming one shows a warning chip "Începe pe {date}" (new copy).
- **Links into screen 03:** "Vezi toate" goes to `/lansari?provocare=<slug>` (launched) and `/lansari?provocare=<slug>&stadiu=in-lucru` (in progress). Screen 03 must honour `provocare` and `stadiu`, as well as `eticheta`.
- **"Un minut. Fără parolă."** under the join button is the reference copy, but it's untrue while sign-in is email and password. Kept word for word; the owner decides (NEXT-ACTIONS).
- **Avatar** gains a 40px size, for the participant list.

## Verify during M1 setup

Facts the research couldn't confirm. Check each one once, and record the result here.

- **Resend:** one test send. Does DKIM cover the `List-Unsubscribe` headers? Do ă/â/î/ș/ț render correctly in Gmail, Outlook and Apple Mail? Set `lang="ro"`, add a UTF-8 charset meta, and send a text part.
- **sharp:** confirm memory and time for a 5 MB image on a preview deploy.
- **Neon previews:** do preview database URLs exist at build time, so migrations can run? Do preview branches reset on later pushes?
- **Base UI:** confirm `role="alertdialog"` and the focus trap in the leave-challenge confirm (screen 08). That confirm has no reference design, so record its copy and backdrop here.
