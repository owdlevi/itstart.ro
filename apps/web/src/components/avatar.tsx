import { cn } from "@/lib/utils";

const FILLS = ["#FFD84D", "#DCEBDD", "#F3D9C8", "#D9D6F5"];

export type AvatarPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarFill: string | null;
  isAgent: boolean;
};

const fillFor = (id: string) => {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return FILLS[Math.abs(hash) % FILLS.length]!;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/**
 * A person's picture, or initials on a pastel; an agent's square "AI" tile
 * (rule 19). Decorative: the name is always next to it.
 */
export function Avatar({
  person,
  size = 36,
  className,
}: {
  person: AvatarPerson;
  // 40: the participant list on the challenge page. 72: a profile on phones.
  size?: 22 | 36 | 40 | 52 | 72 | 96;
  className?: string;
}) {
  const box = { width: size, height: size };
  if (person.isAgent) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center bg-ink font-bold text-bg",
          className,
        )}
        style={{
          ...box,
          fontSize: Math.round(size * 0.36),
          borderRadius: "28%",
        }}
      >
        AI
      </span>
    );
  }
  if (person.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny, already sized avatars
      <img
        src={person.avatarUrl}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-sans font-bold text-on-accent",
        className,
      )}
      style={{
        ...box,
        fontSize: Math.round(size * 0.36),
        // Pastels are fixed brand values, the same in both themes (HANDOVER §8).
        background: person.avatarFill ?? fillFor(person.id),
      }}
    >
      {initials(person.name)}
    </span>
  );
}
