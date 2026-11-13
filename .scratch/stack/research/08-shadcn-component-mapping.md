# 08 · shadcn component mapping: findings

Research for [issue 08](../issues/08-shadcn-component-mapping.md). Researched 2026-11-13. Library claims cite a URL (numbers point to **Sources**). Design claims cite the spec file. **Unconfirmed** marks anything I could not verify from a primary source.

## Recommendation

**Use Base UI as the base.** Use shadcn as a source of files, not as a theme. Of the 16 items, only two start from shadcn: **Tabs** and the **AlertDialog** for "Renunță la provocare". The other 14 are built by hand from the spec code in `docs/design/components/*.md`. Each of those specs is a few lines of plain markup with exact values. No shadcn component would survive its classes being rewritten.

Why Base UI:

- **It is shadcn's default now.** Since July 2026, `shadcn init` picks Base UI, and shadcn says "Starting something new? We recommend Base UI". Radix is "not being deprecated", and new components "ship for both libraries (unless a component only exists in Base UI)" [1]. Base UI v1.0.0 has been stable since 2025-12-11, and the latest release is v1.9.0 (2026-10-09) [6].
- **Tailwind v4 and React 19 are a tie.** shadcn supports both on either base [3]. shadcn's docs don't mention Next 16 for either base (**unconfirmed**; no evidence of a problem). Radix has shipped React 19 and 19.2 fixes as recently as June–July 2026: Slot re-render loops, Popper and Presence "Maximum update depth", stale Escape handlers [9]. Those are fixes, not open bugs, but they count against Radix in a new React 19.2 app.
- **Accessibility (HANDOVER §10) is a tie for what we use.** Base UI "adhere[s] to the WAI-ARIA Authoring Practices" and manages focus. It leaves visible focus, contrast and labels to us [7], which our tokens and `:focus-visible` rule already cover (`docs/design/notes/nextjs-tailwind.md` §2). Radix documents its patterns per component, e.g. Tabs [10] and Alert Dialog [11].
  - Tabs: Base UI defaults to manual activation (`activateOnFocus: false`, arrows move focus, Enter/Space activates) [8]. Radix defaults to automatic [10]. The spec only asks for "arrow-key movement" (`Tabs.md`), so either passes.
  - AlertDialog: Base UI's page doesn't state `role="alertdialog"` or a focus trap. It does document initial and final focus [12]. Radix states it follows the Alert Dialog pattern and traps focus [11]. **Unconfirmed for Base UI:** verify `role`, the focus trap and Esc with a screen reader when building screen 08.

How to initialise so the theme maps onto our tokens:

1. Run `pnpm dlx shadcn@latest init -t next -b base` in the workspace that will own `components/ui`. Ticket 09 decides `apps/web` or `packages/ui`; in a monorepo, pass `-c <workspace>` [4][5]. Keep `cssVariables: true`, the default [2][13]. With `false`, components get inline palette colours like `zinc`, which is worse to strip. Leave `tailwind.config` blank, as v4 requires [13]. Style and base colour don't matter because both are overwritten, though both are fixed once set [13]. `-d` gives `next` + `nova` [4].
2. In `globals.css`, replace everything init generated with the block from `docs/design/notes/nextjs-tailwind.md` §2. Then add the strip lines below. That means deleting shadcn's `:root`, `.dark`, `@theme inline`, `@custom-variant dark (&:is(.dark *))` and `@layer base` [2][14][15].
3. `pnpm dlx shadcn@latest add tabs alert-dialog`, then rewrite their classes to our token names and spec values, per the table below.
4. Set `next-themes` to `attribute="data-theme"` (notes §3), not shadcn's `attribute="class"` [16].
5. `cn`: shadcn components now import `cn` from the standalone `cn` package, and init writes a one-line `lib/utils.ts` [17]. The notes define `lib/cn.ts` (notes §4). Pick one in ticket 09; both do `twMerge(clsx(...))` [17].

## Component table

| Component | Start from | Primitive | Reason |
|---|---|---|---|
| Button | Hand-built | native `button` / `next/link` | The spec is complete (`Button.md`). shadcn's Button is a cva over `cn-button-*` classes: `rounded-lg`, `text-sm`, `h-8`, ring focus [18][19]. Every class would be replaced. |
| VoteButton / VoteCount | Hand-built | native `button` + `aria-pressed`; `div role="img"` | Domain-specific 56×60 / wide layouts and the "never disabled" rule (`VoteButton.md`). No shadcn equivalent. |
| FilterChip | Hand-built | native `button` + `aria-pressed` | shadcn Toggle (Base UI Toggle) [20] adds only `aria-pressed`, which the spec already sets. Its sizes and colours conflict (`FilterChip.md`). |
| Tabs | **shadcn `tabs`**, classes replaced | Base UI `Tabs` [8] | The only spec that asks for a primitive (`Tabs.md`). Replace the `line` variant classes with the spec's. Radix's `data-[state=active]` becomes Base UI's `data-active` [8][14]. |
| Field (Input, Textarea, Select) | Hand-built | native `input` / `textarea` / `select` + `label` | The spec's 48px, 16px, `radius-md` controls (`Field.md`) conflict with shadcn Input (`h-8`, `md:text-sm`) [19]. shadcn's Field kit is larger than our label, hint and error trio. |
| Checkbox | Hand-built | native `input type="checkbox"` + `accent-color` | The spec mandates a native 22px box via `accent-primary` (`Checkbox.md`). shadcn/Base UI Checkbox is a custom rendered box [19]. |
| Tag | Hand-built | `next/link` | A link with four classes (`Tag.md`). shadcn Badge has its own size and radius scale [19]. |
| StatusChip | Hand-built | `span` | Two tone pairs, exact 13/20 type (`StatusChip.md`). Badge adds nothing. |
| AgentBadge | Hand-built | `span` | Outlined 12/18 label, exact padding `px-[7px] py-px` (`AgentBadge.md`). |
| Avatar | Hand-built | `next/image` / `span` | The spec uses `next/image`, hashed pastel fills and a square agent tile (`Avatar.md`). shadcn/Base UI Avatar's load-fallback logic isn't needed. |
| Countdown | Hand-built | `div role="timer"` | Client clock logic. No library equivalent (`Countdown.md`). |
| ProjectCard | Hand-built | `article` | A composition of Avatar, Tag and a vote slot (`ProjectCard.md`). shadcn Card's padding and gap scale would be fully overridden. |
| LaunchRow | Hand-built | `article` | A composition with responsive thumbnail sizes (`LaunchRow.md`). |
| Wordmark | Hand-built | `span` | Brand type, two spans (`Wordmark.md`). |
| Confirm "Renunță la provocare" | **shadcn `alert-dialog`**, restyled | Base UI `AlertDialog` [12] | Needs a modal with focus management, which we shouldn't hand-roll. Swap its imported shadcn Button for ours [21]. Drop the `animate-in` and `backdrop-blur` classes (HANDOVER §2.7, §10) [22]. |
| Select, screen 09 | Hand-built | native `select` (the `Select` in `Field.md`) | The reference renders a plain native `<select>`: 48px, 1px `#4D5A52`, radius 10, 16px, browser arrow (`reference/Lanseaza.html`, `#pv` and `#hd`). shadcn NativeSelect adds `appearance-none` and its own chevron [23]. shadcn Select is a JS popup [24]. Neither matches the reference pixels. |

Notes:

- **The confirm dialog has no reference design.** HANDOVER §6/08 says only "confirm before leaving". Body copy, button labels and the scrim colour are judgment calls for `DECISIONS.md`. Suggested treatment, using the HANDOVER §7 Panel pattern:
  - Surface: `bg-surface`, `border border-line`, `rounded-lg`, `p-5`–`p-8`.
  - Title: h2.
  - Buttons: our Button, `secondary` + `primary`.
  - Scrim: `bg-ink/40`, a token rather than shadcn's `bg-black/10` [22]. No red: there is no destructive token (`tokens.json`).
- **The spec's Tabs code imports Radix** (`Tabs.md`). With Base UI, rewrite it to `@base-ui/react/tabs` and swap `data-[state=active]:` for `data-active:`. Also set `defaultValue`/`value` explicitly so SSR picks the right tab [8].
- **Open (ticket 09 or the build):** the board tabs may change the URL ("Din provocări" vs "Proiecte proprii", HANDOVER §6/03). If each tab is its own URL, links with `aria-current` fit better than `role="tab"`. **Unconfirmed**: the spec says tabs.

## Token mapping

shadcn's theme has these variables: `--background`, `--foreground`, `--card(-foreground)`, `--popover(-foreground)`, `--primary(-foreground)`, `--secondary(-foreground)`, `--muted(-foreground)`, `--accent(-foreground)`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1…5`, `--sidebar-*` and `--radius` [2].

**Several of shadcn's names collide with ours but mean something else, so do not alias them.**

- `muted` is a background in shadcn but secondary *text* for us.
- `accent` is a hover background in shadcn but our yellow, never text.
- `border` is a hairline in shadcn. That is our `line`; our `border` is the 3:1 control edge.

If both sets live side by side, a future shadcn `bg-muted` would paint our text grey as a fill. So we don't add a compatibility layer. When a shadcn file is added, rewrite its classes with this table:

| shadcn variable / class | Our token (`tokens.json`) | Note |
|---|---|---|
| `background` | `bg` | |
| `foreground` | `ink` | |
| `card`, `popover` | `surface` | |
| `card-foreground`, `popover-foreground` | `ink` | |
| `primary` | `primary` | Same name, same meaning |
| `primary-foreground` | `on-primary` | |
| `secondary` | `surface` + `border-border` | Our secondary is outlined (`Button.md`) |
| `secondary-foreground` | `ink` | |
| `muted` (fill) | `tint` | |
| `muted-foreground` | `muted` | |
| `accent` (hover fill) | `tint` | Hover is `hover:bg-tint` in the specs |
| `accent-foreground` | `ink` | |
| `destructive` | none | Errors use `warning-ink` (`Field.md`). No red in the system |
| `border` (hairline) | `line` | |
| `input` | `border` | Control edge, 3:1 |
| `ring` + `ring-[3px] ring-ring/50` | `primary` via the global `:focus-visible` outline 3px, offset 3px (HANDOVER §8) | Remove `focus-visible:ring-*` from shadcn files |
| `chart-*`, `sidebar-*` | Drop | Not in the design |
| `--radius` and its `calc()` scale | Drop. Our `radius-sm/md/lg/xl` are fixed 6/10/12/16px (`tokens.json`) | shadcn derives `sm` = ×0.6 … `xl` = ×1.4 of `--radius` [2]. With `--radius` deleted, `rounded-lg` in a shadcn file means our 12px, not shadcn's base. Re-check every `rounded-*` against the spec |
| `.dark` selector, `dark (&:is(.dark *))` | `[data-theme="dark"]` and the notes' `@custom-variant` | [14][16]; notes §2–3 |

## What to strip

So that no default scale leaks into the pixel-exact specs:

1. **Every theme block init generates** [2][14][15]:
   - `:root` and `.dark` variable blocks
   - shadcn's `@theme inline`
   - `@custom-variant dark (&:is(.dark *))`
   - `@layer base { * { @apply border-border outline-ring/50 } body { @apply bg-background text-foreground } }`

   Use the notes' `body className="bg-bg text-ink"` and `:focus-visible` rule instead.
2. **Tailwind's default palette, radii and shadows** [25]. Add to `@theme`:
   - `--color-*: initial;` so that `bg-black/10`, `bg-zinc-*` etc. no longer compile. This enforces HANDOVER §2.2, "no hex values".
   - `--radius-*: initial;` and `--shadow-*: initial;` before our own values.

   Keep Tailwind's default spacing and font-size scales. The specs rely on them: the 4px spacing scale matches 1:1 (notes §2), and the specs use `text-xs`/`sm`/`base`/`lg`/`xl`/`2xl`. `rounded-full` and `bg-transparent` are static utilities and still work. **Unconfirmed:** confirm with a build that nothing else the specs use disappears.
3. **`tw-animate-css`** (init adds it [15]). The design allows no animation beyond simple state changes (HANDOVER §2.7). Remove the `data-open:animate-in … fade-*` and `duration-*` classes from the AlertDialog and Tabs files [22], and drop the dependency.
4. **Size and type classes in each added file.** For example:
   - shadcn's `h-8`, `text-sm`, `md:text-sm` (inputs would become 14px on desktop) [19]
   - `active:translate-y-px` [18]
   - `after:h-0.5` (a 2px underline; the spec wants 3px) [14]

   Replace each with the spec's literal values (HANDOVER §2.1).
5. **`shadcn/tailwind.css`.** Keep it, or `shadcn eject` it [4][26]. It defines no colours or radii, only `data-open`/`data-active`/… variants, scroll-fade/shimmer utilities and accordion keyframes [27]. Eject if we want to drop the `shadcn` package dependency [26].

## Sources

shadcn/ui (docs, changelog, repo):

1. July 2026, Base UI as the Default. https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
2. Theming (variables, radius scale, `cssVariables`). https://ui.shadcn.com/docs/theming
3. Tailwind v4 (Tailwind v4 + React 19, `data-slot`, `tw-animate-css`). https://ui.shadcn.com/docs/tailwind-v4
4. CLI (`init -b base|radix|aria`, `-d` = next + nova, `--monorepo`, `eject`). https://ui.shadcn.com/docs/cli
5. Next.js installation (monorepo, `-c apps/web`). https://ui.shadcn.com/docs/installation/next
13. components.json (`tailwind.config` blank for v4, `baseColor`/`cssVariables`/style fixed after init). https://ui.shadcn.com/docs/components-json
14. Base UI Tabs source. https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/tabs.tsx
15. Base registry (`@base-ui/react`, `tw-animate-css`, `shadcn/tailwind.css`, `@layer base`). https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/registry.ts. Plus the v4 `.dark` custom variant in https://github.com/shadcn-ui/ui/blob/main/packages/registry/src/updaters/update-css-vars.ts
16. Dark mode, Next.js (`attribute="class"`). https://ui.shadcn.com/docs/dark-mode/next
17. September 2026, cn. https://ui.shadcn.com/docs/changelog/2026-09-cn
18. Base UI Button source. https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/button.tsx
19. Nova style classes (`cn-button`, `cn-input`, `cn-native-select`, …). https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/styles/style-nova.css
20. Base UI Toggle source. https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/toggle.tsx
21. Base UI AlertDialog source. https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/alert-dialog.tsx
22. Nova `.cn-alert-dialog-overlay` (`bg-black/10`, `animate-in`, `backdrop-blur-xs`). Same file as [19]
23. NativeSelect docs and source. https://ui.shadcn.com/docs/components/native-select and https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/native-select.tsx
24. Same docs page as [23] (Select "for custom styling, animations, or complex interactions").
26. May 2026, shadcn eject. https://ui.shadcn.com/docs/changelog/2026-05-shadcn-eject
27. `shadcn/tailwind.css`. https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/tailwind.css
- Changelog index (create Dec 2025, unified Radix package Feb 2026, React Aria Jul 2026). https://ui.shadcn.com/docs/changelog and https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create

Base UI:

6. Releases (v1.0.0 2025-12-11, v1.9.0 2026-10-09). https://base-ui.com/react/overview/releases
7. Accessibility. https://base-ui.com/react/overview/accessibility
8. Tabs (`activateOnFocus`, `data-active`, `render`, SSR note). https://base-ui.com/react/components/tabs
12. Alert Dialog (initial and final focus, data attributes). https://base-ui.com/react/components/alert-dialog

Radix:

9. Releases (React 19 / 19.2 fixes, June–July 2026). https://www.radix-ui.com/primitives/docs/overview/releases
10. Tabs (WAI-ARIA Tabs, `activationMode` automatic). https://www.radix-ui.com/primitives/docs/components/tabs
11. Alert Dialog (WAI-ARIA Alert Dialog, focus trap, Esc). https://www.radix-ui.com/primitives/docs/components/alert-dialog

Tailwind:

25. Theme variables (`--color-*: initial`). https://tailwindcss.com/docs/theme

Design inputs: `docs/design/components/*.md` (all 14), `docs/design/tokens.json`, `docs/design/notes/nextjs-tailwind.md`, `docs/design/reference/Lanseaza.html`, `docs/HANDOVER.md` §2, §6, §7, §8, §10.
