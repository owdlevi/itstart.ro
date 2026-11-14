import { SiteFooter } from "@/components/site-footer";
import { BareHeader } from "@/components/site-header";

/** Sign-in and onboarding: the wordmark alone in the header (HANDOVER §6). */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <BareHeader />
      <main id="continut" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
