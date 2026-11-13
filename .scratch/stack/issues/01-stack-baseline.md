# Stack baseline from the charting session

Type: grilling
Status: resolved

## Question

Which stack choices can be locked from what is already known, before any research?

## Answer

Decided with the product owner (David, OWD) on 2026-11-13. Final, not a proposal.

- **Scope of this map:** everything M1 needs, plus any M2/M3 need an M1 choice would lock in. Planning only; installs and building come after.
- **Monorepo:** Turborepo + pnpm. `@repo/db` (Drizzle) ← `@repo/core` (rules as deep modules) ← `apps/web` (thin adapters). See `docs/ARCHITECTURE.md`.
- **Database:** Postgres on **Neon**, `eu-central-1`. Drizzle ORM. Tests on PGlite with real migrations, Vitest.
- **Apps:** Next.js (App Router) only. **No Vite app for now**; admin is an `/admin` route group behind `role = admin`. `@repo/contracts` is not created until an HTTP client appears.
- **Hosting:** **Vercel**, region `fra1`.
- **Vendor posture:** EU data residency where offered; free tiers first; at most one extra paid vendor for M1.
- **Auth:** **Better Auth** (Drizzle adapter, magic-link plugin, users in Neon), pending ticket 02.
- **E-mail:** **Resend** (EU region, React Email).
- **Screenshots:** **Vercel Blob** + **sharp** resize, behind a storage seam in core.
- **Review agent:** **Claude Code**, meaning the Claude Agent SDK, behind `reviewProject(project, brief)`. Details in ticket 04.
- **Background jobs:** chosen in ticket 05, after research ticket 03.
- **Styling:** **Tailwind v4** with tokens as CSS variables per `docs/design/notes/nextjs-tailwind.md`; fonts via `next/font/local` from `docs/design/reference/fonts/` (the note's `next/font/google` conflicts with HANDOVER §2.3). **shadcn/ui** for accessible primitives, restyled to the specs.
- **i18n:** **next-intl**, Romanian only, no locale prefix in URLs.
- **Forms:** **react-hook-form** + **zod** (`@hookform/resolvers`) on the client; the server action re-parses with the same schema (HANDOVER §2.8).
- **Small defaults:** lucide-react icons; delete `apps/docs`; milestone flags as a typed `flags.ts` in `apps/web`; Playwright + pixelmatch + pngjs as dev deps for `tools/capture.mjs`.
- **Analytics:** Vercel Web Analytics (cookieless, so no cookie notice). Sentry deferred to v2.
