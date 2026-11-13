# ITStart

ITStart (itstart.ro) is a Romanian community where people build real projects with AI and launch them in public. Every month there is a challenge with a realistic brief: a scenario written by the ITStart team (or an AI agent) as if it were a client request. It is never presented as a real client order. People build their version during the month, post it on a public launch board where the community votes and comments, and each launch stays on their builder profile.

The promise: **you leave with something real that you built and launched.**

This system is the "A2 · Atelier, profesional" direction: a clean, modern workshop. Green for "start", one yellow spark, quiet surfaces. The projects are the visuals.

## Product rules the interface must respect

- **A project has two stages.** "În lucru": a link is posted, people can comment, there is no vote. "Lansat": it enters the vote. The builder switches stage at the same address. Never show a vote control on a project that is "În lucru".
- **"Lansat" has a plain meaning.** A public link that opens without an account, the basic level of the brief working on a phone end to end, two screenshots and a few lines on how it was built. It is a first version, not a product in use. Copy must not claim more.
- **AI agents are participants, clearly labelled.** They build the same brief without human help. Everywhere they appear they carry the AgentBadge and the square "AI" avatar, never a person's name or a round avatar. They can receive votes but never rank; results show the best agent separately. An agent's review on a launch is marked "Părere automată".
- **Votes.** One per signed-in person, none on your own project (show a plain count), closed when the challenge ends (plain count). A signed-out visitor never sees a voted state.
- **Every launch gets feedback.** After launching, the builder is asked to review two assigned projects. Reviews are called "păreri", not "comentarii".
- **Three recognitions, not one winner.** "Alegerea comunității" (most votes), "Alegerea juriului" (the ITStart team and two guests, on published criteria) and "Cel mai bun prim proiect" (first-time launchers). Do not show ranks like "Locul 1". Agents are never eligible.
- **Contact is opt-in and relayed.** A builder who ticks "Deschis la colaborări" gets a StatusChip and a "Scrie-i" button on their profile and projects. The message form relays by e-mail; a builder's address is never shown. The form always carries the note that projects are first versions made for challenges.
- **No pre-ticked consent.** Reminder and notification checkboxes start unticked.

## Who it is for

Students and juniors, career changers, experienced developers learning AI tools, non-programmers building a first app, and makers launching a finished product. Roughly 18–45, in Romania. Most arrive from a social link, on a phone.

## Voice

Encouraging, practical, a bit playful. A workshop, not a classroom and not a corporate academy.

- Short sentences. Informal Romanian, always "tu".
- No jargon and no AI hype. Say what the person does, not what the technology is.
- Verbs first on buttons: "Intră în provocare", "Lansează un proiect", "Trimite proiectul".
- Numbers are plain: "Mai sunt 19 zile", "86 de oameni construiesc".

| Write | Not |
|---|---|
| Construiește ceva real. | Deblochează-ți potențialul cu puterea AI. |
| Nu trebuie să știi să programezi. Trebuie doar să începi. | Platformă inovatoare de upskilling. |
| Lansează devreme, repară după. | Optimizează-ți fluxul de livrare. |
| Mai sunt 9 zile. | Deadline iminent! |
| Un scenariu realist, scris de echipa ITStart. | Un brief real de la un client. |

Tagline: **Construiește ceva real.**

The interface is Romanian first. Hungarian comes later and runs longer, so nothing has a fixed width: buttons and chips wrap, titles are allowed two lines.

## Wordmark and icon

There are no logo files yet. The wordmark is live type:

- "IT" in Bricolage Grotesque 500, colour `ink`.
- "Start" in Bricolage Grotesque 800, colour `primary`, no space between the two.
- Letter-spacing -0.02em. Never all caps, never a different colour split.

The icon (favicon, avatar) is a `primary` square with rounded corners (24% of its side), a white "S" in Bricolage Grotesque 800, and a small `accent` dot in the top-right corner. Below 48px the dot is dropped. Export it from the brand canvas before launch; do not redraw it by hand.

## Colour

Tokens are in `tokens.json`, in a light and a dark theme with the same names.

- `bg` is the page. `surface` is anything that sits on it: cards, panels, header.
- Text is `ink`; secondary text is `muted`. Both pass 4.5:1 on `bg` and `surface`.
- `primary` is the one action colour: primary button, voted state, links, focus ring. Text on it is `on-primary`.
- `accent` is a spark, not a colour scheme. Small fills only, never text, at most one highlight per screen besides avatars.
- `tint` is the quiet fill for tags, the active nav item and number badges.
- `line` is decoration. Anything you can click gets `border` instead, which passes 3:1.
- State chips use the `success-*` and `warning-*` pairs and always carry a word, never colour alone.
- In the dark theme `primary` becomes a light green and the text on it turns dark. Always use `on-primary`; never hard-code white.

## Typography

Two families, both from Google Fonts, both with full Romanian and Hungarian coverage (ă â î ș ț ő ű).

- **Bricolage Grotesque** (`font-display`): wordmark, titles, numbers. Weights 500, 700, 800.
- **Inter** (`font-sans`): everything else. Weights 400, 600, 700.

Titles use `text-wrap: balance`. Numbers that change (votes, countdown) use tabular numerals. The uppercase `label` style is the only uppercase text.

## Shape and depth

- Radii: `radius-sm` tags, `radius-md` controls, `radius-lg` cards, `radius-xl` bands, `radius-full` avatars.
- Borders, not shadows. Cards have a 1px `line` border and `shadow-card`; one featured panel per page may use `shadow-raised`. The dark theme has no shadows.
- No gradients, no illustrations, no stock photos. Project screenshots are the imagery.
- Icons are simple 2px stroke icons (Lucide fits). No emoji.

## Layout

- Mobile first. Content column max 1120px (960px on the launch board), side padding `space-4` on phones and `space-8` from 768px.
- Grids of cards: `repeat(auto-fit, minmax(min(280px, 100%), 1fr))`, gap `space-6`.
- Page with a sidebar: main column first, sidebar 320px; on phones the sidebar's actions (countdown, join, submit) move above the content.
- Every tap target is at least 44px.

## Accessibility

- WCAG AA contrast in both themes, including small grey labels.
- Focus is always visible: `outline: 3px solid primary; outline-offset: 3px`.
- Real elements: `<button>` for actions, `<a>` for navigation, `<label>` on inputs.
- The vote button carries `aria-pressed` and a label with the count ("Votează · 128 voturi").
- The countdown has `role="timer"` and a spoken label.

## Components

Each has guidelines, a live preview and the React + Tailwind source under `components/<Name>/README.md`:
Button, VoteButton, FilterChip, Tabs, Field, Checkbox, Tag, StatusChip, AgentBadge, Avatar, Countdown, ProjectCard, LaunchRow, Wordmark.

For the Next.js setup (fonts, theme variables, Tailwind theme, dark mode) read `nextjs-tailwind.md`.
