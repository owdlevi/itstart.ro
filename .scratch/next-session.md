# Next session: screen 02 (Provocare), then onward

Paste everything below the line into a fresh session.

---

Build screen 02 (Provocare, `/provocari/[slug]`, signed out) to the reference, then screen 03 (Lansări) if there's room. Build no screen past the one you're on until it's done per HANDOVER §14.

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). Sign-in is email and password for now (DECISIONS, "Email and password for now"). The parts that matter most: HANDOVER §3 (sections hidden until later milestones), §5 rules 1–3 and 5, §6 screen 02 and 03, §7–§10, §13 and §14; `docs/ARCHITECTURE.md` (where code goes; read the gotchas, several are new); DECISIONS "Fixture counts", "Screen 01 data" and "Screen 01 build"; `docs/design/components/*.md`; `docs/design/fixtures.json` (`screenStates`) and `screens.json`. Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

State on 2026-11-14: branch `screen-01-groundwork` (7 commits, not pushed yet: the `gh` token lacks the `workflow` scope, see NEXT-ACTIONS) has:

- **CI:** `.github/workflows/ci.yml` runs lint, type-check and test on PRs and pushes to `main`.
- **Copy:** next-intl with a fixed `ro` locale. All copy is in `apps/web/messages/ro.json`, and the keys are typed.
- **Sessions:** `getSession()` (`src/server/session.ts`), `authClient` (`src/lib/auth-client.ts`), and `/dev/login-as/[handle]` (fixtures mode only; `anonymous` signs out).
- **Schema:** challenges have number, intro, summary, builtFor and startsAt; projects have slug, pitch, liveUrl, tools and screenshots. New tables: participations, reviews and `fixture_count_extras`.
- **Seed:** `db:seed:fixtures` loads all of the above. Counts above the seeded rows go into the extras table.
- **Core:** `challenges.running()` and `challengeStatus()` (rule 1), `projects.mostVoted()`, and `withExtra()` for every count. 27 PGlite tests.
- **Shell and components:** the header and footer (`src/app/(site)/layout.tsx`), and the spec components Button, Wordmark, Avatar, Tag, StatusChip, AgentBadge, Countdown, VoteButton/VoteCount (with the `toggleVote` server action), ProjectCard, LaunchRow and ProjectVote.
- **Screen 01** at `/`: mobile `match`; desktop differs only in the thumbnails (§9.4).

If the branch isn't on GitHub yet, first ask me whether `gh auth refresh -h github.com -s workflow` is done. Then push it (`git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u origin screen-01-groundwork` works without `gh auth setup-git`), open its PR with `gh`, and check that CI passes. Start this session's work on a branch from that one (or from `main` once it's merged).

Port 3000 on `localhost` may be taken by an SSH tunnel. If it is, `pnpm dev` is reachable only on the LAN IP, where Next blocks dev resources and pages don't hydrate. Tell me rather than changing the port or the config. `capture.mjs` works against `pnpm dev` on the LAN IP (the screenshots don't need hydration). Test interaction on `next build && next start`.

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass.

1. **Schema and seed for screen 02:** the challenge's brief fields (scenarioNote, scenario, baseLevel[], stretch[], launchCriteria[], materialsUrl?, materialsNote?, the tip cards, the "Trei recunoașteri" panel copy and juryNote). Check whether the tips and the recognitions panel are per-challenge data or fixed copy, and record the call in DECISIONS. Add project updates (`ProjectUpdate`: version, text, createdAt) for the "În lucru" rows, and the extras for `in_progress` and the participant list. Extend `db:seed:fixtures`.
2. **Core reads for screen 02:** a challenge by slug with its status (rules 1 and 3), its participants for the sidebar (avatars and the "Andrei, Réka și încă 83" sentence: the participants count minus the names shown; the reference shows "86 de oameni construiesc" and "23 au lansat deja"), its launched projects (four rows; find out from the reference which order and which four) and its "În lucru" projects with their latest update. Pick the module by its job, with tests named by rule number.
3. **Screen 02** per HANDOVER §6 02:
   - Hide "Întrebări și ajutor", "Și 4 agenți AI" and "Toate provocările" behind milestone flags (`src/flags.ts`, §3). The layout without them must still look right, and `capture.mjs` will show their absence as a difference: list it.
   - The sidebar comes first on mobile.
   - The join button links to `/intra?provocare=<slug>`, the same as Home.
   - Done per §14 with `node docs/tools/capture.mjs app --base <dev url> --only 02`.
4. **Screen 03 (Lansări)** if there's room. It's signed in as andrei-popescu, with Tabs (add shadcn's `tabs` and rewrite it onto our tokens; see ARCHITECTURE), FilterChips, the sort, the agents checkbox, week groups and filters in the URL. Tags already link to `/lansari?eticheta=<tool>` (DECISIONS, "Screen 01 build"), so honour that parameter.

Still open from screen 01, for the owner (NEXT-ACTIONS): the "Cele mai votate săptămâna asta" heading (§13.1) and the vote refusal copy. Don't change either without an answer.

If context runs low, stop at a step boundary, commit, and write what's left into this file for the next session.

Out of scope: screen 06 (`/intra`; it needs the owner's copy for the password form, see DECISIONS), the Resend adapter, and anything that needs Vercel, Neon, OAuth apps or Resend accounts. If you hit one of those, add it to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off anything finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
