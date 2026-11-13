# ITStart · build handover

Read this whole file before writing code. It is the brief for building **ITStart (itstart.ro)**, a Romanian community where people build real projects with AI and launch them in public.

The design is finished and must be followed precisely. Every screen exists as a pixel-exact PNG and as a standalone HTML reference whose inline styles hold every exact value. The technology stack is **not decided yet**: when it is, it will be added to this repo. Until then, nothing in this document assumes a framework, except where a note says "if you pick X".

---

## 0. What is in this bundle

```
HANDOVER.md                 this file
design/
  screens/                  52 reference PNGs: 13 screens × desktop/mobile × light/dark
  screens.json              screen list: route, signed-in user, milestone, PNG and HTML for each variant
  reference/                the same 52 screens as standalone HTML (open index.html in a browser; links between screens work)
    fonts/                  the two brand fonts (variable woff2, SIL Open Font License) and fonts.css
  fixtures.json             the sample data shown in the screens, for design-fixtures mode (section 9)
  tokens.json               design tokens: colours (light + dark), type scale, spacing, radii, shadows
  brand-book.md             brand rules, voice, product rules, layout, accessibility
  components/*.md           one spec per component: purpose, rules, states, an illustrative implementation
  notes/nextjs-tailwind.md  only relevant if the stack becomes Next.js + Tailwind
tools/
  capture.mjs               renders every app screen in one run and compares it with the PNGs (section 9)
```

**Sources of truth, in order:** (1) the PNGs for what it must look like, (2) the reference HTML inline styles for exact numbers, (3) `tokens.json` for named values, (4) this file for behaviour and data, (5) the component specs. If two disagree, the higher one wins; write the conflict down in `DECISIONS.md` and continue.

The code samples inside `components/*.md` are illustrative (React + Tailwind). Their **rules, sizes and states are binding**; their code is not.

---

## 1. The product in one page

- Every month there is one **challenge** (provocare): a realistic brief, written by the ITStart team or an AI agent as if it were a client request. It is **never** presented as a real client order.
- People **join**, build their version with whatever AI tools they like, at their own pace, until the end of the month.
- They post the link **as soon as something works** (stage "În lucru"), keep improving it at the same address with one-line updates, and switch it to **"Lansat"** when they are happy. Only launched projects enter the vote.
- **"Lansat" means:** a public link that opens without an account, the basic level of the brief working on a phone end to end, two screenshots, and a few lines on how it was built. It is a first version, not a product in use.
- The community **votes** and leaves **păreri** (reviews). Every launch gets at least two human reviews, because each builder is asked to review two assigned projects after launching. An AI agent leaves the first review within minutes, clearly labelled.
- At the end there are **three recognitions**, not one winner: Alegerea comunității (most votes), Alegerea juriului (ITStart team + two guests, public criteria), Cel mai bun prim proiect (first-time launchers).
- Each launch stays on the builder's **public profile**. Builders can opt in to being contacted ("Deschis la colaborări").
- **AI agents** (Claude, DeepSeek, GPT, Gemini…) can take part, always labelled, never ranked.

Audience: students and juniors, career changers, developers learning AI tools, non-programmers, makers. 18–45, Romania, mostly arriving on a phone from a social link. Interface language: Romanian, informal ("tu"). Hungarian comes later.

---

## 2. Ground rules for the build

1. **Pixel fidelity.** Match the PNGs at 1280px and 390px in both themes. Use the exact values from the reference HTML: font sizes, weights, line heights, letter spacing, paddings, gaps, radii, borders, colours. Do not round to a framework's default scale when it differs (e.g. 15px text, 10px radius, 22px checkbox).
2. **Tokens only.** Every colour comes from a token in `tokens.json`. No hex values in components. Both themes use the same token names; dark mode changes values, not components. The theme is an attribute on the root element (`data-theme="light|dark"`), defaulting to the system preference, persisted in `localStorage["theme"]`.
3. **Two fonts, self-hosted.** Bricolage Grotesque (display) and Inter (text), from `design/reference/fonts/`. Both cover ă â î ș ț ő ű. Do not load them from Google at runtime.
4. **Copy is part of the design.** Use the Romanian text from the references word for word, including diacritics (ș ț with comma below, not cedilla) and typographic quotes („…”). Keep every string in one message file per language (e.g. `ro.json`), never inline, so Hungarian can be added. No fixed widths on anything containing text: Hungarian runs ~30% longer.
5. **Mobile first.** Most visitors are on phones. The phone layout is not a shrunk desktop; section 6 lists where they differ.
6. **Accessibility is a requirement,** not polish: section 10.
7. **Light and fast.** No illustrations, no stock photos, no animation beyond simple state changes. Project screenshots are the only imagery. Target: Largest Contentful Paint under 2.5s on a mid-range phone on 4G; total JS for a content page as small as the stack allows.
8. **Product rules are enforced on the server,** not only hidden in the UI (section 5).
9. **Record every judgment call** in `DECISIONS.md`: what was unclear, what you chose, why.

---

## 3. Scope and milestones

| Milestone | Goal | Screens (see `screens.json`) | Features |
|---|---|---|---|
| **M1 · MVP** | Run one real challenge end to end | 01 Acasă, 02 Provocare (visitor), 03 Lansări, 04 Proiect, 05 Profil, 06 Înscriere: cont, 07 Înscriere: profil, 08 Provocare (înscris), 09 Lansează, 10 Lansat | Magic-link + Google + GitHub sign-in; profile; join/leave a challenge; project create/edit with stages and updates; voting; reviews with one level of replies; review assignments; light/dark; e-mail: sign-in link, reminders (opt-in), new review; one AI **review** agent; admin can create a challenge and edit it |
| **M2 · Before the first challenge ends** | Close the month properly | 11 Provocare încheiată, 12 Toate provocările | Challenge end: voting closes, late launches flagged; recognitions entered by an admin; challenge archive; questions & answers thread; share image + Open Graph tags; link checker; "Raportează" + moderation queue |
| **M3 · Later** | Grow | 13 Mesaj către constructor | "Deschis la colaborări" + relayed contact form; AI agents that **build and launch** projects; "Proiecte proprii" tab content; Hungarian |

**Inside M1 screens, hide these sections until their milestone** (behind a feature flag, so the layout without them must still look right):

| Section | On screen | Milestone |
|---|---|---|
| "Întrebări și ajutor" | 02, 08 | M2 |
| "Și 4 agenți AI" panel, agent-built projects | 02, 03, 08 | M3 (the agent *review* is M1) |
| "Trei recunoașteri la final" panel | 02, 08 | M1 (it is a promise; keep it) |
| "Arată-l oamenilor" share image | 10 | M2 (keep the copy-link field in M1) |
| "Vrei să te poată contacta cineva?" | 10 | M3 |
| "Deschisă la colaborări" chip + "Scrie-i" button | 04, 05 | M3 |
| "Proiecte proprii" tab | 03 | M1 shows the tab; the list may be empty with an empty state |
| "Raportează o problemă" link, "Link verificat…" line | 04 | M2 |
| "Toate provocările" link | 02, 08, 11 | M2 |

---

## 4. Domain model (stack-agnostic)

Names are suggestions; keep the meaning.

- **User**: id, handle (unique, URL-safe, from the name), name, email (private), avatarUrl?, avatarFill (one of 4 pastels, chosen from a hash of id), city?, bio? (≤ 240 chars), links (≤ 3 URLs), toolsInterest[], isAgent, agentModel? (agents only), openToWork (M3), remindersOptIn (default **false**), role (member | admin), createdAt.
- **Challenge**: id, number, slug, monthLabel, title, intro, summary, scenarioNote, scenario, baseLevel[], stretch[], launchCriteria[], materialsUrl?, materialsNote?, startsAt, deadlineAt (stored UTC, always shown in Europe/Bucharest), juryNote?, status (derived: upcoming / running / ended).
- **Participation**: userId, challengeId, joinedAt, leftAt?. Unique per user and challenge.
- **Project**: id, slug (unique), ownerId, challengeId? (null = own project), name (≤ 60), pitch (≤ 80), liveUrl, description, screenshots (2–4, ordered; the first is the thumbnail), tools[], stage (in_progress | launched), launchedAt?, isLate (launched after the deadline), build {duration: "<10h" | "10-30h" | ">30h", durationText?, hardestPart, prompt?}, linkCheck {checkedAt, ok} (M2), hidden (moderation), createdAt, updatedAt.
- **ProjectUpdate**: projectId, version (1, 2, 3…), text (≤ 140), createdAt. Shown as "v2 · ieri: …".
- **Vote**: userId, projectId, createdAt. Unique pair.
- **Review** (shown as "părere"): id, projectId, authorId, parentId? (one level of replies), body, isAutomated, createdAt, editedAt?, hidden.
- **ReviewAssignment**: reviewerId, projectId, createdAt, doneAt?.
- **Recognition** (M2): challengeId, kind (community | jury | first_project), projectId, reason.
- **Question / Answer** (M2): challengeId, authorId, title, body, solvedAnswerId?.
- **Message** (M3): toUserId, fromName, fromEmail, kind (paid | collab | question), body, createdAt, status.
- **Report** (M2): projectId, reporterId?, reason, createdAt, resolvedAt?.

Counters shown in the UI (participants, launches, votes, reviews) are computed, or cached and kept consistent; they must never drift from the underlying rows.

---

## 5. Business rules (test each one)

**Challenges**
1. Exactly one challenge is "running" at a time. Its deadline is 23:59 Europe/Bucharest on the last day of the month.
2. Joining is one action. Leaving ("Renunță la provocare") keeps the user's projects but removes them from the participant list.
3. After the deadline, voting on that challenge's projects closes; vote counts become plain counts.

**Projects**
4. A project can be saved as "În lucru" with only a name, pitch and live link. It needs everything in "Lansat" criteria (2+ screenshots, description, build story) before it can be switched to "Lansat".
5. "În lucru" projects cannot be voted on; they show the "în lucru" box instead of a vote control and can receive reviews.
6. Switching to "Lansat" sets launchedAt once; switching back is not offered in M1.
7. Launching after the challenge deadline is allowed: the project is flagged "După termen" and is excluded from recognitions.
8. Editing a launched project is always allowed. Each meaningful change can add a ProjectUpdate (optional field on save).
9. The live link must be https and reachable when submitted (one server-side request with a short timeout); show a clear error if not.

**Votes**
10. One vote per signed-in user per project; tapping again removes it. Optimistic UI, reconciled with the server.
11. No voting on your own project: show the plain count with "voturi" (VoteCount, reason "own").
12. A signed-out visitor sees the **unvoted** state on every project; tapping the vote button goes to sign-in and returns to the same page.
13. Agents never vote. Agent projects can receive votes.
14. Basic anti-abuse: account must be at least 24 hours old to vote (configurable), rate limit votes per user, admins can see vote timelines.

**Reviews**
15. Any signed-in user can review. Owners can reply. One level of replies.
16. After launching, the builder gets **two** ReviewAssignments: launched projects in the same challenge with the fewest human reviews, not their own, not agents', not already reviewed by them. The Lansat screen shows them with a "0 din 2" counter.
17. Review counts in rows ("3 comentarii") count human reviews and replies; automated reviews are excluded.
18. The automated review appears first on the project page, labelled "Părere automată".

**AI agents**
19. An agent is a User with isAgent = true. Everywhere it appears: square "AI" avatar (never round, never initials) and an AgentBadge after the name.
20. Agents are excluded from the three recognitions. Results show the best agent separately ("Cel mai votat agent AI", "În afara clasamentului").
21. The board has "Arată și agenții AI" (on by default; a view preference, not consent).

**Consent and privacy**
22. Reminder e-mails, notifications and "Deschis la colaborări" are off until the user ticks them. Never pre-tick.
23. A builder's e-mail is never shown. Contact (M3) is relayed by e-mail.
24. Show a cookie notice only if non-essential cookies are used; prefer not using any.

---

## 6. Screen specs

For each screen: the PNGs to match are `design/screens/<id>-<slug>.<desktop|mobile>.<light|dark>.png`, the HTML is in `design/reference/` (see `screens.json`). Section order below is top to bottom. "Desktop" means the 1280px reference; "mobile" the 390px one. One layout breakpoint is enough: **768px**. Between 390 and 1279px the layouts reflow on their own (flex-wrap and auto-fit grids); check 768px and 1024px for overflow.

### Shared shell (all screens)
- **Header**, `surface` background, 1px `line` bottom border. Container max 1120px, side padding 16px (mobile) / 32px (desktop).
  - Desktop: one row, min-height 72px: wordmark (26px) · nav links "Provocarea", "Lansări" (44px tall, 0 14px padding, radius 10, 15px/600; active = `tint` background + `aria-current="page"`) · right side.
  - Mobile: a 56px row (wordmark 24px + right side), then a second row with the two nav links side by side, equal width, 8px bottom padding.
  - Right side, signed out: secondary small button "Intră în comunitate" (mobile: "Intră") → sign-in. Signed in: primary small button "+ Lansează un proiect" (desktop only) and the user's avatar (36px inside a 44px link to their profile). On screens 06 and 07: wordmark only, no nav, no right side.
- **Footer**, `surface`, top `line` border: wordmark (20px) + "Construiești. Lansezi. Rămâi cu ceva real." (14px, `muted`); links Despre · Reguli · Contact (14px/600, 44px targets).
- Page background `bg`. Body text Inter 16/24.

### 01 · Acasă `/`  (M1, signed out in the reference)
1. Hero, two columns on desktop (text left, challenge card right), stacked on mobile.
   - Eyebrow "COMUNITATE DE CONSTRUCTORI DIN ROMÂNIA" (13px/700, 0.06em, `primary`).
   - H1 "Construiește ceva real." 68px desktop / 42px mobile, line-height 1.02, -0.03em.
   - Lead paragraph (20/30 desktop, 18/27 mobile, `muted`, max 520px).
   - Primary "Intră în provocarea din noiembrie" (label uses the running challenge's month) → sign-in, or straight to the challenge if signed in. Secondary "Vezi lansările". Full-width on mobile.
   - Challenge card (raised panel, `shadow-raised`): eyebrow with month, title, summary, Countdown (3 cells), warning chip "Termen: 30 noiembrie", counts line "86 de oameni · 4 agenți AI · 25 de lansări", secondary full-width "Citește brief-ul".
2. "Cum funcționează": three numbered steps (badge 36px, `tint`, Bricolage 18px) with title and text.
3. "De ce ai intra": four cards (one per audience).
4. "Cele mai votate săptămâna asta" + "Toate lansările" link. Desktop: three ProjectCards in a grid. Mobile: three LaunchRows. Data: see section 13, item 1.
5. Green band (`band` / `on-band`): headline, line, inverse button "Intră în provocare". The focus ring on this band uses `on-band`.

### 02 · Provocare `/provocari/<slug>`  (M1, signed out)
- Header block: eyebrow "PROVOCAREA #4 · NOIEMBRIE 2026" + chip "În desfășurare" + "Toate provocările" link (M2); H1 (48/32); intro.
- Two columns on desktop: main (flex 999 1 560px) and sidebar (flex 1 1 320px), 40px gap. **On mobile the sidebar comes first** (countdown and join button above the brief).
- Main, in order: **Brief-ul** panel (scenario note in small `muted`; scenario; "Nivelul de bază" checklist; "Dacă vrei mai mult" checklist with `muted` ticks; "Ce înseamnă „lansat”" checklist + note; "Descarcă materialele" secondary button + note) · **Construiește-l cu AI** (four tip cards, 2×2) · **Întrebări și ajutor · 14** (M2) · **Proiecte lansate · 25** (four LaunchRows) · **În lucru · 31** (explanation + LaunchRows with the latest update line and the "în lucru" box).
- Sidebar: **Timp rămas** (Countdown, deadline sentence, primary "Intră în provocare", "Un minut. Fără parolă.") · **86 de oameni construiesc** (avatars 40px, wrapping; sentence with three names) · **Trei recunoașteri la final** · **Și 4 agenți AI** (M3).

### 03 · Lansări `/lansari`  (M1, signed in as andrei-popescu)
- Container max 960px. H1 "Lansări" + lead. Mobile only: full-width primary "+ Lansează un proiect" under the lead (desktop has it in the header).
- Tabs "Din provocări" / "Proiecte proprii".
- Filter rows (FilterChip, label on the left on desktop, above on mobile; **on mobile each row scrolls sideways**, it does not wrap): Provocare · Etichete · Stadiu (Lansate / În lucru).
- Toolbar: Sortare ("Cele mai noi" default / "Cele mai votate") · checkbox "Arată și agenții AI" (ticked).
- Week groups: H2 "Săptămâna aceasta" + "9–15 noiembrie · 4 lansări", then LaunchRows; same for "Săptămâna trecută". Weeks run Monday–Sunday. Within a week: by the chosen sort.
- Filters, sort and tab live in the URL query so a filtered board can be shared.
- Empty state (any filter with no results): one line "Nicio lansare aici încă." + "Șterge filtrele" link. Not in the PNGs; style as body `muted`.

### 04 · Proiect `/proiecte/<slug>`  (M1, signed in as andrei-popescu, who voted)
- Back link "← Lansări".
- Title block: H1 (52/36), pitch (20/30), tags (challenge tag first). Right side (stacks on mobile, full-width primary): **primary "Deschide proiectul"** (external, opens the live URL), VoteButton **wide** (voted = `tint` fill + 2px `primary` border + check icon), secondary "Distribuie" (native share sheet where available, otherwise copy link). Under it: "Link verificat acum 3 ore. Merge." (M2).
- Main: large screenshot (16:10, radius 12) + thumbnail strip (3 columns; selected thumbnail has a 2px `primary` border) · **Despre proiect** · **Cum l-am construit** (two cards: Cât a durat, Ce a fost cel mai greu; then the prompt in a `tint` block) · **Actualizări** (v3/v2/v1 with dates) · **Păreri · 4** (automated first; replies indented 48px desktop / 24px mobile) · review form ("Scrie o părere", textarea, secondary "Trimite părerea").
- Sidebar: Construit de (avatar 52, name, city · count, "Vezi profilul", M3: chip + "Scrie-i Ioanei") · Unelte folosite (Tags) · Făcut pentru (challenge link, launch date) · "Raportează o problemă cu acest proiect" (M2).

### 05 · Profil `/u/<handle>`  (M1, viewed by andrei-popescu)
- Header panel (radius 16): avatar 96/72, H1 name, "Cluj-Napoca · în comunitate din septembrie 2026", bio, links with link icons, (M3) chip + "Scrie-i Ioanei". Stats on the right (desktop) / below (mobile): **3** proiecte lansate · **3** luni la rând (consecutive months with a launch, ending this or last month) · **241** voturi primite.
- **Proiecte lansate**: ProjectCards; the footer shows the challenge (and a recognition if any: "Provocarea #3 · Alegerea juriului") instead of the builder.
- **Provocări terminate**: list rows with number badge, title, month, project name, chip "Terminată".
- Your own profile adds an "Editează profilul" secondary button (not in the PNGs; place it where "Scrie-i" sits for others).

### 06 · Înscriere: cont `/intra`  (M1)
- Bare header. Two columns on desktop (form panel max 460px, "Ce urmează" max 420px), stacked on mobile.
- Panel: eyebrow with the challenge, H1 "Intră în provocare" (36/30), line, secondary full-width "Continuă cu Google" and "Continuă cu GitHub" (text only, per design; adding the provider logos is allowed only in monochrome `ink`), divider "sau", e-mail Field with hint, primary "Trimite-mi linkul", rules sentence with link.
- After "Trimite-mi linkul": show a "check your e-mail" state in the same panel (not in the PNGs): H1 "Verifică-ți e-mailul", the address in bold, "Nu l-ai primit? Trimite din nou" (enabled after 30s). Link valid 15 minutes, single use.
- If the visitor came from a specific challenge, signing in also joins it; from the header button, it only signs in.

### 07 · Înscriere: profil `/bun-venit`  (M1, first sign-in only; captured as bianca-radu)
- Bare header. Single panel max 520px. "Pasul 2 din 2", H1 "Cum te cheamă?", line.
- Fields: Numele tău (prefilled from the provider if available) · Orașul (opțional) · "Cu ce vrei să construiești?" (multi-select FilterChips: Claude, Cursor, v0, Lovable, Bolt, Încă nu știu) · Checkbox reminders (**unticked**) · primary full-width "Gata, intru în provocare" → screen 08.

### 08 · Provocare, înscris  (M1, signed in as bianca-radu, just joined)
Same as 02, plus: success banner at the top ("Ești în provocare, Bianca. Ai 19 zile să construiești și să lansezi.", `role="status"`, shown once after joining), chip "Ești înscrisă" (gendered by the user's name only if a gender is known; otherwise use "Ești înscris/ă" — decide in DECISIONS.md), sidebar "Pașii tăi" checklist (done / not done circles) with primary "Adaugă proiectul" → 09 and "Renunță la provocare" text button (confirm before leaving), participant count +1 and "Tu, Ioana, Andrei și încă 84."

### 09 · Lansează un proiect `/lanseaza` (also `/proiecte/<slug>/editeaza`)  (M1, ioana-muresan)
- H1 + "Cinci minute. Apoi e public și oamenii pot vota."
- Form panel (flex 999 1 520px) and sidebar (flex 1 1 320px); sidebar below on mobile.
- Fields in order: Pentru ce provocare? (select: running challenge, "Fără provocare · proiect propriu") · Numele proiectului · Pe scurt, într-o frază (live counter "N din 80 de caractere") · Linkul live (validated on blur) · Capturi de ecran (2–4; tiles 84px tall; remove button 28px; "Adaugă" dashed tile; drag to reorder; first is the thumbnail; accept png/jpg/webp ≤ 5 MB; resize server-side) · Descriere · Unelte folosite (multi-select chips + "+ Alta" opens a small text input) · **Cum l-ai construit** (Cât a durat? select; Ce a fost cel mai greu?; Un prompt care a mers bine (opțional)) · **În ce stadiu e?** (single-select chips "În lucru" / "Lansat, intră la vot") · primary "Lansează proiectul" (label becomes "Salvează" when stage is În lucru) + secondary "Salvează ciorna".
- Sidebar: "AȘA VA APĂREA PE PANOU" live preview LaunchRow (updates as you type; shows no vote control) · "Înainte să lansezi" checklist.
- Validation: inline, on blur and on submit; first invalid field gets focus; error text replaces the hint (Field spec). The reference shows the form **filled with sample data**; in the product it starts empty with the same labels and hints.

### 10 · Lansat `/proiecte/<slug>/lansat`  (M1, right after launching)
- Container 680px. Chip "Lansat", H1 "E lansat. Bravo, Ioana!", line.
- The project as a LaunchRow (0 votes, plain count).
- **"Mai ai un pas: dă două păreri"** + warning chip "0 din 2" (becomes success "2 din 2" when done), explanation, the two assigned projects as LaunchRows, primary "Scrie prima părere" (→ first assigned project's review form) and secondary "Vezi proiectul tău".
- "Arată-l oamenilor" (share image M2; copy-link field M1) · "Vrei să te poată contacta cineva?" (M3) · closing line.

### 11 · Provocare încheiată `/provocari/<slug>` after the deadline  (M2)
Header block with "Încheiată" outlined chip, three stat tiles, **Trei recunoașteri** (three columns, each: label, ProjectCard with plain count, one-line reason), jury note with the four criteria, **Cel mai votat agent AI** (+ "27 de proiecte făcute de oameni au primit mai multe voturi decât cel mai bun agent."), **Toate cele 41 de lansări** (late ones carry "După termen"), green band pointing to the running challenge. No ranks ("Locul 1") anywhere.

### 12 · Toate provocările `/provocari`  (M2)
Container 960px. One row per challenge, newest first; the running one has a 2px `primary` border, a primary button and its live counts; ended ones show the jury's pick and a secondary "Vezi rezultatele". Closing line with "Propune un brief" (mailto or a simple form).

### 13 · Mesaj către constructor `/u/<handle>/mesaj`  (M3)
Only for builders with openToWork. Panel max 560px: avatar + H1 "Scrie-i Ioanei Mureșan", privacy line, fields (name, e-mail, "Ce cauți?" single-select chips, message), the fixed warning note about first versions, primary "Trimite mesajul". Rate-limit per sender and per recipient; spam protection without a visual captcha if possible.

---

## 7. Components

Specs in `design/components/`. Build each once and reuse it; the screens use nothing else.

| Component | Used for | Key facts |
|---|---|---|
| Button | all actions | variants primary / secondary / inverse; sizes md (48px) / sm (44px); renders a link when it navigates; one primary per view |
| VoteButton + VoteCount | voting | compact 56×60 column and wide row; voted compact = solid `primary`, voted wide = `tint` + 2px `primary` + check; VoteCount for own / closed / în lucru; never a disabled button |
| FilterChip | filters, sort, multi-select in forms | 44px; selected = `tint` + 2px `primary` + check icon; `aria-pressed` |
| Tabs | board tabs | 48px, 3px `primary` underline, real tab semantics |
| Field (Input, Textarea, Select) | forms | label above, 48px controls, 16px text, hint below, error replaces hint |
| Checkbox | consent and view options | 22px, full-sentence label, unticked by default for consent |
| Tag | tools, challenge | `tint` fill, 13px/600, **links to the filtered board** |
| StatusChip | Lansat, În desfășurare, Terminată, deadlines | success / warning pairs, always a word |
| AgentBadge | agents | outlined, 12px/700: "Agent AI", "În afara clasamentului", "Părere automată", "Încheiată" |
| Avatar | people and agents | 22/36/52/96; people round with initials on a pastel; agents square `ink` "AI" |
| Countdown | challenge deadline | 3 cells (zile, ore, minute), no seconds, `role="timer"`; replaced by "Încheiată" after the deadline |
| ProjectCard | grids (Home desktop, profile, results) | thumbnail 160px tall, title links to the project, vote slot |
| LaunchRow | lists everywhere, Home on mobile | thumbnail 128×88 desktop / 64×64 mobile, update line for În lucru, vote slot |
| Wordmark | header, footer | "IT" 500 `ink` + "Start" 800 `primary`, live text |

Patterns that are not separate components but must be consistent: **Panel** (surface, 1px `line`, radius 12, padding 20–32), **section heading row** (H2 + optional right link, wraps on mobile), **numbered badge** (36–44px, `tint`, `primary-hover` text, Bricolage 700), **checklist** (18px check icon in `primary`, 2.6 stroke).

Icons: simple 2px-stroke line icons (Lucide matches). Used: arrow-up, check, plus, external-link, arrow-left, link, share, download, clock, message-square. No emoji.

---

## 8. Design tokens

All in `design/tokens.json`. Summary for orientation; the file wins.

**Colour** (light / dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | #F4F6EF | #0F1712 | page |
| surface | #FFFFFF | #1A261E | cards, panels, header, inputs |
| ink | #14201A | #EEF3EC | text |
| muted | #4D5A52 | #A9B6AC | secondary text (passes 4.5:1 on bg and surface) |
| line | #D5DBD0 | #2E3D33 | decorative borders only |
| border | #4D5A52 | #A9B6AC | control borders (3:1) |
| primary | #0E7A43 | #5BE38E | primary action, voted, links, focus ring |
| primary-hover | #0B5E33 | #8FF0B4 | hover, numbered badges |
| on-primary | #FFFFFF | #0F1712 | text on primary |
| accent | #FFD84D | #FFD84D | small fills only, never text |
| on-accent | #14201A | #14201A | text on accent and avatar pastels |
| tint | #DCEBDD | #22352A | tags, active nav, quiet fills |
| band / on-band | #0E7A43 / #FFFFFF | #17361F / #EEF3EC | call-to-action band |
| success-bg / success-ink | #DDF3E4 / #0B5E33 | #17361F / #7CE0A3 | success chips |
| warning-bg / warning-ink | #FFE9C2 / #7A4100 | #3A2A0C / #FFC56B | deadline chips, "în lucru", warnings |

Avatar pastels (same in both themes, text `on-accent`): #FFD84D, #DCEBDD, #F3D9C8, #D9D6F5. Screenshot placeholder backgrounds in the references are stand-ins for real screenshots; do not reproduce them as a feature.

**Type**: Bricolage Grotesque for headings, numbers and the wordmark (weights 500/700/800, letter-spacing -0.01 to -0.03em, `text-wrap: balance` on headings); Inter for everything else (400/600/700). Styles: display-xl 68 (42 mobile), h1 48 (32–36 mobile; per-screen sizes in the references), h2 28 (24 mobile), h3 20, stat 32, lead 20/30, body 16/24, small 14/20, button 16/20 600, label 13/18 700 0.06em uppercase, tag 13/20 600. Inputs are always 16px.

**Spacing**: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 72. **Radius**: 6 (tags, chips) · 10 (buttons, inputs, vote) · 12 (cards, panels) · 16 (band, profile header) · full (avatars). **Shadow**: card `0 1px 2px rgba(20,32,26,.05)`, raised `0 1px 2px rgba(20,32,26,.05), 0 12px 32px rgba(20,32,26,.07)`; none in dark.

**Focus**: `outline: 3px solid primary; outline-offset: 3px` on every interactive element, `on-band` on the green band.

---

## 9. Visual review: matching the PNGs

The check is automated so it can run after every change.

**1. Design-fixtures mode.** Add a mode (env flag, e.g. `DESIGN_FIXTURES=1`, never enabled in production) that:
- loads `design/fixtures.json` into a fresh database (users, challenges, projects, votes, reviews, assignments, questions);
- freezes the server clock at `2026-11-11T07:35:00+02:00` (so the countdown reads 19 zile · 16 ore · 24 minute and relative times read "acum 2 ore");
- serves the real uploaded screenshots as the thumbnails, **or**, until real screenshots exist, a flat `tint` placeholder; the striped placeholder art in the PNGs is not part of the product (expect differences there, see 4);
- exposes `GET /dev/login-as/<handle>?next=<path>` to sign in as a fixture user (`anonymous` signs out);
- reads the theme from `localStorage["theme"]`.
`fixtures.json → screenStates` says, per screen, which user is signed in and what state the page is in. Screens 07, 09 and 13 show filled forms in the references: fixtures mode may prefill them from `screenStates` so they compare cleanly.

**2. Capture everything in one run.**
```
npm i -D playwright pngjs pixelmatch && npx playwright install chromium
node tools/capture.mjs app --base http://localhost:3000 --milestone M1
```
This visits every route in `screens.json` at 1280px (scale 1) and 390px (scale 2), in light and dark, as the right user, with animations off and the clock frozen, and writes:
- `review/app/*.png`: the app's screens, named exactly like the references;
- `review/side/*.png`: reference | app | diff side by side;
- `review/diff/*.png`: differing pixels in red; magenta where one image is longer;
- `review/report.json` and a console table: status per variant (`match` ≤ 1.5% and same height, `check` ≤ 5%, `differs`).
Filters: `--only 01,04`, `--theme dark`, `--device mobile`. To re-render the reference PNGs from the reference HTML: `node tools/capture.mjs reference`. `node tools/capture.mjs self-test` checks the tool itself (all 52 should report 0%).

**3. Loop.** For each screen in the milestone: build it → capture → open the side-by-side PNG → fix the largest difference → repeat until `match`. Compare at the same time against the reference HTML in a browser with devtools to read exact values. Do not tune numbers to reduce the diff percentage if they contradict the reference HTML.

**4. Expected, acceptable differences.** Thumbnails and screenshots (placeholder art vs real images); text anti-aliasing (the threshold absorbs it). Screen 10 shows Tuns la Fix at the moment of launch (0 votes, 0 reviews) while the fixtures hold its later state (128 votes): fixtures mode should render screen 10 with the project's counts as of its launchedAt, otherwise expect that one difference. Anything else (spacing, size, colour, wrapping, order, missing element) is a defect.

**5. Manual pass per screen,** at 390, 768, 1024 and 1280px, both themes: no horizontal scroll; nothing clipped; long Romanian names and a Hungarian sample string ("Az első űrlapod négy hét alatt elkészül") wrap cleanly; hover, focus and pressed states visible; keyboard order matches visual order.

---

## 10. Accessibility (WCAG 2.2 AA)

- Contrast: text 4.5:1, large text and control borders 3:1, in both themes. The token pairs already pass; do not introduce new pairs without checking.
- Real elements: `button` for actions, `a` for navigation, `label` for every input, `fieldset`/`legend` or `role="group"` + label for chip groups. No clickable `div`s.
- Tap targets ≥ 44×44px.
- Visible focus everywhere (section 8). Skip link "Sari la conținut" as the first focusable element.
- VoteButton: `aria-pressed` and a label with the count ("Votează · 128 voturi"). VoteCount: `role="img"` with a label. Countdown: `role="timer"` with a spoken label without seconds, not announced every minute.
- Icon-only buttons have `aria-label`. Decorative icons `aria-hidden`.
- Every image has alt text: screenshots "Captură de ecran din <proiect>"; thumbnails in lists are decorative (`alt=""`) because the title is next to them.
- `lang="ro"` on the document; Hungarian content later gets `lang="hu"`.
- Status messages (joined, launched, saved, errors) in an `aria-live` region.
- Respect `prefers-reduced-motion`.

---

## 11. E-mails (M1)

Plain, branded with the wordmark as text, Romanian, "tu", one action per e-mail, sent from a no-reply address with a real reply-to.
1. **Sign-in link**: "Intră în ITStart" + button, valid 15 minutes.
2. **Reminders** (only if opted in): 7 days and 1 day before the deadline, only to participants who have not launched.
3. **New review on your project**: reviewer name, first 140 characters, link. Batched: at most one e-mail per project per hour.
4. **Review assignment reminder**: one e-mail 48 hours after launching if fewer than 2 assigned reviews are done.
Every non-transactional e-mail has a one-click unsubscribe.

---

## 12. AI agents

**M1 · review agent.** When a project becomes "Lansat":
1. queue a job; open the live URL in a headless browser at 375px and 1280px;
2. try the brief's basic level (e.g. make a booking), take screenshots of what it saw;
3. write a review in Romanian, informal, ≤ 600 characters: what works, then at most two concrete things to check, no scores, no praise inflation, no invented facts;
4. post it as a Review by the agent user with `isAutomated = true` within ~10 minutes; if the site cannot be opened, post nothing and log it.
The model and provider are not decided: put the call behind one interface (`reviewProject(project, brief) → { body, observations }`) so the provider can change. Log prompts and outputs for review. A person (admin) can hide an automated review.

**M3 · builder agents.** Each agent is a User. On a challenge's start, an agent receives the brief, builds and deploys a site to its own hosting, then creates a Project like a human (stage, screenshots, build story written honestly, e.g. "Făcut de un agent AI în 40 de minute"). Not in scope now; keep the data model ready (isAgent, agentModel).

---

## 13. Known inconsistencies and open decisions

Decide these with the product owner; until then use the default in bold.

1. **Home "Cele mai votate săptămâna asta"** shows the top 3 by votes in the running challenge (Tuns la Fix, Scaunul 3, Brici), but Brici launched last week. **Default: top 3 by votes in the running challenge; change the heading to "Cele mai votate luna asta".** Flag it; do not change the copy without approval.
2. **Challenge intro "…în patru săptămâni"** conflicts with "în ritmul tău, până la sfârșitul lunii". **Default: keep the reference text.**
3. **Gendered Romanian** ("Ești înscrisă", "Deschisă la colaborări") follows the sample users. **Default: store an optional grammatical gender on the profile (feminin / masculin / neutru); neutral forms "Ești în provocare", "Deschis/ă la colaborări" when unknown.**
4. **"Proiecte proprii"** has no reference screen. **Default: the same board without the challenge filter row.**
5. **Prizes**: none are shown or promised anywhere. Keep it that way until decided.
6. **Jury composition** shown as "echipa ITStart și doi invitați". Admin-editable text per challenge.
7. **Technology stack, hosting, database, auth provider, e-mail provider, file storage, AI provider**: to be defined by the product owner. Do not start implementation choices that lock these in before they are given; if asked to start anyway, write the choice in `DECISIONS.md` and keep it behind an interface.
8. **Domain e-mails and legal pages** (Termeni, Confidențialitate, GDPR data export/delete): needed before public launch; content to be provided.

---

## 14. Definition of done (per screen)

- [ ] `node tools/capture.mjs app --only <id>` reports `match` for all four variants, or every remaining difference is listed in section 9.4 categories.
- [ ] Manual pass at 390 / 768 / 1024 / 1280, both themes, no overflow, Hungarian sample wraps.
- [ ] All strings come from the message file; no hard-coded Romanian in components.
- [ ] Keyboard-only walkthrough works; focus visible; screen-reader labels from section 10 present.
- [ ] Business rules touched by the screen have tests (section 5 numbers in the test names).
- [ ] Signed-out, signed-in, owner, agent and empty states render without layout breaks.
- [ ] Any judgment call is written in `DECISIONS.md`.
