import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** The full shell: header, page, footer. */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="continut" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
