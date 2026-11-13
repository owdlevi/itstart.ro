# Architecture

How code is split across the monorepo, and where new code goes. Vocabulary (deep module, interface, seam, adapter) is from the `codebase-design` skill. The stack, and why each piece was chosen, is in `DECISIONS.md`. Names for things in code come from `GLOSSARY.md`: English in code and the database, Romanian in URLs and copy.

## Packages and dependency direction

```
@repo/db  ←  @repo/core  ←  apps/web (Next.js: pages, server actions, API routes, workflows)
```

| Package | Holds |
|---|---|
| `packages/db` | Drizzle schema (`src/schema/`, with Better Auth's tables generated into `src/schema/auth.ts`), migrations, `createDb(client)`, the `Db` type, `createTestDb()` from `@repo/db/testing`, and the `db:seed:fixtures` and `admin:set` scripts |
| `packages/core` | The product's business rules (HANDOVER §5), one **deep module** per capability |
| `apps/web` | Everything UI, plus thin **adapters**: auth, parse input, call `core`, map the result to HTTP or UI |

Imports only point one way, as shown above. Core never imports Better Auth, Resend, Blob or Next.

## `apps/web`

Everything lives under `src/`, imported with the `@/*` alias.

```
src/
  app/
    (site)/          full shell (header + footer): /, /provocari/[slug], /lansari, /proiecte/[slug],
                     /proiecte/[slug]/editeaza, /proiecte/[slug]/lansat, /u/[handle], /lanseaza
    (onboarding)/    bare header: /intra, /intra/confirma, /bun-venit
    admin/           role = admin, functional styling (no reference design)
    dev/login-as/[handle]/   404 unless DESIGN_FIXTURES=1
    api/             Better Auth handler, Blob upload-token route, unsubscribe endpoint
  components/        the spec components; shadcn files in components/ui/
  lib/utils.ts       cn
  server/
    auth.ts          the Better Auth instance
    core.ts          composition root (server-only): pg Pool + attachDatabasePool, real adapters into createCore()
  workflows/         Vercel Workflow: sleep, ask core.notifications, send
  emails/            React Email templates
  flags.ts           milestone flags
messages/ro.json     all copy, keys grouped by screen or component; e-mail copy under "emails"
```

- **Copy** comes from `messages/ro.json` through next-intl (no locale in URLs, fixed `ro`). Put no Romanian strings in components.
- **Forms** use react-hook-form + zod on the client. The server action re-parses with the same schema before calling core.
- **Uploads** go from the browser straight to Blob through the token route (png/jpg/webp ≤ 5 MB, session checked). Server actions receive only blob paths. Vercel caps a request body at 4.5 MB.
- **Admin checks** read `role` from the database on each request, in the `admin` layout and in every admin server action, never from Better Auth's cookie cache.
- **Sign-in** goes through Better Auth's HTTP endpoint (`authClient.signIn.magicLink`), not `auth.api` in a server action, so its per-IP rate limit applies.

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
  | `mailer` | Resend + React Email | in-memory |
  | `storage` | Vercel Blob + sharp | in-memory |
  | `linkChecker` | `fetch` with a short timeout | canned answers |

  Pass `db` straight in. Drizzle is already the query interface, so there's no repository layer over it.
- **Wiring** happens once in `createCore()` (`packages/core/src/index.ts`). `apps/web/src/server/core.ts` calls it with real adapters.

## Environments

- **Local:** each workspace has a gitignored `.env.local` and a committed `.env.example` that lists every key. `drizzle-kit migrate` and `studio` read `packages/db/.env.local`; the Next app reads `apps/web/.env.local`.
- **Deployed:** Vercel's project env holds the Production and Preview values. Neon's Vercel integration gives every preview its own database branch and injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`.
- **Migrations** run in the Vercel build command over the unpooled URL, outside turbo's cache.
- **Design fixtures:** `DESIGN_FIXTURES=1` freezes the clock at `2026-11-11T07:35:00+02:00` and turns on `/dev/login-as`. `pnpm db:seed:fixtures` loads `docs/design/fixtures.json`, admin user included. All of it is off in production builds.

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
- Put `import "server-only"` in `apps/web`'s composition root, not in `db` or `core`: in packages it breaks Vitest.
