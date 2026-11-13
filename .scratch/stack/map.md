# Map: ITStart tech stack and codebase plan

## Destination

Every HANDOVER §13.7 item and every library M1 needs is locked with a reason, and the M1 codebase layout is settled, all recorded in `docs/DECISIONS.md` and `docs/ARCHITECTURE.md`. M1 implementation can then start at screen 01 with nothing left to decide.

## Notes

- Planning only: tickets resolve decisions; installing and building happen after the map, except ticket 10 (writing the record).
- The product owner (David, OWD) decides; decisions are final, not proposals.
- Source brief: `docs/HANDOVER.md`. Existing layout: `docs/ARCHITECTURE.md`. Domain terms: `GLOSSARY.md`.
- Grilling tickets: load the `grilling` and `domain-modeling` skills. Ticket 04 and anything about Claude: load `claude-api`. Before touching turbo config: read the installed turbo docs (AGENTS.md).
- Vendor posture: EU data residency wherever an EU option exists (US processors only when none does, recorded with the reason); Vercel Pro; free tiers first otherwise; at most one extra paid vendor for M1.
- Tracker: local markdown. Tickets live in `issues/`; research findings in `research/`, linked from each ticket's Answer. The repo is moving to GitHub (see "How do CI and deploys run?"); until it has a remote, there are no research branches.

## Decisions so far

- [Stack baseline from the charting session](issues/01-stack-baseline.md): Next.js on Vercel `fra1`, Neon Postgres + Drizzle, Better Auth, Resend, Vercel Blob + sharp, review agent on the Claude Agent SDK (since moved out of M1), Tailwind v4 + shadcn, next-intl, react-hook-form + zod; no Vite app, admin inside Next.
- [How do Neon, Drizzle and Vercel fit together?](issues/06-neon-vercel-wiring.md): `pg` + Neon pooled URL + `attachDatabasePool`, never `neon-http` (no transactions); migrate in the Vercel build over the unpooled URL; Neon-managed preview branches.
- [Do Resend, Vercel Blob and sharp meet the M1 constraints?](issues/07-resend-blob-constraints.md): screenshots upload browser → Blob directly (Vercel's 4.5 MB body cap rules out server actions), then sharp → webp in the launch action; Resend's US data storage and 100/day free cap go to their own ticket.
- [How does the review agent run on the Claude Agent SDK?](issues/04-review-agent-agent-sdk.md): Agent SDK + Console API key (subscription logins not allowed) + Playwright MCP, browser-only tools, Opus 5.5 at medium effort (~$0.50–0.90/review, estimated); host must spawn a CLI + Chromium with 2 GiB RAM, 5 GiB disk, 10 min.
- [Which design components start from shadcn, and on which primitives?](issues/08-shadcn-component-mapping.md): shadcn on Base UI with our tokens replacing its theme (no aliasing); only Tabs and the leave-challenge confirm start from shadcn, the other components are hand-built on native elements.
- [Does Better Auth cover ITStart's sign-in rules?](issues/02-better-auth-fit.md): fits with workarounds: `expiresIn: 900`; e-mail links to our own confirm page (scanners burn single-use links); per-e-mail limits are ours; product fields on its `user` table with defaults and `input: false`; `testUtils` for dev login.
- [Which job runners can host ITStart's background work?](issues/03-job-runner-options.md): only Vercel Workflow + Sandbox (EU, no new vendor, hand-built debounce) and Trigger.dev (native containers, built-in debounce, US data) can host the review agent; Vercel Hobby is non-commercial only.
- [Choose the job runner](issues/05-choose-job-runner.md): Vercel Workflow in `fra1` inside `apps/web` (sleeps for reminders, Postgres check for e-mail batching, Schedules for M2); Vercel Pro since ITStart is commercial; EU-only rule tightened; review agent moved out of M1.
- [Is Resend acceptable for e-mail?](issues/11-email-provider-check.md): yes, Resend Pro ($20/month, no daily cap) sending from `eu-west-1`, as a recorded EU-rule exception: it stores e-mail data in the US under a DPA + SCCs + DPF; the privacy policy must name it. It is M1's one extra paid vendor.
- [What is the M1 codebase layout?](issues/09-m1-codebase-layout.md): everything UI in `apps/web/src` (drop `packages/ui` and `apps/docs`); route groups `(site)`, `(onboarding)`, `admin`, `dev`, `api`; `messages/ro.json`; core modules challenges/projects/votes/reviews/profiles/notifications behind clock/mailer/storage/linkChecker seams; English code, Romanian URLs (`GLOSSARY.md`).
- [Where do rate-limit counters live?](issues/12-rate-limit-store.md): all in Postgres, no Redis; each core module counts its own rows (`vote_events`, `reviews`, new `sign_in_link_sends`); sign-in links 1/30 s + 5/hour per address on top of Better Auth's per-IP limit (database storage, called over HTTP); reviews+replies 10/hour per user; M3 contact numbers wait for M3.
- [How is an admin created?](issues/13-admin-bootstrap.md): a `pnpm --filter @repo/db admin:set <email> admin|member` script grants and removes (no env list, no admin-management UI); no jury role, admins enter the jury's pick; role read fresh from the database on each admin request; seed includes one admin.
- [How do env vars and secrets flow?](issues/14-environments-and-secrets.md): gitignored `.env.local` per workspace plus a committed `.env.example`; Vercel env holds deployed values; Neon's integration injects database URLs for previews; no app secrets in GitHub.
- [How do CI and deploys run?](issues/15-ci-and-deploys.md): GitHub remote; Vercel's Git integration deploys (PR previews, `main` to production); Actions runs lint, types and tests as required checks; `capture.mjs` stays local.
- [Record the stack decision and the install list](issues/10-record-stack-decision.md): written to `docs/DECISIONS.md` (stack table, EU exceptions, scope change, install list, things to verify during setup), `docs/adr/0001`–`0002`, a rewritten `docs/ARCHITECTURE.md` and AGENTS.md pointers. Destination reached.

## Not yet specified

_(empty: all fog has graduated or been ruled out)_

## Out of scope

- Review agent ("Părere automată", HANDOVER §12): moved out of M1 by the owner, see [Choose the job runner](issues/05-choose-job-runner.md). Planned host when built: Vercel Sandbox in `fra1`, set up as in [How does the review agent run on the Claude Agent SDK?](issues/04-review-agent-agent-sdk.md).
- Sentry error tracking: deferred to v2 by the owner.
- M3 builder agents, the Hungarian translation itself, and legal-page content (Termeni, Confidențialitate).
- Vite apps and `@repo/contracts`: no HTTP client app planned for now (see the stack baseline).
- Hungarian URL shape: ruled out by the owner on 2026-11-13. M1 uses no locale prefix, and how `hu` routes look is decided along with the Hungarian translation.
