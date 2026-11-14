# Next session: finish the M1 foundation

Paste everything below the line into a fresh session.

---

Finish the M1 foundation for ITStart so screen work can start: the database package, Better Auth, the composition root and the local environment. Build no screens or core business modules (challenges, projects, reviews, …) this session.

Read first: `AGENTS.md` and every doc it points to. The ones that matter most here are `docs/ARCHITECTURE.md` (where code goes, gotchas) and `docs/DECISIONS.md`: the "Sign-in", "Rate limits live in Postgres", "Admins", "Environments, CI and deploys" and "M1 install list" sections. The research behind the Better Auth and Neon choices is in `.scratch/stack/research/02-better-auth-fit.md` and `06-neon-vercel-wiring.md`; open them when a detail isn't in DECISIONS. Every stack decision is final, so follow it. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

State on 2026-11-14: `main` has the docs, the stack map (`.scratch/stack/`, finished), and the setup commits. Those cover the dependencies, Tailwind + tokens + fonts, shadcn init and the capture tooling. Lint, types, tests and `next build` pass. There's no git remote, no local Postgres container and no `.env.local` yet.

Work on a branch, one small commit per step. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass.

1. **Bump `better-auth` to 1.7.22.** It's now past pnpm's 24-hour release-age gate. Done when `pnpm-workspace.yaml` has no `minimumReleaseAgeExclude` entries.
2. **Local Postgres.** Create a Docker container `pg-itstart` (Postgres 17) and write `packages/db/.env.local` and `apps/web/.env.local` with its URL. Add a committed `.env.example` next to each that lists every key the foundation uses, with no values. Done when `pnpm db:migrate` applies the existing migrations to it.
3. **`@repo/db` reshaped:**
   - `src/schema.ts` becomes a `src/schema/` folder.
   - `createDb(client: string | Pool)`.
   - `drizzle.config.ts` reads `DATABASE_URL_UNPOOLED ?? DATABASE_URL`.
   - Done when existing tests pass unchanged.
4. **Better Auth:**
   - Write `apps/web/src/server/auth.ts` per DECISIONS "Sign-in": magic link with `expiresIn: 900` and hashed tokens; Google + GitHub, with their e-mails marked verified; `usePlural`; `generateId: "uuid"`; product fields on `users` with defaults and `input: false`; `rateLimit.storage: "database"`; `testUtils` only when `DESIGN_FIXTURES=1`.
   - Generate its tables into `packages/db/src/schema/auth.ts` with `pnpm dlx @better-auth/cli@1.7.22 generate`.
   - Add the `sign_in_link_sends` table.
   - Run `pnpm db:generate` and commit the migration.
   - Done when the migration applies locally and Better Auth starts without `SchemaMismatchError`.
5. **Sign-in link limit:**
   - Enforce 1 per 30 s and 5 per hour per address, counted from `sign_in_link_sends`, behind a small core interface that has PGlite tests. Pick the core module by its job ("who may do what, how often"), and say why.
   - `sendMagicLink` calls it, then the mailer seam. Use the in-memory mailer for now; the Resend adapter is fine if it's quick.
   - Done when the tests cover: allowed, the 30 s refusal, and the hourly refusal.
6. **Composition root** `apps/web/src/server/core.ts`: `server-only`, a module-scope `pg` Pool registered with `attachDatabasePool`, and the clock frozen when `DESIGN_FIXTURES=1`, wired into `createCore()`. Mount the Better Auth handler under `src/app/api/`. Done when `next build` passes and `GET /api/auth/ok` answers locally.
7. **`@repo/db` scripts:**
   - `admin:set <email> admin|member` (DECISIONS "Admins").
   - `db:seed:fixtures`, loading `docs/design/fixtures.json` with one admin user.
   - Done when both run against the local container.
8. **`withWorkflow()`** in `apps/web/next.config`. Done when `next build` still passes. No workflows yet.

If context runs low, stop at a step boundary, commit, and write what's left into this file for the next session.

Out of scope this session: screens, the other core modules, the GitHub remote and Actions workflow, and the Vercel, Neon and Resend accounts. Those need me, so give me a checklist instead. Also leave the "Verify during M1 setup" items in DECISIONS: they need a deployed preview or a real Resend domain.

When done, update `docs/ARCHITECTURE.md` and the install list in `docs/DECISIONS.md` if anything changed. Then tell me what's left before screen 01.
