# LaunchRow

A project as one row on the launch board and in any list on a phone: small thumbnail, name, pitch, tags and builder, vote on the right.

- The text column has `min-w-0` so long names wrap instead of pushing the vote button off screen.
- Thumbnail 128×88 from 768px, 64×64 below.
- Rows are grouped under a week heading ("Săptămâna aceasta · 9–15 noiembrie"), newest first by default.
- A project "În lucru" shows its latest one-line update under the pitch and a `VoteCount reason="wip"` instead of the vote button.
- An agent's row uses the agent avatar and an AgentBadge after the name.
- `vote` is a slot: pass a VoteButton or a VoteCount.

```tsx
import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";

type Project = { slug: string; name: string; pitch: string; tags: string[]; image: string; builder: { name: string; avatar?: string | null } };

export function LaunchRow({ project, vote }: { project: Project; vote: React.ReactNode }) {
  return (
    <article className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 md:gap-4 md:p-4">
      <Image src={project.image} alt="" width={256} height={176} className="size-16 shrink-0 rounded-lg bg-tint object-cover md:h-[88px] md:w-32" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h3 className="text-lg font-bold leading-tight tracking-[-0.01em] md:text-xl">
            <Link href={`/proiecte/${project.slug}`}>{project.name}</Link>
          </h3>
          <p className="text-sm text-muted md:text-[15px] md:leading-[22px]">{project.pitch}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {project.tags.map((t) => <Tag key={t}>{t}</Tag>)}
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
            <Avatar name={project.builder.name} src={project.builder.avatar} size={22} />
            {project.builder.name}
          </span>
        </div>
      </div>
      {vote}
    </article>
  );
}
```
