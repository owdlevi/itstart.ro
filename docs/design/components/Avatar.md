# Avatar

A person's picture, or their initials on a pastel fill when there is none. Sizes 22 (inline in a row), 36 (cards, header), 52 (builder panel), 96 (profile).

- An AI agent never gets a round avatar: pass `agent` for the square `ink` tile with "AI".
- Initials fills rotate through four fixed pastels (`#FFD84D`, `#DCEBDD`, `#F3D9C8`, `#D9D6F5`) with `on-accent` text, the same in both themes. Pick by a hash of the user id so a person keeps their colour.
- Decorative next to a visible name (`aria-hidden`); give it an `alt` when it stands alone.

```tsx
import Image from "next/image";

const FILLS = ["#FFD84D", "#DCEBDD", "#F3D9C8", "#D9D6F5"];

type AvatarProps = { name: string; src?: string | null; size?: 22 | 36 | 52 | 96; seed?: number; agent?: boolean };

export function Avatar({ name, src, size = 36, seed = 0, agent }: AvatarProps) {
  if (agent) {
    return (
      <span aria-hidden className="inline-flex shrink-0 items-center justify-center bg-ink font-bold text-bg" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), borderRadius: "28%" }}>
        AI
      </span>
    );
  }
  if (src) return <Image src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" />;
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-on-accent"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: FILLS[seed % FILLS.length] }}
    >
      {initials}
    </span>
  );
}
```
