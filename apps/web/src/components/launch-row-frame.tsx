import { cn } from "@/lib/utils";
import { ProjectThumbnail } from "./project-thumbnail";

/**
 * LaunchRow's layout, without data fetching or translations, so the launch
 * form's live preview (a client component) draws the same row. `compact`
 * keeps the phone sizes at every width (the preview sits in a sidebar).
 */
export function LaunchRowFrame({
  thumbnail,
  title,
  pitch,
  update,
  tags,
  meta,
  vote,
  compact,
}: {
  thumbnail: string | null;
  title: React.ReactNode;
  pitch: React.ReactNode;
  /** The latest update line, for a project in progress. */
  update?: React.ReactNode;
  /** Tags, then the builder and any counts, on one wrapping row. */
  tags: React.ReactNode;
  meta?: React.ReactNode;
  vote: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex items-start gap-3 rounded-lg border border-line bg-surface p-3",
        !compact && "md:gap-4 md:p-4",
      )}
    >
      <ProjectThumbnail
        src={thumbnail}
        className={cn(
          "size-16 shrink-0 rounded-[8px]",
          !compact && "md:h-[88px] md:w-32",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h3
            className={cn(
              "text-lg font-bold leading-[1.25] tracking-[-0.01em]",
              !compact && "md:text-xl",
            )}
          >
            {title}
          </h3>
          <p
            className={cn(
              "text-sm text-muted",
              !compact && "md:text-[15px] md:leading-[22px]",
            )}
          >
            {pitch}
          </p>
          {update && (
            <p className="mt-0.5 text-[13px] leading-5 text-ink">{update}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {tags}
          {meta}
        </div>
      </div>
      {vote}
    </article>
  );
}
