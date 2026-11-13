# How do Neon, Drizzle and Vercel fit together?

Type: research
Status: resolved

## Question

Using Neon, Drizzle and Vercel docs:

- Driver for Vercel functions: `@neondatabase/serverless` (HTTP or WebSocket) vs `pg` with Neon's pooled URL. Which supports `db.transaction` (used by `packages/core/src/votes`), and does `createDb` in `packages/db/src/client.ts` need to change?
- Does our driver-agnostic `Db` type (`PgDatabase<PgQueryResultHKT, typeof schema>`) still hold?
- Neon branch per Vercel preview deployment: the official integration, how `DATABASE_URL` is injected, cost on the free plan.
- Running `drizzle-kit migrate` on deploy: where it belongs (build step, CI, manual), and how it behaves with preview branches.
- Free-plan limits (storage, compute hours, branches, cold starts) vs our expected volume.

## Answer

Findings: [research/06-neon-vercel-wiring.md](../research/06-neon-vercel-wiring.md)

- **Driver:** `pg` (node-postgres) against Neon's **pooled** `DATABASE_URL`, one shared pool per function instance, registered with `attachDatabasePool` from `@vercel/functions` (Neon's recommendation for Vercel Fluid compute). `db.transaction` works through the pooler.
- **Rejected:** `drizzle-orm/neon-http`. It satisfies the `Db` type but throws on `db.transaction` at runtime, which would break `votes.toggle`, and PGlite tests would not catch it.
- **`Db` type holds** for node-postgres, neon-serverless, neon-http and pglite (type-checked in strict mode).
- **Change for M1:** `createDb(client: string | Pool)`, so `apps/web` owns the pool and `attachDatabasePool`; `@vercel/functions` stays out of `packages/db`. `drizzle.config.ts` reads `DATABASE_URL_UNPOOLED ?? DATABASE_URL`.
- **Migrations:** `drizzle-kit migrate` over the unpooled URL in the Vercel build command, outside turbo's cache. Migrations stay additive. Out-of-order merges silently skip the older migration, so regenerate a PR's migration after rebasing.
- **Previews:** Neon-Managed Vercel integration with branch auto-delete, plus `neondatabase/delete-branch-action` on PR close.
- **Free-plan risks:** 100 CU-hours/month are shared by all branches, and exhausting them suspends production too. Restore window is 6 h. Unconfirmed: whether preview DB URLs exist at build time, and whether preview branches reset on later pushes.
