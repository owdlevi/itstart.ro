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
                     /proiecte/[slug]/editeaza, /proiecte/[slug]/lansat, /u/[handle], /lanseaza
    (onboarding)/    bare header: /intra, /intra/confirma, /bun-venit
    admin/           role = admin, functional styling (no reference design)
    dev/login-as/[handle]/   404 unless DESIGN_FIXTURES=1
    api/             Better Auth handler (auth/[...all]), Blob upload-token route, unsubscribe endpoint
  components/        the spec components; shadcn files in components/ui/
  lib/utils.ts       cn
  server/
    auth.ts          createAuth(deps): the Better Auth config. No server-only, so the CLI can load it
    core.ts          composition root (server-only): pg Pool + attachDatabasePool, clock, mailer,
                     createCore(), and the `auth` instance. Import `db`, `core` and `auth` from here
  workflows/         Vercel Workflow: sleep, ask core.notifications, send
  emails/            React Email templates
  flags.ts           milestone flags
messages/ro.json     all copy, keys grouped by screen or component; e-mail copy under "emails"
scripts/auth-generate.ts   builds createAuth() for `pnpm --filter web auth:generate`
```

- **Styling** uses only our tokens (`bg-surface`, `text-muted`, `rounded-lg`, `shadow-card`…), which come from `docs/design/tokens.json` via `globals.css`. Tailwind's default palette, radii and shadows are switched off, so `bg-red-500` or `rounded-2xl` don't compile. Pixel values from the reference HTML go in as arbitrary values (`text-[15px]`) rather than rounded to the scale. Components need no `dark:` classes, because every colour is a variable.
- **shadcn components** (only Tabs and the leave-challenge confirm) are added with `pnpm dlx shadcn@latest add <name>` in `apps/web` and then rewritten onto our token names. shadcn's `muted`, `accent` and `border` mean different things from ours, so an unedited file compiles with the wrong colours. Everything else is hand-built from the specs in `docs/design/components/`.
- **Copy** comes from `messages/ro.json` through next-intl (no locale in URLs, fixed `ro`). Put no Romanian strings in components.
- **Forms** use react-hook-form + zod on the client. The server action re-parses with the same schema before calling core.
- **Uploads** go from the browser straight to Blob through the token route (png/jpg/webp ≤ 5 MB, session checked). Server actions receive only blob paths. Vercel caps a request body at 4.5 MB.
- **Admin checks** read `role` from the database on each request, in the `admin` layout and in every admin server action, never from Better Auth's cookie cache.
- **Sign-in, for now,** is email and password (`authClient.signUp.email` / `authClient.signIn.email`); see DECISIONS "Email and password for now". Like every sign-in, it goes through Better Auth's HTTP endpoint, not `auth.api` in a server action, so the per-IP rate limit applies.
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
| `challenges` | running challenge, deadline and status, join/leave (rules 1–3), admin create/edit |
| `projects` | create/edit, stages, `launch()` (rules 4, 6–8), link check (rule 9), updates |
| `votes` | done (rules 10–14) |
| `reviews` | reviews, replies and counts; assignment picking (rules 15–17) |
| `profiles` | onboarding, handle generation, consent flags (rule 22) |
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
  | `storage` | Vercel Blob + sharp | in-memory |
  | `linkChecker` | `fetch` with a short timeout | canned answers |

  Pass `db` straight in. Drizzle is already the query interface, so there's no repository layer over it.
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
- One test per HANDOVER §5 rule, named with the rule number, e.g. `"refuses a vote on your own project (rule 11)"`.
- `pnpm test` runs every package's `test` task through turbo.

## Gotchas

- Internal packages are just-in-time: `exports` point at `.ts` source, and tsconfig uses `moduleResolution: "Bundler"`, so relative imports carry no `.js` extension.
- Every Drizzle client and `drizzle.config.ts` passes `casing: "snake_case"` (camelCase in TS, snake_case in SQL). A client without it queries columns that don't exist.
- Use the `pg` driver with Neon's pooled URL. `drizzle-orm/neon-http` type-checks against `Db` but throws on `db.transaction`, and PGlite tests won't catch it.
- `createDb` takes a URL or a `Pool`, so `apps/web` owns the pool and registers it with `attachDatabasePool`. `@vercel/functions` stays out of `packages/db`.
- Better Auth's adapter addresses tables by their export key, so set `usePlural: true` to match `users`, `sessions`, and so on. Every NOT NULL column it doesn't write needs a default, or startup throws `SchemaMismatchError`.
- Put `import "server-only"` in `apps/web`'s composition root, not in `db` or `core`: in packages it breaks Vitest. Keep it out of `auth.ts` too, because the Better Auth CLI refuses to load a config that imports it.
- The Better Auth CLI is the `auth` package (`pnpm dlx auth@<better-auth version>`). `@better-auth/cli` is deprecated and stops at 1.4.
- Better Auth's generated tables use `timestamp` without time zone (our own tables use `timestamptz`). Drizzle reads and writes them as UTC, and `defaultNow()` relies on the session time zone being UTC, which it is on Neon and in the container. Don't set a session time zone.
- `next build` with `withWorkflow()` generates `src/app/.well-known/workflow/`. It's gitignored and skipped by ESLint.
