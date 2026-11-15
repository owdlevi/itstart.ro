import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/container";

/** The frame around the challenge form: back link, title, lead, then the page. */
export async function FormPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin.form");
  return (
    <Container className="max-w-[760px] pt-6 md:pt-10">
      <Link
        href="/admin/provocari"
        className="inline-flex min-h-11 items-center text-[15px] font-semibold"
      >
        {t("back")}
      </Link>
      <h1 className="mt-2 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[40px]">
        {title}
      </h1>
      <p className="mt-2 text-muted">{lead}</p>
      <div className="mt-6">{children}</div>
    </Container>
  );
}
