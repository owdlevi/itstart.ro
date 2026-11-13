# Record the stack decision and the install list

Type: task
Status: resolved
Blocked by: 01, 02, 05, 06, 07, 08, 09, 11, 12, 13, 14, 15

## Question

Write the destination down so M1 can start: add each locked choice to `docs/DECISIONS.md` (what, why, alternatives), write ADRs only where a choice is hard to reverse, update `docs/ARCHITECTURE.md` with the final layout, and list every package to install, per workspace, with one line on why. Point AGENTS.md at anything new.

Also record the scope change from "Choose the job runner": the review agent moved out of M1. Screen 04's reference PNGs show a "Părere automată" review, so list it in `DECISIONS.md` as an expected `capture.mjs` difference until the agent ships.

Also from "Is Resend acceptable for e-mail?": record Resend (Pro, sending from `eu-west-1`, data stored in the US) as an EU-rule exception with its legal basis. Add a line in `DECISIONS.md` that the privacy policy must name Resend as a US processor.

Also from "What is the M1 codebase layout?": rewrite `docs/ARCHITECTURE.md` with the layout recorded there, and add an AGENTS.md pointer to `GLOSSARY.md` (read it before naming anything in code or copy).

Also from "Where do rate-limit counters live?": record Postgres-only rate limiting (no Redis) in `DECISIONS.md`, with the limits and where each is counted. Add `sign_in_link_sends` to the planned schema, and set Better Auth's `rateLimit.storage: "database"`.

Also from "How is an admin created?": record the `admin:set` script (grant and remove), no jury role, and fresh role checks on each admin request in `DECISIONS.md`. Add the script to the install/scripts list for `@repo/db`, and an admin user to the seed.

Also from "How do env vars and secrets flow?" and "How do CI and deploys run?": record the env layout (`.env.local` plus a committed `.env.example` per workspace, Vercel env for deployed values) and the GitHub + Vercel Git integration + Actions-checks setup in `DECISIONS.md` and `docs/ARCHITECTURE.md`. List the Actions workflow as something to add, and note that `capture.mjs` runs locally only.

## Answer

Done on 2026-11-13.

- **`docs/DECISIONS.md`:** added the stack table (what, why, not chosen), the EU-residency rule with its two exceptions (Resend's US storage, and the privacy-policy line; Workflow hook records in `iad1`), the review agent leaving M1 (and the expected `capture.mjs` difference on screen 04), sign-in, rate limits, admins, environments/CI/deploys, the **M1 install list** per workspace, and a "Verify during M1 setup" list of the facts research left unconfirmed. The "Server code layout" entry now notes that the Vite apps and `@repo/contracts` were dropped.
- **ADRs** (the only two that are hard to reverse, surprising and a real trade-off):
  - `docs/adr/0001-eu-data-residency.md`
  - `docs/adr/0002-vercel-workflow-for-background-jobs.md`
- **`docs/ARCHITECTURE.md`:** rewritten with the final layout: the `apps/web/src` tree, route groups, core modules and seams, environments, CI/deploys, where rate limits and workflows go, and new gotchas (`pg`, not `neon-http`; `createDb(client)`; Better Auth's `usePlural` and column defaults).
- **`AGENTS.md`:** pointers to `GLOSSARY.md`, `docs/DECISIONS.md` and `docs/adr/`. The ARCHITECTURE pointer now covers workflows too.
