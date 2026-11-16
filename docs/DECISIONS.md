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
- **Removal is immediate:** the `admin` layout and every admin server action read `role` from the database on each request, never from Better Auth's cookie cache. _Since changed: every admin page and every admin core method check it, not the layout (see "Admin: challenges")._
- **Seed:** the design fixtures include one admin user.

## 2026-11-13 · Environments, CI and deploys

- **Env vars:** each workspace that needs them has a gitignored `.env.local` and a committed `.env.example` that lists every key, with no values. Vercel's project env holds the Production and Preview values. Neon's Vercel integration injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for each preview branch, with branch auto-delete, plus `neondatabase/delete-branch-action` on PR close.
- **Remote:** GitHub, `owdlevi/itstart.ro` (added 2026-11-14). Vercel's Git integration deploys: a preview for every PR, and `main` to production. GitHub holds no Vercel token and no app secrets.
- **Checks:** a GitHub Actions workflow runs `pnpm lint`, `pnpm check-types` and `pnpm test` on every PR, and they're required for merging.
- **`capture.mjs`:** runs locally only, before a PR.
- **Neon free plan risk:** 100 CU-hours/month are shared by every branch, and running out suspends production too.

## 2026-11-13 · M1 install list

Installed on 2026-11-13, with the M1 foundation finished on 2026-11-14; exact versions are in each `package.json`. shadcn's `tabs` was added for screen 03 and `alert-dialog` for screen 08's leave confirm (its generated `ui/button.tsx` was deleted: we have our own Button). Run `pnpm exec playwright install chromium` once per machine for `capture.mjs`.

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
- **Screen 06 (`/intra`):** the reference shows Google, GitHub and the link form, so the password form has no reference design. Its copy is in "Screen 06 copy: password sign-in", and the build in "Screen 06 build". Until sign-in switches back, `capture.mjs` reports `differs` for screen 06.

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
- **Participations in the seed:** every owner of a project in a challenge, plus the agents in its agent panel, joined at the challenge's start. Bianca hasn't joined `frizerie`, because screen 08 shows her joining (her "În lucru" project is still seeded). _Since changed: she joins a minute before the frozen clock (see "Screen 08 data")._
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
- **Participant list:** at most 8 avatars (40px), earliest-joined first, with the viewer first when they're in it (screen 08: "Tu, Ioana…"). _Since changed: the viewer is always among the avatars but in join order; only the sentence names them first (see "Screen 08 data")._ The sentence names the first three and says "și încă N", where N is the participant count minus the names shown. The reference shows Bianca's avatar, but the seed has her not joined (screen 08 shows her joining), so 02 shows 7 avatars. That's an expected difference.
- **The sidebar comes first in the DOM,** so phones get the countdown and join button above the brief (§6 02). It moves right with `order` only from 984px, where both columns fit side by side (560 + 40 + 320 + 2 × 32). Between 768 and 983px the row wraps to one column, so a 768px tablet gets the phone order too; with `md:` the join button sat below the whole brief there. On desktop, keyboard focus reaches the sidebar before the brief. A single DOM can't match both references' order, and phones come first (§2.5).
- **Join button:** `/intra?provocare=<slug>` for everyone until screen 08 adds joining. _Since changed: see "Screen 08 build"._
- **Statuses other than running** (no reference until screen 11): an ended challenge shows the outlined "Încheiată" badge and no time-left panel, and its vote counts are plain counts (rule 3). An upcoming one shows a warning chip "Începe pe {date}" (new copy).
- **Links into screen 03:** "Vezi toate" goes to `/lansari?provocare=<slug>` (launched) and `/lansari?provocare=<slug>&stadiu=in-lucru` (in progress). Screen 03 must honour `provocare` and `stadiu`, as well as `eticheta`.
- **"Un minut. Fără parolă."** under the join button is the reference copy, but it's untrue while sign-in is email and password. _Since changed to "Durează un minut." (see "Screen 06 copy: password sign-in")._ Kept word for word; the owner decides (NEXT-ACTIONS).
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

## 2026-11-14 · Screen 06 copy: password sign-in

The owner asked for a draft and left the choices to the agent. Everything here holds until magic link and OAuth come back (DECISIONS, "Email and password for now"); then the reference's copy returns.

- **One panel, two modes:** "Intră" (sign in) and "Cont nou" (sign up), switched by a text link under the button and kept in the URL (`?cont=nou`). It opens on "Cont nou" when the visitor comes to join a challenge (`?provocare=`), and on "Intră" otherwise. One form that guessed between signing in and signing up was turned down: with no password reset, a mistyped e-mail or password would silently create an account nobody can get back into.
- **Google, GitHub and the "sau" divider are hidden,** not shown disabled: buttons that do nothing are noise, and they come back with the OAuth apps.
- **No password reset link:** there's no reset yet (a known gap, DECISIONS above), and a link to nowhere is worse than none.
- **Show password:** a text button in the field, "Arată parola" / "Ascunde parola" (`aria-pressed`), instead of a second "repeat the password" field.
- **"Un minut. Fără parolă."** under the join button (screens 02 and 08) becomes "Durează un minut." while sign-in uses passwords. The reference's line returns with magic link.

| Where | Copy |
|---|---|
| Eyebrow, H1 (from a challenge) | "Provocarea #4 · noiembrie", "Intră în provocare" (reference) |
| H1 (from the header) | "Intră în comunitate" (the header button's words); no eyebrow |
| Line under the H1 | "Un cont și ești înăuntru." (the reference's line without "Fără parolă de ținut minte.") |
| E-mail field | "Adresa ta de e-mail" (reference); hint "Nu o arătăm nimănui." |
| Password field | "Parola"; hint in "Cont nou": "Cel puțin 8 caractere." |
| Show password | "Arată parola" / "Ascunde parola" |
| Primary button | "Intră" / "Creează contul" |
| Switch link | "Prima dată aici? Fă-ți cont" / "Ai deja cont? Intră" |
| Rules sentence | "Prin înscriere accepți regulile comunității." (reference) |
| "Ce urmează" panel | unchanged (reference) |

Errors, replacing the field's hint (Field spec), or under the button for the last four:

| Case | Copy |
|---|---|
| E-mail empty | "Scrie adresa ta de e-mail." |
| E-mail malformed | "Adresa nu pare corectă. Verific-o o dată." |
| Password empty | "Scrie parola." |
| Password under 8 | "Parola are nevoie de cel puțin 8 caractere." |
| Password over 128 | "Cel mult 128 de caractere." |
| Wrong e-mail or password | "E-mailul sau parola nu se potrivesc." |
| Account exists (sign-up) | "Există deja un cont cu adresa asta. Intră cu parola ta." (with the switch link) |
| Too many attempts (429) | "Prea multe încercări. Mai încearcă peste un minut." |
| Anything else | "Nu a mers. Mai încearcă o dată." |

## 2026-11-14 · Screen 06 data

- **`challenges.buildingPhrase`** (new, nullable): what everyone is building, after "construiesc deja" ("86 de oameni construiesc deja pagina frizeriei."). The genitive can't be derived from the title or `builtFor`. The seed sets it for all four fixture challenges; only the running or joinable one is ever shown. When it's null the line reads "86 de oameni construiesc deja." (new copy). Migration `0006_screen_06`.
- The count is the challenge's `participants` (people, agents left out, with the fixture extras), the same number as Home's "86 de oameni".

## 2026-11-14 · Screen 06 build

- **`?provocare=<slug>` is carried on, not joined, for now** (joining is screen 08's). _Since changed: signing in joins it (see "Screen 08 build")._ Only a challenge that can still be joined counts (running or upcoming); an ended or unknown slug is ignored, and the page shows the header version. After sign-in:
  - someone not onboarded yet (`onboardedAt` null; see "Screen 07 data") goes to `/bun-venit?provocare=<slug>&next=<path>`, and screen 07 carries both on;
  - anyone else goes back to `next` if there is one, otherwise to `/provocari/<slug>`, otherwise to Home.
  
  `finishSignIn` (`app/actions/sign-in.ts`) is where screen 08 adds the join, so signing in from a challenge joins it (HANDOVER §6 06). It runs after Better Auth has set the cookie: the form calls `authClient` (the HTTP endpoint, so the per-IP limit applies), then the action, which redirects. The rules are in `lib/sign-in-destination.ts`.
- **`next` wins over `provocare`** when both are present. In practice they never are: joins link with `provocare`, votes and reviews with `next`.
- **`next` must be a path on this site** (`safeNext`): it starts with one `/`, isn't `//…` or `/\…`, and isn't `/intra` itself; it keeps its query and hash (rule 12). Anything else goes Home.
- **Signed in already:** `/intra` redirects to the same place a sign-in would (without joining).
- **Mode in the URL:** `?cont=nou` or `?cont=intra`. Without it, the page opens on "Cont nou" from a challenge and on "Intră" otherwise (DECISIONS, "Screen 06 copy"). The switch link keeps `provocare` and `next`, replaces the history entry, and keeps what was typed.
- **Checks per mode:** "Cont nou" checks the e-mail and Better Auth's 8–128 characters in the browser. "Intră" checks only that a password was typed: a wrong length gets the same "E-mailul sau parola nu se potrivesc." as a wrong password, so length isn't a hint. Errors show on submit, the first invalid field gets the focus, and the server's answer is mapped by `code` (`INVALID_EMAIL_OR_PASSWORD`, `USER_ALREADY_EXISTS*`, 429). A network failure shows "Nu a mers. Mai încearcă o dată."
- **Sign-up sends an empty name:** Better Auth requires the field, and the name comes on `/bun-venit`. What the shell does for someone who skips onboarding is in "Screen 07 build".
- **"Ce urmează"** describes the challenge from `?provocare=`, or the running one (from the header too: it's what the community does now). With no running challenge, the step "Construiești până pe …" and the people line are left out, and the steps renumber to 1–2 (new layout).
- **The header version** (from the header button, no `provocare`): no eyebrow, H1 "Intră în comunitate", as decided. The header's button links to plain `/intra`, so it returns Home.
- **Show password** is a text button inside the field's edge (the field and button look like one control; the focus ring goes around both). It has `aria-pressed` and the changing label, as decided. Screen-reader users hear "Ascunde parola, apăsat"; if the owner wants it cleaner, keep "Arată parola" fixed with `aria-pressed`, or drop `aria-pressed`. A long (Hungarian) label wraps inside the field, and the input keeps at least half the width.
- **Field** (`components/field.tsx`) exists now: label, hint, and an error that replaces the hint, in a live region, with `noteId()` for `aria-describedby`. Screens 07 and 09 use it. The review form predates it and keeps its own markup.
- **The panel is sized like the reference's content box.** The reference's `max-width: 460px` and `flex-basis: 380px` apply to the content box (inline styles, no `box-sizing`), so the panel is 526px wide on desktop. Our classes add the padding and border back.
- **Tests in `apps/web`:** vitest (the version core uses) runs `lib/sign-in-destination.test.ts`. Pure helpers in the web app are tested there; rules stay in core.
- **Better Auth's limiter is off outside production** (`rateLimit.enabled` defaults to `NODE_ENV === "production"`); in production it's 3 sign-in or sign-up requests per 10 s per IP. The 429 copy was checked with an intercepted response.
- **Visual check (`capture.mjs --only 06`, against `pnpm dev`):** desktop light and dark `differs` 5.6% and 5.8%, mobile light and dark `differs` 18.0% and 18.1% (the page is 66px shorter on phones). All of it is the password form:
  - Google, GitHub and "sau" are hidden, and the form has a password field and the switch link;
  - `capture.mjs` opens plain `/intra`, which is the header version (no eyebrow, "Intră în comunitate", "Intră");
  - the lead is shorter ("…Fără parolă de ținut minte." is gone), one line less on phones.
  
  At `/intra?provocare=frizerie`, comparing element positions in the reference HTML and the app with Playwright at 1280 and 390px, the header, the panel's box, the eyebrow, H1, lead and e-mail field's top, "Ce urmează" (heading, each step, the people line) and the footer match to the pixel; heights below the lead follow the form. Aligned regions: header 0.01%, the panel's top 0.02–0.35%, "Ce urmează" 0.06–0.59% (1.74% in desktop dark, all of it glyph edges of light-on-dark text, nothing moved), the footer 0.04–0.46%.
- **Manual pass (§9.5):** 390, 768, 1024 and 1280px in both themes, both versions, with errors showing and the Hungarian sample on every text: no horizontal scroll, nothing clipped. Keyboard order: skip link, wordmark, e-mail, password, show password, the button, the switch link, the rules link, footer; every stop has the 3px outline. Tried on `pnpm dev`: empty and malformed submits (errors, focus on the e-mail), sign-up from a challenge (→ `/bun-venit?provocare=frizerie`), an existing address on sign-up, a wrong password, switching modes with the address kept, a password sign-in with a handle back to `/proiecte/brici#pareri`, a first sign-in carrying `next` to `/bun-venit`, signed in already (→ `/provocari/frizerie`), 429 and a network failure (intercepted), an ended challenge's slug, and no running challenge (deadline moved in the local database).

## 2026-11-14 · Screen 07 data

- **"Not onboarded" means `onboardedAt` is null,** not "no handle". The seed gives `bianca-radu` a handle (so `/dev/login-as` works) but no `onboardedAt`, and a real account could get a handle before onboarding (a provider, later). Screen 06's destination rule was changed to match: `signInDestination({ onboarded })`.
- **`profiles.onboard(userId, input)`** finishes a first sign-in in one transaction: name, city, `toolsInterest`, `remindersOptIn` exactly as ticked (rule 22), `onboardedAt`, and a handle when there's none. It happens once (`already_onboarded`); editing a profile is a separate method, to come. Refusals: `name_empty`, `name_too_long`, `city_too_long`, `unknown_tool`.
- **Limits:** name 1–60 characters, city up to 60 (placeholders, `NAME_MAX_LENGTH`/`CITY_MAX_LENGTH` in core). Spaces are tidied ("  Bianca   Radu " → "Bianca Radu"), and an empty city is stored as null.
- **Handles** are made from the name: diacritics folded (ș ț ă î â, Hungarian ő ű too), lowercase, words joined by "-", at most 40 characters, "constructor" for a name with no latin letters or digits. A taken handle gets the first free number ("bianca-radu-2"). A per-handle advisory lock stops two people with the same name getting the same one. A handle the user already has is kept.
- **Tools** are the screen's fixed list (Claude, Cursor, v0, Lovable, Bolt). "Încă nu știu" is stored as `unsure`, so an edit form can show it again, and it never goes with a tool: picking it clears the tools, and picking a tool clears it. Core refuses the two together.
- **`givenName` and grammatical gender aren't asked.** The reference shows only the name. A family-name-first user is still called by their family name in sentences (DECISIONS, "Screen 02 data"), and screen 08 needs a decision on "Ești înscris/ă" (§13.3) without a stored gender.

## 2026-11-14 · Screen 07 build

- **Prefilled from the account,** not from fixtures: name, city, tools and the reminders choice the user row already has. A password sign-up starts empty (no name); a provider's name will show here once OAuth is back. Bianca's seeded row holds exactly the reference's values, so the capture compares cleanly without a fixtures-only path.
- **Where it goes:** signed out → `/intra`, carrying `provocare` and `next` (sign-in comes back here while onboarding isn't done). Onboarded already → on, as from a sign-in. After saving, the action `completeOnboarding` redirects with `signInDestination` (`next`, else `/provocari/<slug>`, else Home); screen 08 joins the challenge there.
- **The button:** "Gata, intru în provocare" when they came from a challenge (a joinable `provocare`), "Gata, intru în comunitate" otherwise (new copy, like screen 06's two H1s).
- **"Editează profilul" (`/u/<handle>/editeaza`) is not built here.** Editing needs the fields 07 doesn't have (bio, links, avatar), a different heading and button, and an `edit()` method that allows a handle change or not. It stays a 404 until it's built; the profile button stays.
- **The shell doesn't force onboarding.** Screen 08's reference is captured as Bianca signed in and not onboarded, so a layout that sent un-onboarded users to `/bun-venit` would break it. Instead the header's avatar links to `/bun-venit` with the label "Termină-ți profilul" (new copy) until `onboardedAt` is set. Known gap: someone who skips onboarding can still review with an empty name. Decide when the profile edit lands, or require onboarding in `reviews.post`.
- **Checkbox** (`components/checkbox.tsx`) per spec. Its native box is drawn in the light scheme (`scheme-light`) in both themes: the reference pages declare no dark `color-scheme`, so their unticked box is white on the dark panel.
- **Tool chips** are FilterChips (`type="button"`, `aria-pressed`) in a `role="group"` labelled by "Cu ce vrei să construiești?" and described by its hint. They wrap, as in the reference (the sideways scroll is for the board's filter rows).
- **New copy, for the owner to review:** "Gata, intru în comunitate", "Scrie-ți numele.", "Cel mult 60 de caractere.", "Termină-ți profilul", "Nu a mers. Mai încearcă o dată."
- **Visual check (`capture.mjs --only 07`, against `pnpm dev`):** all four variants `match` (desktop 0.22% and 0.15%, mobile 0.39% and 0.36%). The two differences left: the button says "…în comunitate", because `capture.mjs` opens `/bun-venit` without `provocare`, and the dev-mode "N" indicator.
- **Manual pass (§9.5):** 390, 768, 1024 and 1280px in both themes, with errors showing and the Hungarian sample on every text: no horizontal scroll, long chip labels wrap inside their chips. Keyboard order: name, city, the six chips, the checkbox, the button, with the 3px outline on each. Tried on `pnpm dev`: signed out (→ `/intra` with the query), Bianca prefilled, the exclusive "Încă nu știu", an empty name (error, focus), a city over 60, a new password account through `/intra?provocare=frizerie` → `/bun-venit` → `/provocari/frizerie` with handle `ana-pop` and everything stored, and an onboarded user on `/bun-venit?next=/lansari` (→ `/lansari`).

## 2026-11-14 · Screen 08 data

- **`core.challenges.join(userId, slug)`** (rule 2: one action). Joining again changes nothing and keeps the first join time. Joining after leaving clears `leftAt` and starts `joinedAt` from now, so a rejoin moves to the end of the list. Refusals are values:
  - `ended`: the deadline has passed (rules 1 and 3).
  - `not_onboarded`: no name yet. The participant list names people, and a password sign-up has an empty name until `/bun-venit`. So sign-in joins only someone onboarded, and `/bun-venit` joins the rest (see "Screen 08 build").
  - `not_found`: an unknown slug.
- **Upcoming challenges can be joined,** as screen 06 already assumed (`getJoinableChallenge`: running or upcoming). Ended ones can't.
- **`leave(userId, slug)`** (rule 2) sets `leftAt`. It doesn't touch projects: they stay in the lists and the counts ("Proiecte lansate · 25"); only the person leaves the participant list and its count. Refusals: `not_joined`, `not_found` and `ended`. After the deadline the list is the month's record ("64 de oameni au construit"), so leaving isn't offered then.
- **`participation(challengeId, userId)`** returns `{ joinedAt }` while they're in, and null otherwise. **`steps(challengeId, userId)`** gives "Pașii tăi": `posted` (a project of theirs in the challenge, any stage) and `launched` (one of them launched; a late launch counts, since the step is about launching).
- **`participants()` keeps the viewer in join order.** The 08 reference lists the avatars as on 02 (Bianca 7th), while the sentence starts with "Tu". The viewer is still always among the avatars when they're in; the page names them first.
- **Fixtures, decided by the owner:** the seed joins Bianca to `frizerie` a minute before the frozen clock, after the fixture extras are worked out, so her join adds one: every screen at the reference moment reads **87**. Screens 01, 02 and 06 therefore read 87 (and 02 "încă 84") where their references say 86; 02 gains its 8th avatar (BR), as in its reference. Screen 07 reads only her profile and is unaffected (still `match`).
- **Avatars:** having joined last, Bianca's avatar comes after Szabó Attila's (…VI, SA, BR), while both references show BR before SA (fixture order). That's an expected difference on 02 and 08.
- **Bianca's vote on Tuns la Fix:** the 08 reference shows "Ai votat · 128" on it, which `fixtures.votes` doesn't have. The seed adds it (`EXTRA_VOTES`), inside the 128, so screens 01–04 don't change.

## 2026-11-14 · Screen 08 build

- **The banner, once:** a join redirects to `/provocari/<slug>?inscris=1` (`joinedHref`): from the join button, from `finishSignIn`, and from `completeOnboarding`. The page shows "Ești în provocare, …" (`role="status"`) when the flag is there and the viewer is in the challenge. `FlashBanner` then drops the flag with `history.replaceState`, so a reload, a bookmark or a shared link never shows it again.
  - **Design fixtures only:** a join less than 10 minutes old (by the frozen clock) counts too. `capture.mjs` opens the plain route, and Bianca's seeded join is a minute old, so screen 08's capture shows the banner.
  - **Turned down:** a flash cookie (it needs a client round trip to clear, and the seed can't set one), and a `welcomedAt` column (the first `capture.mjs` variant would use it up, so the other three would miss the banner).
- **Banner copy:** "Ești în provocare, {name}." then "Ai 19 zile să construiești și să lansezi." `{name}` is how the participant list calls them (`givenName`, or the name's first word), and the days are the countdown's whole days. New copy:
  - "Ai o zi…" and "Ai 20 de zile…" (Romanian plurals);
  - "Ai mai puțin de o zi să construiești și să lansezi." on the last day;
  - "Începe pe 1 decembrie. Până atunci, citește brief-ul." for an upcoming challenge;
  - "Ești în provocare." without a name.
- **The chip is "Ești înscris/ă"** (HANDOVER §6 08's fallback, §13.3). Nothing stores or asks for a grammatical gender: screen 07 asks only the name, and guessing from a name is unreliable. §13.3's neutral "Ești în provocare" was turned down because the banner right above it says the same words. The chip is 5px wider than the reference's "Ești înscrisă". Storing a gender is the owner's call (NEXT-ACTIONS). The chip shows only while the challenge is running or upcoming.
- **"Intră în provocare" by viewer:**
  - Signed out: `/intra?provocare=<slug>` as before, with "Durează un minut." under it. Signing in joins.
  - Signed in, not onboarded: `/bun-venit?provocare=<slug>`, with the same note; finishing onboarding joins (core refuses `not_onboarded` before that).
  - Signed in and onboarded: a form posting `joinChallenge` (one action), with no note, since there's nothing to sign in to. A refusal shows under the button: "Provocarea s-a încheiat între timp." or "Nu a mers. Mai încearcă o dată." (new copy).
- **Joining on sign-in:** `finishSignIn` joins a joinable `?provocare=` when the user is onboarded; otherwise `/bun-venit` carries it on and `completeOnboarding` joins it. `next` still wins the redirect (no banner then), but the join happens anyway.
- **The participant's sidebar** (in "Timp rămas", after the deadline line, as in the reference): "Pașii tăi" with three steps from real data:
  - "Te-ai înscris" is always done;
  - "Pune linkul când merge ceva" and "Marchează-l ca lansat până pe 30 noiembrie" follow `steps()`.
  
  Done steps get a filled `primary` circle with a check, `muted` text and " · făcut" after it (the reference's words, which also tell screen readers); the circles are decorative. Then primary "Adaugă proiectul" → `/lanseaza` (screen 09, a 404 until it's built) and the "Renunță la provocare" text button, full width, as in the reference.
- **Leave confirm** (no reference design): shadcn's `alert-dialog` on Base UI 1.9, rewritten onto our tokens (`components/ui/alert-dialog.tsx`, `components/leave-challenge.tsx`):
  - The panel is `surface` with a `line` border, radius 12 and `shadow-raised`, 440px wide at most and centered, with no animation.
  - The backdrop is `bg` at 80%: pale in light mode, dark in dark mode, with no colour of its own.
  - The focus starts on "Rămân", so Enter never leaves by accident. Escape or "Rămân" closes it and returns the focus to the trigger.
  - After leaving, the page reloads with `?renuntat=1`, which shows a quiet status line (`tint`, no icon) once, the same way as the banner.

  | Where | Copy |
  |---|---|
  | Title | "Renunți la provocare?" |
  | Text | "Ieși din lista participanților. Proiectele tale rămân publice, iar până la termen poți intra din nou oricând." |
  | Buttons | "Rămân" (secondary), "Da, renunț" (primary) |
  | Refused | "Provocarea s-a încheiat între timp." / "Nu a mers. Mai încearcă o dată." |
  | After leaving | "Ai ieșit din provocare. Proiectele tale rămân publice." |
- **Ended challenge:** a participant sees what everyone does (no "Timp rămas" panel, so no steps or leave), and no chip.
- **StatusChip is capped at its row** with an ellipsis, like Tag and AgentBadge, and the two chips wrap as a pair. With the Hungarian sample on phones the pair pushed the page sideways.
- **Visual check (`capture.mjs --only 08`, against `pnpm dev`):** desktop light and dark `differs` 16.7% and 15.9%, mobile 24.6% and 22.5%, all expected:
  - everything screen 02 reports ("Screen 02 build"): the hidden M2/M3 sections (the page is 423px shorter on desktop), thumbnails, and the launched rows;
  - on phones, the page is 897px shorter: 02's 861px plus 36px, because beside two chips the hidden "Toate provocările" link would take a line of its own;
  - "Ești înscris/ă" (above);
  - "Pune linkul când merge ceva · făcut": Bianca's seeded "Rând la Tuns" is in progress, so the step is done, and on desktop it wraps to two lines (22px);
  - the avatars' order (BR after SA, "Screen 08 data").

  Comparing element positions in the reference HTML and the app with Playwright at 1280 and 390px, the banner, the eyebrow, the title, "Timp rămas", "Pașii tăi" and each step, the buttons and the people panel match to the pixel, apart from the shifts above. Aligned regions: desktop 0.15–0.30% (header, banner, the sidebar down to the steps, the main column), 0.84% around the done step, 0.15% for the people sentence; mobile 0.00–0.03%, and 1.23% around the done step. Avatar rows: 10.9% and 12.1% (the swap).
- **Other screens after the seed change:** 01 mobile 0.47% → 0.57% ("87"), 02 unchanged in size and percentages (15–22%), 03–05 unchanged, 06 5.2% desktop, 07 still `match`.
- **Manual pass (§9.5):** 390, 768, 1024 and 1280px in both themes, as Bianca, with the Hungarian sample on every text: no horizontal scroll after the chip fix, nothing clipped except the chip ellipsis. Keyboard: the dialog is `role="alertdialog"` with `aria-labelledby` and `aria-describedby`; Tab and Shift+Tab stay inside it (Base UI's focus guards move the focus back asynchronously); Escape returns the focus to "Renunță la provocare". Tried on `pnpm dev` (Playwright):
  - signed out (link to `/intra?provocare=frizerie`, note, 87);
  - a new password account from `/intra?provocare=frizerie` → `/bun-venit?provocare=frizerie` → joined, with the banner, "Tu, Ioana, Andrei și încă 85." and 88, the flag dropped and no banner after a reload;
  - leaving (status line, 87, the one-click join button);
  - rejoining with that button (banner);
  - signing out and back in through `/intra?provocare=frizerie&cont=intra` (joined, banner);
  - Bianca leaving (her link becomes `/bun-venit?provocare=frizerie`);
  - Ioana on the ended `cafenea` (no chip, steps or leave).

## 2026-11-15 · Screen 09 data

- **`core.projects.create(ownerId, input)`, `edit(userId, slug, input)` and `editable(slug, userId)`** (the form's prefill, owner only). Refusals are values; the list is `SaveRefusal` in `projects/save.ts`. The rules that need no database (`PROJECT_LIMITS`, `isHttpsUrl`, `missingToLaunch`) live in `projects/rules.ts`, exported as `@repo/core/project-rules`, so the form's zod schema checks them with the same code.
- **Rule 4:** "În lucru" needs a name, pitch and live link; "Lansat" also needs 2+ screenshots, a description, "Cât a durat?" and "Ce a fost cel mai greu?" (the prompt stays optional). A refused launch says what's missing (`incomplete`, `missing: [...]`), so the form marks every field at once.
- **Limits:** name 60 and pitch 80 (§4), update 140 (§4), at most 4 screenshots. Placeholders, in `PROJECT_LIMITS`: description 2000, "Ce a fost cel mai greu?" 200 (it's a one-line input), prompt 2000, 8 tools, a tool 30 characters (DECISIONS "Screen 02 build" asked for that cap), live link 2000.
- **The slug** is made from the name when the project is created, like a handle ("Țuică & Cod" → `tuica-cod`, then `tuica-cod-2`; "proiect" when nothing latin is left), and never changes after: shared links keep working when the name does.
- **`projects.is_late`** (rule 7), set with `launchedAt` at the moment of launch, and fixed like it. A later change to the deadline doesn't move it. Migration `0007_screen_09`.
- **Rule 6:** `launchedAt` is set once; saving a launched project as "În lucru" is refused (`already_launched`), and the form doesn't offer it.
- **Which challenge:**
  - A new project goes to the running challenge or to none (`challenge_not_running` for anything else, upcoming included: there's no brief to build yet).
  - A project in progress can move between its own challenge (even once it has ended), the running one and none.
  - A launched project stays in its challenge (`challenge_locked`): its votes were cast there. A launched project of its own stays its own.
- **Saving a project for the running challenge joins it** (rule 2), and rejoins someone who had left: posting a project is taking part, and the participant list is the month's builders (the seed already treats every owner as a participant). The same goes for moving a project in progress into the running challenge. Other edits never rejoin.
- **Only someone onboarded creates a project** (`not_onboarded`): a project shows its builder's name. `/lanseaza` sends anyone else to `/bun-venit?next=/lanseaza`.
- **Rule 9, when:** on create, whenever the link changes, and when launching. Not on every edit, so a site that's briefly down doesn't stop someone fixing a typo in the description.
- **Rule 9, how** (`server/link-checker.ts`): one GET, 5 s, up to 3 redirects, each https. 2xx opens. 401 and 403 are `link_needs_account` ("Linkul cere cont sau parolă…"), except a Cloudflare bot check (`cf-mitigated: challenge`), which a browser gets through. Anything else, no answer included, is `link_unreachable`. Private, loopback, link-local (cloud metadata) and other non-internet addresses are refused inside the DNS lookup, at connect time, so a name can't pass the check and then resolve somewhere else. Design fixtures treat `.example` hosts, which the seed uses and which never resolve, as opening.
- **Updates (rule 8)** can be added on any edit, in progress or launched (an in-progress row shows its latest update), not on create. The next version is the highest plus one, taken while the edit holds the project's row.
- **`buildDurationText`** (the builder's own words, screen 04) has no field on the form; it's kept until "Cât a durat?" changes, then cleared, since it described the old answer.
- **Tools** are stored in the order they were picked (cards show the first two), each once whatever its case, as first written.
- **Screenshots** must be files our storage holds (`storage.owns`, `screenshot_unknown`), so a request can't attach any image URL.
- **`challenges.launch_check`** (new, nullable): the brief's end-to-end test, the last line of "Înainte să lansezi" ("Ai făcut o programare de test, de la cap la coadă."). The seed sets it for `frizerie`. Without one (a project of its own) the list has the two fixed lines.
- **Not added:** §4's `updatedAt`, which nothing shows.

## 2026-11-15 · Screen 09 build

- **"Salvează ciorna" keeps the form in this browser** (`localStorage`, one draft per account), never on the server and never public. Coming back to `/lanseaza` restores it, with "Am pus înapoi ciorna salvată pe acest dispozitiv." and an "Începe de la zero" button; a successful save drops it. §4 has no draft stage and GLOSSARY says "În lucru" isn't a draft: "În lucru" is public. A server-side draft was turned down: every list, count, profile and "Pașii tăi" would have to leave it out. The edit page has no draft button (the project is public already).
- **Storage, locally** (`server/storage.ts`): the browser posts each file to `POST /api/capturi` (session, png/jpg/webp by the bytes, not the name, 5 MB). sharp turns it to webp (at most 1600px on the long side, EXIF orientation applied, metadata such as GPS dropped, quality 80) and it's written to `apps/web/.data/capturi/` (gitignored), served by `/dev/captura/<name>`. This adapter runs only off Vercel; on a deploy without Blob, uploads answer "Aici nu se pot încărca imagini încă." The Blob adapter (browser → Blob through the token route, then sharp) waits for the store (NEXT-ACTIONS). Uploads that are never saved, or removed later, aren't cleaned up yet.
- **The form:** react-hook-form + zod (`lib/schemas/project.ts`, shared with `saveProject`), validated on blur and on submit; errors replace hints in live regions, and the first invalid field gets the focus (a server refusal too). The live link is checked on blur through `checkLiveUrl` (signed in only, once per address), the same check a save makes. "Cât a durat?" shows "Alege" until something is picked, so nothing is chosen for the builder.
- **"Pentru ce provocare?"** lists the running challenge (the default) and "Fără provocare · proiect propriu"; editing adds the project's own challenge first. For a launched project it shows only its challenge, with the hint "Un proiect lansat rămâne în provocarea lui."
- **"Unelte folosite"** has the reference's chips (Claude, Next.js, Supabase, Tailwind CSS, Vercel, Cursor; screen 07's list is different, as in the references). "+ Alta" opens a small field (30 characters) with "Adaugă" and "Renunță"; Enter adds, Escape closes, and the focus goes back to "+ Alta". A typed name that matches a chip ("claude") selects that chip. Long names wrap inside the chip.
- **Screenshots:** tiles are buttons ("Captura 1 din 3, apare pe panou", described by "Mut-o cu săgețile sau trage-o."). Arrow keys, Home and End move the focused tile; a mouse drags at once; a finger drags after resting 250 ms, so a swipe over the tiles still scrolls. Every move is announced ("Captura e acum pe locul 2 din 3."). The remove button is 28px as drawn, with a 44px target; after removing, the focus goes to the next tile or "Adaugă".
- **The preview** is LaunchRow's own layout (`LaunchRowFrame`, now shared with `LaunchRow`) at phone sizes, live from the form: the first screenshot, the name ("Numele proiectului" in `muted` while empty), the pitch, the first two tools and the builder, and VoteCount ("0 voturi · proiectul tău", or "în lucru" while that stage is chosen). Its title and tags aren't links, so nothing leaves an unsaved form.
- **The buttons:** "Lansează proiectul" or "Salvează" by stage; full width on phones, as in the reference. Editing a launched project says "Salvează" and has no stage chips (rule 6), and the update field ("Ce s-a schimbat?", "…Apare ca v4 pe pagina proiectului.") sits above the buttons when editing.
- **After saving,** `saveProject` returns where to go and the form navigates (a `redirect()` rejects the client's promise, so the form couldn't tell a save from a failure, and kept the draft). A launch goes to `/proiecte/<slug>/lansat` (screen 10, a 404 until it's built); anything else to the project's page with "Am salvat proiectul." once (`?salvat=1`, `FlashBanner`).
- **The owner's "Editează proiectul"** (secondary) is a new button on the project page, after "Distribuie" (no reference design; screen 04 is captured as Andrei, so its capture doesn't change).
- **`/proiecte/<slug>/editeaza`:** signed out → `/intra?next=…`; someone else's project → its page (they can see it anyway); an unknown slug → 404. The title is "Editează proiectul" with "Ce schimbi apare pe pagina proiectului imediat ce salvezi."
- **Design fixtures prefill `/lanseaza` for `ioana-muresan`** (`lanseaza/fixture-draft.ts`) with the reference's values word for word, which aren't Tuns la Fix's row (a shorter description, other tools), and two of the fixtures' placeholder screenshots. Anyone else gets the empty form, as in the product. Saving the prefilled form creates `tuns-la-fix-2`; reseed after.
- **"Lansări" is the current nav link on `/lanseaza`,** as in the reference.
- **New copy, for the owner to review** (none of it has a reference design): the errors ("Scrie numele proiectului.", "Spune într-o frază ce face.", "Pune linkul la care se deschide proiectul.", "Pune un link public care începe cu https://.", "Linkul nu se deschide. Încearcă-l într-o fereastră privată, apoi mai verifică o dată.", "Linkul cere cont sau parolă. Trebuie să se deschidă pentru oricine.", "Pentru lansare ai nevoie de cel puțin 2 capturi.", "Pentru lansare scrie câteva rânduri despre proiect.", "Alege cât a durat.", "Spune ce a fost cel mai greu.", "Cel mult 8 unelte.", the upload errors, "Provocarea nu mai primește proiecte noi. Alege „Fără provocare”.", "Termină-ți profilul înainte să lansezi.", "Nu s-a salvat. Mai încearcă o dată."), "Verific linkul…", "Alege", "Renunță", the draft lines, the edit page's title, lead and update field, "Editează proiectul", "Am salvat proiectul.", and the screenshot tiles' labels and announcements.
- **Visual check (`capture.mjs --only 09`, against `pnpm dev`):** all four variants `match` (desktop 0.54% and 0.39%, mobile 1.16% and 0.81%). What's left: the screenshot tiles (placeholder art against flat `tint`, §9.4) and the select's "…frizerie de cartier" (the open title question, "Screen 04 build"). Element positions match the reference HTML to the pixel at 1280 and 390px. Screens 02, 03 and 04 are unchanged by the LaunchRow refactor.
- **Manual pass (§9.5):** 390, 768, 1024 and 1280px in both themes, with errors showing, a long custom tool and the Hungarian sample on every text: no horizontal scroll, nothing clipped. Keyboard order: the challenge, name, pitch, link, each tile and its remove button, "Adaugă", the description, the tool chips, "+ Alta", the build fields, the stage chips, the two buttons; the 3px outline on every stop. Tried on `pnpm dev` (Playwright): signed out (→ `/intra?next=/lanseaza`), not onboarded (Bianca → `/bun-venit?next=/lanseaza`), an empty submit (three errors, focus on the name), an empty launch (seven), the link on blur (http, `https://127.0.0.1`, an unknown host, a real site, `.example`), a fake png, three uploads, reordering by keyboard and by mouse, removing, "+ Alta", a draft kept across a reload and dropped after the launch, a launch (→ `/lansat`, joined, tools and screenshots stored), a project of its own in progress (→ its page, the saved line), its edit with an update (v1 shown), Andrei on Ioana's edit page (→ her project), Ioana editing launched Tuns la Fix (no stages, one challenge, "v4"), and a late launch (frizerie's deadline moved back in the local database: Szabó Attila's Foarfeca launched with `is_late`, and a new project could only be its own).

## 2026-11-15 · Owner accepted screens 01–09

- **Decided by the owner** ("accept all pages"): screens 01–09 stay as built. That settles, as they are now:
  - the copy without a reference design from screens 01–09 (each screen's "build" entry lists it), and the password sign-in copy with "Durează un minut.";
  - Home's heading stays "Cele mai votate săptămâna asta" (§13.1), showing the running challenge's top 3;
  - "Ești înscris/ă" with no stored gender (§13.3);
  - the stored challenge title, "…de cartier" included;
  - the board's fixed tag chips;
  - the show-password button keeps `aria-pressed` and its changing label;
  - someone who skips onboarding can still review;
  - the review rules (only owners reply, owners don't review their own project, 2000 characters);
  - screen 09's calls (the draft in this browser only, joining on save, the locked challenge, the fixed slug, the placeholder limits) and the owner's "Editează proiectul" on screen 04.

## 2026-11-15 · Screen 10 data

- **Rule 16, when:** inside the transaction that launches a project, in `projects.create()` and `edit()` (`reviews/assignments.ts`, `assignOnLaunch`). A relaunch can't happen (rule 6), so a project launches, and assigns, once. Saving in progress, or editing after the launch, assigns nothing.
- **Rule 16, which:** launched projects in the same challenge, not the builder's own, not an agent's, not one they've reviewed (any review of theirs, in progress included), not one already assigned to them. Fewest human reviews first, counted like the rows show them (with the fixture extras, so the fixtures pick what the screens suggest); a tie goes to the **oldest launch** (it has waited longest), then the id.
- **Two per builder per challenge, not per launch.** Assignments belong to the reviewer, not to a launch (`review_assignments` has no launch column). A second launch in the same challenge adds none once they hold two, done or not.
- **Fewer than two candidates:** they get what there is. Then, when someone else launches in that challenge, every builder there still short of two gets the new launch (it has no reviews yet, so it's the fewest anyway), unless they already reviewed it. So the first launchers of a month aren't left without assignments. A per-challenge advisory lock keeps two launches at once from topping someone past two.
- **A project of its own** (no challenge) gives no assignments: there's no "same challenge" to pick from.
- **A late launch** (rule 7) gets assignments like any other: reviews stay open after the deadline, and its builder is still asked to give two.
- **Agents** get none (they never review, §12), and an agent's launch is given to nobody.
- **`projects.launch(slug, viewerId)`** is the page's one read: the owner's launched project (summary, launch time, challenge), their assignments in that challenge with `done`, in the order given and then oldest launch first, and `expected` (2, or 0 for a project of its own). Refusals: `not_found`, `not_owner`, `not_launched`.
- **Counts at the launch (HANDOVER §9.4):** `launch()` takes `countsAtLaunch`, which counts only the votes and human reviews created by `launchedAt`, without fixture extras. Only design fixtures pass it, so screen 10 shows Tuns la Fix with 0 votes and no reviews, as the reference does; everywhere else the page shows the real counts.
- **Seed:** Ioana's two assignments are a second apart, in fixture order (Scaunul 3, then La Fix), so the page lists them as the reference does. Nobody else in the fixtures holds assignments, so the first launch tried locally is given to every human builder of `frizerie` (the top-up above). Expected; reseed after trying.

## 2026-11-15 · Screen 10 build

- **Who sees `/proiecte/<slug>/lansat`:** only the owner of a launched project, any time (it's where their assignments live; nothing links back to it yet besides the launch itself). Signed out → `/intra?next=…`; someone else, or a project still in progress → the project's page; an unknown slug → 404.
- **"E lansat. Bravo, {name}!"** calls them as screen 08's banner does (`givenName`, or the name's first word); "E lansat. Bravo!" without a name. The chip, title and line are one `role="status"` block (§10).
- **The project's row** uses VoteCount "own" (rule 11), "0 voturi · proiectul tău", whatever the deadline.
- **LaunchRow drops "0 comentarii"** everywhere: no reference shows a zero count, and screen 10's fresh launch has none.
- **The counter** is "{done} din 2": warning until both are done, then success (§6). Each done row gets a success chip "Ai scris părerea" after the builder (new copy).
- **Buttons:** primary "Scrie prima părere", or "Scrie a doua părere" once one is done (new copy), to the first open assignment's `#pareri`. When none is open, the button goes and "Vezi proiectul tău" becomes the primary, so the view keeps one. Full width on phones, as in the reference.
- **Fewer than two assigned:** under the rows, "Al doilea proiect îți apare aici când mai lansează cineva în provocare." or, with none, "Proiectele îți apar aici pe măsură ce lansează și alții în provocare." (new copy).
- **A project of its own:** no "Mai ai un pas" section; "Vezi proiectul tău" (primary) right under the row.
- **"Arată-l oamenilor" in M1:** the heading and the copy-link field only. The field shows the address without `https://` (as the reference does), read-only, selected on focus; "Copiază linkul" copies the full link and says screen 04's "Am copiat linkul." in a status line. The address is the request's own host, so locally it reads `localhost:3001/…`. The share image, "Descarcă imaginea" and the hint under the field ("…apare cu imaginea de mai sus") wait for M2 (`flags.shareImage`); "Vrei să te poată contacta cineva?" waits for M3 (`flags.contactConsent`).
- **The closing line stays** ("Îți scriem pe e-mail când primești o părere…"), word for word, though the new-review e-mail waits for Resend: it's an M1 feature (§11).
- **Visual check (`capture.mjs --only 10`, against `pnpm dev`):** all four `differs` (40% desktop, 30% mobile), all expected:
  - the hidden share image, its button and hint (M2) and the contact section (M3): the page is 621px shorter on desktop and 489px on phones, so everything below the share heading is compared against other content;
  - the link field reads `localhost:3001/proiecte/tuns-la-fix` instead of `itstart.ro/…`;
  - the thumbnails (flat `tint`, §9.4).

  Comparing element positions in the reference HTML and the app with Playwright at 1280 and 390px, the title, the three rows, both headings, the buttons, the field and "Copiază linkul" match to the pixel (the field and the button sit higher by the hidden image). From the header to the share section's divider, with the thumbnails masked: 0.19% and 0.20% desktop, 0.06% and 0.04% mobile. Screens 01–05 and 09 are unchanged.
- **Manual pass (§9.5):** 390, 768, 1024 and 1280px in both themes with the Hungarian sample on every text: no horizontal scroll, nothing clipped but the Tag ellipsis. Keyboard order: the rows (title, tags, vote), the buttons, the field, "Copiază linkul", with the 3px outline on every stop. Tried on `pnpm dev` (Playwright): signed out, Andrei on Ioana's page, Bianca's project in progress, an unknown slug, a real launch through the edit form (Szabó Attila's Foarfeca: Coadă Zero and La Fix, the two with the fewest reviews, and the top-up to the other builders), Ioana writing both reviews from "Scrie prima/a doua părere" ("2 din 2", both rows marked, "Vezi proiectul tău" primary), one assignment short (the waiting line), and a project of her own.

## 2026-11-15 · Admin: challenges

HANDOVER §3, M1: "admin can create a challenge and edit it". No reference design; functional styling on our tokens and components.

**Core** (`challenges/admin.ts`; the rules that need no database in `challenges/rules.ts`, exported as `@repo/core/challenge-rules`):

- **The admin enters a month, not dates.** Rule 1 fixes both ends: a challenge runs from 00:00 on the 1st to its deadline, 23:59 on the last day, in Europe/Bucharest (`monthBounds("2026-12")`). The fixtures already fit this shape. Typing a start or deadline would only allow mistakes, and a native month input is missing from Safari, so the form has a select of months.
- **One challenge a month** (`month_taken`). That's what makes rule 1's "exactly one running" hold without checking overlaps.
- **Numbers are the next free one** (highest + 1), given on create and never changed. **They follow the months:** a new challenge must come after every other one, and an upcoming one can't move past a neighbour (`month_out_of_order`). Renumbering was turned down: an upcoming challenge is already public at its address and joinable.
- **No month that has ended** (`month_past`). This month is allowed, so the very first challenge can start mid-month; it's running as soon as it's saved.
- **The slug** is the admin's choice (lowercase latin letters, digits and "-", at most 40). Left empty, it's made from the short title, or the title, like a project's (`cafenea`, then `cafenea-2`). A chosen one that's taken is refused (`slug_taken`), not numbered, since the admin picked it on purpose.
- **Once a challenge has started** (running or ended), its month and slug are fixed (`month_locked`, `slug_locked`). People joined for that deadline, late launches were flagged against it (rule 7, fixed at launch), and the address is shared. Everything else can still change, ended challenges included: the brief's typos, and the jury's note, which comes after the end.
- **Required:** the title and the month. Everything else is optional and can be filled in while the challenge is upcoming; the public pages already leave out what's empty (DECISIONS "Screen 01 build", "Screen 02 build").
- **Lists** (`baseLevel`, `stretch`, `launchCriteria`) are typed one item per line; blank lines are dropped and spaces tidied. At most 12 items of 200 characters each. **Tips** are title + text pairs, at most 4 (the 2×2 grid); an empty pair is dropped, half a pair is refused. Other limits are placeholders in `CHALLENGE_LIMITS` (title 120, short title 30, summary 300, scenario 3000, jury note 1000…). The materials link must be https (`isHttpsUrl`, the project rule). It isn't checked for reachability: it's the team's own file.
- **Admins only, by the database:** `create()`, `edit()`, `all()` and `editable()` take the actor's id and read their role inside the call (`not_admin`). Writes hold one advisory lock, so two saves can't take one month, number or slug.
- **Not added:** a unique index on `starts_at`. The lock and the check cover it, and it would need a migration for no visible gain.

**App:**

- **Who sees `/admin`:** signed out → `/intra?next=<path>` (an admin whose session ran out gets back in); a member → 404, which doesn't advertise the area. `requireAdmin(path)` does this at the top of every admin page. The layout checks nothing (ARCHITECTURE, "Admin checks"). `/admin` redirects to `/admin/provocari`.
- **The shell:** the wordmark, one nav link ("Provocări"), "Înapoi pe site", no footer, `noindex`.
- **The list:** newest month first: "#5 · decembrie 2026", the status chip as on screen 02 ("În desfășurare", "Începe pe 1 decembrie", "Încheiată"), the title, and secondary "Editează" and "Vezi pagina" (hidden "provocarea #5" for screen readers). "Provocare nouă" is the one primary.
- **The form:** react-hook-form + zod (`lib/schemas/challenge.ts`, shared with `saveChallenge`), validated when a field is left and on submit; errors replace hints in live regions, and the first invalid field gets the focus (a server refusal too: `slug_taken` on the slug, the month refusals on the month). Five panels: De bază (title, short title, slug, month), Pe pagina principală și la înscriere (summary, `builtFor`, `buildingPhrase`), Brief-ul (intro, scenario note, scenario, the three lists, launch note, `launchCheck`, materials), Construiește-l cu AI (the tip cards), Juriul (`juryNote`). Each hint says where the text shows up.
- **The month select** offers this month to a year ahead, and the challenge's own month. Months other challenges hold are disabled. A new challenge starts on the month after the newest one. Once started, the select holds only its month, and the slug field is read-only; both hints say why.
- **Tip cards:** "Adaugă un card" moves the focus to the new card's title; "Șterge cardul" (labelled "Șterge cardul 2") moves it to "Adaugă un card".
- **After saving,** the form goes to `/admin/provocari/<slug>?salvat=1` ("Am salvat provocarea.", `FlashBanner`), with "Vezi pagina provocării" above the form.
- **New copy** (all of it; no reference design): `admin` in `ro.json`.
- **Tried on `pnpm dev`** (port 3001; port 3000 held by onepage.ro's server), with Playwright:
  - signed out (→ `/intra?next=%2Fadmin%2Fprovocari`), Andrei (404 on the list and the edit page), the admin;
  - an empty submit (title error, focus on it), a non-https materials link and half a tip card;
  - a taken slug (the server's refusal on the field, focused), then a challenge with every field (→ #5, `pensiune`, December);
  - moving it to January;
  - frizerie running: the slug read-only, one month;
  - saving twice on one page.
  
  Public pages, with `pensiune`'s dates moved to November in the local database (frizerie moved out) and reseeded after:
  - 01: the card's title and summary, the countdown, "Luna asta: o pensiune." and the band;
  - 02: the brief, the lists, materials, one tip card;
  - 08: Andrei joining, with the banner;
  - 09: "Provocarea #5 · …" in the select and "Ai făcut o rezervare de test…" in the checklist.
- **Manual pass:** 390 and 1280px in both themes: no horizontal scroll. Keyboard order: skip link, wordmark, "Provocări", "Înapoi pe site", "← Provocări", then the fields in visual order, "Adaugă un card", the jury note, the button; the 3px outline on each.
- **Seen on a fresh challenge, not changed** (screens 01–09 are accepted as built): Home's card reads "0 oameni · 0 agenți AI · 0 lansări" and 02's sidebar "0 oameni construiesc" until people join. NEXT-ACTIONS asks whether a new month should hide zero counts.

## 2026-11-16 · Profile editing

HANDOVER §3 M1 "profile", §4 User, §6 05 "Editează profilul". No reference design; screen 07's components and panel.

**Core** (`profiles.editable()` and `edit()`; the rules that need no database in `profiles/rules.ts`, exported as `@repo/core/profile-rules`, which screen 07's schema now imports too):

- **Fields:** the name (1–60), "Cum să-ți spunem?" (`givenName`, optional, 30), the city (60), the bio (240, §4), up to 3 links (§4), the picture, the tools (screen 07's list, "Încă nu știu" alone) and the reminders, saved exactly as ticked (rule 22). Not on the form: the e-mail (never shown, rule 23; changing it is Better Auth's, with verification, later), "Deschis la colaborări" (M3), `role` and `isAgent`. Core builds the row from these fields only, so extra keys in a request change nothing.
- **`givenName` is asked here, not on screen 07** (DECISIONS "Screen 07 data"): sentences call people by it ("Bravo, Réka!", the participant line), and without a field a family-name-first user (Hungarian, §1) would be called by their family name for good. Empty means the name's first word, as before.
- **The handle stays when the name changes,** like a project's slug (DECISIONS "Screen 09 data"): profile links are shared, and a changed handle would break them, or need redirects. The name field's hint says so ("Adresa profilului rămâne aceeași: /u/ioana-muresan.").
- **Text is tidied** like screen 07 (one line, single spaces); the bio is one paragraph, since the profile shows it as one. Empty optional fields are stored as null.
- **Links** must be https (`isHttpsUrl`, the project rule), at most 200 characters each (placeholder). Blank ones are dropped and duplicates kept once. They aren't checked for reachability (rule 9 is about a project's live link); the profile already marks them `nofollow ugc`.
- **The picture** must be a file our storage holds (`storage.owns`, `avatar_unknown`), as for screenshots. A picture they already have is kept on save even if it isn't ours (a provider's picture, once OAuth is back). Null removes it, and the initials on a pastel come back.
- **Only someone onboarded edits** (`not_onboarded`): `/bun-venit` comes first, since it gives the handle. The known gap (someone who skips onboarding can still review with an empty name; "Screen 07 build", accepted by the owner) is unchanged.
- **Refusals** are `{ reason: "invalid", field }` like the admin's challenge form, plus `not_onboarded` and `avatar_unknown`.

**App:**

- **`/u/<handle>/editeaza`:** signed out → `/intra?next=…`; someone else's handle → their profile (anyone can see it); not onboarded → `/bun-venit?next=…`; an unknown handle → 404. `noindex`.
- **The page:** "← Profilul tău", then screen 07's panel (560px rather than 520, for the links) with "Editează profilul" and "Ce schimbi apare pe profilul tău imediat ce salvezi."
- **The form:** react-hook-form + zod (`lib/schemas/profile.ts`, shared with `saveProfile`), validated when a field is left and on submit; errors replace hints, the first invalid field gets the focus (a server refusal too). Order: picture, name, "Cum să-ți spunem?", city, "Despre tine" (with "N din 240 de caractere", like the pitch on screen 09), the three links (a `fieldset` with "Linkuri"; each input labelled "Linkul 1…3" for screen readers), the tool chips and the reminders sentence, both word for word from screen 07, then primary "Salvează profilul" and secondary "Renunță" (back to the profile).
- **The picture** (`AvatarPicker`): the avatar at 72px as the profile will show it, "Încarcă o poză" / "Schimbă poza" and "Scoate poza". The file goes through `/api/capturi` with `shape=avatar`: the same checks as a screenshot (png/jpg/webp by the bytes, 5 MB, signed in), then sharp crops it to a 400px square from the middle, as webp, metadata dropped. Nothing is stored on the profile until the form is saved; each change is announced. With Blob, the same browser upload moves to the token route.
- **After saving,** the form goes to the profile with "Am salvat profilul." once (`?salvat=1`, `FlashBanner`). `saveProfile` calls `refresh()` so the header's avatar and name update too (ARCHITECTURE, gotchas).
- **New copy, for the owner to review** (all of it: `profile.form` and `profile.saved` in `ro.json`).
- **Tried on `pnpm dev`** (port 3001; 3000 held by onepage.ro's server), with Playwright: signed out, Andrei on Ioana's edit page (→ her profile), Bianca not onboarded (→ `/bun-venit?next=…`), an unknown handle (404), Ioana prefilled, an http link (error on leaving the field), an empty name (error, focus), a picture uploaded, a new name, given name, bio, link, tool and reminders saved (→ the profile with the banner, the new name, picture and links, the handle unchanged, the header's picture updated). 390px dark and 1280px light: no horizontal scroll.

## 2026-11-16 · Admin: vote timeline

Rule 14: "admins can see vote timelines". Every vote and retraction is a row in `vote_events` ("Vote anti-abuse defaults"). No reference design.

**What an admin needs to spot abuse:** votes from accounts made just for voting, and many votes close together (a group of friends, or one person with several accounts). So:

- **Two marks on every toggle:** "Cont nou" when the account was under 7 days old *at the time of the toggle* (with its age then: "4 ore", "3 zile"), and "Rafală" when it's one of 5 or more toggles on the same timeline within 10 minutes. Placeholders in `TIMELINE` (`votes/timeline.ts`), like the vote limits. The 24-hour minimum (rule 14) already refuses the youngest accounts; a week catches accounts made for one challenge.
- **`votes.activity(adminId)`** (`/admin/voturi`): the projects and the voters with toggles in the last 7 days, 30 of each, most toggles in the last 24 hours first, then the week. Per project: toggles in 24 hours and 7 days, distinct voters, how many came from new accounts, the last one. Per voter: the account's date, the toggles, distinct projects, the last one.
- **`votes.timeline(adminId, { project } | { user })`** (`/admin/voturi/proiecte/<slug>`, `/admin/voturi/oameni/<handle>`): toggles newest first (the newest 300), each with its time to the second (Bucharest), "Vot" or "Retras", the voter (or the project) linking to their own timeline, and the marks; above them a summary over every toggle (changes, votes, retractions, people or projects, from new accounts). A voter's agent badge shows, though agents never vote (rule 13): a toggle by one would mean a bug.
- **Admins only, by the database** (`not_admin`), like `challenges.all()`; `requireAdmin(path)` on every page. "Voturi" joins "Provocări" in the admin nav.
- **Counts here are rows only,** never the fixtures' extras: the page is about the toggles themselves, not the number a project shows.
- **Not added:** hiding or removing votes. The timeline is for seeing; what to do about abuse (remove votes, block an account) isn't decided (NEXT-ACTIONS).
- **Tables** scroll sideways inside their own box on a phone (focusable, labelled by the heading), never the page; on a timeline the marks come right after the time and action, so they show without scrolling.
- **Seed:** the fixtures' votes had no time, so the seed gave them the seed's own clock, after the frozen moment. They now sit halfway between each project's launch and the reference moment, a minute apart, so fixtures mode shows them (screen 10 still counts 0 at the launch).
- **Tried on `pnpm dev`:** signed out (→ `/intra?next=…`), Andrei (404), the admin; six toggles a minute apart by Bianca (account made that day) inserted into the local database: "6 din conturi noi", every row marked "Cont nou · 4 ore" and "Rafală"; her own timeline; an unknown slug (404); 390px dark without page scroll. Reseeded after.

## 2026-11-16 · M1 end-to-end pass

- **No owner answers to apply, no Blob:** nothing in NEXT-ACTIONS was ticked or answered after 2026-11-15, and the Blob store isn't confirmed, so `BLOB_READ_WRITE_TOKEN` stays unused.
- **Card grids use `auto-fill`,** not the reference's `auto-fit` (Home's top 3 on desktop, a profile's "Proiecte lansate"). With three cards, as in every reference, the two are pixel-identical. With one or two, `auto-fit` stretched a card across the whole row (1,055px wide with a 160px thumbnail on a first launch's profile); `auto-fill` keeps a column's width.

## Verify during M1 setup

Facts the research couldn't confirm. Check each one once, and record the result here.

- **Resend:** one test send. Does DKIM cover the `List-Unsubscribe` headers? Do ă/â/î/ș/ț render correctly in Gmail, Outlook and Apple Mail? Set `lang="ro"`, add a UTF-8 charset meta, and send a text part.
- **sharp:** confirm memory and time for a 5 MB image on a preview deploy.
- **Neon previews:** do preview database URLs exist at build time, so migrations can run? Do preview branches reset on later pushes?
- **Base UI:** confirm `role="alertdialog"` and the focus trap in the leave-challenge confirm (screen 08). That confirm has no reference design, so record its copy and backdrop here. _Checked locally on 2026-11-14 with Base UI 1.9: `role="alertdialog"`, labelled and described, the focus trapped (Tab and Shift+Tab), and Escape returning the focus to the trigger. Copy and backdrop are in "Screen 08 build". Check once more on a preview deploy._
