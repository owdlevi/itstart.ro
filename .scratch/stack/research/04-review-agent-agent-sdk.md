# How the review agent runs on the Claude Agent SDK

Research for ticket `.scratch/stack/issues/04-review-agent-agent-sdk.md`. Context: `docs/HANDOVER.md` §12. Sources read on 2026-11-13. Anything marked **[unconfirmed]** is inference or estimate, not stated in a primary source.

## Recommended setup

| Concern | Recommendation |
| - | - |
| Package | `@anthropic-ai/claude-agent-sdk` (TypeScript; npm latest 0.3.323, `engines.node >=18.14.0`). Call it only from the job worker, behind `reviewProject(project, brief) → { body, observations }`. |
| Model | `claude-opus-5-5` ($4 in / $20 out per MTok), `effort: "medium"` set explicitly, `fallbackModel: "claude-sonnet-5-5"`. Run 20–30 real reviews, then try `claude-sonnet-5-5` at the same settings and keep it only if the Romanian text holds up. |
| Auth | An Anthropic **API key** (`ANTHROPIC_API_KEY`) from a Claude Console org/workspace owned by ITStart, kept in the job runner's secret store. **Never** a Claude Pro/Max/Team subscription login (OAuth). |
| Browser tool | **Playwright MCP** (`@playwright/mcp`, stdio, launched by the SDK through `mcpServers`) with `--headless --isolated --browser chromium --viewport-size 1280x800 --output-dir <tmp>`, plus `--no-sandbox` only if the container needs it. The agent calls `browser_resize` to 375×812 for the mobile pass. |
| Tool allow-list | `tools: []` (no built-in tools: no Bash, Read, Write, Edit, WebFetch, WebSearch, Agent). `allowedTools`: the read/interact subset of `mcp__playwright__*`: `browser_navigate`, `browser_navigate_back`, `browser_resize`, `browser_snapshot`, `browser_find`, `browser_take_screenshot`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_select_option`, `browser_press_key`, `browser_hover`, `browser_wait_for`, `browser_handle_dialog`, `browser_console_messages`, `browser_tabs`, `browser_close`. `disallowedTools`: `mcp__playwright__browser_evaluate`, `mcp__playwright__browser_run_code_unsafe`, `mcp__playwright__browser_file_upload`. Set `permissionMode: "dontAsk"`, `strictMcpConfig: true`, `settingSources: []`, and env `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Add a `PreToolUse` hook that denies anything outside the list (a second layer). |
| Budgets | `maxTurns: 40`, `maxBudgetUsd: 2` (the cap can be overshot by one response, so leave headroom), and an `AbortController` aborting at **8 min** of wall-clock time. The SDK has no session timeout of its own. Playwright: default navigation timeout 60 s, action timeout 5 s. |
| Output contract | `outputFormat: { type: "json_schema", schema }` generated from a Zod schema in `@repo/core`: `{ status: "reviewed" \| "unreachable", body: string (maxLength 600), observations: [{ viewport: "375" \| "1280", step, result, screenshot? }] }`. Accept only `type === "result"`, `subtype === "success"`, `!is_error`, `structured_output` present **and** a Zod re-parse that passes (with the ≤600 check). Any other outcome, or `status: "unreachable"`: post nothing and log it. |
| Logging | Persist one `review_run` row per job: system prompt, user prompt (the brief), model, every SDK message (assistant text, tool calls and results from the stream, skipping the `StructuredOutput` tool), final `structured_output`, `subtype`, `total_cost_usd`, `usage`, `modelUsage`, `duration_ms`, `num_turns`, and the screenshots (upload them to Blob). Optionally also send OTEL (`CLAUDE_CODE_ENABLE_TELEMETRY=1`, plus `OTEL_LOG_USER_PROMPTS=1` and `OTEL_LOG_TOOL_DETAILS=1`). |
| Sessions | `persistSession: false`: there's no resume, and the DB row is the record. |

### Host runtime requirements (checklist for the job-runner decision, ticket 03/05)

- [ ] **Node.js**: ≥18.14 for the SDK and ≥18 for Playwright MCP. The repo pins `>=24` (`package.json` engines), which satisfies both.
- [ ] **Can spawn child processes**: the SDK spawns a native `claude` binary over stdio, which in turn spawns the Playwright MCP Node process, which launches Chromium. A pure serverless function that forbids subprocesses, or whose bundler strips the SDK's optional native-binary dependency, will not work.
- [ ] **Native binary matches the platform**: the bundled `claude` binary must match the host's CPU architecture and libc (glibc or musl). Optional dependencies must be installed in the image.
- [ ] **Headless Chromium plus its system libraries**: use the Playwright browser install with deps, or base the image on `mcr.microsoft.com/playwright`. Chromium's sandbox may need `--no-sandbox` in containers.
- [ ] **Writable filesystem**: `CLAUDE_CONFIG_DIR` (or `~/.claude`), a per-run `cwd`, a temp browser profile, and the screenshot output dir. Ephemeral storage is fine. Anthropic's starting point is 5 GiB of disk per agent.
- [ ] **Memory and CPU**: Anthropic's starting point is 1 GiB RAM and 1 CPU per agent, before Chromium. Plan for **≥2 GiB** per concurrent review **[unconfirmed estimate: Chromium's footprint isn't stated in the sources]**.
- [ ] **Wall-clock**: ≥10 min per job (HANDOVER: posted "within ~10 minutes"). The expected typical run is 2–5 min **[unconfirmed estimate]**.
- [ ] **Outbound network**: HTTPS to `api.anthropic.com` and to arbitrary public URLs (the builders' sites). No inbound port is needed.
- [ ] **Secrets**: `ANTHROPIC_API_KEY` injected as an env var, or through a key-injecting proxy via `ANTHROPIC_BASE_URL`.
- [ ] **Durable sink**: access to Postgres and Blob from the job, so logs and screenshots survive the container.
- [ ] **Concurrency**: 1 review at a time is enough (~50 launches/month). The per-host formula is `(host RAM − overhead) / per-session RAM`.

---

## 1. Licensing and auth: API key or subscription login?

**An API key is required.** A product feature (ITStart's automated reviews) may not run on a Claude subscription (Pro/Max/Team) OAuth login.

Exact terms text:

- Agent SDK overview, note: *"Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead."* (https://code.claude.com/docs/en/agent-sdk/overview)
- Agent SDK overview, License and terms: *"Use of the Claude Agent SDK is governed by Anthropic's Commercial Terms of Service, including when you use it to power products and services that you make available to your own customers and end users, except to the extent a specific component or dependency is covered by a different license as indicated in that component's LICENSE file."* (https://code.claude.com/docs/en/agent-sdk/overview)
- Legal and compliance, Authentication and credential use: *"**OAuth authentication** is intended exclusively for purchasers of Claude Free, Pro, Max, Ultra, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications."* and *"**Developers** building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users."* (https://code.claude.com/docs/en/legal-and-compliance)
- Same page: *"This does not restrict how customers provision and manage their own API keys or third-party inference provider credentials — for example, configuring an API key in a development environment, secrets manager, or machine image for use by the customer's own authorized users — provided the resulting usage is billed to the key owner under their agreement with Anthropic (or the applicable provider) and is not resold or intermediated as described above."* (https://code.claude.com/docs/en/legal-and-compliance)
- Same page, Acceptable use: *"Advertised usage limits for Pro, Max, and Ultra plans assume ordinary, individual usage of Claude Code and the Agent SDK."* (https://code.claude.com/docs/en/legal-and-compliance)
- Consumer Terms (effective Oct 8, 2025), prohibited uses: *"Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise."* (https://www.anthropic.com/legal/consumer-terms)

Supported auth for the SDK: `ANTHROPIC_API_KEY`, or a cloud provider via `CLAUDE_CODE_USE_BEDROCK=1`, `CLAUDE_CODE_USE_ANTHROPIC_AWS=1`, `CLAUDE_CODE_USE_VERTEX=1` or `CLAUDE_CODE_USE_FOUNDRY=1`. The SDK does not load `.env` files automatically. (https://code.claude.com/docs/en/agent-sdk/quickstart)

**Interpretation note [unconfirmed]:** Legal and compliance also has a section, "Can customers offer Claude Code in their products?", which says that when "preinstalling or running Claude Code in your products or services (e.g. in hosted sandboxes or other agent infrastructure)", *"Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential"*. That section reads as being about exposing Claude Code to end users. ITStart's builders never drive the agent: it is ITStart's own back-office job, billed to ITStart's own key. That matches the "own API keys … for use by the customer's own authorized users" carve-out quoted above. If the owner wants certainty, ask Anthropic sales (link on the same page). Keeping the `reviewProject` interface also lets the job switch to the plain Client SDK tool runner, which is not Claude Code, with no change to callers.

## 2. Runtime needs

- **Process model.** `query()` spawns a separate `claude` CLI subprocess and talks to it over stdio. One session maps to one subprocess. The subprocess owns a shell, a working directory, and JSONL transcripts on local disk. (https://code.claude.com/docs/en/agent-sdk/hosting)
- **Runtimes.** "Python 3.10+ for the Python SDK, or Node.js 18.14+ for the TypeScript SDK". Both SDKs "bundle a native Claude Code binary for most installs, and the spawned CLI needs no separate Node.js install". The binary is pinned to the SDK version. (https://code.claude.com/docs/en/agent-sdk/hosting) The npm `engines` field confirms `>=18.14.0` (https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/latest).
- **Filesystem.** Transcripts go in `~/.claude/projects/` or `CLAUDE_CONFIG_DIR/projects`. None of this survives a container restart. `persistSession: false` disables writing the session to disk. (https://code.claude.com/docs/en/agent-sdk/hosting, https://code.claude.com/docs/en/agent-sdk/typescript)
- **Resources.** "1 GiB RAM, 5 GiB disk, and 1 CPU per agent is a reasonable starting point … Memory usage grows with session length and tool activity." (https://code.claude.com/docs/en/agent-sdk/hosting) Chromium comes on top of this **[unconfirmed figure]**.
- **Network.** Outbound HTTPS to `api.anthropic.com`, plus whatever the tools reach. No inbound port is needed for a one-shot job. (https://code.claude.com/docs/en/agent-sdk/hosting)
- **Session pattern.** The "Ephemeral sessions" pattern fits: one container per task, a one-shot entrypoint, exit when done. (https://code.claude.com/docs/en/agent-sdk/hosting)
- **Duration.** There is "No top-level session timeout": bound the run with `maxTurns` and your own abort. (https://code.claude.com/docs/en/agent-sdk/hosting) No official typical duration is published. The estimate is 2–5 min for ~15–30 turns **[unconfirmed]**, and HANDOVER §12 allows ~10 min.
- **Cost of infra vs tokens.** "A minimally provisioned container runs roughly $0.05 per hour, while a single long agent session can spend dollars in tokens." (https://code.claude.com/docs/en/agent-sdk/hosting)
- **Common deployment failures.** The CLI isn't found because the image build skipped optional dependencies, or the binary doesn't match the architecture/libc or lost its exec bit. (https://code.claude.com/docs/en/agent-sdk/hosting#troubleshoot-deployment-failures)
- **Isolation.** Pass `settingSources: []` and `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` so no `CLAUDE.md` or settings from the host leak in. In TS, `env` *replaces* the subprocess env, so spread `...process.env`. (https://code.claude.com/docs/en/agent-sdk/hosting)

## 3. Browser tool: Playwright MCP vs agent-browser vs SDK built-ins

| Need | Playwright MCP | agent-browser | Agent SDK built-ins |
| - | - | - | - |
| Open a URL | `browser_navigate` | `agent-browser open <url>` | `WebFetch` only: fetches HTML, converts it to Markdown, and runs an extraction prompt in a separate model call. No JS, no viewport, "lossy by design" |
| 375 px / 1280 px | `--viewport-size 1280x720` flag; `browser_resize(width,height)` tool; `--device`/`--mobile` | `set viewport <w> <h> [scale]`, `set device "iPhone 14"` | None |
| Interact | `browser_click`, `browser_type`, `browser_fill_form`, `browser_select_option`, `browser_press_key`, `browser_wait_for`, `browser_handle_dialog` on refs from `browser_snapshot` (accessibility tree) | `snapshot -i` gives `@eN` refs, then `click`, `fill`, `type`, `select`, `press`, `wait` | None |
| Screenshots | `browser_take_screenshot` (viewport or `fullPage`, saved to `--output-dir`). The image goes to the model because `--image-responses` defaults to `allow` | `screenshot [path]`, `--full`, `--annotate` | None |
| How the SDK reaches it | Native MCP server over stdio in `mcpServers`, so tools are named `mcp__playwright__*` and can be allow-listed one by one | The CLI path needs the **Bash** tool (breaks the "no shell" guardrail). Its `agent-browser mcp` stdio server avoids Bash; its tool names are `agent_browser_*` | n/a |
| Runtime | Node ≥18 (`@playwright/mcp` 0.0.85); official Docker image `mcr.microsoft.com/playwright/mcp`; `--headless`, `--no-sandbox` | Native Rust binary driving Chrome for Testing over CDP via a background daemon (exits after 1 h idle); npm package `engines.node >=22`; Linux `install --with-deps` | n/a |
| Guardrail flags | `--allowed-origins`/`--blocked-origins` ("*does not* serve as a security boundary"); `--isolated`; dangerous tools `browser_evaluate`, `browser_run_code_unsafe` ("RCE-equivalent") can be denied by name | `--allowed-domains` (blocks navigations and sub-resources), `--action-policy` (deny eval, downloads, uploads), `--content-boundaries`, `--max-output` | n/a |

Sources: Playwright MCP README (https://github.com/microsoft/playwright-mcp/blob/main/README.md), npm metadata (https://registry.npmjs.org/@playwright/mcp/latest); agent-browser README (https://github.com/vercel-labs/agent-browser/blob/main/README.md), commands (https://agent-browser.dev/commands), security (https://agent-browser.dev/security), npm metadata (https://registry.npmjs.org/agent-browser/latest); WebFetch behavior (https://code.claude.com/docs/en/tools-reference#webfetch-tool-behavior).

**Most reliable headless option: Playwright MCP.** It is Microsoft's own wrapper over Playwright, which has auto-waiting and explicit navigation and action timeouts (`--timeout-navigation` defaults to 60 000 ms and `--timeout-action` to 5 000 ms). It has a first-party Docker image for headless Chromium. It plugs into the SDK as a stdio MCP server, so the tool allow-list works per tool and no shell is needed. Playwright's own README suggests the CLI+skills for *coding* agents because it uses fewer tokens, and MCP for "specialized agentic loops that benefit from persistent state", which fits this case. agent-browser is a good second choice, and it has a Vercel Sandbox skill. But its CLI form requires Bash, and its MCP server is newer and less documented: whether its screenshots return to the model as images is **[unconfirmed]**. "Most reliable" is a judgment based on the docs, not a benchmark **[unconfirmed]**.

Watch out for: MCP tool search is on by default and may defer tool definitions (https://code.claude.com/docs/en/agent-sdk/mcp#mcp-tool-search). With ~20 tools this is harmless, but if the first turn can't see the browser tools, set `alwaysLoad: true` on the server or set `ENABLE_TOOL_SEARCH`.

## 4. Model choice and cost per review

Current models and prices (https://platform.claude.com/docs/en/about-claude/models/overview, https://platform.claude.com/docs/en/about-claude/pricing):

| Model | Input | 5-min cache write | Cache read | Output | Notes |
| - | - | - | - | - | - |
| `claude-opus-5-5` | $4 | $5 | $0.20 | $20 | Anthropic's "start here for most workloads". Adaptive thinking always on; **default effort `medium`** |
| `claude-sonnet-5-5` | $2 | $2.50 | $0.10 | $10 | Default effort `high` |
| `claude-haiku-5-5` | $0.10 | $0.125 | $0.01 | $0.50 | ≤100k-token prompts |
| `claude-fable-5-2` | $8 | | | $40 | Overkill here |

All prices are per MTok. The SDK accepts the `model`, `fallbackModel` and `effort` options. `temperature`/`max_tokens` aren't exposed. (https://code.claude.com/docs/en/agent-sdk/configuration)

Screenshot token cost: `⌈w/28⌉ × ⌈h/28⌉` visual tokens (https://platform.claude.com/docs/en/build-with-claude/vision). A 1280×800 viewport costs 46×29 = **1 334 tokens**; a 375×812 viewport costs 14×29 = **406 tokens**. Full-page screenshots of long pages are downscaled to at most 4 784 tokens on 4.7+ models.

**Estimate [unconfirmed, to be checked with `total_cost_usd` on real runs]**: ~20 turns. About 10k tokens of fixed prefix (system prompt, brief, tool schemas), growing to about 60k tokens of context from accessibility snapshots (2–8k each) and ~6 screenshots. Most of the re-sent input is a cache read, about 60–80k tokens are new input written to cache, and output including thinking is about 10–15k tokens.

| Model | Estimated cost per review |
| - | - |
| Opus 5.5 @ medium | **≈ $0.50–0.90** (cap at $2) |
| Sonnet 5.5 | ≈ $0.25–0.45 |
| Haiku 5.5 | ≈ $0.02–0.05 (quality risk for informal Romanian and judgment) |

At ~50 launches a month, Opus 5.5 comes to roughly **$25–45/month**. The cost a run reports, `total_cost_usd`, is a client-side estimate and not billing data (https://code.claude.com/docs/en/agent-sdk/cost-tracking).

## 5. Output contract: a reliable `{ body, observations }`

- Pass `outputFormat: { type: "json_schema", schema }`. The SDK "validates the output against it, re-prompting on mismatch", and the validated value arrives as `structured_output` on the result message. Zod is supported for typed parsing. (https://code.claude.com/docs/en/agent-sdk/structured-outputs)
- Failure modes to handle (same page): subtype `error_max_structured_output_retries`; `success` with `is_error: true` (an API error or refusal); `success` with no `structured_output`. *"A `success` subtype doesn't by itself mean the run produced an answer."* A single-shot `query()` **throws** after yielding an error result, so wrap the loop in try/catch.
- Mechanism: the SDK uses a `StructuredOutput` tool behind the scenes. Read from `structured_output`, not from `tool_use` blocks, and skip `StructuredOutput` calls in logs. (same page)
- "Keep schemas focused … make those fields optional" when the data might not exist. (same page)
- Recommended schema: `status` ("reviewed" | "unreachable"), `body` (string, maxLength 600, Romanian, informal: what works, then at most 2 things to check), and `observations[]` (`viewport`, `step`, `result`, optional `screenshot` filename). Re-validate with Zod in `reviewProject` and enforce `body.length ≤ 600` there too: whether the SDK's validator enforces `maxLength` is **[unconfirmed]**. Map `status: "unreachable"` and every failure path to "post nothing, log it" (HANDOVER §12).
- Whether `outputFormat` still works with `tools: []` (the hidden `StructuredOutput` tool) is **[unconfirmed]**. Check it in the first spike. If it fails, use `disallowedTools` to remove the unwanted built-ins instead.

## 6. Guardrails: browser-only tools, budgets, logging

**Tools.**
- `allowedTools` *"does not restrict Claude to only these tools"*: it pre-approves them. Use `disallowedTools` to block. A bare name such as `"Bash"` "removes the tool from Claude's context". (https://code.claude.com/docs/en/agent-sdk/typescript, https://code.claude.com/docs/en/agent-sdk/permissions)
- "For a locked-down agent, pair `allowedTools` with `permissionMode: "dontAsk"`". In that mode, any call that would otherwise prompt is denied. But "calls that need no approval in `default` mode run whether or not you list them", including read-only Bash and `Agent`. So also remove the built-ins. (https://code.claude.com/docs/en/agent-sdk/permissions)
- The `tools` option restricts built-in tools to those named. The CLI equivalent, `--tools ""`, "disable[s] all". (https://code.claude.com/docs/en/agent-sdk/typescript, https://code.claude.com/docs/en/cli-reference) That `tools: []` in the TS SDK behaves exactly like `--tools ""` is **[unconfirmed]**. As belt and braces, also put `"Bash","Write","Edit","Read","WebFetch","WebSearch","Agent"` in `disallowedTools`.
- Never use `bypassPermissions`: "`allowed_tools` does not constrain `bypassPermissions`". (https://code.claude.com/docs/en/agent-sdk/permissions)
- `strictMcpConfig: true` uses only the servers passed in `mcpServers`, ignoring `.mcp.json`, user settings, plugins and claude.ai connectors. (https://code.claude.com/docs/en/agent-sdk/typescript)
- `PreToolUse` hooks can deny calls ("A hook deny applies even in `bypassPermissions` mode"). A hook that throws lets the call through to the normal permission flow, so keep the allow-list as the primary control. (https://code.claude.com/docs/en/agent-sdk/permissions, https://code.claude.com/docs/en/agent-sdk/hooks)
- Prompt injection from reviewed sites is the main threat. Anthropic recommends defense in depth and network controls (https://code.claude.com/docs/en/agent-sdk/secure-deployment). With no shell, no file writes, no JS-eval tools, and output limited to a schema-checked ≤600-char text that an admin can hide, the blast radius stays small.

**Budgets.**
- `maxTurns` gives `error_max_turns`. Count one turn per tool round plus one for the final answer. `maxBudgetUsd` gives `error_max_budget_usd`. The budget is checked after each response, so "spend can therefore pass the cap by up to the cost of that one response". (https://code.claude.com/docs/en/agent-sdk/agent-loop)
- There is no wall-clock limit in the SDK (https://code.claude.com/docs/en/agent-sdk/hosting). Use `abortController` (https://code.claude.com/docs/en/agent-sdk/typescript) with a timer, and also cap the job in the runner.
- `taskBudget` exists but is *Alpha* (https://code.claude.com/docs/en/agent-sdk/typescript). Not needed here.

**Logging ("log prompts and outputs for review").**
- Iterate the `query()` stream and store every message. The result message carries `total_cost_usd`, `usage` and `modelUsage`, on error results too. (https://code.claude.com/docs/en/agent-sdk/cost-tracking)
- `PostToolUse` hooks see each tool result, useful for an audit trail and for capturing screenshot paths. (https://code.claude.com/docs/en/agent-sdk/hooks)
- OTEL export is optional: `CLAUDE_CODE_ENABLE_TELEMETRY=1`. Prompts and tool inputs are excluded by default. Opt in with `OTEL_LOG_USER_PROMPTS=1`, `OTEL_LOG_TOOL_DETAILS=1`, `OTEL_LOG_TOOL_CONTENT=1`, or `OTEL_LOG_RAW_API_BODIES=1|file:<dir>` for full request/response JSON with thinking redacted. (https://code.claude.com/docs/en/agent-sdk/observability) For M1, logging to the DB is enough.

## Sources

- Agent SDK overview: https://code.claude.com/docs/en/agent-sdk/overview
- Agent SDK quickstart: https://code.claude.com/docs/en/agent-sdk/quickstart
- Hosting the Agent SDK: https://code.claude.com/docs/en/agent-sdk/hosting
- Secure deployment: https://code.claude.com/docs/en/agent-sdk/secure-deployment
- Agent loop (turns, budgets): https://code.claude.com/docs/en/agent-sdk/agent-loop
- Configuration (model, fallback, effort): https://code.claude.com/docs/en/agent-sdk/configuration
- TypeScript reference (Options): https://code.claude.com/docs/en/agent-sdk/typescript
- Permissions: https://code.claude.com/docs/en/agent-sdk/permissions
- Hooks: https://code.claude.com/docs/en/agent-sdk/hooks
- MCP in the SDK: https://code.claude.com/docs/en/agent-sdk/mcp
- Custom tools: https://code.claude.com/docs/en/agent-sdk/custom-tools
- Structured outputs: https://code.claude.com/docs/en/agent-sdk/structured-outputs
- Cost tracking: https://code.claude.com/docs/en/agent-sdk/cost-tracking
- Observability: https://code.claude.com/docs/en/agent-sdk/observability
- Tools reference (WebFetch): https://code.claude.com/docs/en/tools-reference
- CLI reference (`--tools`): https://code.claude.com/docs/en/cli-reference
- Model config (aliases): https://code.claude.com/docs/en/model-config
- Legal and compliance: https://code.claude.com/docs/en/legal-and-compliance
- Consumer Terms of Service: https://www.anthropic.com/legal/consumer-terms
- Commercial Terms of Service: https://www.anthropic.com/legal/commercial-terms
- Models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- Vision (image token cost): https://platform.claude.com/docs/en/build-with-claude/vision
- TS Agent SDK repo / changelog: https://github.com/anthropics/claude-agent-sdk-typescript
- npm `@anthropic-ai/claude-agent-sdk`: https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/latest
- Playwright MCP README: https://github.com/microsoft/playwright-mcp/blob/main/README.md
- npm `@playwright/mcp`: https://registry.npmjs.org/@playwright/mcp/latest
- agent-browser README: https://github.com/vercel-labs/agent-browser/blob/main/README.md
- agent-browser commands: https://agent-browser.dev/commands
- agent-browser security: https://agent-browser.dev/security
- npm `agent-browser`: https://registry.npmjs.org/agent-browser/latest
