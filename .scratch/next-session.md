# Next session: screen 08 (Provocare, înscris)

Paste everything below the line into a fresh session.

---

Build screen 08 (Provocare, înscris: `/provocari/<slug>` for a participant, right after joining). Build no screen past it until it's done per HANDOVER §14.

Read first: `AGENTS.md` and every doc it points to, including `docs/NEXT-ACTIONS.md` (no Vercel, Neon, OAuth apps or Resend yet: build and test locally only). The parts that matter most: HANDOVER §3, §5 rules 1–3, §6 screens 02 and 08 (08 is 02 plus the participant's parts), 06 and 07 (where joining starts), §7–§10, §13 (item 3, gendered Romanian) and §14; `docs/ARCHITECTURE.md` (core modules, the sign-in and onboarding flow, the gotchas); DECISIONS "Screen 02 data" and "Screen 02 build" (the page 08 extends: participant list, "Tu, …", sidebar order, the join button), "Screen 06 build" and "Screen 07 data/build" (`finishSignIn`, `completeOnboarding`, `signInDestination`, the un-onboarded shell), "M1 install list" (`alert-dialog` from shadcn for the leave confirm) and "Verify during M1 setup" (Base UI's `alertdialog`); `docs/design/components/*.md`; `screens.json` and the `Provocare-inscris*` references; `fixtures.json → screenStates["08"]`. Every stack decision is final. If something truly isn't decided, ask me and record the answer in `docs/DECISIONS.md`.

## State on 2026-11-14

Branches, all local:
- `screen-01-groundwork`: CI, next-intl, sessions, the shell and components, screen 01. I'm pushing it by hand (the `gh` token lacks the `workflow` scope). Local `main` was fast-forwarded to it by mistake; don't push `main`.
- `screen-02-provocare` (02, 03) → `screen-04-proiect` (04) → `screen-05-profil` (05) → `screen-06-intra` (06) → `screen-07-bun-venit` (07), each branched from the one before. Work on a new branch from `screen-07-bun-venit` (`screen-08-inscris`). What 06 and 07 added:
  - **Screen 06 (done per §14):** `/intra`, e-mail and password in two modes (`?cont=nou|intra`), `?provocare=` and `?next=` carried on. `challenges.buildingPhrase` (migration `0006`). Field component.
  - **Screen 07 (done per §14, all four variants `match`):** `/bun-venit`; core `profiles.onboard()` (name, city, tools, reminders as ticked, handle from the name, once; 91 core tests); Checkbox component; the header's avatar reads "Termină-ți profilul" until `onboardedAt` is set.
  - **The flow:** after Better Auth signs someone in, `finishSignIn` (`app/actions/sign-in.ts`) redirects through `lib/sign-in-destination.ts`: not onboarded → `/bun-venit?provocare=&next=`; else `next`, else `/provocari/<slug>`, else Home. `/bun-venit`'s `completeOnboarding` (`app/actions/onboarding.ts`) redirects the same way. **Neither joins yet: that's this screen.**
  - DECISIONS, ARCHITECTURE and NEXT-ACTIONS cover all of it.

## Running it

- Postgres: `orb start`, then `docker start pg-itstart`; run `pnpm db:migrate`, then reseed with `pnpm db:seed:fixtures --reset` (always reseed after trying forms; sign-ups leave users behind).
- `DESIGN_FIXTURES=1 pnpm dev` in `apps/web` serves `http://localhost:3000`, and pages hydrate. If 3000 is taken, look at what holds it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`); a leftover `next dev` or `next-server` from this project can be stopped, anything else, tell me.
- `node docs/tools/capture.mjs app --base http://localhost:3000 --only 08` (output in `docs/review/`). Compare element positions in the reference HTML and the app with Playwright (`getBoundingClientRect` of the same selectors in both), and diff aligned regions with pixelmatch using capture.mjs's options (`threshold: 0.1, includeAA: false`). Anything under ~0.6% is antialiasing. Scripts outside the repo must import Playwright, pngjs and pixelmatch by absolute path from the repo's `node_modules`. Screen 08 shares 02's hidden M2/M3 sections, so expect the same `differs` causes as 02 (DECISIONS, "Screen 02 build"); compare the aligned regions.
- Better Auth's rate limiter is off in `pnpm dev` (ARCHITECTURE gotcha). A password account: `/intra?cont=nou`, then `/bun-venit`.

## Screen 08

- **Core, in `challenges`:** `join()` and `leave()` (rule 2: one action; leaving keeps projects but removes them from the participant list; a second join after leaving rejoins). Refuse an ended challenge, and decide about upcoming ones. Refusals as values; one test per rule.
- **Joining:** from the challenge page's "Intră în provocare" when signed in, and after sign-in from a challenge: add the join to `finishSignIn` and `completeOnboarding` (for a joinable `challengeSlug`), so "signing in also joins it" (HANDOVER §6 06). Decide what the join button does for a signed-in, not-onboarded user.
- **The page for a participant:** the success banner (`role="status"`, shown once after joining: decide how "once" is carried, e.g. a query flag the page drops), the chip "Ești înscris/ă" (§13.3: there's no stored gender, so decide and record; the reference says "Ești înscrisă" for Bianca), the sidebar "Pașii tăi" checklist (done / not done from real data), primary "Adaugă proiectul" → `/lanseaza` (screen 09, not built yet), "Renunță la provocare" with a confirm (shadcn `alert-dialog` on Base UI; record its copy and check `role="alertdialog"` and the focus trap), the count +1 and "Tu, Ioana, Andrei și încă 84."
- **The capture:** `screens.json` opens `/provocari/frizerie` as `bianca-radu`, and the seed has her **not joined and not onboarded** (screens 07 and 08 share her). `screenStates["08"]` says "right after joining: participant count shows 87". Decide how fixtures mode reaches that state (e.g. join her in the seed and leave 07 unaffected, since 07 reads only her profile) and record it.
- **Signed-out and other states** must keep screen 02's look (02's capture must still match its last report).
- Then the rest of §14: manual pass at 390/768/1024/1280 in both themes with the Hungarian sample; keyboard order (the confirm dialog too); status messages announced; joined, left, rejoined, ended challenge, signed out.

## Still open, for the owner (NEXT-ACTIONS)

Don't change any of these without an answer:
- the "Cele mai votate săptămâna asta" heading (§13.1);
- the vote refusal copy, and the new copy from screens 02–07;
- the password sign-in copy (screen 06) and "Durează un minut." under the join button;
- the show-password button's `aria-pressed` with a changing label;
- what happens to someone who skips onboarding (empty name on reviews);
- the board's fixed tag chips;
- the November challenge's title ("de cartier");
- the review rules: only owners reply, owners don't review their own project, 2000 characters.

## How to work

Work in small commits. Each step is done when `pnpm lint`, `pnpm check-types` and `pnpm test` pass. If context runs low, stop at a step boundary, commit, and rewrite this file for the next session.

Out of scope: magic link, Google and GitHub in the UI (they wait for Resend and the OAuth apps), profile editing (`/u/<handle>/editeaza`), screen 09's create/edit form, assignment picking on launch (screen 10), reminder e-mails and the Resend adapter, the review agent, and anything that needs Vercel, Neon, OAuth apps or Resend. Add those to `docs/NEXT-ACTIONS.md` instead.

When done, update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` if anything changed, tick off what's finished in `docs/NEXT-ACTIONS.md`, rewrite this file for the following session, and tell me what's left.
