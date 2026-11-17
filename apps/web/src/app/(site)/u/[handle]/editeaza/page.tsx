import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/container";
import { ProfileForm } from "@/components/profile-form";
import { toProfileFields } from "@/lib/schemas/profile";
import { core } from "@/server/core";
import { getSession } from "@/server/session";
import { uploadVia } from "@/server/storage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile.form");
  return { title: t("metaTitle"), robots: { index: false } };
}

/**
 * "Editează profilul" (HANDOVER §6 05; no reference design): the owner's own
 * profile, prefilled. Signed out → sign-in; someone else's → that profile.
 */
export default async function EditProfileRoute({
  params,
}: PageProps<"/u/[handle]/editeaza">) {
  const { handle } = await params;
  const path = `/u/${handle}/editeaza`;
  const session = await getSession();
  if (!session) redirect(`/intra?next=${encodeURIComponent(path)}`);
  const result = await core.profiles.editable(handle, session.user.id);
  if (!result.ok) {
    if (result.reason === "not_found") notFound();
    if (result.reason === "not_onboarded") {
      redirect(`/bun-venit?next=${encodeURIComponent(path)}`);
    }
    // Someone else's: their profile, which anyone can see.
    redirect(`/u/${handle}`);
  }
  const profile = result.value;
  const t = await getTranslations("profile.form");

  return (
    <Container>
      <div className="flex justify-center pb-10 pt-4 md:pb-24 md:pt-10">
        <div className="flex w-full max-w-[560px] flex-col">
          <Link
            href={`/u/${profile.handle}`}
            className="inline-flex min-h-11 items-center self-start text-[15px] font-semibold"
          >
            {t("back")}
          </Link>
          <section className="mt-2 flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 md:p-8">
            <h1 className="text-[30px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[36px]">
              {t("title")}
            </h1>
            <p className="text-muted">{t("lead")}</p>
            <ProfileForm
              uploadVia={uploadVia}
              person={{ id: profile.id, avatarFill: profile.avatarFill }}
              handle={profile.handle}
              defaults={toProfileFields(profile.input)}
            />
          </section>
        </div>
      </div>
    </Container>
  );
}
