# How does the review agent run on the Claude Agent SDK?

Type: research
Status: resolved

## Question

The owner chose Claude Code (the Claude Agent SDK) for the M1 review agent (HANDOVER §12). Using Anthropic's own docs, establish:

- **Licensing/auth:** a product feature must use an Anthropic API key, or can a Claude Code subscription login be used? Quote the terms.
- **Runtime needs:** Node version, filesystem, process model, memory, typical run duration; what a host must provide (feeds ticket 03).
- **Browser tool:** Playwright MCP vs the `agent-browser` CLI vs Agent SDK built-ins for: open a URL at 375 px and 1280 px, interact (try the brief's basic level), take screenshots. Which is most reliable headless?
- **Model choice and cost:** which current Claude model to use and the estimated cost per review (one site, two viewports, a few interactions, ≤ 600-char Romanian output).
- **Output contract:** how to get a structured `{ body, observations }` result reliably.
- **Guardrails:** limiting tools to the browser only (no shell, no file writes), a time/turn budget, and logging prompts and outputs (§12 "log prompts and outputs for review").

Load the `claude-api` skill before reading docs. Answer as a recommended setup, plus the facts behind it.

## Answer

Findings: [research/04-review-agent-agent-sdk.md](../research/04-review-agent-agent-sdk.md)

- **Package:** `@anthropic-ai/claude-agent-sdk` (TypeScript), behind `reviewProject(project, brief)`.
- **Auth:** an ITStart Console **API key** only. Anthropic's terms forbid subscription (OAuth) logins for products built on the SDK; the findings quote the exact terms.
- **Model:** `claude-opus-5-5` at `effort: "medium"`, falling back to `claude-sonnet-5-5`. Estimated $0.50–0.90 per review, ~$25–45/month at ~50 launches. This is a token-count estimate, not measured.
- **Browser:** Playwright MCP over stdio, headless, `--isolated`. The agent switches between 375 px and 1280 px with `browser_resize`.
- **Guardrails:**
  - `tools: []` removes the built-ins; `allowedTools` lists only the browser's read and interact tools.
  - `browser_evaluate`, `browser_run_code_unsafe` and `browser_file_upload` are denied.
  - `permissionMode: "dontAsk"`, `strictMcpConfig`, `settingSources: []`, plus a deny-all `PreToolUse` hook.
  - `maxTurns` 40, `maxBudgetUsd` 2, and our own 8-minute abort (the SDK has no session timeout).
- **Output:** the SDK's JSON-schema mode returning `{ status, body ≤ 600, observations[] }`, re-parsed with zod. On failure or `status: "unreachable"`, nothing is posted and the run is logged.
- **Logging:** a `review_run` row per run (messages, prompt, result, cost), with screenshots in Blob.
- **Host runtime requirements (input to "Choose the job runner"):**
  - Node ≥ 18.14.
  - Can spawn child processes: the bundled `claude` binary (must match the host's CPU and libc) → Playwright MCP → Chromium.
  - Chromium's system libraries; possibly `--no-sandbox`.
  - 5 GiB writable temp disk.
  - ≥ 2 GiB RAM and 1 CPU per concurrent review (RAM figure is an estimate).
  - ≥ 10 minutes wall-clock per job.
  - Outbound HTTPS to `api.anthropic.com` and public sites.
  - `ANTHROPIC_API_KEY` as a secret; access to Postgres and Blob.
- **Spike before building:** confirm that `tools: []` removes every built-in tool and that structured output still works with them removed.
