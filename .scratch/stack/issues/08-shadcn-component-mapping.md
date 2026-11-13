# Which design components start from shadcn, and on which primitives?

Type: research
Status: resolved

## Question

shadcn/ui currently supports more than one primitive base (Radix, Base UI). Using shadcn's docs and the 14 specs in `docs/design/components/*.md`:

- Which base fits better with Tailwind v4, React 19 and Next 16, and for accessibility (HANDOVER §10)?
- For each spec component (Button, VoteButton/VoteCount, FilterChip, Tabs, Field, Checkbox, Tag, StatusChip, AgentBadge, Avatar, Countdown, ProjectCard, LaunchRow, Wordmark), plus the confirm dialog for "Renunță la provocare" and the select in screen 09: start from a shadcn component, or hand-build? One line of reasoning each.
- How shadcn's generated theme variables map onto our tokens (`docs/design/tokens.json`), and what to strip so no default shadcn scale leaks into the pixel-exact specs.

## Answer

Findings: [research/08-shadcn-component-mapping.md](../research/08-shadcn-component-mapping.md)

- **Base:** **Base UI**. It has been shadcn's default since July 2026 and stable since December 2025 (v1.9.0 in October 2026). Radix is still supported but needed several React 19.x fixes as recently as mid-2026. For the parts we use, accessibility is a tie.
- **Setup:**
  - Run `shadcn init -t next -b base` with CSS variables on.
  - Replace the generated theme CSS with our `globals.css` (dark mode on `data-theme`).
  - Remove Tailwind's default colour, radius and shadow values so stray defaults don't compile.
  - Drop shadcn's animation package.
  - Rewrite any added shadcn component onto our token names. **Don't alias** shadcn's `muted`/`accent`/`border` to ours: the names mean different things, so an alias would paint the wrong colours.
- **What starts from shadcn:** only **Tabs** (shadcn `tabs`, classes replaced) and the **"Renunță la provocare" confirm** (shadcn `alert-dialog`, restyled).
- **Hand-built from the spec code:**
  - Button, VoteButton/VoteCount, FilterChip on a native `button`.
  - Field and Checkbox on native inputs with `accent-color`.
  - The screen 09 select on a native `select`; shadcn's versions don't match the reference.
  - Tag, StatusChip, AgentBadge, Avatar, Countdown, ProjectCard, LaunchRow, Wordmark from plain elements, `next/image` and `next/link`.
- **Open:**
  - Confirm `role="alertdialog"` and the focus trap on Base UI when building screen 08.
  - The confirm dialog has no reference design, so its copy and backdrop go in `DECISIONS.md`.
  - `Tabs.md`'s illustrative code imports Radix.
  - The `cn` helper location is for "What is the M1 codebase layout?".
