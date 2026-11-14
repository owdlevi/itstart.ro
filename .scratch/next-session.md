# Next session: groundwork for screens, then screen 01

Paste everything below the line into a fresh session. Before you do, merge `feat/m1-foundation` into `main` (see `docs/NEXT-ACTIONS.md`).

---

Lay the groundwork every screen needs, then build screen 01 (Acasă, `/`) to the reference. Build no other screens this session.

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (what isn't set up yet: no Vercel, Neon, OAuth apps or Resend, so build and test locally only). The ones that matter most here: HANDOVER §6 (screen 01 and the shared shell), §7–§10 (components, tokens, visual review, accessibility), §13.1 and §14 (definition of done); `docs/ARCHITECTURE.md` (where code goes, gotchas); `docs/design/components/*.md` for the specs; `docs/design/fixtures.json` and `screens.json`. The research behind `/dev/login-as` is in `.scratch/stack/research/02-better-auth-fit.md` §6. Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

State on 2026-11-14: `main` has the M1 foundation: `@repo/db` with Better Auth's tables and the `sign_in_link_sends` table, the `signIn` and `votes` core modules, the composition root (`apps/web/src/server/core.ts`, which exports `db`, `core` and `auth`), the auth handler at `/api/auth/*`, `withWorkflow()`, and the `db:seed:fixtures` and `admin:set` scripts. The `pg-itstart` container and both `.env.local` files exist on this machine. Remote: GitHub `owdlevi/itstart.ro`; no CI yet. Port 3000 on `localhost` may be taken by an SSH tunnel; if `pnpm dev` isn't reachable there, tell me rather than changing the port.

Work on a branch from `main`, one small commit per step. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass.

1. **CI.** Add `.github/workflows/ci.yml`: on pull requests and pushes to `main`, install with pnpm (version from `packageManager`, Node 24) and run `pnpm lint`, `pnpm check-types`, `pnpm test`. No secrets. Done when it passes on your branch's PR: push the branch and open the PR with `gh`.
2. **next-intl** without i18n routing, fixed locale `ro`, copy in `apps/web/messages/ro.json` (keys grouped by screen or component). Done when the layout renders a string from it, with no Romanian in components.
3. **Sessions and dev login:**
   - `src/lib/auth-client.ts` (Better Auth client with the magic-link plugin) and a server helper that reads the session in server components.
   - `/dev/login-as/[handle]?next=…` per research 02 §6 and `docs/tools/capture.mjs`: 404 unless design-fixtures mode is on (use `core.ts`'s flag, never in production); `anonymous` signs out.
   - Done when, with `DESIGN_FIXTURES=1` and the seed loaded, `/dev/login-as/andrei-popescu` signs him in and the session helper returns him, and the route 404s with the flag off.
4. **Schema and seed for screen 01.** Add the challenge and project columns screen 01 reads (HANDOVER §4: e.g. challenge number, month label, summary, start date; project slug, pitch, live URL, tools, thumbnail), plus participations if the counts need them. Extend `db:seed:fixtures`. HANDOVER says counters are computed from rows and never drift, but the reference shows fixture counts ("86 de oameni · 4 agenți AI · 25 de lansări", 128 votes) far above the seeded rows. Propose how the fixtures reach those numbers without breaking that rule, ask me, and record the answer in DECISIONS before building it.
5. **Core reads for screen 01.** The running challenge, its status, deadline and counts (rule 1), and the top 3 projects for "Cele mai votate…" (§13.1 default: top 3 by votes in the running challenge; flag the heading, don't change the copy). Pick the module by its job, per ARCHITECTURE, with PGlite tests named by rule number where a §5 rule applies.
6. **Shared shell:** header and footer per HANDOVER §6 "Shared shell" and the component specs (Wordmark, Button, Avatar, …), signed-out and signed-in states, both themes.
7. **Screen 01** at `/`: hero with the challenge card and Countdown, "Cum funcționează", "De ce ai intra", the top-3 section (ProjectCards on desktop, LaunchRows on mobile), green band. Done per HANDOVER §14, with `node docs/tools/capture.mjs app --base <dev url> --only 01` (app in design-fixtures mode, seed loaded) reporting `match`, or every remaining difference listed with its §9.4 category.

If context runs low, stop at a step boundary, commit, and write what's left into this file for the next session.

Out of scope this session: other screens, the Resend adapter, and anything that needs Vercel, Neon, OAuth apps or Resend accounts. If you hit one of those, add it to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off anything finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session (screen 02 onward), and tell me what's left.
