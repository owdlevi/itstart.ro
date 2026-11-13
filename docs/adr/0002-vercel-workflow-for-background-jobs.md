# Vercel Workflow for background jobs

Reminders (7 days and 1 day before the deadline, 48 h after launch), new-review e-mail batching and the M2 link checker run as Vercel Workflow workflows inside `apps/web`, with run data in `fra1`. Trigger.dev had native containers and built-in debounce, but it stores data in the US, which ADR 0001 rules out. Workflow adds no vendor, and its durable `sleep` covers the reminders. We hand-build debounce: a "last sent at" check in Postgres gives at most one new-review e-mail per project per hour. Workflows stay thin (sleep, ask `core.notifications`, send) so the rules stay in core, and changing runners means rewriting only `src/workflows/`.

## Consequences

- The review agent, when it's built, runs in Vercel Sandbox (`fra1`), started by a workflow. A Vercel Function can't spawn a CLI and Chromium with 2 GiB of RAM for 10 minutes.
