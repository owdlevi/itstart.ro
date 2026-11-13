# Choose the job runner

Type: grilling
Status: resolved
Blocked by: 03, 04

## Question

Given the comparison in ticket 03 and the review agent's runtime needs from ticket 04, which runner hosts ITStart's background jobs? Does it count as the one extra paid vendor for M1? And does it add an app to the monorepo (e.g. `apps/worker`)?

Also decide, from the job-runner research: is ITStart commercial use under Vercel's terms? Hobby is non-commercial only. If yes, Vercel Pro ($20/month) is needed whichever runner is chosen, which changes the "free tiers first" math in favour of Vercel Workflow + Sandbox.

## Answer

Decided with the owner on 2026-11-13.

- **Hosting plan:** ITStart is commercial use, so it runs on **Vercel Pro** ($20/month) from the first public deploy. This is a paid plan on an existing vendor, so it doesn't use the "one extra paid vendor" slot.
- **EU residency rule (tightened):** wherever an EU option exists, use it. A US processor is allowed only when no EU option exists, and it is recorded in `DECISIONS.md` with the reason. This rules out Trigger.dev and Inngest, which store data in the US.
- **Job runner: Vercel Workflow** (`workflow` 5.5.0 stable; run data pinned to `fra1`), deployed inside `apps/web` via `withWorkflow()`.
  - Reminders (7 days / 1 day before the deadline, 48 h after launch): Workflow `sleep`.
  - "At most one new-review e-mail per project per hour": hand-written "last sent at" check in Postgres.
  - M2 link checker: a Vercel Schedule that starts a workflow.
  - Known exception: workflow hook records default to `iad1` (small metadata, no payloads). Record it in `DECISIONS.md`.
- **Review agent: moved out of M1** by the owner (a scope change against HANDOVER §3, which listed it under M1). When it is built, the planned host is **Vercel Sandbox in `fra1`**, started by a workflow, following "How does the review agent run on the Claude Agent SDK?". Until then, M1 needs no Sandbox, no Agent SDK and no Anthropic key.
- **Monorepo:** no new app in M1. Where the agent's code will live (`apps/review-agent` was proposed) is decided when the agent is built.
