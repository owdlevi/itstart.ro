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

Installed on 2026-11-13, with the M1 foundation finished on 2026-11-14; exact versions are in each `package.json`. Still to do, as part of building: adding `alert-dialog` from shadcn when the leave-challenge confirm is built (`tabs` was added for screen 03). Run `pnpm exec playwright install chromium` once per machine for `capture.mjs`.

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
- **The sidebar comes first in the DOM,** so phones get the countdown and join button above the brief (§6 02). It moves right with `order` only from 984px, where both columns fit side by side (560 + 40 + 320 + 2 × 32). Between 768 and 983px the row wraps to one column, so a 768px tablet gets the phone order too; with `md:` the join button sat below the whole brief there. On desktop, keyboard focus reaches the sidebar before the brief. A single DOM can't match both references' order, and phones come first (§2.5).
- **Join button:** `/intra?provocare=<slug>` for everyone until screen 08 adds joining.
- **Statuses other than running** (no reference until screen 11): an ended challenge shows the outlined "Încheiată" badge and no time-left panel, and its vote counts are plain counts (rule 3). An upcoming one shows a warning chip "Începe pe {date}" (new copy).
- **Links into screen 03:** "Vezi toate" goes to `/lansari?provocare=<slug>` (launched) and `/lansari?provocare=<slug>&stadiu=in-lucru` (in progress). Screen 03 must honour `provocare` and `stadiu`, as well as `eticheta`.
- **"Un minut. Fără parolă."** under the join button is the reference copy, but it's untrue while sign-in is email and password. Kept word for word; the owner decides (NEXT-ACTIONS).
- **Avatar** gains a 40px size, for the participant list.
- **The viewer is "Tu"** in the participant sentence when they're in it ("Tu, Ioana, Réka și încă 83."), as on screen 08.
- **The header row keeps its height while "Toate provocările" (M2) is hidden.** The link has a 44px tap target and shares a line with the status chip, so the chip sits in a 44px-tall box. On desktop (one line) and mobile (the chip wraps to a second line) the header then lines up with the reference to the pixel.
- **Ended challenge** (until screen 11 replaces this layout in M2): the sidebar reads in the past tense, "64 de oameni au construit" and "40 au lansat." (new copy). The Brief panel is left out when the challenge has no brief text at all, instead of showing a heading over nothing.
- **Tags never wrap inside** (spec), so a tag longer than its row is cut with an ellipsis (`max-w-full truncate`) rather than pushing the page sideways at 390px. Screen 09 should also cap the length of a custom tool ("+ Alta").
- **Fonts: diacritics were drawn in Arial.** next/font adds a metric-matched fallback face (local Arial, no `unicode-range`) right after each family, so the stack was `inter, inter Fallback, interExt`, and every ă â î ș ț came from Arial. The latin faces now set `adjustFontFallback: false`; the latin-ext faces keep theirs, which ends the stack. Text widths now equal the reference's to the hundredth of a pixel. Screen 01 improved too: mobile 0.8% → 0.47%, desktop 4.0% → 3.7% (thumbnails).
- **Visual check (`capture.mjs --only 02`, against `pnpm dev`):** all four variants report `differs` (15–22%), and all of it is expected:
  - the hidden M2/M3 sections ("Întrebări și ajutor" in the main column, the "Și 4 agenți AI" panel in the sidebar, the "Toate provocările" link), which shift everything below them, so the page is 423px (desktop) and 861px (mobile) shorter;
  - thumbnails (§9.4);
  - the launched rows: Brici and La Fix in place of Frizerie Simplă and Brici (agent projects hidden, rows ordered by votes); on mobile La Fix's pitch takes one more line than the agent row's;
  - 7 participant avatars, not 8 (Bianca hasn't joined).
  
  Diffing the aligned regions instead (each section against its shifted counterpart, the thumbnail column left out): desktop 0.36–0.60%, mobile 0.01–0.57%, all under the tool's 0.61% self-test baseline.
- **Manual pass (§9.5):** 390, 768, 1024 and 1280px in both themes, with and without the Hungarian sample appended to every text: no horizontal scroll and nothing clipped except the tag ellipsis above. Keyboard order follows the visual order (except the sidebar on desktop, above), and every stop shows the 3px outline. Ended (`cafenea`) and upcoming (dates moved in the local database) both render cleanly. Signed in as `andrei-popescu`: "Ai votat" on Tuns la Fix, "96 voturi · proiectul tău" on Scaunul 3 (rule 11).

## 2026-11-14 · Screen 03 data

- **`challenges.shortTitle`** (new, nullable): the name on the board's challenge chips ("#4 Frizerie", "#2 Meșter local"). It can't come from the slug, which drops diacritics. Null falls back to the title. The seed sets it for the four fixture challenges.
- **`projects.board()`** is one read for the whole board: a scope (one challenge, every challenge, or projects outside any: "Proiecte proprii"), a stage (launched or in progress, never both: rule 5), a tool and a sort. Each row carries `at`, what the board groups by (the launch, or for a project in progress its latest update or creation, as on screen 02), and `votingOpen`, false once that row's challenge has ended (rule 3), so a board across challenges shows plain counts on finished months. No limit or paging yet: a month brings tens of launches. Revisit when "Toate" gets long.
- **`challenges.started()`** lists the challenges that have started, newest first, for the chips. Upcoming ones have no projects to show.

## 2026-11-14 · Screen 03 build

- **URL parameters** (Romanian, defaults left out): `tip=proprii` (tab), `provocare=<slug>` or `provocare=toate`, `eticheta=<tool>`, `stadiu=in-lucru`, `sortare=voturi`. The parsing lives in `lansari/board-params.ts`. Unknown values fall back to the default; an unknown challenge slug shows every challenge.
- **The board opens on the running challenge.** The reference is captured at plain `/lansari` with "#4 Frizerie" selected, so that's the default, and "Toate" needs its own value (`provocare=toate`). With no running challenge, the default is every challenge.
- **Switching tabs** starts the new tab from its defaults, keeping only the sort. "Proiecte proprii" is the same board without the challenge row (§13.4).
- **No "Toate" in the Stadiu row,** as in the reference: launched is the default, and launched and in-progress projects are never mixed (rule 5).
- **The sort row is hidden for projects in progress**, which have no votes to sort by; `sortare` is ignored there. In M3 the "Arată și agenții AI" checkbox joins that row (`flags.builderAgents`), so the row will show for both stages then.
- **The Etichete chips are a fixed list** from the reference: Claude, Cursor, v0, Lovable, Next.js, Supabase (the AI builders from screen 07, then the two most common stacks). Usage counts in the fixtures don't produce that list, so it isn't derived. A tool from a Tag link that isn't in the list (`eticheta=Astro`) is added at the end, selected.
- **Week groups** run Monday to Sunday in Bucharest (`weekOf()` in `lib/dates.ts`), newest first; within a week, rows keep the chosen sort. This week and last week are named, with the dates beside them ("9–15 noiembrie · 3 lansări"); older weeks are headed by their dates ("26 octombrie – 1 noiembrie"), with only the count beside them (new layout, not in the reference). The count is the rows shown, and says "proiecte" for projects in progress.
- **Empty state:** "Nicio lansare aici încă." and, when a filter is narrowing the board, a "Șterge filtrele" link to every challenge, launched, any tool (keeping the tab and sort). With no filter to clear, the link is left out.
- **Filters are GET forms (`next/form`), one per chip.** They work before hydration and become client-side navigations after. next/form builds the URL from the form's fields only and drops the button that submitted it, so each chip's hidden inputs hold the whole query it leads to. FilterChip is a `type="submit"` button with `aria-pressed` (spec). It's capped at its row's width, so a long (Hungarian) label wraps inside the chip instead of widening the page.
- **Tabs are links with tab semantics:** shadcn's Base UI tabs, rewritten onto our tokens (`components/ui/tabs.tsx`), and `LinkTabs`, whose triggers render as `Link`s. Arrow keys move between tabs once hydrated; Enter follows the link. Only the selected tab's panel is rendered. Base UI gives a panel its own tab stop, which this one doesn't need (it starts with chips), so it's `tabIndex={-1}`.
- **"+ Lansează un proiect" under the lead (phones)** shows only when signed in, like the header's desktop button.
- **Signing in from a vote returns to the same page with its query** (rule 12), so a filtered board comes back filtered. This changes VoteButton for every screen.
- **Agent rows and the "Arată și agenții AI" checkbox are hidden** (M3, `flags.builderAgents`).
- **Visual check (`capture.mjs --only 03`, against `pnpm dev`):** all four variants report `differs` (17–25%), all of it expected:
  - the hidden agent rows (Frizerie Simplă, Programare Rapidă), so the week counts read "3 lansări" instead of 4, and the page is 268px (desktop) and 409px (mobile) shorter;
  - the hidden "Arată și agenții AI" checkbox, which on phones wraps to its own 52px line;
  - thumbnails (§9.4).
  
  Every element above the first hidden row sits at the reference's exact position and size. Aligned regions, thumbnails left out: desktop 0.03–0.57%, mobile 0.01–0.06% (and 1.3–1.9% in a block whose crop is off by one device pixel), under the 0.61% baseline.
- **Manual pass (§9.5):** 390, 768, 1024 and 1280px in both themes, with and without the Hungarian sample: no horizontal scroll; on phones the chip rows scroll sideways inside themselves. Keyboard order follows the layout, with the 3px outline on every stop. Tested on `next build && next start`: every chip, combined filters, sort, the stage switch, the tabs by keyboard, the links from screen 02 ("Vezi toate", both) and from Tags, the empty state and its link, and a vote that holds after a reload. Signed out: every row unvoted (rule 12), no launch button.

## 2026-11-14 · Screen 04 data

- **The build story and description live on `projects`:** `description` (paragraphs split by a blank line), `buildDuration` (enum `under_10h` | `10_30h` | `over_30h`, the three options of screen 09's "Cât a durat?"), `buildDurationText` (the builder's own words, shown instead of the option's label when present: "Cam 20 de ore, seara, în trei săptămâni."), `buildHardestPart`, `buildPrompt`. They're always read with the project, like `screenshots`. Migration `0005_screen_04`.
- **`review_assignments`** (reviewer, project, created, done) exists now, so a review can fulfil an assignment: `reviews.post()` sets `doneAt` on the author's open assignment for that project (rule 16). Picking assignments on launch is screen 10's. The seed loads the fixtures' two for Ioana, both open ("0 din 2").
- **Seeded screenshots:** none exist as images, so each launched fixture project gets two (three for Tuns la Fix, as in the reference) pointing at `/dev/captura/<slug>-<n>.svg`. That route exists only in fixtures mode and returns a transparent 16:10 SVG, so the `tint` behind every screenshot is what shows (HANDOVER §9.1). Thumbnails on 01–03 now come from these too and look the same.
- **`projects.bySlug(slug, viewerId)`** returns the summary fields plus everything on the page: live URL, screenshots, description, build story, launch time, `votingOpen` (rule 3), the challenge, the owner's city and launched-project count, and the updates newest first.
- **`reviews.thread(projectId)`**: the automated review first (rule 18), then people's reviews newest first (the reference puts Andrei's, from today, above Réka's, from yesterday), each with its replies oldest first. Hidden ones are left out. `humanCount` is rule 17's count (with the fixture extras); `total` adds the automated ones and is the heading's number ("Păreri · 4" = 3 human + 1 automated).
- **`reviews.post()` rules** (refusals are values):
  - Any signed-in person reviews (rule 15), on launched and in-progress projects alike (rule 5).
  - **Only the owner replies**, and only to a top-level review on that project (one level). HANDOVER says "Owners can reply"; replies from others would turn reviews into threads.
  - **The owner doesn't review their own project** (`own`); they reply instead. The form isn't shown to them.
  - **Agents are refused** (`agent`): automated reviews will come from the review agent's own path, not this one.
  - Body trimmed, 1–2000 characters (`empty`, `too_long`). 2000 is a placeholder in `ReviewsConfig`; the agent's own limit is 600 (§12).
  - **10 reviews and replies per hour per person**, counted from `reviews` (DECISIONS, "Rate limits live in Postgres"), under a per-author advisory lock so a double submit can't pass it.
- **The automated review stays in the seed.** The review agent is out of M1, but the fixtures' automated review is loaded, and the page renders any row with `isAutomated`, so screen 04 matches the reference there. In production there are no such rows until the agent ships.

## 2026-11-14 · Screen 04 build

- **The challenge's name in "Făcut pentru" is its title.** The references disagree: screens 01, 02 and 08 say "Pagină de programări pentru o frizerie de cartier", while 04, 05, 09 and 12 drop "de cartier". The other three challenges' titles are the same everywhere, so this looks like a slip in the reference, not a second, shorter title. Screen 04 shows the stored title, which wraps to three lines in the sidebar (23px taller than the reference). If the owner wants the short form, it's a data change.
- **Tools on the page:** the header shows the challenge tag ("Provocarea #4", to the board filtered by that challenge), then the first two tools; the sidebar shows all of them. There's one ordered list (DECISIONS, "Screen 01 data"), and the references order it differently in different places (cards: Next.js, Claude; the sidebar: Claude, Next.js), so the sidebar's first two tags are swapped against the reference.
- **"Lansări" is the current nav link on a project page**, as in the reference (`NavLinks` takes extra paths per link).
- **Dates:** updates read "v3 · 10 noiembrie"; reviews read "acum 2 ore", "acum o oră", "ieri", "acum 3 zile" (minutes and hours on the same Bucharest day, then calendar days), and the date after a week. An automated review reads "la 6 minute după lansare" (minutes or hours after `launchedAt`, within a day). The launch line is "Lansat marți, 10 noiembrie 2026".
- **Vote slot, wide:** the wide VoteButton as specified. Where voting isn't possible, VoteCount gets a wide shape too, 48px like the buttons beside it: "96 voturi" on a `tint` fill (own project, closed challenge) and "În lucru" on `warning-bg` (rule 5). Same labels as the compact ones.
- **"Distribuie"** opens the native share sheet where there is one; otherwise, or if sharing fails (but not if the person closes the sheet), it copies the page's URL and says "Am copiat linkul." under the button (`role="status"`).
- **"Deschide proiectul"** is a plain link to the live URL (`rel="noopener"`), in the same tab, as in the reference.
- **Screenshot viewer:** the large image is 16:10 with the alt text "Captură de ecran din <proiect>" (§10); the strip buttons are "Captura 1…" with `aria-pressed`. The strip is left out when there's only one screenshot, and the whole section when there are none (a project in progress may have none).
- **Sections without data are left out** (description, build story, updates): only Tuns la Fix has them in the fixtures, and a project in progress may not have them yet. "Făcut pentru" is left out for a project outside any challenge, and its launch line for a project in progress.
- **Review form:** react-hook-form + zod, with the schema shared by the form and the server action (`lib/schemas/review.ts`). Errors replace the hint under the field (Field spec) in a live region, so a refusal from the server is announced. After posting, the action calls `refresh()` and the new review appears; "Părerea ta e publicată." is announced. The submit button is full width on phones, as in the reference.
- **Signed out**, the form is replaced by the same panel with "Scrie o părere" and a secondary "Intră ca să scrii o părere" to `/intra?next=/proiecte/<slug>#pareri`.
- **Owner's replies:** under each review, the owner sees "Răspunde" (a text button, 44px tall). It opens a reply form in place ("Răspunsul tău", "Trimite răspunsul") with the focus in the field; after sending, the form closes and the reply appears indented (48px desktop, 24px phones).
- **New copy, for the owner to review** (none of it has a reference design): "Intră ca să scrii o părere", "Părerea ta e publicată.", "Răspunde", "Răspunsul tău", "Trimite răspunsul", "Răspunsul tău e publicat.", "Am copiat linkul.", the wide "În lucru" box, and the errors "Scrie ceva înainte să trimiți.", "Cel mult 2000 de caractere.", "Ai scris multe păreri în ultima oră. Mai încearcă puțin mai târziu.", "Nu s-a trimis. Mai încearcă o dată."
- **Long labels on phones:** the wide VoteButton may take a row of its own and is capped at its width, so a longer (Hungarian) label wraps; its refusal message opens rightwards on phones so it stays on screen. AgentBadge never wraps (spec), so like Tag it's capped at its row and cut with an ellipsis.
- **Hidden until later milestones:** "Link verificat acum 3 ore. Merge." and "Raportează o problemă cu acest proiect" (M2), the "Deschisă la colaborări" chip and "Scrie-i Ioanei" (M3). Comments in the page mark where they go.
- **Visual check (`capture.mjs --only 04`, against `pnpm dev`):** desktop light `differs` 7.7%, desktop dark `check` 3.6%, mobile light and dark `differs` 15.8% and 14.4%, all expected:
  - the screenshots: placeholder art in the reference against flat `tint` (§9.4);
  - the hidden M2 line under the buttons: on desktop the buttons sit 24px lower (they align to the bottom of the title block); on phones everything below the title block is 24px higher;
  - the hidden M3 chip and "Scrie-i Ioanei": the builder panel is 108px shorter, and the sidebar below it moves up;
  - the hidden "Raportează…" link (60px, the end of the page on phones);
  - "Făcut pentru"'s title and the tools' order (above).

  Comparing every element's position and size in the reference HTML and the app with Playwright, all other elements match to the pixel at 1280 and 390px. Aligned regions, screenshots left out: the main column 0.55% (light) and 0.56% (dark), the builder panel's header 0.35–0.39%, the footer 0.1%, under the 0.61% baseline.
- **Manual pass (§9.5):** 390, 768, 1024 and 1280px in both themes, with and without the Hungarian sample on every text: no horizontal scroll, nothing clipped except the tag and badge ellipses. Keyboard order follows the layout (back link, tags, the three buttons, the strip, the form, the sidebar), with the 3px outline on every stop. Tried in a browser on `pnpm dev` (port 3000 is free now, so it hydrates): an empty submit (error, focus on the field), a review, the owner's reply, a vote that holds after a reload, the copy-link fallback, the strip, signed out (unvoted, sign-in link). Also rendered: the owner (Andrei on Scaunul 3: "96 voturi · proiectul tău", no form), an agent's project (Frizerie Simplă), a project in progress (Rând la Tuns: "În lucru" box, reviews open), a closed challenge's project (Meniu QR: "33 voturi · votul s-a încheiat"), a project with no review rows (La Fix: the heading counts the fixture extras, "Păreri · 2", and only the form shows below it), and an unknown slug (404). Every fixture project has a review count, so a true "Păreri · 0" wasn't seen.

## 2026-11-14 · Screen 05 data

- **"Provocări terminate" lists the challenges someone launched in, running ones included** (decided by the owner). The reference shows #4 Frizerie, still running, as "Terminată" beside #3 and #2, so "Terminată" means they finished the challenge (launched a project in it), not that its deadline passed. Joining without launching doesn't add a row, and projects of their own (no challenge) don't either. With several launches in one challenge, the row names them all ("proiecte: A, B"), newest first. Rows are newest challenge first.
- **`profiles.byHandle(handle, viewerId)`** is the page's one read: the public fields (never the e-mail, rule 23), the stats, the launched projects (`projects.launchedBy()`, newest launch first, each with its challenge and `votingOpen`) and the challenges above. `createCore` hands `profiles` the `projects` module, so a card on a profile is built by the same query as everywhere else.
- **Stats:**
  - "proiecte lansate" counts launched projects, own projects included.
  - "luni la rând" counts consecutive Bucharest calendar months with at least one launch, ending this month or last month; a run whose last month is older reads 0. Late launches count: it's about building every month, not recognitions.
  - "voturi primite" sums the votes of their launched projects, each through `withExtra`, so the fixtures read 128 + 74 + 39 = 241. Projects in progress can't hold votes (rule 5).
- **"În comunitate din"** is the account's creation month (`users.createdAt`; the seed sets it from the fixtures' `joinedAt`, and agents get the seed's fixed date).

## 2026-11-14 · Screen 05 build

- **ProjectCard takes `meta`,** which replaces the builder in the footer (spec). On a profile it reads "Provocarea #4 · noiembrie" (the challenge's month, from `startsAt`), and "Proiect propriu" for a project outside any challenge (new copy). A recognition ("Provocarea #3 · Alegerea juriului") replaces the month in M2, when recognitions exist; until then Meniu la Minut reads "Provocarea #3 · octombrie".
- **Vote slots follow the rules, not the reference:** the reference shows live vote buttons on #3's and #2's projects, but those challenges have ended, so they show the plain count ("74 voturi", rule 3), as on screen 04. On your own profile every card shows "N voturi" (rule 11).
- **Stat labels have no "de"** ("241 voturi primite"), word for word from the reference and like "128 voturi" on the vote buttons; one is singular ("1 proiect lansat", "1 lună la rând", "1 vot primit"). The stats are a `dl`: the label is the `dt` (read first by screen readers), shown under the number.
- **"Editează profilul"** (own profile only, secondary, small, in the row where "Scrie-i" sits for others) links to `/u/<handle>/editeaza`, which doesn't exist yet. Screen 07's form will serve it, prefilled, the way `/proiecte/<slug>/editeaza` reuses screen 09's. `/bun-venit` was turned down: it's the first sign-in only, and its copy ("Pasul 2 din 2", "Gata, intru în provocare") doesn't fit editing.
- **Links** show without the scheme, `www.` and a trailing slash ("github.com/ioanamuresan"), with `rel="nofollow ugc noopener"`, in the same tab like "Deschide proiectul". Lucide's link icon stands in for the reference's.
- **The challenge rows** keep the reference's look: the "#4" badge is decorative, so the title carries a hidden "Provocarea #4: " for screen readers. Neither the title nor the project names are links, as in the reference.
- **Without a city** the line is "În comunitate din septembrie 2026". Bio and links are left out when empty.
- **Empty states** (no reference): with no launches, "Proiecte lansate" shows "Niciun proiect lansat încă." and "Provocări terminate" is left out (it would say the same thing). Stats read 0.
- **Agents' profiles:** square "AI" avatar and AgentBadge after the name (rule 19). Their projects are listed: HANDOVER §3 hides agent-built projects on screens 02, 03 and 08, not on profiles, and screen 04 already shows them. In M1 production there are none.
- **Hidden until M3:** the "Deschisă la colaborări" chip and "Scrie-i Ioanei" (a comment marks the row). The header panel is 56px shorter, and everything below moves up by that.
- **Avatar** gains a 72px size (the profile on phones).
- **New copy, for the owner to review:** "Niciun proiect lansat încă.", "Proiect propriu", "În comunitate din …" (without a city), "proiecte: A, B" (several launches in one challenge).
- **Visual check (`capture.mjs --only 05`, against `pnpm dev`):** desktop light and dark `differs` 11.5%, mobile light and dark `differs` 17.9% and 13.1%, all expected:
  - the hidden M3 row (56px; the page is 56px shorter);
  - thumbnails (§9.4);
  - the closed vote counts on #3's and #2's projects (rule 3), and "octombrie" for the M2 recognition;
  - the November challenge's title, "…frizerie de cartier" (DECISIONS, "Screen 04 build").

  Comparing element positions in the reference HTML and the app with Playwright at 1280 and 390px, every element matches to the pixel apart from the 56px shift (headings' boxes are narrower, at the same position and height). Aligned regions, thumbnails and the closed vote boxes left out: desktop 0.17–0.27%, mobile 0.06–0.07%, under the 0.61% baseline.
- **Manual pass (§9.5):** 390, 768, 1024 and 1280px in both themes, with and without the Hungarian sample on every text, for Ioana as Andrei, signed out, Andrei's own profile, an agent (`agent-claude`), a profile with no launches (`bianca-radu`) and an unknown handle (404): no horizontal scroll and nothing clipped. Keyboard order follows the layout (links, then each card's title, tags and vote), with the 3px outline on every stop.

## Verify during M1 setup

Facts the research couldn't confirm. Check each one once, and record the result here.

- **Resend:** one test send. Does DKIM cover the `List-Unsubscribe` headers? Do ă/â/î/ș/ț render correctly in Gmail, Outlook and Apple Mail? Set `lang="ro"`, add a UTF-8 charset meta, and send a text part.
- **sharp:** confirm memory and time for a 5 MB image on a preview deploy.
- **Neon previews:** do preview database URLs exist at build time, so migrations can run? Do preview branches reset on later pushes?
- **Base UI:** confirm `role="alertdialog"` and the focus trap in the leave-challenge confirm (screen 08). That confirm has no reference design, so record its copy and backdrop here.
