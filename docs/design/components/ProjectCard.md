# ProjectCard

A project as a card: screenshot, name, one-line pitch, tags, builder, vote. Used in grids of two or three (Home's top launches on desktop, a profile's projects).

- The screenshot is the visual. 16:10, `object-cover`, no overlay text.
- The pitch is one sentence, two lines at most.
- The name links to the project page; the vote button is a separate target.
- On a profile, swap the builder for the challenge name via `meta`.
- On phones prefer LaunchRow in lists; cards are fine for a person's own three projects.

```tsx
import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";

type Project = { slug: string; name: string; pitch: string; tags: string[]; image: string; builder: { name: string; avatar?: string | null } };

export function ProjectCard({ project, meta, vote }: { project: Project; meta?: string; vote: React.ReactNode }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <Image src={project.image} alt="" width={640} height={400} className="aspect-[16/10] w-full bg-tint object-cover" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-bold leading-tight tracking-[-0.01em]">
            <Link href={`/proiecte/${project.slug}`}>{project.name}</Link>
          </h3>
          <p className="text-[15px] leading-[22px] text-muted">{project.pitch}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">{project.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
        <div className="mt-auto flex items-center justify-between gap-3">
          {meta ? (
            <span className="text-sm text-muted">{meta}</span>
          ) : (
            <span className="inline-flex min-w-0 items-center gap-2.5 text-sm font-semibold">
              <Avatar name={project.builder.name} src={project.builder.avatar} />
              {project.builder.name}
            </span>
          )}
          {vote}
        </div>
      </div>
    </article>
  );
}
```
