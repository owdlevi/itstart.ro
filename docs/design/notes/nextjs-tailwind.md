# Next.js + Tailwind setup

How to carry these tokens into a Next.js (App Router) project with Tailwind CSS v4. Token names are the same as in `tokens.json`, so `bg-primary`, `text-muted`, `rounded-lg` and `font-display` mean what the brand book says.

## 1. Fonts: `app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"], // latin-ext carries ă â î ș ț ő ű
  weight: ["500", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});
const sans = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ITStart · Construiește ceva real.",
  description: "Comunitatea în care construiești proiecte reale cu AI și le lansezi public.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className="bg-bg text-ink font-sans antialiased">{children}</body>
    </html>
  );
}
```

## 2. Tokens and theme: `app/globals.css`

```css
@import "tailwindcss";

/* dark: utilities follow data-theme on <html> */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

:root {
  --bg: #F4F6EF;
  --surface: #FFFFFF;
  --ink: #14201A;
  --muted: #4D5A52;
  --line: #D5DBD0;
  --border: #4D5A52;
  --primary: #0E7A43;
  --primary-hover: #0B5E33;
  --on-primary: #FFFFFF;
  --accent: #FFD84D;
  --on-accent: #14201A;
  --tint: #DCEBDD;
  --band: #0E7A43;
  --on-band: #FFFFFF;
  --success-bg: #DDF3E4;
  --success-ink: #0B5E33;
  --warning-bg: #FFE9C2;
  --warning-ink: #7A4100;
  --shadow-card-v: 0 1px 2px rgba(20, 32, 26, 0.05);
  --shadow-raised-v: 0 1px 2px rgba(20, 32, 26, 0.05), 0 12px 32px rgba(20, 32, 26, 0.07);
}

[data-theme="dark"] {
  --bg: #0F1712;
  --surface: #1A261E;
  --ink: #EEF3EC;
  --muted: #A9B6AC;
  --line: #2E3D33;
  --border: #A9B6AC;
  --primary: #5BE38E;
  --primary-hover: #8FF0B4;
  --on-primary: #0F1712;
  --accent: #FFD84D;
  --on-accent: #14201A;
  --tint: #22352A;
  --band: #17361F;
  --on-band: #EEF3EC;
  --success-bg: #17361F;
  --success-ink: #7CE0A3;
  --warning-bg: #3A2A0C;
  --warning-ink: #FFC56B;
  --shadow-card-v: none;
  --shadow-raised-v: none;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-border: var(--border);
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-on-primary: var(--on-primary);
  --color-accent: var(--accent);
  --color-on-accent: var(--on-accent);
  --color-tint: var(--tint);
  --color-band: var(--band);
  --color-on-band: var(--on-band);
  --color-success-bg: var(--success-bg);
  --color-success-ink: var(--success-ink);
  --color-warning-bg: var(--warning-bg);
  --color-warning-ink: var(--warning-ink);

  --font-display: var(--font-bricolage), "Trebuchet MS", sans-serif;
  --font-sans: var(--font-inter), "Helvetica Neue", Arial, sans-serif;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  --shadow-card: var(--shadow-card-v);
  --shadow-raised: var(--shadow-raised-v);
}

@layer base {
  :focus-visible {
    outline: 3px solid var(--primary);
    outline-offset: 3px;
  }
  h1, h2, h3 {
    font-family: var(--font-display);
    text-wrap: balance;
  }
}
```

Spacing uses Tailwind's default 4px scale, which matches the spacing tokens one to one: `space-4` is `p-4`, `space-18` is `py-18`.

On Tailwind v3, keep the `:root` and `[data-theme="dark"]` blocks and put the same map under `theme.extend` in `tailwind.config.ts` (`colors: { primary: "var(--primary)", … }`, `darkMode: ["selector", '[data-theme="dark"]']`).

## 3. Dark mode

The theme is the `data-theme` attribute on `<html>`. With no attribute the site is light. To follow the system and let people switch, the smallest working setup is `next-themes`:

```tsx
// app/providers.tsx
"use client";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
```

Because every colour is a variable, components need no `dark:` classes. Use `dark:` only for the rare case where the layout itself changes.

## 4. Helper: `lib/cn.ts`

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

## 5. Page shell

```tsx
export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1120px] px-4 md:px-8", className)} {...props} />;
}
```

## 6. Where things go

```
app/
  layout.tsx, globals.css, providers.tsx
  page.tsx                      Acasă
  provocari/[slug]/page.tsx     Provocare
  lansari/page.tsx              Lansări
  proiecte/[slug]/page.tsx      Proiect
  u/[handle]/page.tsx           Profil
components/ui/                  Button, VoteButton, FilterChip, Tabs, Field, Checkbox, Tag, StatusChip, AgentBadge, Avatar, Countdown, Wordmark
components/                     ProjectCard, LaunchRow, SiteHeader, SiteFooter
lib/cn.ts
```

The source for each component is in its README under `components/`.
