# Architecture

How code is split across the monorepo, and where new code goes. Vocabulary (deep module, interface, seam, adapter) is from the `codebase-design` skill. The stack, and why each piece was chosen, is in `DECISIONS.md`. Names for things in code come from `GLOSSARY.md`: English in code and the database, Romanian in URLs and copy.

## Packages and dependency direction

```
@repo/db  ←  @repo/core  ←  apps/web (Next.js: pages, server actions, API routes, workflows)
```

| Package | Holds |
|---|---|
| `packages/db` | Drizzle schema (`src/schema/`, one file per area; Better Auth's tables, `users` included, are generated into `src/schema/auth.ts`), migrations, `createDb(client)`, the `Db` type, `createTestDb()` from `@repo/db/testing`, and the `db:seed:fixtures` and `admin:set` scripts in `scripts/` |
| `packages/core` | The product's business rules (HANDOVER §5), one **deep module** per capability |
| `apps/web` | Everything UI, plus thin **adapters**: auth, parse input, call `core`, map the result to HTTP or UI |

Imports only point one way, as shown above. Core never imports Better Auth, Resend, Blob or Next.

## `apps/web`

Everything lives under `src/`, imported with the `@/*` alias.

```
src/
  app/
    layout.tsx       html/body, font variables, Providers
    providers.tsx    next-themes (data-theme on <html>)
    fonts.ts, fonts/ Bricolage Grotesque + Inter via next/font/local
    globals.css      design tokens; the only colours, radii and shadows Tailwind knows
    (site)/          full shell (header + footer): /, /provocari/[slug], /lansari, /proiecte/[slug],
                     /proiecte/[slug]/editeaza, /proiecte/[slug]/lansat, /u/[handle], /u/[handle]/editeaza, /lanseaza
    (onboarding)/    bare header: /intra, /intra/confirma, /bun-venit
    admin/           role = admin, functional styling (no reference design)
      (site)/lansari/board-params.ts   the board's URL parameters: parse, and build a query without the defaults
    dev/login-as/[handle]/   404 unless DESIGN_FIXTURES=1
    (site)/lanseaza/fixture-draft.ts   the reference's form values, prefilled for ioana-muresan in fixtures mode
    dev/captura/[name]/      screenshots uploaded locally (the local storage adapter, off Vercel only), and the
                             fixtures' screenshots (transparent SVGs) when DESIGN_FIXTURES=1; 404 otherwise
    api/             Better Auth handler (auth/[...all]), capturi (one screenshot, local adapter; the Blob
                     upload-token route comes with the Blob adapter), unsubscribe endpoint
    actions/         server actions, one file per area (votes.ts: toggleVote, reviews.ts: postReview,
                     sign-in.ts: finishSignIn, which sends someone on after Better Auth signs them in,
                     onboarding.ts: completeOnboarding, participation.ts: joinChallenge and
                     leaveChallenge; the last three join a challenge and redirect with ?inscris=1;
                     projects.ts: saveProject, which returns where to go rather than redirecting, and
                     checkLiveUrl, rule 9's check on blur)
  components/        the spec components, one file each (button, avatar, vote-button, project-card,
                     launch-row, countdown, filter-chip, field, checkbox, …), the shell (site-header with BareHeader,
                     site-footer), sign-in-form (screen 06), onboarding-form (screen 07), join-button,
                     leave-challenge and flash-banner (screen 08: a status shown once, which drops its query
                     flag), link-tabs (URL tabs on Base UI), and screen 09's project-form (form and sidebar),
                     screenshot-picker, tool-chips, launch-page and launch-row-frame (LaunchRow's layout,
                     shared with the form's live preview); shadcn files, rewritten onto our tokens, in
                     components/ui/ (tabs, alert-dialog)
  i18n/request.ts    next-intl config: fixed locale `ro`, Europe/Bucharest; next-intl.d.ts types the keys
  lib/utils.ts       cn
  lib/schemas/       zod schemas shared by a form and its server action (review.ts, sign-in.ts, onboarding.ts,
                     project.ts, which imports core's own launch rules from @repo/core/project-rules)
  lib/sign-in-destination.ts   where a sign-in or onboarding goes next (/bun-venit, `next`, the challenge),
                     safeNext(), and joinedHref() with the ?inscris / ?renuntat flags
  lib/auth-client.ts Better Auth's browser client (sign-in calls), magic-link plugin ready
  server/
    auth.ts          createAuth(deps): the Better Auth config. No server-only, so the CLI can load it
    core.ts          composition root (server-only): pg Pool + attachDatabasePool, clock (`now`),
                     `designFixtures`, mailer, createCore(), and the `auth` instance. Import `db`, `core`,
                     `auth` and `now` from here
    session.ts       getSession(): the session in server components, cached per request
    challenge.ts     getRunningChallenge(): core.challenges.running(), cached per request
    joinable.ts      getJoinableChallenge(slug): `?provocare=` if it isn't over, cached per request
    storage.ts       screenshot storage: the local adapter (apps/web/.data/capturi, off Vercel) and sharp → webp;
                     null where nothing can be stored yet
    link-checker.ts  rule 9's real check (https GET, 5 s, private addresses refused at connect time), and
                     withExampleHosts() for design fixtures; blocked-addresses.ts holds the address list
  workflows/         Vercel Workflow: sleep, ask core.notifications, send
  emails/            React Email templates
  lib/dates.ts       daysAgo() ("ieri", "acum 3 zile"), timeAgo() and afterLaunch() (review times), and
                     weekOf()/weeksAgo()/weekDays() (Monday–Sunday weeks), in Bucharest
  flags.ts           milestone flags (HANDOVER §3), from one MILESTONE number; M1 screens must look right with them off
messages/ro.json     all copy, keys grouped by screen or component; e-mail copy under "emails"
scripts/auth-generate.ts   builds createAuth() for `pnpm --filter web auth:generate`
```

- **Styling** uses only our tokens (`bg-surface`, `text-muted`, `rounded-lg`, `shadow-card`…), which come from `docs/design/tokens.json` via `globals.css`. Tailwind's default palette, radii and shadows are switched off, so `bg-red-500` or `rounded-2xl` don't compile. Pixel values from the reference HTML go in as arbitrary values (`text-[15px]`) rather than rounded to the scale. Components need no `dark:` classes, because every colour is a variable.
- **shadcn components** (only Tabs and the leave-challenge confirm) are added with `pnpm dlx shadcn@latest add <name>` in `apps/web` and then rewritten onto our token names. shadcn's `muted`, `accent` and `border` mean different things from ours, so an unedited file compiles with the wrong colours. Everything else is hand-built from the specs in `docs/design/components/`.
- **Copy** comes from `messages/ro.json` through next-intl (no locale in URLs, fixed `ro`). Put no Romanian strings in components.
- **Forms** use react-hook-form + zod on the client. The server action re-parses with the same schema before calling core.
- **Uploads** go from the browser straight to Blob through the token route (png/jpg/webp ≤ 5 MB, session checked). Server actions receive only blob paths. Vercel caps a request body at 4.5 MB. _Until the Blob store exists,_ the local adapter takes the file through `POST /api/capturi` (same checks), resizes it and keeps it on disk; the form's `ScreenshotPicker` is where the browser side switches adapters. Core accepts only screenshots `storage.owns()`.
- **Admin checks** read `role` from the database on each request, in the `admin` layout and in every admin server action, never from Better Auth's cookie cache.
- **Sign-in, for now,** is email and password (`authClient.signUp.email` / `authClient.signIn.email`); see DECISIONS "Email and password for now". Like every sign-in, it goes through Better Auth's HTTP endpoint, not `auth.api` in a server action, so the per-IP rate limit applies. Once it succeeds, the `/intra` form calls `finishSignIn({ next, challengeSlug })`, which reads the new session and redirects (`signInDestination`): anyone not onboarded (`onboardedAt` null) to `/bun-venit`, carrying `provocare` and `next`. `/bun-venit`'s `completeOnboarding` redirects with the same rules. Both actions join a joinable `challengeSlug` (`core.challenges.join`): `finishSignIn` only for someone onboarded, since core refuses a participant without a name, and `completeOnboarding` always. A join sends them to the challenge with `?inscris=1`, which shows the banner once. `/intra` itself redirects a signed-in visitor the same way, without joining.
- **Magic link** (configured, not in the UI yet) uses `authClient.signIn.magicLink`. `sendMagicLink` asks `core.signIn.requestLink(email)` first. A refusal comes back as HTTP 429 with `code` `TOO_SOON` or `TOO_MANY` and `retryAfter` in seconds, or 400 `UNDELIVERABLE` for `.invalid` addresses. The `/intra` form maps the code to copy. The e-mail links to `/intra/confirma` with the same query string as Better Auth's verify URL (`token`, `callbackURL`, …).
- **Better Auth schema:** after changing anything in `createAuth` that affects tables (fields, plugins), run `pnpm --filter web auth:generate`, then `pnpm db:generate`. Never edit `packages/db/src/schema/auth.ts` by hand.

## Where new code goes

- **A product rule** (who may do what, when, how often) goes in a `core` module, behind that module's existing interface where possible. Route handlers, server actions and workflows stay free of rules, so HANDOVER §5 "enforced on the server" holds everywhere.
- **A rate limit** goes in the core module that owns the action and counts that action's own rows (e.g. `vote_events`, `reviews`). There's no Redis and no generic counter table.
- **A table, column or index** goes in `packages/db/src/schema/`. Then run `pnpm db:generate` and commit the generated migration. Leave applied migrations as they are: fix forward with a new one. After rebasing a PR, regenerate its migration, because an out-of-order merge silently skips the older one.
- **A new endpoint or server action** goes in `apps/web`. Its body is: authenticate, parse, one `core` call, map the result.
- **A scheduled or delayed job** goes in `apps/web/src/workflows/`. It sleeps, asks core what to do, and does it.
- **A new vendor** passes the EU-residency check first (ADR 0001).

## `packages/core`

M1 modules:

| Module | Covers |
|---|---|
| `signIn` | done: per-address sign-in link limit, counted from `sign_in_link_sends` |
| `challenges` | `running()`, `bySlug()` (brief, status, `votingOpen`: rules 1 and 3), `started()` (the board's chips), `participants()` (rule 2), `challengeStatus()`, `join()` and `leave()` (rule 2; not after the deadline, not before onboarding), `participation()` and `steps()` ("Pașii tăi") are done. To come: admin create/edit |
| `projects` | `mostVoted()`, `inProgress()` (with `latestUpdate`; `agents: false` hides agent-built projects) and `board()` (scope, stage, tool, sort; each row's `at` and `votingOpen`), `bySlug()` (the project page) and `launchedBy()` (a profile's cards) are done, and so are `create()`, `edit()` and `editable()` (screen 09: rules 4 and 6–9, updates, joining the running challenge; `projects/save.ts`, with the database-free rules in `projects/rules.ts`, exported as `@repo/core/project-rules`). To come: the link check over time (M2), hiding (moderation) |
| `votes` | done (rules 10–14) |
| `reviews` | `thread()` (automated first, replies, counts: rules 17–18) and `post()` (reviews, the owner's replies, 10 per hour, fulfils an assignment: rules 15–16) are done. To come: assignment picking on launch (rule 16), hiding (admin) |
| `profiles` | `byHandle()` (the public profile: stats, launched projects, the challenges launched in; never the e-mail, rule 23; it reads projects through `projects.launchedBy()`) and `onboard()` (screen 07: name, city, tools, reminders as ticked (rule 22), a handle from the name, once) are done. To come: editing (bio, links, avatar), consent for "Deschis la colaborări" (M3) |
| `notifications` | who gets which e-mail when (§11) |

### Shape of a core module

`packages/core/src/votes/index.ts` is the reference. Copy its shape:

- **Factory with injected dependencies**: `createVotes({ db, now, config })` returns an object with few methods (`toggle`). Most of the rules are internal to it.
- **Refusals are values**: return a union like `{ ok: false, reason: "own" | "closed" | … }`. Throw only for broken invariants (an unknown session user). The adapter maps each `reason` to Romanian copy or an HTTP status.
- **Seams only where something varies.** Each seam has a real adapter and a fake:

  | Seam | Real | Fake |
  |---|---|---|
  | `clock` | system time | frozen (design fixtures, tests) |
  | `mailer` | Resend + React Email (not built yet: `core.ts` uses the in-memory one and logs each link) | in-memory (`createMemoryMailer()`) |
  | `storage` | `owns(url)`: apps/web's adapter (local files now, Vercel Blob later; both resize with sharp) | `createPrefixStorage(prefix)` |
  | `linkChecker` | one https GET with a short timeout (`server/link-checker.ts`) | `createCannedLinkChecker(answers)` |

  Both fail closed when `createCore` gets none: no link answers, no screenshot is ours.

  Pass `db` straight in. Drizzle is already the query interface, so there's no repository layer over it.
- **Counts** (votes, reviews, participants, launches) are computed from rows with `withExtra()` (`src/counts.ts`), which adds the design fixtures' `fixture_count_extras`. That table is empty outside fixtures mode. Every new count shown in the UI goes through it, so the references' numbers hold (DECISIONS, "Fixture counts").
- **Wiring** happens once in `createCore()` (`packages/core/src/index.ts`). `apps/web/src/server/core.ts` calls it with real adapters.

## Environments

- **Local:** each workspace has a gitignored `.env.local` and a committed `.env.example` that lists every key. `drizzle-kit migrate` and `studio` read `packages/db/.env.local`; the Next app reads `apps/web/.env.local`. Postgres 17 runs in the `pg-itstart` container (`postgres://itstart:itstart@localhost:5432/itstart`), created with:
  ```
  docker run -d --name pg-itstart --restart unless-stopped -e POSTGRES_USER=itstart -e POSTGRES_PASSWORD=itstart -e POSTGRES_DB=itstart -p 5432:5432 -v pg-itstart-data:/var/lib/postgresql/data postgres:17
  ```
- **Deployed:** Vercel's project env holds the Production and Preview values. Neon's Vercel integration gives every preview its own database branch and injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`.
- **Migrations** run in the Vercel build command over the unpooled URL, outside turbo's cache.
- **Design fixtures:** `DESIGN_FIXTURES=1` freezes core's clock at `2026-11-11T07:35:00+02:00` and turns on `/dev/login-as` (Better Auth's `testUtils`). Better Auth itself keeps real time. `pnpm db:seed:fixtures` loads `docs/design/fixtures.json` plus the admin `echipa-itstart`. It refuses a database that already has users unless you pass `--reset`, which empties it. Fixture users have `.invalid` e-mails, so they sign in only through `/dev/login-as`. `core.ts` ignores the flag when `VERCEL_ENV=production`, and the seed refuses to run there.

## CI and deploys

- GitHub Actions runs `pnpm lint`, `pnpm check-types` and `pnpm test` on every PR, and they're required for merging.
- Vercel's Git integration deploys: a preview for every PR, and `main` to production.
- `docs/tools/capture.mjs` runs locally, against `pnpm dev`, before a PR.

## Tests

- Test each module through its interface, against real Postgres via `createTestDb()` (PGlite, in-memory, every migration applied, one instance per test). Leave Drizzle unmocked.
- `src/test-data.ts` makes rows with every required column (`makeUser`, `makeChallenge`, `makeProject`, `join`, `vote`, `review`, `addExtra`); override only what the test is about.
- One test per HANDOVER §5 rule, named with the rule number, e.g. `"refuses a vote on your own project (rule 11)"`.
- `pnpm test` runs every package's `test` task through turbo. `apps/web` has vitest too, for pure helpers next to their file (`lib/sign-in-destination.test.ts`); rules and their tests stay in core.

## Gotchas

- Internal packages are just-in-time: `exports` point at `.ts` source, and tsconfig uses `moduleResolution: "Bundler"`, so relative imports carry no `.js` extension.
- Every Drizzle client and `drizzle.config.ts` passes `casing: "snake_case"` (camelCase in TS, snake_case in SQL). A client without it queries columns that don't exist.
- Use the `pg` driver with Neon's pooled URL. `drizzle-orm/neon-http` type-checks against `Db` but throws on `db.transaction`, and PGlite tests won't catch it.
- `createDb` takes a URL or a `Pool`, so `apps/web` owns the pool and registers it with `attachDatabasePool`. `@vercel/functions` stays out of `packages/db`.
- Better Auth's adapter addresses tables by their export key, so set `usePlural: true` to match `users`, `sessions`, and so on. Every NOT NULL column it doesn't write needs a default, or startup throws `SchemaMismatchError`.
- Put `import "server-only"` in `apps/web`'s composition root, not in `db` or `core`: in packages it breaks Vitest. Keep it out of `auth.ts` too, because the Better Auth CLI refuses to load a config that imports it.
- The Better Auth CLI is the `auth` package (`pnpm dlx auth@<better-auth version>`). `@better-auth/cli` is deprecated and stops at 1.4.
- Better Auth's generated tables use `timestamp` without time zone (our own tables use `timestamptz`). Drizzle reads and writes them as UTC, and `defaultNow()` relies on the session time zone being UTC, which it is on Neon and in the container. Don't set a session time zone.
- `cn` (the `cn` package, like tailwind-merge) drops `leading-*` when a font-size class comes after it, and `text-xl` and friends carry their own line height. Put `leading-*` last, or use arbitrary sizes (`text-[20px]`).
- Tailwind's preflight is on, so headings have no weight: set `font-bold` on every h1–h3. Plain links are `primary` and underlined (globals.css), as in the references; components that look like buttons or tags add `no-underline` and their own colour.
- Message keys are typed (`src/i18n/next-intl.d.ts`): a missing key fails `check-types`. Plurals use ICU with Romanian's `one`/`few`/`other` ("19 zile", "24 de minute").
- Opening `pnpm dev` from another host (e.g. the LAN IP while port 3000 on localhost is taken): Next 16 blocks cross-origin dev resources, so the page renders but never hydrates (buttons do nothing). Use `localhost`, or test interaction on `next build && next start`.
- In a production build, Link prefetches of routes that don't exist yet stay pending, so Playwright's `networkidle` (which `capture.mjs` waits for) never arrives. Until those screens exist, run `capture.mjs` against `pnpm dev`.
- `capture.mjs` needs design-fixtures mode, and `apps/web/.env.local` doesn't turn it on. Start the server with `DESIGN_FIXTURES=1 pnpm dev`, or the countdown and relative dates follow the real clock.
- Postgres can't `order by` a constant (`order by false` is a syntax error). Build an optional sort key conditionally, as `challenges.participants()` does.
- `next/form` builds the URL from the form's fields only: unlike a native GET form, it drops the name and value of the button that submitted it. Put a chip's value in hidden inputs, one form per chip (`lansari/page.tsx`).
- Base UI gives a tab panel its own tab stop. When the panel starts with focusable controls, pass `tabIndex={-1}` (`LinkTabs`).
- `pkill -f "next start"` misses the production server, whose process is named `next-server`. A leftover one holds the port, and the next `next start` fails with `EADDRINUSE`.
- next/font puts a metric-matched fallback face (local Arial, no `unicode-range`) right after each family. With latin and latin-ext as separate families, that fallback catches every diacritic before latin-ext is tried. `fonts.ts` turns it off on the latin faces (`adjustFontFallback: false`); keep it that way when adding a font.
- Drizzle leaves column names unqualified in a select from one table, even inside a raw `sql` subquery. `${reviews.projectId} = ${projects.id}` then renders as `"project_id" = "id"`, and both resolve to the subquery's own table, so the count is silently wrong. Compare with a value (`= ${projectId}`), or select from a join, where names are qualified (`projects.select`).
- Tailwind's preflight sets `line-height: 1.5` on `html`, a ratio, while the references use a fixed 24px. Text at 15px or 13px that inherits it gets 22.5px or 19.5px lines, so rows come out shorter than the reference. Set `leading-6` (or the reference's value) wherever smaller text sits in a row.
- `next build` with `withWorkflow()` generates `src/app/.well-known/workflow/`. It's gitignored and skipped by ESLint.
- Base UI's focus trap (dialogs) moves the focus back from its hidden guard elements asynchronously. A Playwright check that reads `document.activeElement` straight after a Tab sees the guard or `body`; wait a moment first.
- A query flag shown once (`?inscris`, `?renuntat`) is dropped by `FlashBanner` with `history.replaceState`, which Next's router follows. A `router.refresh()` after that renders the page without the banner.
- A `"use server"` file may export only async functions. A constant shared by an action and a page (`SAVED_PARAM`) goes in `lib/`.
- `redirect()` inside a server action makes the client's `await` reject, so the caller can't tell a save from a failure. Where the form has something to do after a save (screen 09 drops its draft), the action returns `{ ok: true, href }` and the form calls `router.push`.
- Node's `net.BlockList` matches a plain IPv4 address against an IPv4-mapped IPv6 rule (`::ffff:0:0/96`), so that rule blocks every IPv4 address. Unwrap `::ffff:a.b.c.d` before checking instead (`blocked-addresses.ts`, tested).
- If port 3000 is held by another project's server, run `DESIGN_FIXTURES=1 BETTER_AUTH_URL=http://localhost:3001 pnpm next dev --port 3001` in `apps/web` and pass `--base http://localhost:3001` to `capture.mjs`.
- Better Auth's rate limiter is off unless `NODE_ENV` is `production` (`rateLimit.enabled` defaults to that), so `pnpm dev` never answers 429. To see it, use `next build && next start`, or intercept the request in Playwright.
