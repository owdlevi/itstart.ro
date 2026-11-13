# Research: how Neon, Drizzle and Vercel fit together

Ticket: `.scratch/stack/issues/06-neon-vercel-wiring.md` · Researched 2026-11-13 against drizzle-orm 0.45.4, drizzle-kit 0.31.11, turbo 2.11.11 (installed), @neondatabase/serverless 1.2.0 and @vercel/functions 3.11.1 (scratchpad only).

## Recommendation

- **Driver:** keep `pg` (node-postgres) with Neon's **pooled** `DATABASE_URL`, one module-scope `Pool` per instance, registered with `attachDatabasePool` from `@vercel/functions`. This is what Neon recommends on Vercel Fluid compute, it supports `db.transaction`, and it adds no new database driver. Do **not** use `neon-http`: it type-checks against `Db` but throws on `db.transaction`.
- **`createDb`:** small change. Accept `string | Pool` so `apps/web` can build the pool, call `attachDatabasePool(pool)`, and pass it in. Also point `drizzle.config.ts` at `DATABASE_URL_UNPOOLED` for migrations. The `Db` type stays as it is.
- **Migrations:** run `drizzle-kit migrate` in the Vercel build command before the build, outside turbo's cache, over the direct (unpooled) URL. On a preview this migrates that preview's Neon branch. On production it migrates the production branch. Keep migrations additive (expand/contract).
- **Preview branching:** use the **Neon-Managed** Vercel integration (we already have a Neon project in eu-central-1). Turn on "Automatically delete obsolete Neon branches" and add `neondatabase/delete-branch-action` on PR close. The Free plan allows 10 branches per project, so about 8 open previews at once.

## 1. Driver for Vercel functions, `db.transaction`, and whether `createDb` changes

| Option | `db.transaction` (interactive) | Notes |
|---|---|---|
| `drizzle-orm/neon-http` (`@neondatabase/serverless` `neon()`) | **No. Throws at runtime.** | In 0.45.4, `NeonHttpSession.transaction` is literally `throw new Error("No transactions support in neon-http driver")` (`node_modules/.pnpm/drizzle-orm@0.45.4_pg@8.23.1/node_modules/drizzle-orm/neon-http/session.js:151-153`). The only atomic option is the non-interactive `db.batch([...])`. Neon says HTTP is for "single queries and … multiple queries in one non-interactive transaction" [neon-driver]. `votes.toggle` reads data and then branches on it, so it needs an interactive transaction. |
| `drizzle-orm/neon-serverless` (`Pool`/`Client` over WebSocket) | **Yes** | It checks out a client, runs `BEGIN`, then `COMMIT` or `ROLLBACK` (`neon-serverless/session.js:178-192`). Neon says to use WebSockets when you need "interactive transactions, sessions, or compatibility with node-postgres" [neon-driver] [drizzle-neon]. Needs Node ≥ 19. Node ≥ 22 has a built-in WebSocket; older versions need `neonConfig.webSocketConstructor = ws` [neon-driver]. On the Edge runtime the pool must be created and closed within each request [neon-driver]. |
| `drizzle-orm/node-postgres` (`pg`) over Neon's pooled URL | **Yes** | Same `BEGIN`/`COMMIT` on one checked-out client (`node-postgres/session.js:180-195`). The Neon pooler is PgBouncer in transaction mode: "connections are returned to the pool after each transaction completes". A `BEGIN…COMMIT` block therefore stays on one server connection. The pooler does not support `SET`/`RESET`, session advisory locks, `LISTEN`/`NOTIFY` or SQL-level `PREPARE` [neon-pooling]. Our core code uses none of these. |

**Which to pick.** For Vercel Fluid compute, Neon "recommend[s] you use a standard Postgres TCP connection", using node-postgres plus `attachDatabasePool`. Its example is Drizzle: `new Pool(...)`, `attachDatabasePool(pool)`, `drizzle({ client: pool, schema })` [neon-vercel-conn]. Fluid compute has been the default for new Vercel projects since 2025-04-23. It runs several invocations on one instance, so a module-scope pool is shared across them [vercel-fluid]. `attachDatabasePool` "ensures that idle pool clients are properly released before functions suspend" and lists `pg` as supported [vercel-functions-pkg]. Neon keeps recommending the HTTP/WebSocket driver only for classic (non-Fluid) serverless, where HTTP's lower setup cost (~3 round trips vs ~8 for TCP, Neon's estimate) matters on cold starts [neon-vercel-conn]. Our code uses interactive transactions and `pg` is already a dependency, so `pg` is the better fit. `neon-serverless` is the fallback if we ever move to the Edge runtime.

**Does `createDb` need to change?** Functionally, no. `drizzle(url)` for node-postgres already builds a `pg.Pool` internally (`node-postgres/driver.js:61`). The problem is that the pool is then hidden: the `Db` type erases `$client`, so `apps/web` cannot pass it to `attachDatabasePool`. Proposed minimal change, which I type-checked in the scratchpad against drizzle-orm 0.45.4 + `@vercel/functions` 3.11.1:

```ts
// packages/db/src/client.ts
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Pool } from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDb(client: string | Pool): Db {
  return typeof client === "string"
    ? drizzle(client, { schema, casing: "snake_case" })
    : drizzle({ client, schema, casing: "snake_case" });
}
```

```ts
// apps/web/src/server/db.ts (sketch; @vercel/functions is an apps/web dependency, not a packages/db one)
import "server-only";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { createDb } from "@repo/db";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);
export const db = createDb(pool);
```

`@vercel/functions` stays out of `packages/db`, so the package remains host-agnostic. Pool sizing (`max`, `idleTimeoutMillis`) is **unconfirmed**. Neither the Neon nor the Vercel page gives a number. The `pg` defaults are fine at our volume.

## 2. Does the driver-agnostic `Db` type still hold?

**Yes, for every candidate driver.** I verified this by type-check (`tsc --strict`, scratchpad, drizzle-orm 0.45.4). Each of these assigns to `PgDatabase<PgQueryResultHKT, typeof schema>` with no cast: `drizzle-orm/node-postgres` (url or Pool), `drizzle-orm/neon-serverless` (url or `Pool`), `drizzle-orm/neon-http`, and `drizzle-orm/pglite`. `db.transaction(...)` type-checks on `Db`. Each driver's database class `extends PgDatabase<XQueryResultHKT, TSchema>`, and each `XQueryResultHKT extends PgQueryResultHKT` (`neon-http/driver.d.ts:24`, `neon-serverless/driver.d.ts:23`, `node-postgres/session.d.ts:57`).

**Caveat:** the type cannot catch the `neon-http` trap. `NeonHttpDatabase` satisfies `Db`, and `transaction` keeps its normal signature, but it throws at runtime. So "`Db` compiles" does not mean "`votes` works". PGlite tests support real transactions, so they would not catch this either. If we ever switch drivers, add one smoke test that runs `votes.toggle` against a real Neon branch.

## 3. Neon branch per Vercel preview deployment

**Two official integrations** both create a branch per preview. A third, manual option has no automatic branching [neon-vercel-overview]:

| | Vercel-Managed ("Neon Postgres", Native Integration) | Neon-Managed ("Neon", Connectable Account) |
|---|---|---|
| Account | New Neon org created through Vercel | Existing Neon account/project |
| Billing | Through Vercel | Through Neon (Free plan applies) |
| Branch name | `preview/<git-branch>` [neon-vercel-managed] | `preview/<git-branch>`, parented from the default branch [neon-managed] |
| Cleanup | When the last Vercel deployment of that branch is deleted. Vercel retains previews about 6 months by default [neon-cleanup] | When the Git branch is merged or deleted, with "Automatically delete obsolete Neon branches" on. Cleanup runs on the *next* preview deployment, not immediately [neon-managed] |

**Pick Neon-Managed.** We already have a Neon project in eu-central-1. Billing stays on the Neon Free plan, and cleanup follows the Git branch rather than Vercel's 6-month retention. Add `neondatabase/delete-branch-action` on PR close in both cases. Neon recommends it and it "works regardless of integration type" [neon-cleanup]. Don't rename Git or Neon branches, and don't create child branches off previews. Either one breaks auto-cleanup [neon-managed].

**How `DATABASE_URL` is injected.** By default the integration sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) for Production and Development. Optionally it also sets `PGHOST`, `PGHOST_UNPOOLED`, `PGUSER`, `PGDATABASE` and `PGPASSWORD`. For a preview, it creates the branch and Vercel "injects it as environment variables for that specific deployment only". Production uses the branch chosen at connect time. Development uses an optional `vercel-dev` branch [neon-managed]. The Vercel-Managed integration sets the same pair plus legacy `POSTGRES_*` [neon-vercel-managed].

**Cost on the Free plan.** Branches cost no money, but they draw on quotas:
- 10 branches per project, counting the root. Extra branches are not available on Free [neon-plans]. Root + `vercel-dev` leaves **about 8 concurrent previews**. Archived branches still count [neon-cleanup].
- Every branch's compute counts toward the project's **100 CU-hours/month** ("All computes in your project count toward usage") [neon-plans]. Each preview compute scales to zero after 5 minutes idle [neon-plans], so an untouched preview costs nothing. One that a reviewer clicks through costs at least 5 min × its CU size.
- Storage: a new child branch starts at zero and then accrues its write delta [neon-plans]. How the delta counts against Free's 1 GB per-project cap is **unconfirmed**.
- What happens at the CU-hour cap is the real risk: "your compute is suspended until the next billing period or until you upgrade" [neon-plans]. Runaway preview usage can therefore take **production** down. Mitigation: keep preview computes at the minimum size (0.25 CU [neon-computes]) and keep the delete-branch action on.

## 4. Running `drizzle-kit migrate` on deploy

**What drizzle-kit actually does (0.31.11 / 0.45.4 source):**
- It picks the first installed driver in this order: `pg`, `postgres`, `@vercel/postgres`, `@neondatabase/serverless`. We have `pg`, so it connects over TCP (`drizzle-kit/bin.cjs` ~l.78877, 79067).
- It reads the latest `drizzle.__drizzle_migrations` row and then applies, **in one transaction**, every migration whose journal timestamp is *greater* than that row's `created_at` (`pg-core/dialect.js:44-70`). It takes no advisory lock.
- Neon lists schema migrations under "Direct" connections because "Tools may not support transaction pooling" [neon-pooling]. Use `DATABASE_URL_UNPOOLED`.

**Where it belongs.** Neon's docs for both integrations say to put the migrate command in the Vercel build command (Settings → Build and Deployment → Override). That "ensures schema changes in your commits are applied to each preview deployment's database branch" [neon-managed] [neon-vercel-managed]. Drizzle's docs list `generate` + `migrate` as a supported flow and leave the choice of where to run it to us [drizzle-migrations]. For our size:

- **Build command, both environments (recommended):** e.g. `pnpm --filter @repo/db db:migrate && turbo run build --filter=web` (sketch, **unverified on Vercel**).
  - Run migrate **outside turbo**, or as a `cache: false` task. A turbo cache hit would silently skip the migration.
  - Turbo's default Strict env mode removes any variable not listed in `env`/`globalEnv`/`passThroughEnv` from a task's environment. A turbo `db:migrate` task would therefore not see `DATABASE_URL_UNPOOLED` unless it is declared (installed turbo docs, `docs/crafting-your-repository/using-environment-variables.mdx` l.90-116).
  - `drizzle-kit` is a devDependency of `@repo/db`. Vercel installs devDependencies during build by default (**unconfirmed** for our pnpm workspace setup).
- **Production trade-off:** the migration runs before the new deployment is promoted. If the build fails afterwards, the old code runs against the new schema. This is fine as long as migrations are additive (expand → deploy → contract in a later PR). A GitHub Actions job on push to `main` is the upgrade path if we want a separate gate.
- **Manual:** only for a destructive one-off.

**Required change:** `drizzle.config.ts` should read `process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL`.

**Behaviour with preview branches (gotchas):**
1. The preview branch is forked from production when it is created. The build migrates it with the PR's new migrations, and production is untouched until merge.
2. **Timestamp-ordering trap (verified in source).** The migrator only applies migrations newer than the *last applied* one. Suppose PR A generates a migration at t1 and PR B generates one at t2 > t1, and B merges first. Then A's migration is **silently skipped** in production. The same thing happens on a long-lived preview branch after rebasing onto a `main` that gained an older-stamped migration. Mitigation: after rebasing onto a `main` with new migrations, delete the PR's migration and run `drizzle-kit generate` again so it is newest. Reset or delete the preview branch if it has drifted.
3. Whether later pushes reuse the existing `preview/<git-branch>` or reset it from the parent is **unconfirmed**. The docs say only that a branch "named `preview/<git-branch>`" is created.
4. That the integration's per-deployment `DATABASE_URL*` values are present at **build** time (not only at runtime) is implied by Neon recommending migrations in the build command. I have **not verified it independently**.

## 5. Free-plan limits vs expected volume

Our volume: ~100 builders, ~50 launches per month, low traffic.

| Limit (Neon Free) [neon-plans] [neon-pricing] | Value | Our fit |
|---|---|---|
| Storage | 1 GB per project (20 GB total across projects) | Users, projects, votes and vote events are kilobytes per row. 1 GB is years of headroom. Images belong in blob storage, not Postgres. |
| Compute | 100 CU-hours per project per month, shared by all branches | Assuming CU-hours ≈ CU × active hours (formula **unconfirmed** [neon-computes]): a 0.25 CU compute awake 24/7 would use ~182 CU-h/month, over the cap. With scale-to-zero, cost tracks *active* time. At 0.25 CU we get 400 awake-hours/month, about 13 h/day. Low traffic should fit, but bot or uptime pings that keep the compute awake would not. |
| Max compute | Autoscaling up to 2 CU | Set the max low (e.g. 0.25–0.5) so a spike can't burn the quota. |
| Branches | 10 per project, root included, no extras | About 8 concurrent previews (see §3). |
| Scale to zero | After 5 min idle; cannot be disabled on Free | Cold start: compute wakes "within a few hundred milliseconds" [neon-s2z]. The first request after idle also pays new-TCP-connection setup (~8 round trips, Neon's estimate) [neon-vercel-conn]. fra1 ↔ eu-central-1 are both Frankfurt, so round trips are short. |
| Restore window | 6 h, 1 GB; no instant restore | This is the real weakness for a production app. Take our own `pg_dump` backups, or move to Launch. |
| Egress | 5 GB per project per month | Ample. |
| Over limit | Compute suspended until the next period or an upgrade; data not deleted | Watch usage, and keep previews from eating production's quota. |

**Next tier:** Launch is pay-as-you-go with no minimum: $0.106 per CU-hour and $0.35 per GB-month [neon-pricing]. At our size that is likely a few dollars a month, and it removes the hard suspension. It is the sensible step once real users depend on the site.

## Sources

- [neon-driver] https://neon.com/docs/serverless/serverless-driver
- [neon-vercel-conn] https://neon.com/docs/guides/vercel-connection-methods
- [neon-pooling] https://neon.com/docs/connect/connection-pooling
- [neon-vercel-overview] https://neon.com/docs/guides/vercel-overview
- [neon-vercel-managed] https://neon.com/docs/guides/vercel-managed-integration
- [neon-managed] https://neon.com/docs/guides/neon-managed-vercel-integration
- [neon-cleanup] https://neon.com/docs/guides/vercel-branch-cleanup
- [neon-plans] https://neon.com/docs/introduction/plans
- [neon-pricing] https://neon.com/pricing
- [neon-s2z] https://neon.com/docs/introduction/scale-to-zero
- [neon-computes] https://neon.com/docs/manage/computes
- [drizzle-neon] https://orm.drizzle.team/docs/connect-neon
- [drizzle-migrations] https://orm.drizzle.team/docs/migrations
- [vercel-fluid] https://vercel.com/docs/fluid-compute
- [vercel-functions-pkg] https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool
- Drizzle source, installed: `node_modules/.pnpm/drizzle-orm@0.45.4_pg@8.23.1/node_modules/drizzle-orm/{neon-http,neon-serverless,node-postgres}/{session,driver}.{js,d.ts}`, `pg-core/dialect.js` (also on GitHub: https://github.com/drizzle-team/drizzle-orm/tree/main/drizzle-orm/src)
- drizzle-kit source, installed: `node_modules/.pnpm/drizzle-kit@0.31.11/node_modules/drizzle-kit/bin.cjs`
- Turborepo docs, installed: `node_modules/.pnpm/turbo@2.11.11/node_modules/turbo/docs/crafting-your-repository/using-environment-variables.mdx`
- Type-check experiment: `/private/tmp/claude-502/-Users-david-code-owd-itstart-ro/c458b5aa-466a-4c21-bf64-8368fd5b9b5a/scratchpad/tc/src/{check,proposed}.ts` (passes `tsc --strict`)
