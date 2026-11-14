# itstart.ro

ITStart: a Romanian community where people build real projects with AI during a monthly challenge and launch them in public.

Turborepo with pnpm: `apps/web` (Next.js), `packages/core` (business rules), `packages/db` (Drizzle + Postgres).

- Product brief: `docs/HANDOVER.md`
- Where code goes: `docs/ARCHITECTURE.md`
- Stack and judgment calls: `docs/DECISIONS.md`
- What's waiting on the owner: `docs/NEXT-ACTIONS.md`

## Local setup

1. Node 24+ and pnpm 11 (see `package.json`). Run `pnpm install`.
2. Postgres: create the `pg-itstart` container (command in `docs/ARCHITECTURE.md`, "Environments").
3. Copy each `.env.example` to `.env.local` (`apps/web`, `packages/db`) and fill it in.
4. `pnpm db:migrate`, then optionally `pnpm db:seed:fixtures`.
5. `pnpm dev`. Sign-in links are printed to the server console until the Resend adapter exists.

Checks: `pnpm lint`, `pnpm check-types`, `pnpm test`.
