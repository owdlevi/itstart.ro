# Research 03: Job runner options for ITStart

Ticket: [`issues/03-job-runner-options.md`](../issues/03-job-runner-options.md). Researched 2026-11-13 against vendor docs, pricing pages and changelogs. Each claim cites a numbered source (see **Sources**). The choice itself belongs to ticket 05.

## The jobs and our volume

| # | Job | Shape | Needs |
|---|---|---|---|
| J1 | Review agent (HANDOVER §12) | Event: project becomes "Lansat" | Node process that spawns the Claude Agent SDK (which runs the Claude Code CLI as a subprocess) plus headless Chromium at 375 px and 1280 px. Writable filesystem, about 1–2 GB RAM, up to about 10 minutes. Review posted within about 10 minutes. |
| J2 | Deadline reminders (§11.2) | Time-based: 7 days and 1 day before a deadline | Per-challenge timing; ±15 min accuracy is fine |
| J3 | Review-assignment reminder (§11.4) | Delayed: 48 h after launch, only if fewer than 2 reviews are done | A delay plus a condition check at fire time |
| J4 | "New review" e-mail batching (§11.3) | Debounce/throttle: at most 1 per project per hour | Key per project |
| J5 | Link checker (M2) | Periodic HTTP check of every live URL | Cron, short HTTP calls |

Volume: about 100 builders and about 50 launches a month, so about 50 J1 runs a month. J2–J5 add up to a few thousand small runs a month at most.

**Cross-cutting facts that shape every option**

- **Vercel Functions limits.** Max duration is 300 s on Hobby. On Pro it's 800 s, or 1800 s in the extended beta. Memory tops out at 2 GB / 1 vCPU on Hobby and 4 GB / 2 vCPU on Pro. Bundles are capped at 250 MB, or 5 GB with the "large functions" beta [V1]. A 10-minute J1 run therefore **can't run in a Hobby function at all**, and on Pro it only fits under 800 s with little margin.
- **Claude Code on Vercel runs in a Sandbox.** Vercel's own docs on durable agent harnesses say "Claude Code and Codex run only in a Sandbox" [V12]. This is a statement about their `durable-harness` package, not a hard platform ban. Running the Claude Code CLI plus Chromium inside a plain Vercel Function is **unconfirmed** and not documented anywhere I found. Puppeteer's bundled Chromium is named as a common cause of oversized functions [V1]. `@sparticuz/chromium` targets "a vanilla Lambda instance", and its README doesn't mention Vercel [O2].
- **Hobby terms.** Vercel's Hobby plan is restricted to personal, non-commercial use, according to the Terms [V16] and the pricing page [V17]. Whether ITStart counts as commercial is the owner's call. If it does, **Vercel Pro ($20/month per developer seat [V15]) is needed whichever runner is chosen**. That matters for the "one extra paid vendor" budget. Pro is not an extra vendor, but it is a cost.

### J1 host checklist (from ticket 04's "Host runtime" requirements)

Ticket 04 ([`04-review-agent-agent-sdk.md`](04-review-agent-agent-sdk.md)) sets these J1 host requirements:

- Node ≥ 18.14.
- Able to spawn the bundled native `claude` binary, which must match the host's arch and libc. That binary spawns Playwright MCP over stdio, which in turn launches headless Chromium with its system libraries.
- 5 GiB writable temp disk per agent.
- ≥ 2 GiB RAM and 1 CPU per concurrent review.
- ≥ 10 min wall-clock; we abort at 8 min.
- Outbound HTTPS to `api.anthropic.com` and to arbitrary sites.
- `ANTHROPIC_API_KEY`, plus access to Neon and Blob.

How each J1 host scores against that list:

| Requirement | Trigger.dev container | Vercel Sandbox (used by §3, §4, and Inngest's practical path) | Plain Vercel Function (Inngest's default host; §4 drain) |
|---|---|---|---|
| Node ≥ 18.14 | node-22/24/26 runtimes, node-24 default [T15] | Managed images: Node 22/24/26 [V7] | Node.js runtime [V1] |
| Spawn `claude` → MCP → Chromium | Yes, a normal container. Native packages go in `external` and are installed in the image, not bundled [T15, T4] | Yes, a full microVM with `runCommand`, `sudo` and `apt-get` [V8] | **Unconfirmed.** Risky: function bundling/tracing may drop the SDK's optional native-binary dependency (ticket 04 flags this). Not documented by Vercel; Vercel's own Claude Code harness runs "only in a Sandbox" [V12] |
| Arch/libc match | Debian base, so **glibc** [T15]; CPU arch **unconfirmed** (amd64 assumed) | Ubuntu base, so **glibc**; custom images must be `linux/amd64` [V7] | Unconfirmed |
| Chromium system libs | `playwright` extension installs browser + deps; `aptGet` extension for extras [T3, T15] | `apt-get` at runtime, or bake into a custom VCR image or snapshot [V7, V8] | Only a Lambda-style build such as `@sparticuz/chromium`, untested on Vercel [O2] |
| 5 GiB writable disk | 10 GB disk on every machine preset ✔ [T5] | 64 GB ephemeral NVMe ✔ [V6] | `/tmp` size **not stated** on the limits page [V1]. Unconfirmed; likely the binding constraint |
| ≥ 2 GiB RAM + 1 CPU | `medium-1x` = 1 vCPU / 2 GB exactly; `medium-2x` = 2 vCPU / 4 GB for headroom [T5] | 1 vCPU = 2 GB; up to 4 vCPU / 8 GB on Hobby [V6] | Hobby 2 GB / 1 vCPU; Pro up to 4 GB / 2 vCPU [V1] |
| ≥ 10 min wall-clock | No max ✔ [T6] | 45 min Hobby / 24 h Pro per session ✔ [V6] | ✘ Hobby 300 s; Pro 800 s (just enough) [V1] |
| Outbound HTTPS | Yes (default) | Yes; network policies optional [V8] | Yes |
| Secrets, Neon, Blob | Env vars, synced from Vercel by the integration [T14] | Pass env/secrets in at create/run time; the sandbox reaches Neon and Blob over the public internet (my assessment) | Native project env |

**Verdict.** Only the **Trigger.dev container** and the **Vercel Sandbox** clear every J1 requirement on paper. A plain Vercel Function fails on Hobby duration and has two unknowns: disk space and the native binary. That reinforces that Inngest and the Cron option both need a Sandbox (or another container host) for J1.

**Trigger.dev cost at the new sizing.** The machine stays `medium-1x`, so the earlier estimate holds: ≤ $2.55/month for 50 runs at 10 min, and ≈ $2.04 at the 8-min abort [T1].

**Sandbox cost at the new sizing.** 1 vCPU / 2 GB × 8 min × 50 runs ≈ 13 GB-h of memory, which is easy. Active CPU depends on utilisation; even 100% of 1 vCPU comes to ≈ 6.7 CPU-h/month, which **exceeds Hobby's 5 h if every run hits the cap**. Typical runs are expected to take 2–5 min (ticket 04, unconfirmed), which would take that to ≈ 1.7–4 h. These are estimates.

---

## 1. Trigger.dev (Cloud)

**Can it run J1?** Yes, natively in Trigger.dev's own containers:

- **Chromium.** Build extensions install the browser at deploy time. `puppeteer()` installs Chrome and sets the executable path [T2]. `playwright({ browsers: ["chromium"] })` installs Chromium, headless by default [T3].
- **Agent SDK.** There is an official guide for the Claude Agent SDK. You mark `@anthropic-ai/claude-agent-sdk` as `external` in `trigger.config.ts`; the guide says this "is necessary for the Claude Agent SDK". The guide's example uses machine `small-2x` and works in a `mkdtemp` temp directory [T4]. Whether the CLI subprocess gets bundled correctly is for ticket 04 to verify.
- **Machine.** `medium-1x` gives 1 vCPU, 2 GB RAM and a 10 GB disk. Every preset has a 10 GB disk. On out-of-memory errors you can retry on a larger machine with `retry.outOfMemory.machine` [T5].
- **Max duration.** No maximum. `maxDuration` is set per project, task or run, and `timeout.None` lets a run go indefinitely [T6].

**J2–J5**

- **Delays.** `delay: "48h"` or a `Date` covers J3, and also J2 if you schedule a delayed run per challenge per user. There is no maximum delay [T6, T7].
- **Debounce.** The `debounce` option (`key`, `delay`, `mode`, `maxDelay`) covers J4 [T7].
- **Cron.** Declarative or imperative schedules with IANA timezones. On the **Free plan, schedules run at most once per hour** and you get 10 schedules [T8, T1]. That covers J5 and a reminder sweeper.
- **Idempotency.** Idempotency keys stop duplicate reminder sends [T7].

**EU region.** Partial:

- **Execution.** It can run in `eu-central-1` (Frankfurt). You pass `region` per trigger or set a project default; the changelog dates this to 2025-08-21 [T9, T7].
- **Data storage.** The docs state the region "does not change where the run payload, output, tags, logs, or any other data is stored" [T7]. The DPA (last updated 2025-12-23) says "Trigger.dev stores data in a multi-tenant environment in AWS East-1", with SCCs used for transfers [T10]. **Payloads (project URL, review text, e-mail addresses) would be stored in the US.**
- **Plan availability.** Whether the EU region is open to the Free plan is **unconfirmed**; the pricing page doesn't mention regions [T1].
- **Reliability caveat.** A 2026-06-22 incident report says customers were pointed at eu-central-1 while us-east-1 was down, and eu-central-1 then went down too [T11]. I saw this only in a search summary and didn't read the report, so it is **unconfirmed** beyond that.

**Free tier vs our volume**

- **Allowance.** $5 compute credit a month, 20 concurrent runs, 10 schedules and 1-day log retention. There are no preview branches on Free [T1, T6].
- **Rates.** `medium-1x` costs $0.0000850/s and a run invocation costs $0.000025 [T1].
- **J1 estimate.** 50 runs × 600 s × $0.000085 ≈ **$2.55/month** at the worst case of 10 minutes each.
- **J5 estimate.** An hourly link checker at `small-1x` with about 30 s per run comes to about $0.73/month.
- **Verdict.** It fits under $5 (my estimate, not vendor-stated). If it doesn't, Hobby is $10/month [T1].

**Local dev.** `npx trigger.dev dev` runs tasks on your machine, each in its own Node process [T12]. The dev CLI is tied to a Trigger.dev cloud project (dashboard links, `api.trigger.dev`), so you need an account. DEV runs aren't charged [T1]. The build extensions do nothing in dev; locally, Puppeteer uses the browser it downloads on install [T2].

**Deploying alongside Vercel in a pnpm/Turborepo monorepo**

- **Separate deploy target.** Tasks are a separate deploy, not part of the Next.js build.
- **Layout.** The official Turborepo example puts tasks in a workspace package (`packages/tasks`, exported as `@repo/tasks`, with its own `trigger.config.ts`) or inside `apps/web` [T13].
- **Vercel integration.** Each Vercel deploy triggers a Trigger.dev deploy. Env vars sync both ways, and skew protection pins runs to the same commit. **It requires the GitHub integration** because "Trigger.dev always builds from the repo root" [T14]. This repo has no git remote yet, so until then you would deploy with `npx trigger.dev deploy` by hand or from CI.

**Can job code import `@repo/core`?** Very likely yes. Tasks are bundled from the repo root, and the Turborepo example has tasks using a workspace DB package via the Prisma extension [T13]. An explicit `import … from "@repo/…"` inside a task isn't shown in the docs, so treat it as **likely but not confirmed in docs**.

---

## 2. Inngest (Cloud)

**Can it run J1?** Not on its own compute in the Free tier:

- **Where code runs.** Inngest orchestrates; your code runs "wherever you deploy your endpoint" [I5]. On Vercel that means steps run inside Vercel Functions. The 300 s Hobby or 800 s Pro limit applies, because the step ceiling (2 h) "doesn't extend a shorter host timeout" [I2, I6]. Checkpointing and streaming can stretch a *function* past `maxDuration` [I6], but one continuous 10-minute Agent SDK + Chromium session is a single long step. Splitting it is **unconfirmed** to be practical.
- **Connect.** Inngest Connect runs workers on a long-running server. Vercel is explicitly not supported for this; the docs name "Render, Fly.io, Kubernetes, etc." [I7]. That means **another hosting vendor**.
- **Inngest Sandboxes.** The pricing page lists Sandboxes, billed per vCPU-second and GB-second, with 100 concurrent and a 24 h max on Pro. Free-plan sandbox limits are ambiguous on the page [I1]. I didn't find sandbox docs, so **whether they suit Chromium + Claude Code is unconfirmed**. Pro starts at $99/month [I1].
- **Practical J1 path.** An Inngest step starts a **Vercel Sandbox** (see §3) and polls or waits for it. That works, but it's two systems.

**J2–J5.** This is Inngest's strength:

- **Sleeps.** `step.sleep` / `sleepUntil` can wait up to 1 year (J2, J3) [I2].
- **Debounce.** Native per-key debounce, with a period from 1 s to 7 d plus an optional `timeout` (J4) [I3]. Throttling and rate-limit options are also documented [I3].
- **Cron.** Cron triggers exist; I didn't fetch their page, so the details are **unconfirmed**.

**EU region.** **No.**

- Inngest Cloud runs in "two nearby footprints in the eastern United States": AWS us-east-2 plus bare metal in Ashburn, VA [I5].
- The security page says all data is in US AWS databases [I8].
- Multi-region data appears only as a roadmap request [I9].
- Your code still executes in `fra1`, but event payloads and step outputs are stored in the US.

**Free tier vs our volume.**

- **Allowance.** 50k executions a month, where each run and each step counts as one. Also 5 concurrent steps, 500k events and 24 h trace history. At the quota, execution pauses rather than charging overage [I1].
- **Fit.** Our J2–J5 volume is far below 50k.
- **Commercial use.** The Free plan's terms on commercial use are **unconfirmed**; the pricing page doesn't say [I1].

**Local dev.** This is the best of the four. The open-source Dev Server (`npx inngest-cli dev` or Docker) runs locally with dummy keys and a local UI at `:8288` [I4].

**Deploying alongside Vercel.** Functions live in the Next.js app behind `serve()` at `/api/inngest`, so they deploy with the app. The Vercel integration sets the keys and syncs on every deploy, including previews. Deployment Protection must be bypassed so Inngest can reach the endpoint [I6].

**Can job code import `@repo/core`?** Yes. The functions are ordinary Next.js route code, so they import workspace packages like the rest of `apps/web`. That follows from the architecture [I6] rather than an explicit doc statement.

---

## 3. Vercel Workflow + Vercel Sandbox

**What it is.**

- **Status.** Vercel Workflows reached GA on 2026-04-16 [V3].
- **Model.** It is built on the open-source Workflow SDK, with `'use workflow'` / `'use step'` directives. Steps run as Vercel Functions, dispatched by Vercel Queues [V2].
- **Sleeps.** `sleep()` has no maximum and uses no compute while suspended [V4].

**Can it run J1?** Yes, through **Vercel Sandbox** (Firecracker microVMs):

- **Resources.** Up to 4 vCPU / 8 GB on Hobby and 8 vCPU / 16 GB on Pro. Each vCPU comes with 2 GB. Each sandbox gets 64 GB of ephemeral disk [V6].
- **Session length.** Max **45 minutes on Hobby** and 24 h on Pro [V6].
- **Images.** The default image is Ubuntu-based (`universal`, with Node 24) and has `sudo` + `apt-get`, so Chromium can be installed. Better: bake it into a custom image in Vercel Container Registry, or into a snapshot [V7, V8].
- **Long runs.** Detached commands plus `Sandbox.get({ name })` let one step start the run and a later step reconnect [V8].
- **Claude Agent SDK.** Vercel has a guide for running the Claude Agent SDK in Sandbox (`vercel/sandbox/node:22`, Claude Code CLI installed with `sudo npm i -g`). It was published 2025-11-25 and updated 2026-09-24 [V9].
- **Shape.** A workflow step creates the sandbox in `fra1` and runs the agent detached. Further steps wait for it, so no single step needs 10 minutes. Then a final step writes the Review row.
- **Pro alternative.** Workflow steps can run up to 1800 s with an env opt-in. That is a beta from 2026-07-24; Hobby stays at 300 s [V5]. Running Chromium + Claude Code directly in a step is **unconfirmed** (see the cross-cutting facts).

**J2–J5**

- **Delays.** `sleep('…')` or a sleep-until for J2 and J3 [V2, V4].
- **Debounce.** There's no built-in primitive. The cookbook has no debounce recipe; the closest is racing a sleep against a hook [V10]. J4 would be hand-built, for example with a Postgres "last sent at" check.
- **Cron.** J5 starts from Vercel Schedules or Cron (see §4), and "a schedule can start a workflow" [V2].

**EU region.** Good, with caveats:

- **Run data.** Workflows pins each run to the region of the function that started it. With functions in `fra1`, run payloads, records and streams stay in `fra1` [V2, V11].
- **SDK version.** This needs `workflow` ≥ `5.0.0-beta.33`; runs from the 4.x line always live in `iad1` [V2].
- **Leaks.** Hook records default to `iad1`. Observability metadata isn't region-pinned, but it never receives payloads [V11].
- **Sandbox.** It is available in `fra1` (eu-central-1), set per sandbox or as a project default. The default otherwise is `iad1` [V13].

**Free tier (Hobby) vs our volume**

- **Workflow.** 50k Workflow Events and 1 GB data written a month on Hobby. A step costs about 3 events and a sleep about 2 [V4]. Our volume is a few thousand events a month, so it fits.
- **Retention.** Workflow data retention is 1 day on Hobby and 7 days on Pro [V11].
- **Sandbox allowance.** 5 h Active CPU, 420 GB-h provisioned memory and 5,000 creations a month, 10 concurrent. Over the quota, creation pauses rather than billing [V6].
- **J1 memory estimate.** 50 runs × 10 min × 4 GB (2 vCPU) ≈ 33 GB-h, which fits easily.
- **J1 CPU estimate.** Active CPU depends on utilisation, and Chromium + Claude Code is not idle. At an assumed 30% of 2 vCPU it comes to ≈ 0.1 h per run, so **≈ 5 h a month, right at the Hobby cap**. With 1 vCPU / 2 GB it's ≈ 3 h. **My estimate, not measured.**
- **Pro cost.** On Pro, the same 50 runs cost about $1.35 at iad1 rates ($0.128/CPU-h, $0.0212/GB-h). That is inside the $20 monthly credit [V6]. fra1 rates differ and I didn't fetch them.
- **Hobby usability.** Hobby is usable only if ITStart qualifies as non-commercial [V16].

**Local dev.** The Workflow SDK runs locally under `next dev` with no setup (the "Local World"). Runs can be inspected with `npx workflow web` [V14, V2]. **Sandbox has no local emulator**: local runs call the real Sandbox with a `VERCEL_OIDC_TOKEN` from `vercel env pull`, which expires after 12 h [V9]. The alternative is running the agent script directly on the Mac in dev.

**Deploying alongside Vercel.**

- **Part of the app.** It is the same Next.js deployment. You wrap the config in `withWorkflow()` [V14].
- **Turborepo.** Add `app/.well-known/workflow/**` to the build outputs in `turbo.json`, or workflows may "fail to register properly on cache hits" [V14].
- **Middleware.** Exclude `.well-known/workflow/` from the middleware matcher [V14].
- **Vendors.** No new vendor or account.

**Can job code import `@repo/core`?**

- **Workflow steps.** Yes: they're Next.js server code. That follows from the architecture; the docs don't cover workspace imports explicitly [V14].
- **Sandbox code.** It does **not** come from the Next.js bundle. You ship it into the sandbox yourself: write a pre-bundled script with `writeFiles`, use a git source, or build a custom image [V8, V7].
- **How to keep imports.** Bundle the agent entrypoint, including `@repo/core`, with esbuild/tsup into one file, or build a VCR image in CI. That is extra build plumbing (my assessment).

---

## 4. Vercel Cron (or Schedules) + a Postgres-backed queue

**What it is.** There are two pieces: a jobs table in Neon, or a library such as pg-boss, plus a scheduled function that drains it.

- **Cron Jobs (legacy).** On **Hobby**, cron jobs run **once a day** with ±59 min precision. On Pro they can run every minute. Vercel calls Cron Jobs "a legacy feature" to be migrated to Schedules [V18].
- **Schedules (public beta).** On **Hobby**, the most frequent cron is every 15 min with a fixed 15-minute jitter, and the plan allows 5,000 runs and 500 dynamic schedules a billing period. On Pro it's every minute with 1-minute jitter. One-time schedules at a specific time exist, which suits J2 and J3 directly [V19].
- **pg-boss.** It advertises cron scheduling, job deferral, "rate limiting, debouncing, and concurrency" policies, and "Serverless function compatible" [O1]. The exact API wasn't verified, so it is **unconfirmed**.

**Can it run J1?** Not by itself:

- **Function host.** The drain function is a Vercel Function, capped at 300 s on Hobby (see the cross-cutting facts).
- **Workable pattern.** On launch, Next.js `after()` (or the cron drain) starts a **Vercel Sandbox** in `fra1` with a detached command [V8]. The agent inside the sandbox writes the Review row straight to Neon. A sweeper marks stuck jobs as failed.
- **Retries.** There's no durable retry/state machine; you build retries and idempotency yourself (my assessment).
- **Latency.** Relying on a 15-minute Hobby schedule to *start* J1 would break the "within ~10 minutes" target. J1 should be kicked off on the launch request, not by the poller.

**J2–J5**

- **J2/J3.** Rows with `run_at` and a status, drained every 15 min. The alternative is one-time Schedules [V19].
- **J4.** A `last_new_review_email_at` per project, checked in a transaction.
- **J5.** A scheduled batch.
- **Fit.** All of this is plain code plus SQL. It fits our volume easily: every 15 min is about 2,880 runs a month, under the 5,000 cap [V19].

**EU region.** The best of the four: everything stays in Vercel `fra1` plus Neon eu-central-1. The only third party is Resend, which is ticket 07's concern.

**Free tier vs our volume.**

- **Functions.** Covered by Hobby function allowances: 4 CPU-h, 360 GB-h and 1M invocations [V15].
- **J1 compute.** The same Sandbox numbers as §3.
- **Queues.** If you use Vercel Queues instead of a table, Hobby includes 1M operations; the max delay is 7 days, and messages are retained for at most 7 days [V20]. That makes it unsuitable for the 7-day-before reminder unless you re-enqueue (my reading).

**Local dev.** It's just Postgres (`pg-<project>` container) plus calling the route. Schedules support local runs via `vercel dev` [V19]. Sandbox has the same caveat as §3.

**Deploying alongside Vercel.** Cron and Schedules are declared in `vercel.json` (static) or created at runtime (dynamic) [V19]. There's nothing else to deploy, and no new vendor.

**Can job code import `@repo/core`?** Yes for the drain and the e-mail code, which is all in `apps/web`. The Sandbox agent code has the same packaging caveat as §3.

---

## Comparison table

| | Trigger.dev | Inngest | Vercel Workflow + Sandbox | Vercel Cron/Schedules + Postgres queue |
|---|---|---|---|---|
| **J1 review agent runs?** | **Yes, natively** (container + `playwright`/`puppeteer` extension; Agent SDK as `external`) [T2–T4] | **Not alone.** Steps run in Vercel Functions (300 s Hobby). Needs Vercel Sandbox, a Connect worker on another host, or Inngest Sandboxes (Pro, unconfirmed) [I1, I6, I7] | **Yes, via Sandbox** (microVM, apt + sudo, custom image) [V6–V9] | **Via Sandbox only**, started from `after()`/cron; no durable orchestration [V8] |
| **Meets ticket 04 J1 host checklist?** | Yes: Debian/glibc, 10 GB disk, `medium-1x` 1 vCPU/2 GB [T5, T15] | Only via Sandbox/other host | Yes: Ubuntu/glibc, 64 GB disk, 1 vCPU/2 GB [V6, V7] | Only via Sandbox |
| **Max duration** | Unlimited (`maxDuration` configurable) [T6] | Step ≤ 2 h, but capped by the host: Vercel 300 s / 800 s [I2, V1] | Run unlimited; step = function limit (300 s Hobby, 800/1800 s Pro); Sandbox session 45 min Hobby / 24 h Pro [V4, V5, V6] | Function 300 s Hobby / 800 s Pro; Sandbox as left [V1, V6] |
| **Delay / sleep (J2, J3)** | `delay`, no max [T6, T7] | `sleep` up to 1 yr [I2] | `sleep`, no max [V4] | `run_at` rows or one-time Schedules [V19] |
| **Debounce (J4)** | Built-in `debounce` [T7] | Built-in `debounce` [I3] | Hand-built [V10] | Hand-built (SQL) or pg-boss policies (unconfirmed) [O1] |
| **Cron (J5)** | Yes; Free ≤ 1/hour, 10 schedules [T8, T1] | Yes (details unconfirmed) | Via Vercel Schedules/Cron [V2] | Hobby: Cron daily, Schedules every 15 min (beta); Pro every 1 min [V18, V19] |
| **EU region** | Execution in eu-central-1; **data stored in US (AWS us-east-1)** [T7, T10] | **No.** US only [I5, I8] | **Yes**: run data pinned to `fra1` (workflow ≥ 5.0.0-beta.33); Sandbox in `fra1`; metadata/hook records partly not pinned [V2, V11, V13] | **Yes**: all in `fra1` + Neon EU |
| **Free tier vs our volume** | $5 credit; est. J1 ≈ $2.55/mo + J5 ≈ $0.73/mo → fits (estimate) [T1] | 50k executions → fits J2–J5; J1 needs compute elsewhere [I1] | Workflow 50k events fits; Sandbox 5 CPU-h/mo is **tight** for J1 (estimate); Hobby is non-commercial only [V4, V6, V16] | Hobby function quota fits; J1 same Sandbox caveat; Schedules 5,000 runs/mo [V19] |
| **Local dev** | `trigger.dev dev`, local processes, needs cloud account [T12] | Dev Server, fully local, best [I4] | Local World under `next dev`; Sandbox only remote (OIDC, 12 h) [V9, V14] | Local Postgres + route; Schedules via `vercel dev` [V19] |
| **Deploy with Vercel / Turborepo** | Separate deploy; Vercel integration needs GitHub (no remote yet) or CLI deploy [T13, T14] | In-app `/api/inngest`; Vercel integration syncs on deploy [I6] | In-app (`withWorkflow`); add `.well-known/workflow/**` to turbo outputs [V14] | In-app; `vercel.json` |
| **Imports `@repo/core`?** | Likely yes (bundled from repo root; not explicit in docs) [T13, T14] | Yes (Next.js route code) | Steps yes; Sandbox agent needs its own bundle/image | Drain yes; Sandbox agent needs its own bundle/image |
| **New vendor?** | Yes | Yes | No | No |
| **Paid need for M1** | Probably none ($5 credit) | None for J2–J5; J1 still needs Sandbox or another host | Vercel Pro if commercial or if Sandbox CPU exceeds Hobby | Vercel Pro if commercial |

Other Vercel options seen but not researched: **Vercel Daemons** (container workers, public beta) [V12a] could also host J1. Its limits and region support are **unconfirmed**.

---

## If I had to pick (recommendation only; the owner decides in ticket 05)

I'd go with **Vercel Workflow + Vercel Sandbox (`fra1`)**.

- **J1.** Run it in a Sandbox built from a custom image with Chromium and the Claude Code CLI, started and awaited by a workflow.
- **J2, J3.** Workflow `sleep`.
- **J4.** A small Postgres "last sent" check.
- **J5.** A Vercel Schedule that starts a workflow.

**Why.** It is the only option that adds **no new vendor**, keeps run data in `fra1` next to Neon, deploys with the Next.js app, and lets the e-mail code import `@repo/core` directly.

**Cost to accept.**

- **Packaging.** The agent code must be shipped into the Sandbox as its own bundle or image.
- **Vercel Pro is realistically required.** That is because of the Hobby non-commercial terms and the tight 5 CPU-h Sandbox allowance; at our volume, Sandbox and Workflow usage should sit inside Pro's $20 credit.
- **Debounce.** It has to be hand-written.

**Runner-up.** **Trigger.dev**, if the owner would rather spend the one extra vendor slot to get native Chromium containers, built-in debounce and delays, and a likely-free bill. Its US data storage conflicts with the EU-residency preference, though.

**Inngest** is the weakest fit: US-only, and it can't run J1 without a second compute host.

---

## Sources

Accessed 2026-11-13. `last_updated` values are from page front-matter where shown.

**Trigger.dev**
- [T1] Pricing: https://trigger.dev/pricing (no date shown on page)
- [T2] Puppeteer extension: https://trigger.dev/docs/config/extensions/puppeteer
- [T3] Playwright extension: https://trigger.dev/docs/config/extensions/playwright
- [T4] Claude Agent SDK setup guide: https://trigger.dev/docs/guides/ai-agents/claude-code-trigger (example uses an older model id; may be stale)
- [T5] Machines: https://trigger.dev/docs/machines
- [T6] Limits: https://trigger.dev/docs/limits
- [T7] Triggering (delay, ttl, idempotency, debounce, region): https://trigger.dev/docs/triggering
- [T8] Scheduled tasks: https://trigger.dev/docs/tasks/scheduled
- [T9] Changelog, multi-region workers (2025-08-21): https://trigger.dev/changelog/multi-region-workers
- [T10] Data Processing Agreement (last updated 2025-12-23): https://trigger.dev/legal/dpa
- [T11] Incident report, 2026-06-22 (seen via search summary only; not read): https://trigger.dev/blog/incident-report-jun-22-2026
- [T12] CLI dev command: https://trigger.dev/docs/cli-dev-commands
- [T13] Turborepo monorepo example: https://trigger.dev/docs/guides/example-projects/turborepo-monorepo-prisma
- [T14] Vercel integration: https://trigger.dev/docs/vercel-integration
- [T15] Build extensions and deploy images (Debian/glibc bases, `external`, `aptGet`), seen via search summary of these pages: https://trigger.dev/docs/config/extensions/overview, https://trigger.dev/docs/config/extensions/aptGet, https://trigger.dev/docs/config/config-file

**Inngest**
- [I1] Pricing: https://www.inngest.com/pricing (no date shown)
- [I2] Usage limits: https://www.inngest.com/docs/usage-limits/inngest
- [I3] Debounce: https://www.inngest.com/docs/guides/debounce
- [I4] Local development: https://www.inngest.com/docs/local-development
- [I5] Cloud architecture and security (no date shown): https://www.inngest.com/docs/platform-and-operations/cloud-architecture-and-security
- [I6] Deploy on Vercel: https://www.inngest.com/docs/deploy/vercel
- [I7] Connect: https://www.inngest.com/docs/setup/connect
- [I8] Security page, data in US AWS (seen via search summary; page may be stale): https://www.inngest.com/security
- [I9] Roadmap requests: https://roadmap.inngest.com/request

**Vercel**
- [V1] Functions limits (2026-08-24): https://vercel.com/docs/functions/limitations
- [V2] Workflows overview (2026-09-04): https://vercel.com/docs/workflows
- [V3] Workflows GA blog (2026-04-16): https://vercel.com/blog/a-new-programming-model-for-durable-execution
- [V4] Workflow pricing and limits (2026-09-16): https://vercel.com/docs/workflows/pricing
- [V5] Changelog, Workflow steps extended durations (2026-07-24): https://vercel.com/changelog/workflow-steps-now-support-extended-function-durations
- [V6] Sandbox pricing and quotas (2026-09-10): https://vercel.com/docs/sandbox/pricing
- [V7] Sandbox images (2026-08-11): https://vercel.com/docs/sandbox/concepts/images
- [V8] Working with Sandbox (2026-09-15): https://vercel.com/docs/sandbox/working-with-sandbox
- [V9] KB guide, Claude Agent SDK in Sandbox (updated 2026-09-24): https://vercel.com/kb/guide/using-vercel-sandbox-claude-agent-sdk
- [V10] Workflow SDK cookbook (no debounce recipe): https://workflow-sdk.dev/cookbook
- [V11] Workflow data retention and storage location (front-matter date shows 2018-10-20, clearly a placeholder; content references the 5.x SDK, so current): https://vercel.com/docs/workflows/retention
- [V12] Agent harnesses (same placeholder date): https://vercel.com/docs/agent-harnesses
- [V12a] Background workers overview, incl. Daemons beta (same placeholder date): https://vercel.com/docs/background-workers
- [V13] Sandbox regions (2026-09-22): https://vercel.com/docs/sandbox/concepts/regions
- [V14] Workflow SDK, Next.js getting started: https://workflow-sdk.dev/docs/getting-started/next
- [V15] Hobby plan (2026-09-14): https://vercel.com/docs/plans/hobby
- [V16] Terms of Service, Hobby personal/non-commercial (via search summary): https://vercel.com/legal/terms
- [V17] Pricing page: https://vercel.com/pricing
- [V18] Cron Jobs usage and pricing (2026-07-15): https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing
- [V19] Schedules limits (public beta; placeholder date): https://vercel.com/docs/schedules/limits
- [V20] Queues pricing and limits (2026-08-12): https://vercel.com/docs/queues/pricing

**Other**
- [O1] pg-boss README: https://github.com/timgit/pg-boss
- [O2] @sparticuz/chromium README: https://github.com/Sparticuz/chromium

**Unconfirmed items, collected:**
- Running the Claude Code CLI plus Chromium inside a plain Vercel Function, including its `/tmp` size and whether the native binary survives bundling.
- The CPU architecture of Trigger.dev's deploy images.
- Trigger.dev EU region availability on the Free plan.
- `@repo/*` imports inside Trigger.dev tasks (likely, but not shown in the docs).
- Inngest Sandboxes' suitability and Free-plan limits, and Inngest cron details.
- The pg-boss debounce API.
- Vercel Daemons' limits and regions.
- Sandbox fra1 pricing.
- Every cost figure marked "estimate".
