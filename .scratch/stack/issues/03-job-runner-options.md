# Which job runners can host ITStart's background work?

Type: research
Status: resolved

## Question

Compare **Trigger.dev**, **Inngest**, **Vercel Workflow (+ Vercel Sandbox)** and **Vercel Cron + a Postgres-backed queue** for these M1/M2 jobs, citing each vendor's docs and pricing pages:

1. The review agent: Claude Agent SDK driving headless Chromium at 375 px and 1280 px, up to ~10 minutes per run (see ticket 04 for its runtime needs).
2. Scheduled e-mails: reminders 7 days and 1 day before a challenge deadline; a review-assignment reminder 48 h after launch.
3. Debounced batching: at most one "new review" e-mail per project per hour.
4. M2 link checker: periodic HTTP check of every live URL.

For each runner: can it run (1) at all, and how (container, build extension, sandbox); max duration; EU region; free-tier limits vs our volume (~100 builders, ~50 launches/month); local dev story; how it deploys alongside a Vercel-hosted Next.js app in a pnpm/Turborepo monorepo; whether job code can import `@repo/core`.

End with a comparison table. The choice itself belongs to ticket 05.

## Answer

Findings: [research/03-job-runner-options.md](../research/03-job-runner-options.md). Checked against the host requirements from "How does the review agent run on the Claude Agent SDK?".

- **Only Trigger.dev and Vercel Sandbox can host the review agent.** Inngest and Vercel Cron would need a Sandbox for it. A plain Vercel Function is capped at 300 s on Hobby, and whether it can run the bundled `claude` binary with 5 GiB of disk is unconfirmed.

| | Trigger.dev | Inngest | Vercel Workflow + Sandbox | Vercel Cron + Postgres |
|---|---|---|---|---|
| Review agent | Yes (Debian/glibc, 10 GB disk, 1 vCPU/2 GB) | Only via Sandbox | Yes (Ubuntu/glibc, 64 GB disk) | Only via Sandbox |
| Max duration | No limit | Function limit (300/800 s) | Sandbox 45 min Hobby / 24 h Pro | Function limit |
| Debounce | Built in | Built in | Hand-built | Hand-built |
| Cron | Free plan: at most hourly | Yes | Via Schedules | Hobby: every 15 min (beta) |
| EU | Runs in Frankfurt, data stored in US | US only | Run data + Sandbox in `fra1` | All EU |
| Free tier | $5 credit, ~$3.5/month estimated | 50k executions | Sandbox 5 CPU-h/month is tight | Fits |
| New vendor | Yes | Yes | No | No |

- **Researcher's pick (not a decision):** Vercel Workflow + Sandbox in `fra1`. It adds no vendor, keeps data in the EU and deploys with Next.js. The costs: the agent needs its own bundle/image, and debounce is hand-written. Runner-up: Trigger.dev, with native containers and built-in debounce, likely free, but data stored in the US.
- **Hosting fact:** Vercel **Hobby is non-commercial only**, and its Sandbox quota is tight, so Vercel Pro ($20/month) is realistically needed for this route.
