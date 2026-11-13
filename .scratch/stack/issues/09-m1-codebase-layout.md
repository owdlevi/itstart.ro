# What is the M1 codebase layout?

Type: grilling
Status: resolved
Blocked by: 02, 05, 08

## Question

With auth, job runner and component base settled: where does each M1 concern live?

- Apps and packages: does `packages/ui` hold shadcn + spec components, or does `apps/web`?
- Route structure for the Romanian routes in `docs/design/screens.json`, plus `/admin` and `/dev/*`.
- Where the next-intl message file lives.
- Where workflow code lives inside `apps/web`, and how it reaches `@repo/core`.
- Design-fixtures mode (§9.1): the clock freeze reuses core's injected `now`; the fixtures loader lives in `@repo/db` as the seed.
- Which new core modules M1 needs and their seams (storage, mailer, link checker, clock).

## Answer

Decided with the owner on 2026-11-13. Domain terms (English in code, Romanian in URLs and copy) are in `GLOSSARY.md` at the repo root.

- **Conventions:** `apps/web/src/` with the `@/*` alias (owner's global convention). Code and DB use English names; URLs and copy are Romanian.
- **Components:** shadcn + the 14 spec components live in `apps/web/src/components/` (shadcn files in `components/ui/`). **Delete `packages/ui`** together with `apps/docs` (both create-turbo demos). `cn` lives at shadcn's default `@/lib/utils`.
- **Routes** under `apps/web/src/app/`:
  - `(site)/` (full shell: header + footer): `/`, `/provocari/[slug]`, `/lansari`, `/proiecte/[slug]`, `/proiecte/[slug]/editeaza`, `/proiecte/[slug]/lansat`, `/u/[handle]`, `/lanseaza`. M2 adds `/provocari`; M3 adds `/u/[handle]/mesaj`.
  - `(onboarding)/` (bare header): `/intra`, `/bun-venit`, the "check your e-mail" state, and the magic-link confirm page.
  - `admin/`: guarded by `role = admin`, functional styling (no reference design).
  - `dev/login-as/[handle]`: 404 unless `DESIGN_FIXTURES=1`.
  - `api/`: Better Auth handler, Blob upload token route, unsubscribe endpoint.
- **i18n:** `apps/web/messages/ro.json` via next-intl "without i18n routing", fixed `ro` locale. Keys are grouped by screen or component; e-mail copy goes in an `emails` group.
- **`@repo/core` modules for M1** (deep modules, small interfaces):
  - `challenges`: running challenge, deadline/status, join/leave (rules 1–3), admin create/edit.
  - `projects`: create/edit, stages, `launch()` (rules 4, 6–8), link check (rule 9), updates.
  - `votes`: done (rules 10–14).
  - `reviews`: reviews, replies and counts; assignment picking (rules 15–17).
  - `profiles`: onboarding, handle generation, consent flags (rule 22).
  - `notifications`: who gets which e-mail when (§11).
  - **Seams** (two adapters each): `clock` (real / frozen), `mailer` (Resend + React Email / in-memory), `storage` (Blob + sharp / fake), `linkChecker` (fetch / fake). Core never imports Better Auth, Resend, Blob or Next.
- **Server wiring in `apps/web`:**
  - Better Auth tables are generated into `packages/db/src/schema/auth.ts` (`schema.ts` becomes a `schema/` folder; product fields go on its `user` table).
  - The Better Auth instance lives in `src/server/auth.ts`.
  - The composition root is `src/server/core.ts` (`server-only`; pool + `attachDatabasePool`; real adapters into `createCore()`).
  - Workflows go in `src/workflows/` (thin: sleep, ask `core.notifications`, send).
  - E-mail templates go in `src/emails/`.
- **Design-fixtures mode:**
  - `DESIGN_FIXTURES=1` → the composition root uses a clock frozen at `2026-11-11T07:35:00+02:00`.
  - `pnpm db:seed:fixtures` in `@repo/db` loads `docs/design/fixtures.json`.
  - `/dev/login-as` uses Better Auth `testUtils`.
  - `screenStates` prefill applies to forms 07 and 09.
  - All of it is off in production builds.
