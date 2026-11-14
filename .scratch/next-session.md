# Next session: finish screen 02 (Provocare), then screen 03 (Lansări)

Paste everything below the line into a fresh session.

---

Finish screen 02 (Provocare, `/provocari/[slug]`, signed out): it's built but hasn't been checked against the reference yet. Then build screen 03 (Lansări) if there's room. Build no screen past the one you're on until it's done per HANDOVER §14.

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). Sign-in is email and password for now (DECISIONS, "Email and password for now"). The parts that matter most: HANDOVER §3 (sections hidden until later milestones), §5 rules 1–5, §6 screens 02 and 03, §7–§10, §13 and §14; `docs/ARCHITECTURE.md` (where code goes; read the gotchas, two are new); DECISIONS "Fixture counts", "Screen 01 data", "Screen 01 build", "Screen 02 data" and "Screen 02 build"; `docs/design/components/*.md` (Tabs, FilterChip and Checkbox for screen 03); `docs/design/fixtures.json` (`screenStates`) and `screens.json`. Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-14

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare`, branched from it. Work here, or on a branch from it. Its commits:
  1. **Schema and seed:** the challenge brief (scenarioNote, scenario, baseLevel, stretch, launchCriteria, launchNote, materialsUrl/Note, `tips` jsonb, juryNote), `users.givenName`, the `project_updates` table, and the `launchers` extras metric. Migration `0003_screen_02`.
  2. **Core:** `challenges.bySlug()` (brief, `status`, `votingOpen`: rules 1 and 3), `challenges.participants()` (viewer first, then earliest joined; no leavers or agents: rule 2), `projects.inProgress()` with `latestUpdate`, and an `agents` option on the lists. 37 PGlite tests.
  3. **Screen 02:** `src/app/(site)/provocari/[slug]/page.tsx`, `src/flags.ts` (milestone flags), `SectionHeading` (shared with Home), the LaunchRow update line, `lib/dates.ts`, and 40px avatars.
  4. **Docs** for all of the above.

## 1. Finish screen 02

- Start Postgres if needed (`orb start`, then `docker start pg-itstart`), and reseed with `pnpm db:seed:fixtures --reset`.
- **Start the server with `DESIGN_FIXTURES=1 pnpm dev`**: `.env.local` doesn't turn fixtures mode on, so without it the clock isn't frozen (the countdown reads 16 zile instead of 19). An SSH tunnel holds `localhost:3000`, so the dev server is reachable only on the LAN IP (`ipconfig getifaddr en0`). That's fine for `capture.mjs`, but pages don't hydrate there. Test interaction on `next build && next start`. Don't change the port or the config; if 3000 is taken by something else, tell me.
- Run `node docs/tools/capture.mjs app --base http://<LAN IP>:3000 --only 02` and loop until each variant is `match`, or every difference left is one of these expected ones (list them in DECISIONS, "Screen 02 build"):
  - thumbnails (§9.4);
  - the hidden M2/M3 sections: "Întrebări și ajutor", the "Toate provocările" link, the "Și 4 agenți AI" panel;
  - the launched rows: Brici and La Fix in place of Frizerie Simplă and Brici (agent projects hidden, rows ordered by votes);
  - 7 participant avatars, not 8 (Bianca hasn't joined).
- Then the rest of §14: a manual pass at 390, 768, 1024 and 1280 in both themes with the Hungarian sample string; keyboard order; the ended and upcoming states (point a challenge's dates elsewhere in a scratch database, or test through core); signed in as `andrei-popescu` (`/dev/login-as/andrei-popescu?next=/provocari/frizerie`): his own Scaunul 3 shows the plain count.

## 2. Screen 03 (Lansări), if there's room

Signed in as andrei-popescu. Tabs (add shadcn's `tabs`, then rewrite it onto our tokens; see ARCHITECTURE), FilterChips, the sort, week groups (Monday–Sunday, Bucharest), filters in the URL, and the empty state. The URL parameters are already in use:
- `eticheta=<tool>`, from Tags;
- `provocare=<slug>` and `stadiu=in-lucru`, from screen 02's "Vezi toate".

Pick the names for sort and tab, and record them. Agent-built projects and the "Arată și agenții AI" checkbox are M3 (`flags.builderAgents`). The reference's agent rows are another expected difference.

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer:
- the "Cele mai votate săptămâna asta" heading (§13.1);
- the vote refusal copy;
- "Un minut. Fără parolă." under the join button.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: screen 06 (`/intra`; it needs the owner's copy for the password form), screen 08's joining, the Resend adapter, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
