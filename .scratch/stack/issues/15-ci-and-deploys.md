# How do CI and deploys run?

Type: grilling
Status: resolved

## Question

Once the repo has a remote, where do lint, type-check, tests and `tools/capture.mjs` run, and what deploys to Vercel?

## Answer

Decided with the owner on 2026-11-13:

- **Remote:** GitHub.
- **Deploys:** Vercel's Git integration. Every PR gets a preview deployment, and `main` deploys to production. Actions never runs `vercel deploy`, so GitHub holds no Vercel token.
- **Checks:** GitHub Actions runs lint, type-check and tests on every PR, and they're required for merging.
- **`tools/capture.mjs`:** runs locally only, before a PR, against the reference PNGs. Running it in CI (Playwright browsers and stable fonts on the runner) can be added later if it proves worth it.
