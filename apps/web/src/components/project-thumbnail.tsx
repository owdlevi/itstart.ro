import { cn } from "@/lib/utils";

/**
 * A project's first screenshot, decorative because the name is next to it
 * (HANDOVER §10). Until one is uploaded: a flat `tint` block (§9.1).
 */
export function ProjectThumbnail({
  src,
  className,
}: {
  src: string | null;
  className?: string;
}) {
  if (!src) return <div aria-hidden className={cn("bg-tint", className)} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Blob serves resized webp already
    <img src={src} alt="" className={cn("bg-tint object-cover", className)} />
  );
}
