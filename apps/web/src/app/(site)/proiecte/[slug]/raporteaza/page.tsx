import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/container";
import { ReportForm } from "@/components/report-form";
import { core } from "@/server/core";
import { getSession } from "@/server/session";

export async function generateMetadata({
  params,
}: PageProps<"/proiecte/[slug]/raporteaza">): Promise<Metadata> {
  const { slug } = await params;
  const [project, t] = await Promise.all([
    core.projects.bySlug(slug),
    getTranslations("report"),
  ]);
  if (!project) return {};
  return {
    title: t("metaTitle", { name: project.name }),
    robots: { index: false },
  };
}

/**
 * "Raportează o problemă cu acest proiect" (screen 04, M2; no reference
 * design). Signed in only; its owner goes back to the project.
 */
export default async function ReportProjectRoute({
  params,
}: PageProps<"/proiecte/[slug]/raporteaza">) {
  const { slug } = await params;
  const path = `/proiecte/${slug}/raporteaza`;
  const session = await getSession();
  if (!session) redirect(`/intra?next=${encodeURIComponent(path)}`);
  // Without the viewer: a hidden project can't be reported, not even by its owner.
  const project = await core.projects.bySlug(slug);
  if (!project) notFound();
  if (project.owner.id === session.user.id) redirect(`/proiecte/${slug}`);
  const t = await getTranslations("report");

  return (
    <Container>
      <div className="flex justify-center pb-10 pt-4 md:pb-24 md:pt-10">
        <div className="flex w-full max-w-[560px] flex-col">
          <Link
            href={`/proiecte/${slug}`}
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-semibold"
          >
            <ArrowLeft size={18} strokeWidth={2.2} aria-hidden />
            {t("back")}
          </Link>
          <section className="mt-2 flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 md:p-8">
            <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[36px]">
              {t("title")}
            </h1>
            <p className="text-muted">
              {t("lead", { name: project.name, owner: project.owner.name })}
            </p>
            <ReportForm projectId={project.id} slug={project.slug} />
          </section>
        </div>
      </div>
    </Container>
  );
}
